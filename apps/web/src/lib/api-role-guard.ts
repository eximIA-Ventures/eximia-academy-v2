import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// requireRole — guard de papel para rotas de API
// ---------------------------------------------------------------------------
// Irmão declarado do `requireFeature` (`lib/feature-gate.ts`): mesma forma de
// recusa em dois desfechos que NUNCA se confundem.
//
//   • 403 — a leitura funcionou e a resposta é "não". Papel insuficiente, ou
//     nenhum perfil para esta pessoa. Permanente até alguém mudar o cadastro.
//   • 503 + `Retry-After` — a leitura FALHOU. Não sabemos se tem direito. É
//     transitório por definição, e retentável.
//
// Existe porque oito rotas escreviam a mesma leitura sem checar `error` e
// despachavam 403 para as duas situações (laudo LOOP-0c, tabela E→NEGA). Um
// gestor legítimo, num timeout de statement, lia "Permissão negada". Oito cópias
// do mesmo julgamento foi como o defeito se espalhou; esta é a única cópia que
// resta.
// ---------------------------------------------------------------------------

/** Corpo do 503. Deliberadamente SEM papel nem tenant: é o que não se conseguiu ler. */
export interface ProfileCheckUnavailableBody {
  error: "profile_check_unavailable"
}

export interface PerfilDeRota {
  role: string
  /**
   * NORMALIZADO PARA `""`, E O TIPO HONESTO SERIA `string | null`. A troca está
   * DIFERIDA, não descartada — e o motivo é sequenciamento, não mérito.
   *
   * `""` nunca é um tenant válido; ele só silencia um erro de tipo. O sinal de
   * que o tipo está errado é o código se defendendo dele: duas rotas escrevem
   * `|| null` contra um campo declarado `string`. Mudar para `string | null`
   * faria o `tsc` ENUMERAR os sítios em vez de alguém grepar — que é o ganho
   * real, prevenção do próximo caso.
   *
   * O que segura a troca: o diff é largo (24 erros de `tsc` em 13 arquivos, um
   * deles `lib/super-admin-auth.ts`) e o `tsc` fica vermelho até o último sítio.
   * Com mais de uma frente escrevendo em helpers de autorização ao mesmo tempo,
   * isso destrói a rede de segurança de todas elas de uma vez. A troca é uma
   * MUDANÇA ATÔMICA ÚNICA, para depois que as frentes fecharem.
   *
   * Por que NÃO é urgente: `users_super_admin_tenant_check`
   * (`20260209000000_epic11_super_admin_whitelabel.sql`, nunca derrubada) exige
   * `role != 'super_admin' → tenant_id IS NOT NULL`. Logo o `""` só chega a
   * existir onde `super_admin` está na lista de papéis. Censo das 15 rotas
   * consumidoras: **1 afetada** (`integrations/keys`, papéis `["admin",
   * "super_admin"]`), já contornada localmente; 14 indiferentes.
   *
   * Ao fazer a troca, o critério de varredura precisa incluir `y !== x` contra
   * um `y` anulável, além de `??`, `=== null`/`!= null` e `?.`. Essa forma
   * carrega travas de isolamento entre tenants e o `tsc` é CEGO a ela (os dois
   * lados seguem comparáveis). Hoje nenhuma rota combina essa forma com
   * `super_admin` na lista, mas o dia em que uma combinar, o compilador não
   * avisa. Detalhe em `docs/auditoria/consolidacao-2026-08-28/FIX-B7-uniao.md` §6.
   *
   * O guard irmão `requireAnyRole` nasceu com `string | null` porque é novo e
   * não tem consumidor legado — a honestidade de tipo lá custa zero.
   */
  tenant_id: string
}

/**
 * Exatamente um dos dois lados vem preenchido. O chamador faz
 * `if (recusa) return recusa` e segue com `profile` já estreitado.
 */
export type ResultadoDoGuard =
  | { profile: PerfilDeRota; recusa: null }
  | { profile: null; recusa: NextResponse }

/**
 * Código do PostgREST para "zero (ou mais de uma) linha" num `.single()`.
 * Este é o único `error` que NÃO significa indisponibilidade: a leitura
 * aconteceu e o veredito é "não há perfil". Tratá-lo como 503 esconderia um
 * usuário órfão atrás de um "tente de novo" que jamais resolveria.
 */
const ZERO_LINHAS = "PGRST116"

/**
 * Forma mínima do cliente que este guard usa. `from` devolve `any` de propósito,
 * e não a cadeia tipada: descrever o encadeamento estruturalmente obriga o TS a
 * comparar contra o `PostgrestQueryBuilder`, que é genérico em profundidade
 * suficiente para estourar o orçamento de instanciação (`TS2589`) em rotas que
 * já carregam inferência pesada — `ai-fill`, com seu `z.record`, foi a primeira
 * a estourar. O contrato do que se espera de volta não se perde: ele está em
 * `RespostaDePerfil`, aplicado logo abaixo na leitura.
 */
export interface LeitorDePerfil {
  // biome-ignore lint/suspicious/noExplicitAny: ver o comentário acima (TS2589)
  from: (tabela: string) => any
}

/** O que a leitura de `users` precisa devolver para este guard decidir. */
interface RespostaDePerfil {
  data: { role?: string | null; tenant_id?: string | null } | null
  error: { code?: string | null; message?: string } | null
}

export async function requireRole(
  supabase: LeitorDePerfil,
  userId: string,
  papeisPermitidos: readonly string[],
): Promise<ResultadoDoGuard> {
  const { data: profile, error }: RespostaDePerfil = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", userId)
    .single()

  // A checagem que faltava nas oito. Qualquer erro que não seja "zero linhas" é
  // uma leitura que não aconteceu — e uma leitura que não aconteceu não autoriza
  // ninguém a dizer "você não tem permissão".
  if (error && error.code !== ZERO_LINHAS) {
    console.error(`[api-role-guard] leitura de perfil indisponivel para ${userId}:`, error)

    const body: ProfileCheckUnavailableBody = { error: "profile_check_unavailable" }
    // `Retry-After` porque isto passa. O 403 irmão não tem header nenhum, e essa
    // assimetria é o sinal de que os dois casos são diferentes.
    return {
      profile: null,
      recusa: NextResponse.json(body, { status: 503, headers: { "Retry-After": "5" } }),
    }
  }

  if (!profile?.role || !papeisPermitidos.includes(profile.role)) {
    return {
      profile: null,
      recusa: NextResponse.json({ error: "Permissão negada" }, { status: 403 }),
    }
  }

  return {
    profile: { role: profile.role, tenant_id: profile.tenant_id ?? "" },
    recusa: null,
  }
}

/**
 * Os papéis que as rotas do Course Designer (e a listagem de cursos que as serve)
 * aceitam. Era a mesma literal repetida oito vezes; agora é uma só, para que um
 * papel novo entre num lugar em vez de sete.
 */
export const PAPEIS_COURSE_DESIGNER = ["manager", "admin", "super_admin", "instructor"] as const

// ---------------------------------------------------------------------------
// requireAnyRole — o guard irmão, para quem decide pela UNIÃO DE CHAPÉUS
// ---------------------------------------------------------------------------
// Cinco rotas ficaram de fora do `requireRole` acima, e por um bom motivo: elas
// não olham o papel SINGULAR de `users.role`, e sim `user_roles` — a união de
// chapéus (E1/E7). Um gestor que também é aluno tem `users.role = "student"`;
// aplicar o guard singular nele NEGARIA acesso a todo membro multi-chapéu.
// Trocaria um defeito que aparece sob falha transitória por um que apareceria
// SEMPRE.
//
// Este guard traz para cá a única coisa que faltava — a separação entre "não tem
// direito" (403) e "não deu para verificar" (503) — SEM mexer em quem entra. Ele
// reproduz, num lugar só, a mesma leitura e o mesmo cálculo de chapéus que as
// cinco escreviam à mão, incluindo o fallback: quando o join vem vazio (linha
// legada, sem chapéus semeados), vale o papel singular.
//
// DUAS FONTES DE DECISÃO, e a segunda não é um detalhe cosmético.
// `analytics/aggregate` lê `user_roles`, mas o PORTÃO dela sempre foi o papel
// singular; a união entra depois, só para decidir ESCOPO. Migrar o portão dela
// para a união ALARGARIA o acesso em silêncio — um `student` com chapéu de
// `manager` passaria a entrar onde hoje leva 403. Por isso a fonte é explícita
// na chamada, e não uma inferência: a divergência é real e fica registrada onde
// o leitor tropeça nela.
// ---------------------------------------------------------------------------

/**
 * `"uniao_de_chapeus"` — o portão lê `user_roles` (multi-chapéu entra).
 * `"papel_singular"` — o portão lê `users.role`. Só `analytics/aggregate`, e a
 * razão está no bloco acima: é o que ela já fazia, e mudar alargaria o acesso.
 */
export type FonteDaDecisao = "uniao_de_chapeus" | "papel_singular"

export interface PerfilComChapeus {
  /** A coluna singular `users.role`, como está no banco. Pode faltar. */
  role: string | null
  /**
   * A união de chapéus de `user_roles`, com fallback ao papel singular quando o
   * join vem vazio. É esta lista que as rotas repassam adiante — para
   * `resolveCallerStudentScope`, para `hasAnyRole`, para o recorte de escopo.
   *
   * Mutável de propósito: os consumidores a jusante (`hasAnyRole`,
   * `resolveCallerStudentScope`) assinam `string[]`, e marcá-la `readonly` aqui
   * obrigaria a alterar assinaturas compartilhadas de carona — mudança que não
   * pertence a esta correção.
   */
  chapeus: string[]
  /**
   * Deliberadamente `string | null`, e NÃO normalizado para `""` como no
   * `requireRole` acima. `""` é falsy e `null` também, mas os dois se comportam
   * diferente num `??` — e foi exatamente por aí que uma trava de autorização
   * quase foi atravessada em `integrations/keys`. Um guard novo não nasce com
   * essa dívida: aqui vem o que o banco tem, e quem consome decide.
   */
  tenant_id: string | null
  /** Duas das cinco rotas assinam o e-mail com o nome de quem chama. */
  full_name: string | null
}

export type ResultadoDoGuardDeChapeus =
  | { profile: PerfilComChapeus; recusa: null }
  | { profile: null; recusa: NextResponse }

/** O que a leitura de `users` com o join de chapéus devolve. */
interface RespostaDePerfilComChapeus {
  data: {
    role?: string | null
    tenant_id?: string | null
    full_name?: string | null
    user_roles?: { role: string }[] | null
  } | null
  error: { code?: string | null; message?: string } | null
}

export async function requireAnyRole(
  supabase: LeitorDePerfil,
  userId: string,
  papeisPermitidos: readonly string[],
  opcoes: { decidirPor?: FonteDaDecisao } = {},
): Promise<ResultadoDoGuardDeChapeus> {
  const { data: profile, error }: RespostaDePerfilComChapeus = await supabase
    .from("users")
    .select("role, tenant_id, full_name, user_roles!user_roles_user_id_fkey(role)")
    .eq("id", userId)
    .single()

  // Mesma checagem, mesma assimetria do irmão acima: qualquer erro que não seja
  // "zero linhas" é uma leitura que não aconteceu, e uma leitura que não
  // aconteceu não autoriza ninguém a dizer "você não tem permissão".
  if (error && error.code !== ZERO_LINHAS) {
    console.error(`[api-role-guard] leitura de perfil indisponivel para ${userId}:`, error)

    const body: ProfileCheckUnavailableBody = { error: "profile_check_unavailable" }
    return {
      profile: null,
      recusa: NextResponse.json(body, { status: 503, headers: { "Retry-After": "5" } }),
    }
  }

  // O fallback ao singular vale quando o JOIN está vazio — não quando o chapéu
  // é insuficiente. Um perfil com chapéu de `student` decide por `student`,
  // mesmo que a coluna singular diga `admin`: o join, quando existe, SUBSTITUI
  // a coluna, e era assim nas cinco.
  const doJoin = (profile?.user_roles ?? []).map((r) => r.role)
  const chapeus: string[] = doJoin.length > 0 ? doJoin : profile?.role ? [profile.role] : []

  const decidirPor = opcoes.decidirPor ?? "uniao_de_chapeus"
  const permitido =
    decidirPor === "papel_singular"
      ? !!profile?.role && papeisPermitidos.includes(profile.role)
      : chapeus.some((papel) => papeisPermitidos.includes(papel))

  if (!profile || !permitido) {
    return {
      profile: null,
      // A literal de cada rota era "Forbidden", não "Permissão negada" como no
      // irmão singular. O corpo do 403 é contrato de quem consome a API, e um
      // guard novo não é lugar para renomear mensagem de erro de carona.
      recusa: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return {
    profile: {
      role: profile.role ?? null,
      chapeus,
      tenant_id: profile.tenant_id ?? null,
      full_name: profile.full_name ?? null,
    },
    recusa: null,
  }
}

/** Os quatro chapéus que abrem o Engagement Center (cutucada e campanha). */
export const CHAPEUS_DO_ENGAJAMENTO = ["instructor", "manager", "admin", "super_admin"] as const

/**
 * O painel semântico é mais estreito de propósito: perfilamento por aluno
 * (camada Jung, CMA, resumo, evidências) é LGPD-sensível e NÃO admite
 * `manager`/`leader`. É esta lista que `manager` discrimina das demais.
 */
export const CHAPEUS_DO_PERFIL_SEMANTICO = ["instructor", "admin", "super_admin"] as const

/** O agregado é o mais largo: inclui `leader`, que nenhuma das outras aceita. */
export const PAPEIS_DO_AGREGADO = [
  "leader",
  "manager",
  "admin",
  "instructor",
  "super_admin",
] as const
