import {
  type Classification,
  classifyImportRows,
  parseUsersCsv,
} from "@/app/(platform)/admin/users/bulk-import"
import { requireAdmin } from "@/lib/api-auth/require-admin"
import { logAdminAction } from "@/lib/audit"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"
import { inviteTenantUser } from "../invite-user"

/**
 * Import em massa de usuários (CFG-6.1).
 *
 * ## A regra que dá segurança a esta rota
 *
 * Ela tem DOIS modos sobre o MESMO texto: `preview` não escreve nada e devolve a
 * classificação; `apply` **reclassifica do zero** e só cria o que a
 * classificação daquele instante disser. O cliente não manda a lista do que
 * criar — ele manda o mesmo CSV e o NÚMERO que viu na tela. Se o número não
 * bater com o recalculado (alguém convidou a mesma pessoa nesse meio-tempo, o
 * arquivo mudou), a rota devolve 409 e **não cria nada**. É essa checagem que
 * torna impossível a criação silenciosa: nenhuma conta nasce sem ter aparecido
 * antes num número que o admin leu e confirmou.
 *
 * ## Limite conhecido da pré-visualização
 *
 * "Já cadastrado" é verificado DENTRO da empresa do chamador (é o que ele pode
 * ver, e é a pergunta que importa para ele). Um e-mail que já exista em OUTRA
 * empresa da plataforma não aparece na pré-visualização — o Auth recusa a
 * criação na hora do `apply`, e a linha volta em `failed` com a mensagem do
 * Auth. O caso é raro e nunca vira criação errada: vira falha explícita.
 */

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("preview"), csv: z.string() }),
  z.object({ mode: z.literal("apply"), csv: z.string(), expected: z.number().int().min(0) }),
])

interface Actor {
  actorId: string
  tenantId: string
}

type Guarded = { ok: false; response: NextResponse } | ({ ok: true } & Actor)

async function guard(): Promise<Guarded> {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }

  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nenhum tenant ativo. Selecione um tenant antes de importar usuários." },
        { status: 400 },
      ),
    }
  }

  return { ok: true, actorId: profile.id, tenantId }
}

/** E-mails que já existem NA EMPRESA do chamador. Lido sob RLS, de propósito. */
async function existingTenantEmails(tenantId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("users").select("email").eq("tenant_id", tenantId)
  return (data ?? []).map((row) => row.email as string)
}

function classificationPayload(classification: Classification) {
  return {
    counts: classification.counts,
    toCreate: classification.toCreate.map((row) => ({
      line: row.line,
      full_name: row.full_name,
      email: row.email,
      role: row.role,
    })),
    skipped: classification.skipped,
  }
}

export async function POST(request: Request) {
  const guarded = await guard()
  if (!guarded.ok) return guarded.response
  const { actorId, tenantId } = guarded

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }
  const body = parsedBody.data

  const parsed = parseUsersCsv(body.csv)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const classification = classifyImportRows(parsed.rows, await existingTenantEmails(tenantId))

  if (body.mode === "preview") {
    // Nenhuma escrita acontece neste caminho. É a única forma de o admin ver o
    // que vai acontecer ANTES de acontecer.
    return NextResponse.json({ mode: "preview", ...classificationPayload(classification) })
  }

  // --- apply ---------------------------------------------------------------

  if (classification.toCreate.length !== body.expected) {
    // O mundo mudou entre ver e confirmar. Recusa e devolve a foto nova: o admin
    // revê e confirma de novo, em vez de criar um conjunto que ele nunca viu.
    return NextResponse.json(
      {
        error:
          "O resultado mudou desde a pré-visualização. Nada foi criado — revise e confirme novamente.",
        ...classificationPayload(classification),
      },
      { status: 409 },
    )
  }

  if (classification.toCreate.length === 0) {
    return NextResponse.json({ error: "Nada a criar neste arquivo." }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const created: { line: number; email: string; userId: string | null }[] = []
  const failed: { line: number; email: string; message: string }[] = []

  // Sequencial de propósito: um lote em paralelo contra o GoTrue vira 429 no
  // meio do caminho, e aí metade do lote falharia por motivo que não é o dado.
  for (const row of classification.toCreate) {
    const outcome = await inviteTenantUser(serviceClient, tenantId, {
      email: row.email,
      full_name: row.full_name,
      report_name: row.report_name,
      role: row.role,
    })

    if (!outcome.ok) {
      failed.push({
        line: row.line,
        email: row.email,
        message:
          outcome.stage === "profile"
            ? `Convite enviado, mas falha ao criar perfil: ${outcome.message}`
            : outcome.message,
      })
      continue
    }

    created.push({ line: row.line, email: row.email, userId: outcome.userId })
    if (outcome.userId) {
      await logAdminAction({
        actorId,
        tenantId,
        action: "user.invited",
        targetType: "user",
        targetId: outcome.userId,
        details: { email: row.email, role: row.role, source: "bulk_import" },
      })
    }
  }

  return NextResponse.json({
    mode: "apply",
    created,
    failed,
    counts: {
      ...classification.counts,
      created: created.length,
      failed: failed.length,
    },
    skipped: classification.skipped,
  })
}
