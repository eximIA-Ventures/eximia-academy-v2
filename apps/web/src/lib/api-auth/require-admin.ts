import type { ProfileCheckUnavailableBody } from "@/lib/api-role-guard"
import { hasAnyRole } from "@/lib/role-helpers"
import type { createClient } from "@/lib/supabase/server"
import type { Role } from "@eximia/shared"
import { NextResponse } from "next/server"

// =============================================================================
// Guard de ROTA DE API por CHAPÉUS REAIS (`user_roles`), nunca pela coluna
// singular `users.role`.
//
// Correção de auditoria (rodada 3). `api/admin/audit-log/route.ts` foi criada
// nesta frente e é a ÚNICA fonte de dados de `/admin/audit`, cuja PÁGINA já
// decidia por chapéus (`canOpenAdminRoute`). Os dois lados da mesma tela,
// escritos na mesma rodada, estavam em eixos opostos: a página abria pelo chapéu
// e a rota que a alimenta decidia pela coluna singular.
//
// Regra dura 3 da doutrina de workspaces: gate de papel usa `hasAnyRole`/`hasRole`
// sobre a união de chapéus. Aqui o conjunto permitido de cada função é
// TRANSCRIÇÃO 1:1 do que existia (`["admin","super_admin"]` e
// `["admin","manager","super_admin"]`); só o EIXO mudou.
//
// Por que é seguro (W4 — nenhum acesso que existe hoje pode ser perdido):
//   1. Fato de produção verificado: existem 3 usuários admin-tier e `user_roles`
//      tem exatamente as 3 linhas correspondentes. Os dois eixos CONCORDAM hoje.
//   2. `recompute_primary_role` mantém `users.role` derivado dos chapéus.
//   3. Fallback defensivo abaixo: perfil SEM nenhuma linha em `user_roles` cai
//      em `[profile.role]`, exatamente como `getAuthProfile` (`lib/auth.ts:47`).
//      Assim nem uma linha pré-backfill perde acesso.
//
// FRONTEIRA DECLARADA: esta rodada migrou só o que ESTA FRENTE é dona — este
// módulo (do qual `api/admin/audit-log` depende) e as 2 server actions de
// configurações que a frente tocou (`admin/settings/actions.ts` e
// `whitelabel-actions.ts`). A lista completa do que continua no eixo singular,
// com arquivo e motivo, está em `lib/admin-route-access.ts` (§FRONTEIRA DO EIXO).
// Fronteira declarada é aceitável; fronteira escondida não é.
// =============================================================================

/**
 * Colunas + embed dos chapéus. String literal ÚNICA de propósito: supabase-js só
 * infere o tipo do select sobre literais (mesma armadilha documentada em
 * `lib/auth.ts:30-33` — string concatenada colapsa para `GenericStringError` e
 * quebra o `next build`). O embed aponta a FK `user_id` porque `user_roles` tem
 * duas FKs para `users` (`user_id` e `granted_by`).
 */
const ACTOR_SELECT = "id, role, tenant_id, user_roles!user_roles_user_id_fkey(role)"

interface ActorProfile {
  id: string
  role: string
  tenant_id: string | null
}

// =============================================================================
// TERCEIRO ESTADO: "não deu para verificar" (auditoria, rodada FIX-B6)
// =============================================================================
// Até aqui este helper tinha DOIS desfechos — tem perfil / não tem — e as vinte
// rotas que dependem dele traduziam "não tem" em 403. Uma leitura de perfil que
// FALHOU (timeout de statement, conexão derrubada) caía no mesmo balde: o admin
// legítimo lia "Permissão negada" por causa de um soluço do banco.
//
// É o MESMO defeito que `lib/api-role-guard.ts` já corrigiu em 47 rotas. Ficou
// invisível a três censos porque este arquivo escreve `const { data }` onde o
// helper irmão escreve `const { data: profile }` — as varreduras procuravam a
// grafia, não o gesto.
//
// O contrato aqui é DELIBERADAMENTE o mesmo de `api-role-guard`, até o corpo e o
// header do 503 (o tipo `ProfileCheckUnavailableBody` é importado de lá, não
// recopiado): dois dialetos para o mesmo julgamento seriam trocar um defeito
// uniforme por defeitos divergentes, que é pior de auditar.
//
//   • 401 — não há sessão.
//   • 403 — a leitura funcionou e a resposta é "não": não há perfil, ou o chapéu
//     não está no conjunto permitido. Permanente até alguém mudar o cadastro.
//   • 503 + `Retry-After` — a leitura FALHOU. Não sabemos se tem direito.
//     Transitório por definição, e retentável.
//
// Os corpos de 401/403 são TRANSCRIÇÃO LITERAL do que as vinte rotas já
// devolviam (`Unauthorized` / `Forbidden`), para que nenhuma resposta que existe
// hoje mude de forma por causa desta correção.
// =============================================================================

/**
 * Código do PostgREST para "zero (ou mais de uma) linha" num `.single()`. Único
 * `error` que NÃO é indisponibilidade: a leitura aconteceu e o veredito é "não há
 * perfil". Tratá-lo como 503 esconderia um usuário órfão atrás de um "tente de
 * novo" que jamais resolveria. Mesma constante de `lib/api-role-guard.ts`.
 */
const ZERO_LINHAS = "PGRST116"

type ClienteServidor = Awaited<ReturnType<typeof createClient>>
type UsuarioAutenticado = NonNullable<
  Awaited<ReturnType<ClienteServidor["auth"]["getUser"]>>["data"]["user"]
>

/**
 * Exatamente um dos dois lados vem preenchido. O chamador faz
 * `if (recusa) return recusa` e segue com `user`/`profile` já estreitados —
 * uma linha no lugar das duas de antes, e sem terceiro estado para esquecer.
 */
export type ResultadoDoGuardDeAdmin =
  | { user: UsuarioAutenticado; profile: ActorProfile; recusa: null }
  | { user: UsuarioAutenticado | null; profile: null; recusa: NextResponse }

const semSessao = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
const semPermissao = () => NextResponse.json({ error: "Forbidden" }, { status: 403 })

/**
 * `Retry-After` porque isto passa. O 403 irmão não tem header nenhum, e essa
 * assimetria é o sinal de que os dois casos são diferentes.
 */
function leituraIndisponivel(userId: string, erro: unknown): NextResponse {
  console.error(`[require-admin] leitura de perfil indisponivel para ${userId}:`, erro)
  const body: ProfileCheckUnavailableBody = { error: "profile_check_unavailable" }
  return NextResponse.json(body, { status: 503, headers: { "Retry-After": "5" } })
}

/** Como a leitura de `users` terminou — o que separa "não tem" de "não deu". */
type EstadoDaLeitura = "ok" | "sem_perfil" | "indisponivel"

/**
 * Carrega o ator e a UNIÃO DE CHAPÉUS dele numa única query.
 *
 * Devolve o perfil NARROWED para `{ id, role, tenant_id }` — exatamente a forma
 * pública que os chamadores sempre consumiram (`profile.tenant_id`), sem vazar o
 * embed para dentro deles.
 */
async function loadActor(supabase: ClienteServidor): Promise<{
  user: UsuarioAutenticado | null
  profile: ActorProfile | null
  hats: string[]
  leitura: EstadoDaLeitura
  erro: unknown
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, hats: [], leitura: "sem_perfil", erro: null }

  const { data, error } = await supabase
    .from("users")
    .select(ACTOR_SELECT)
    .eq("id", user.id)
    .single()

  // A checagem que faltava. Qualquer erro que não seja "zero linhas" é uma
  // leitura que não aconteceu — e uma leitura que não aconteceu não autoriza
  // ninguém a dizer "você não tem permissão".
  if (error && error.code !== ZERO_LINHAS) {
    return { user, profile: null, hats: [], leitura: "indisponivel", erro: error }
  }

  if (!data) return { user, profile: null, hats: [], leitura: "sem_perfil", erro: null }

  const row = data as unknown as ActorProfile & { user_roles?: { role: string }[] }
  const hats = (row.user_roles ?? []).map((r) => r.role)
  // Fallback defensivo pré-backfill, idêntico a `getAuthProfile`: sem nenhum
  // chapéu registrado, a coluna singular ainda vale como chapéu único.
  const effectiveHats = hats.length > 0 ? hats : row.role ? [row.role] : []

  const profile: ActorProfile = { id: row.id, role: row.role, tenant_id: row.tenant_id }
  return { user, profile, hats: effectiveHats, leitura: "ok", erro: null }
}

/** O julgamento comum às duas funções públicas; só o conjunto de chapéus muda. */
async function exigirChapeu(
  supabase: ClienteServidor,
  permitidos: Role[],
): Promise<ResultadoDoGuardDeAdmin> {
  const { user, profile, hats, leitura, erro } = await loadActor(supabase)

  if (!user) return { user: null, profile: null, recusa: semSessao() }

  if (leitura === "indisponivel") {
    return { user, profile: null, recusa: leituraIndisponivel(user.id, erro) }
  }

  if (!profile || !hasAnyRole({ roles: hats }, permitidos)) {
    return { user, profile: null, recusa: semPermissao() }
  }

  return { user, profile, recusa: null }
}

/** Conjunto INALTERADO: admin-tier. Só o eixo mudou (singular -> chapéus). */
const ADMIN_HATS: Role[] = ["admin", "super_admin"]
/** Conjunto INALTERADO: admin-tier + gestor. Só o eixo mudou. */
const ADMIN_OR_MANAGER_HATS: Role[] = ["admin", "manager", "super_admin"]

export function requireAdmin(supabase: ClienteServidor): Promise<ResultadoDoGuardDeAdmin> {
  return exigirChapeu(supabase, ADMIN_HATS)
}

export function requireAdminOrManager(supabase: ClienteServidor): Promise<ResultadoDoGuardDeAdmin> {
  return exigirChapeu(supabase, ADMIN_OR_MANAGER_HATS)
}
