import { requireAdmin } from "@/lib/api-auth"
import { resolveTenantId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// =============================================================================
// CONTEXTO COMUM DAS ROTAS DE DEPARTAMENTO (CFG-7.1)
// =============================================================================
// Três coisas que TODA rota desta frente precisa fazer igual, e que erradas
// produzem exatamente o defeito do AC0.1:
//   1. Gate admin pelos chapéus reais (`requireAdmin`, nunca a coluna singular).
//   2. Empresa resolvida por `resolveTenantId` — o super_admin (tenant NULL)
//      opera a empresa escolhida no seletor, não "nenhuma".
//   3. Client de escrita: perfil sem tenant próprio escreve pelo service client,
//      mesmo critério que o loader já usa para ler. Sem isso, o super_admin
//      escreveria sob policies pensadas para admin de empresa e algumas escritas
//      falhariam em silêncio.
// =============================================================================

// biome-ignore lint/suspicious/noExplicitAny: ponte estrutural entre os dois clients supabase
type AnyDbClient = { from: (table: string) => any }

export type DepartmentContext =
  | { ok: false; response: NextResponse }
  | {
      ok: true
      userId: string
      tenantId: string
      /** Client de LEITURA/ESCRITA já escolhido conforme o perfil. */
      client: AnyDbClient
    }

export async function requireDepartmentContext(): Promise<DepartmentContext> {
  const supabase = await createClient()
  const { user, profile, recusa } = await requireAdmin(supabase)
  // `recusa` já traz o desfecho certo dos TRÊS casos — inclusive o 503 de leitura
  // indisponível, que antes chegava aqui indistinguível de "não é admin" e virava
  // 403 para as três rotas de departamento.
  if (recusa) return { ok: false, response: recusa }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nenhuma empresa selecionada" }, { status: 400 }),
    }
  }

  let client: AnyDbClient = supabase as AnyDbClient
  if (!profile.tenant_id) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    client = createServiceClient() as AnyDbClient
  }

  return { ok: true, userId: user.id, tenantId, client }
}

/** Unidades (`areas`) da empresa — as colunas do Mapa, sempre escopadas. */
export async function fetchUnidades(client: AnyDbClient, tenantId: string) {
  const { data } = await client
    .from("areas")
    .select("id, name, slug, description")
    .eq("tenant_id", tenantId)
    .order("name")

  return (data ?? []) as { id: string; name: string; slug: string; description: string | null }[]
}
