import { FEATURE_KEYS, PREVIEW_PARAM } from "@/lib/onboarding/types"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { z } from "zod"

/**
 * Onboarding de novidades — grava o "visto" (story
 * `docs/stories/feat-onboarding-novidades-lancamento.md`).
 *
 * SCHEMA: `supabase/migrations/20260803000000_onboarding_novidades.sql`.
 * `product_announcement_views` é chaveada por `(user_id, feature_key)`, com
 * `state` (não `view_state`), `version` FORA da chave e SEM `tenant_id` — cada
 * uma dessas omissões tem a prova medida em §1.3 da story. Este handler fala
 * com esse schema, não com o DDL rascunhado no contrato de arquitetura.
 *
 * Invariantes de segurança, no mesmo espírito de
 * `chapter-view-progress/route.ts`:
 *  - O anúncio precisa existir e estar VISÍVEL para este usuário sob a mesma
 *    RLS (`pa_select_eligible`) que `resolveOnboarding()` usa — não há
 *    caminho para gravar "visto" de algo que a pessoa nunca teve o direito de
 *    ver.
 *  - NENHUM service client. Escrita do próprio usuário sobre o próprio dado;
 *    a RLS (`pav_insert_own`/`pav_update_own`, `user_id = auth.uid()`) precisa
 *    valer integralmente.
 *
 * Regras de supressão (story §Fase 3):
 *  - "Ver como aluno" (cookie `x-view-as-student`) e o modo demonstração
 *    (`PREVIEW_PARAM`) NUNCA gravam linha, mesmo que o front chame esta rota
 *    por engano. Defesa em profundidade: `resolveOnboarding()` já nem monta
 *    a UI que dispararia esta chamada nesses dois modos.
 *  - Nunca regride de estado TERMINAL para não-terminal por acidente — um
 *    reenvio tardio de `last_step` depois de completed/seen/skipped
 *    ressuscitaria o modal ou o tour para quem já resolveu. A ÚNICA exceção é
 *    `rearm: true`, que é a afordância "Ver o guia do construtor" da story
 *    §2.3: ali a pessoa PEDIU para rever, então rearmar é a intenção dela, e
 *    não um efeito colateral de uma requisição atrasada.
 *  - "Duas abas abertas, a que ganha o INSERT exibe, a outra cala": a
 *    PRIMEIRA linha usa `upsert(..., { ignoreDuplicates: true })`, que delega
 *    a corrida para a PK do banco. `recorded: false` na resposta é o sinal
 *    honesto de quem perdeu a corrida.
 */

const TERMINAL_STATES = ["seen", "skipped", "completed"] as const
const WRITABLE_STATES = ["armed", ...TERMINAL_STATES] as const

const bodySchema = z
  .object({
    featureKey: z.enum([FEATURE_KEYS.percorrido, FEATURE_KEYS.jornada, FEATURE_KEYS.tour]),
    /** Opcional: quem já tem o artefato em mãos manda a versão que exibiu;
     *  quem só quer armar/rearmar (a novidade 2 armando o tour, a afordância
     *  §2.3) omite, e o servidor usa a versão vigente no catálogo. Fixar um
     *  `1` literal no cliente apodreceria em silêncio no primeiro bump. */
    version: z.number().int().positive().optional(),
    state: z.enum(WRITABLE_STATES).optional(),
    lastStep: z.number().int().min(0).optional(),
    /** Afordância §2.3: rearma deliberadamente uma linha já terminal. */
    rearm: z.boolean().optional(),
  })
  .refine((v) => v.state !== undefined || v.lastStep !== undefined, {
    message: "informe state ou lastStep",
  })

function isTerminal(state: string | null | undefined): boolean {
  return state != null && (TERMINAL_STATES as readonly string[]).includes(state)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // Defesa em profundidade — story §Fase 3: nenhum dos dois modos grava
  // linha, mesmo que o front erre e chame esta rota mesmo assim.
  const viewingAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  if (viewingAsStudent) return new Response(null, { status: 204 })

  const url = new URL(request.url)
  if (url.searchParams.has(PREVIEW_PARAM)) return new Response(null, { status: 204 })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return new Response("Invalid body", { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return new Response("Invalid request", { status: 400 })
  const { featureKey, state, lastStep, rearm } = parsed.data

  // O anúncio precisa existir e estar visível PARA ESTE usuário — a mesma
  // RLS que `resolveOnboarding()` usa também governa esta leitura.
  const { data: announcementRows, error: announcementError } = await supabase
    .from("product_announcements")
    .select("feature_key, version")
    .eq("feature_key", featureKey)
    .limit(1)

  if (announcementError) return new Response("Write failed", { status: 500 })
  const announcement = announcementRows?.[0] as { version?: number | null } | undefined
  if (!announcement) return new Response("Not found", { status: 404 })
  const version = parsed.data.version ?? announcement.version ?? 1

  const { data: existingRows, error: existingError } = await supabase
    .from("product_announcement_views")
    .select("state, version")
    .eq("feature_key", featureKey)
    .eq("user_id", user.id)
    .limit(1)

  if (existingError) return new Response("Write failed", { status: 500 })
  const existing = existingRows?.[0] as { state?: string | null; version?: number | null } | undefined

  // Terminal na versão ATUAL (ou mais nova) bloqueia — a menos que a pessoa
  // tenha pedido para rever. Uma view de versão anterior nunca bloqueia: é
  // assim que o bump de versão reabre o artefato (story §Fase 2, "Reabre com").
  const existingIsCurrent = (existing?.version ?? 0) >= version
  if (existing && existingIsCurrent && isTerminal(existing.state) && !rearm) {
    return json({ recorded: false })
  }

  const payload = {
    user_id: user.id,
    feature_key: featureKey,
    version,
    state: state ?? "armed",
    // Rearmar zera o passo: quem pediu para rever o guia quer o guia, não o
    // resto dele a partir de onde desistiu há três meses.
    ...(rearm ? { last_step: null } : lastStep !== undefined ? { last_step: lastStep } : {}),
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    // Linha já existe — atualização normal, sem disputa de corrida: é a mesma
    // pessoa avançando passos do próprio tour (ou rearmando de propósito).
    const { error } = await supabase
      .from("product_announcement_views")
      .update(payload)
      .eq("feature_key", featureKey)
      .eq("user_id", user.id)
    if (error) return new Response("Write failed", { status: 500 })
    return json({ recorded: true })
  }

  // Primeira linha: quem ganha o INSERT exibe, a outra cala.
  const { data: inserted, error: insertError } = await supabase
    .from("product_announcement_views")
    .upsert(payload, { onConflict: "user_id,feature_key", ignoreDuplicates: true })
    .select()

  if (insertError) return new Response("Write failed", { status: 500 })

  return json({ recorded: (inserted?.length ?? 0) > 0 })
}
