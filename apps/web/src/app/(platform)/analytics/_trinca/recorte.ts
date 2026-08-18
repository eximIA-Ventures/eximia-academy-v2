// ---------------------------------------------------------------------------
// O RECORTE DO GESTOR — uma resolução só, servindo as três abas da trinca.
// ---------------------------------------------------------------------------
// Este arquivo é o corpo que vivia dentro de `_visao-geral/painel.tsx` (gate de
// acesso, tenant, recorte de equipe, lista de cursos, filtro de curso, período),
// movido para cá SEM mudança de comportamento quando "Padrões e tendências" e
// "Mapa da jornada" deixaram o placeholder e passaram a servir tela real.
//
// POR QUE MOVER, e não copiar para as duas abas novas: as três telas respondem
// sobre a MESMA equipe. Duas resoluções de escopo lado a lado produzem duas
// populações — a mesma pessoa entra no recorte numa aba e sai dele na outra, sem
// que ninguém tenha mudado filtro nenhum, e o gestor não tem como perceber. Pior
// ainda no eixo de segurança: uma segunda resolução é um segundo caminho ao lado
// do gate entre times (`auth_subtree_user_ids`), que é literalmente como
// vazamento entre equipes acontece. Aqui existe UM caminho, e ele é o que já
// estava em produção.
//
// O QUE ESTE ARQUIVO NÃO FAZ: não lê métrica nenhuma. Ele resolve QUEM entra na
// conta; QUANTO é trabalho de `lib/analytics/*`. As abas "Visão geral" e
// "Padrões e tendências" leem o banco pela MESMA porta (`lerFonteVisaoGeral`) e
// o "Mapa da jornada" pela porta dele — nenhuma consulta nova nasceu aqui.
//
// SOMENTE LEITURA. Nenhuma escrita, nenhuma migration, nenhuma semente: o
// `.env.local` deste repositório aponta para o Supabase de PRODUÇÃO.
// ---------------------------------------------------------------------------

import type {
  ControlesFiltro,
  CursoFiltravel,
} from "@/components/analytics/visao-geral/filtros-escopo"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import { getTeamViewMode } from "@/lib/team-view-context"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"

/** Os mesmos papéis de `ANALYTICS_ACCESS_ROLES` em `analytics/page.tsx`. */
export const ACESSO: Role[] = ["leader", "manager", "admin", "instructor", "super_admin"]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** PostgREST devolve no máximo 1000 linhas por requisição. */
const PAGINA = 1000
const MAX_PAGINAS = 50

type ClienteServico = ReturnType<typeof createServiceClient>

export interface RecorteDaTrinca {
  /** Client de SERVIÇO: é ele que lê os dados (RLS bloqueia o gestor por desenho). */
  db: ClienteServico
  tenantId: string
  tenantNome: string
  gestorId: string
  gestorNome: string
  gestorPapel: string
  /** Tem o chapéu `manager` E está no contexto `team` (workspace-separation WP5). */
  ehGestorDeTime: boolean
  modo: "direct" | "hierarchy"
  periodoDias: 7 | 30 | 90
  /** `null` = tenant inteiro · `[]` = recorte sem ninguém (fail-closed) · `[ids]`. */
  escopoAlunoIds: string[] | null
  cursoId: string | null
  cursoNome: string | null
  cursos: CursoFiltravel[]
  /** A lista de cursos falhou — a pílula única NÃO é "só existe um curso". */
  falhaCursos: boolean
  /**
   * O filtro de curso não pôde ser aplicado. Quem renderiza PARA: alargar para o
   * tenant inteiro ou colapsar para vazio são as duas formas de mentir aqui,
   * cada uma para um lado.
   */
  erroCurso: string | null
}

export function lerPeriodo(bruto: string | undefined): 7 | 30 | 90 {
  if (bruto === "7") return 7
  if (bruto === "90") return 90
  return 30
}

/**
 * Alunos matriculados num curso. Só serve para NARROW: o resultado é
 * intersectado com o recorte já resolvido, nunca somado a ele.
 *
 * I-4: `error` é lido e INTERROMPE. Devolver a lista parcial de uma consulta que
 * falhou no meio produziria um recorte menor indistinguível de um recorte
 * legítimo — e todo percentual da tela sairia errado para menos, sem aviso.
 */
async function alunosDoCurso(
  db: ClienteServico,
  tenantId: string,
  cursoId: string,
): Promise<{ ids: string[] | null; erro: string | null }> {
  const ids: string[] = []
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * PAGINA
    const { data, error } = await db
      .from("enrollments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("course_id", cursoId)
      .is("deleted_at", null)
      .range(de, de + PAGINA - 1)
    if (error) return { ids: null, erro: error.message }
    const lote = data ?? []
    for (const linha of lote) ids.push(linha.student_id as string)
    if (lote.length < PAGINA) break
  }
  return { ids: [...new Set(ids)], erro: null }
}

/**
 * Resolve tudo que as três abas precisam saber ANTES de ler um número: quem é o
 * gestor, qual tenant, quais alunos ele alcança, qual período e qual curso.
 *
 * Redireciona (login / dashboard) exatamente como a rota já fazia — `redirect()`
 * lança, então o retorno abaixo só existe quando o gate passou.
 */
export async function resolverRecorteDaTrinca(
  params: Record<string, string | undefined>,
): Promise<RecorteDaTrinca> {
  const { user, profile, supabase, roles } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const roleUnion = roles as Role[]
  if (!hasAnyRole({ roles: roleUnion }, ACESSO)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return redirect("/dashboard")

  // MESMA derivação de "está vendo como gestor" que `analytics/page.tsx` usa
  // (workspace-separation WP5): tem o chapéu `manager` E o contexto ativo é
  // `team`. Deriva do contexto RESOLVIDO, não do cookie cru — um gestor no
  // default "Meu Time" não tem cookie explícito.
  const { resolveContext } = await import("@/lib/context-resolver")
  const { active: contextoAtivo } = await resolveContext()
  const ehGestorDeTime = roleUnion.includes("manager") && contextoAtivo.type === "team"

  // O client de SERVIÇO lê os dados (RLS bloqueia o gestor de ler sessões de
  // aluno, por desenho); o client AUTENTICADO resolve o recorte, porque as RPCs
  // de escopo são ancoradas em `auth.uid()`. A divisão é deliberada.
  const db = createServiceClient()

  const periodoDias = lerPeriodo(params.periodo)

  // --- recorte de equipe: URL manda, cookie é o padrão -------------------
  // A URL só ESCOLHE entre dois ramos que já existiam e já são gated; ela não
  // abre um terceiro. Um valor forjado cai no cookie, e o cookie cai em
  // "direct" — sempre para o lado mais estreito.
  const modoCookie = await getTeamViewMode()
  const modoUrl =
    params.escopo === "diretos" ? "direct" : params.escopo === "hierarquia" ? "hierarchy" : null
  const modo: "direct" | "hierarchy" = modoUrl ?? modoCookie

  let escopoAlunoIds: string[] | null
  if (ehGestorDeTime) {
    const { getDirectTeamStudentIds, getManagedTeamStudentIds, getSubtreeStudentIdsAtNode } =
      await import("@/lib/area-context")

    // Drill-down `?focus=`: só vale se o nó estiver DENTRO da subárvore do
    // próprio gestor. Erro de leitura da RPC ⇒ raiz (fail-closed): nunca alarga.
    let focusUserId: string | null = null
    const focusPedido = typeof params.focus === "string" ? params.focus : null
    if (focusPedido && UUID_RE.test(focusPedido)) {
      const { data: subarvore, error } = await supabase.rpc("auth_subtree_user_ids")
      if (error) {
        console.error("[analytics] auth_subtree_user_ids falhou, focus ignorado:", error.message)
      } else if (new Set((subarvore ?? []) as string[]).has(focusPedido)) {
        focusUserId = focusPedido
      }
    }

    escopoAlunoIds =
      modo === "hierarchy"
        ? focusUserId
          ? await getSubtreeStudentIdsAtNode(supabase, tenantId, focusUserId)
          : ((await getManagedTeamStudentIds(supabase, tenantId, user.id, {
              includeSubtree: true,
            })) ?? [])
        : await getDirectTeamStudentIds(supabase, tenantId, focusUserId ?? user.id)
  } else {
    const { getActiveAreaId, getAreaStudentIds } = await import("@/lib/area-context")
    const areaId = (await getActiveAreaId()) ?? params.areaId
    escopoAlunoIds = await getAreaStudentIds(db, tenantId, areaId)
  }

  // --- lista de cursos (chrome do filtro) --------------------------------
  const { data: cursosBrutos, error: erroCursos } = await db
    .from("courses")
    .select("id, title")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("title")
  if (erroCursos) {
    // A falha NÃO derruba a tela: a lista de cursos é chrome, e os números
    // continuam corretos para "Todos os cursos". Mas ela também não é calada —
    // <FiltrosEscopo/> recebe `falhaCursos` e diz o que aconteceu, senão o
    // gestor leria "só existe um recorte possível".
    console.error("[analytics] leitura de cursos falhou:", erroCursos.message)
  }
  const cursos: CursoFiltravel[] = (cursosBrutos ?? []).map((c) => ({
    id: c.id as string,
    titulo: (c.title as string) ?? "Sem título",
  }))

  // --- filtro de curso ---------------------------------------------------
  // ESCOPO HONESTO DO QUE ISTO FAZ: narrowing de POPULAÇÃO, não de atividade.
  // Com um curso escolhido, o recorte passa a ser "quem está matriculado nele";
  // a atividade dessas pessoas continua sendo contada por inteiro, porque as
  // camadas de leitura leem sessão e reflexão sem eixo de curso e mudar isso é
  // alterar a camada de dados, não ligá-la. Registrado como parcial, não como
  // pronto.
  const cursoId = params.curso && UUID_RE.test(params.curso) ? params.curso : null
  let erroCurso: string | null = null
  if (cursoId) {
    const { ids, erro } = await alunosDoCurso(db, tenantId, cursoId)
    if (erro) {
      erroCurso = erro
    } else if (ids) {
      const doCurso = new Set(ids)
      escopoAlunoIds =
        escopoAlunoIds === null ? [...doCurso] : escopoAlunoIds.filter((id) => doCurso.has(id))
    }
  }

  return {
    db,
    tenantId,
    tenantNome: nomeDoTenant(profile),
    gestorId: user.id,
    gestorNome: profile.full_name ?? "Gestor",
    gestorPapel: papelLegivel(roleUnion),
    ehGestorDeTime,
    modo,
    periodoDias,
    escopoAlunoIds,
    cursoId,
    cursoNome: cursoId ? (cursos.find((c) => c.id === cursoId)?.titulo ?? null) : null,
    cursos,
    falhaCursos: Boolean(erroCursos),
    erroCurso,
  }
}

/**
 * Os controles de filtro, derivados do recorte — UMA tradução para as três abas.
 *
 * Duplicar este objeto em cada aba é como o segmentado de período de uma delas
 * fica marcado em "30 dias" enquanto a tela mostra 90: a barra e os números
 * passariam a ler fontes diferentes do mesmo fato.
 */
export function controlesDaTrinca(recorte: RecorteDaTrinca): ControlesFiltro {
  return {
    periodoDias: recorte.periodoDias,
    escopoEquipe: recorte.modo === "hierarchy" ? "hierarquia" : "diretos",
    escopoEditavel: recorte.ehGestorDeTime,
    cursoId: recorte.cursoId,
    cursos: recorte.cursos,
    falhaCursos: recorte.falhaCursos,
  }
}

/** `getAuthProfile` já traz o tenant embutido no select; nada de query extra. */
function nomeDoTenant(profile: unknown): string {
  const tenants = (profile as { tenants?: { name?: string } | { name?: string }[] } | null)?.tenants
  if (Array.isArray(tenants)) return tenants[0]?.name ?? "Academy"
  return tenants?.name ?? "Academy"
}

function papelLegivel(roles: readonly Role[]): string {
  if (roles.includes("manager")) return "Gestor"
  if (roles.includes("instructor")) return "Instrutor"
  if (roles.includes("admin") || roles.includes("super_admin")) return "Administrador"
  return "Líder"
}
