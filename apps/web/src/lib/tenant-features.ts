// ---------------------------------------------------------------------------
// Kill switch server-side para features atrás de `tenants.settings` JSONB.
//
// O padrão já existia, duplicado dentro de `manager-dashboard-page.tsx:681`
// (`isFeatureEnabled`, FIX-15, usado ali só para `ai_detection`). Este módulo
// extrai a mesma checagem para reuso — não a reinventa (story
// `docs/stories/feat-onboarding-novidades-lancamento.md` §Fase 4, "Sua peça",
// item 4) — e adiciona a busca no banco que faltava para quem ainda não tem
// `tenants.settings` em mãos.
//
// Server-side é OBRIGATÓRIO aqui: uma flag lida do bundle do cliente não se
// mata. Neste repo "deploy" é rebuild manual no EasyPanel + humano
// disponível (branch `deploy/cory`, sem CI em push) — não é mitigação.
// Desligar uma feature precisa valer no PRÓXIMO request, via um UPDATE em
// `tenants.settings` no Supabase Studio, sem deploy nenhum.
// ---------------------------------------------------------------------------

/**
 * Formato mínimo exigido do client — a mesma superfície que
 * `@supabase/supabase-js` expõe para esta única query, e nada além disso.
 * Manter este módulo desacoplado de um tipo de client concreto é o que
 * permite testá-lo com um stub de poucas linhas (ver `__tests__/`).
 */
export interface TenantSettingsClient {
  from: (table: string) => {
    // biome-ignore lint/suspicious/noExplicitAny: ver a nota abaixo — o client real de supabase-js infere o retorno a partir do schema tipado, e amarrar a forma exata aqui reintroduz a instanciação recursiva que este `any` existe para cortar.
    select: (columns: string) => any
  }
}
// NOTA sobre o `any` acima, que é deliberado e não preguiça: o client real
// (`SupabaseClient` genérico) resolve `.select().eq().maybeSingle()` por
// inferência sobre o schema inteiro, e declarar a cadeia com tipos concretos
// aqui fazia o `tsc` estourar com "Type instantiation is excessively deep"
// (TS2589) no ponto de chamada, além de reclamar que `PostgrestBuilder` não é
// um `Promise` (é apenas thenable). O contrato que importa continua tipado
// onde importa: o RETORNO de `isTenantFeatureEnabled` é `boolean`, e o
// `isFeatureEnabled` puro valida o formato de `settings` em runtime — nenhum
// dado não verificado escapa daqui.

/**
 * Checagem pura sobre `settings` já carregado — mesma forma exata do helper
 * original de `manager-dashboard-page.tsx:681`. Existe separada de
 * `isTenantFeatureEnabled` para quem já tem a tenant em mãos (ex.:
 * `getAuthProfile()`, que embute `tenants(settings)` na mesma query) não
 * pagar uma segunda ida ao banco só para reler o que já foi buscado.
 *
 * SEM DEFAULT implícito de "ligado": ausência de `settings`, de
 * `settings.features`, ou da chave específica dá `false` — a mesma direção
 * seguida no resto do onboarding (dado ausente nunca liga uma feature).
 */
export function isFeatureEnabled(settings: unknown, feature: string): boolean {
  if (!settings || typeof settings !== "object") return false
  const s = settings as Record<string, unknown>
  if (!s.features || typeof s.features !== "object") return false
  const features = s.features as Record<string, unknown>
  return features[feature] === true
}

function logTenantFeatureError(feature: string, error: unknown): void {
  const e = (error ?? {}) as { code?: unknown; message?: unknown }
  const code = typeof e.code === "string" ? e.code : undefined
  const message = typeof e.message === "string" ? e.message : String(error)
  console.error(
    `[tenant-features:${feature}] erro ao ler tenants.settings${code ? ` (${code})` : ""}: ${message}`,
  )
}

/**
 * Busca `tenants.settings` no servidor e aplica `isFeatureEnabled`.
 *
 * Fail-safe SEMPRE na direção de OFF: tenant inexistente, coluna ausente,
 * RLS negando, ou qualquer outro erro de leitura resultam em `false`, nunca
 * em exceção lançada. Dado ruim aqui derruba uma feature opcional — nunca
 * quebra a tela que a chama. Mesma direção de falha seguida em
 * `lib/onboarding/resolve.ts`.
 */
export async function isTenantFeatureEnabled(
  supabase: TenantSettingsClient,
  tenantId: string,
  feature: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .maybeSingle()

    if (error) {
      logTenantFeatureError(feature, error)
      return false
    }

    return isFeatureEnabled(data?.settings, feature)
  } catch (e) {
    logTenantFeatureError(feature, e)
    return false
  }
}
