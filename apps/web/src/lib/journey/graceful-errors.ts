// ---------------------------------------------------------------------------
// EPIC-JORNADA — degradação graciosa da camada de dados da Jornada.
//
// Um erro de INFRAESTRUTURA (tabela fora do schema cache do PostgREST, relation
// inexistente, coluna ausente, conexão, negação de RLS) NUNCA deve vazar sua
// mensagem crua para a UI: ele é logado no servidor (diagnosticável) e a UI
// recebe estado/mensagem segura. Erros de DOMÍNIO/validação (durações inválidas,
// matrícula não encontrada) continuam legíveis para o usuário e NÃO passam
// por aqui — são resolvidos antes de qualquer escrita.
//
// Motivação: o erro "Could not find the table 'public.study_plans' in the schema
// cache" (PGRST205) chegou à tela do usuário via `saveJourneyPlan` retornando
// `error.message` cru. Este módulo fecha o vazamento e o mantém fechado por
// regressão futura (qualquer erro de infra na camada degrada, mesmo com a tabela
// já existente).
// ---------------------------------------------------------------------------

/** Códigos que denotam erro de infraestrutura/esquema, não de domínio. */
const INFRA_CODES = new Set([
  "PGRST205", // PostgREST: tabela não encontrada no schema cache (erro do Hugo)
  "PGRST204", // coluna não encontrada no schema cache
  "PGRST202", // função (RPC) não encontrada no schema cache
  "PGRST301", // problema de auth/role em nível de infra
  "42P01", // undefined_table
  "42703", // undefined_column
  "42883", // undefined_function
  "42501", // insufficient_privilege (negação de RLS / grant)
])

type MaybePgError = { code?: unknown; message?: unknown; details?: unknown }

/** Classifica um erro (supabase-js/PostgREST/Postgres) como infraestrutura. */
export function isInfrastructureError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as MaybePgError
  const code = typeof e.code === "string" ? e.code : ""
  if (INFRA_CODES.has(code)) return true
  if (code.startsWith("08")) return true // connection_exception (Postgres classe 08)
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : ""
  return (
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("row-level security")
  )
}

/** Loga o erro real no servidor (jamais na UI), com escopo para diagnóstico. */
export function logInfraError(scope: string, error: unknown): void {
  const e = (error ?? {}) as MaybePgError
  const code = typeof e.code === "string" ? e.code : undefined
  const message = typeof e.message === "string" ? e.message : String(error)
  console.error(`[jornada:${scope}] infra error${code ? ` (${code})` : ""}: ${message}`)
}

/** Mensagem segura para a UI quando a persistência da jornada falha por infra. */
export const SAFE_JOURNEY_SAVE_ERROR =
  "Não foi possível salvar sua jornada agora. Tente novamente em instantes."
