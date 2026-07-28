// =============================================================================
// Seletor de EMPRESA (TenantSelector) — quem precisa dele
// =============================================================================
//
// Correção de auditoria (rodada 2), FURO 2 — "super_admin e admin global perdem
// o seletor de empresa dentro do mundo admin".
//
// O shell Padrão monta o `TenantSelector`; o shell do mundo admin (novo) não
// montava. Como `/admin/tenants` entrou na allowlist do mundo admin, o
// super_admin que clicava "Empresas" caía no shell administrativo SEM o
// dropdown — e o cookie `x-sa-active-tenant` que ele deixava de poder trocar é
// lido por `admin/users/loader.ts`, `admin-dashboard-page.tsx`,
// `api/admin/audit-log/route.ts`, `api/admin/users/route.ts` e pelas rotas de
// analytics. Ele passava a ver dados de um tenant que não conseguia mudar
// (violação de W4: nenhum acesso que existe hoje pode ser perdido).
//
// A condição abaixo é TRANSCRIÇÃO VERBATIM da que já vivia em
// `(platform)/layout.tsx` (bloco "Multi-tenant selector"), agora com um dono só,
// consumida pelos DOIS shells. Ela é deliberadamente idêntica, não "melhorada":
// mudar o critério do shell Padrão nesta rodada seria alterar comportamento que
// ninguém pediu.
//
// Nota de eixo (regra dura 3): isto NÃO é um gate de papel — não libera nem
// barra nenhuma rota, só decide se um dropdown de UI aparece. Por isso segue no
// `users.role` singular, verbatim. Migrar este critério para chapéus é decisão
// à parte, com o shell Padrão junto, nunca um efeito colateral silencioso desta
// correção.
// =============================================================================

export interface TenantSelectorSubject {
  role: string
  tenant_id: string | null
}

/** True quando o cabeçalho deve montar o seletor de empresa. */
export function needsTenantSelector(profile: TenantSelectorSubject): boolean {
  return profile.role === "super_admin" || (profile.role === "admin" && !profile.tenant_id)
}
