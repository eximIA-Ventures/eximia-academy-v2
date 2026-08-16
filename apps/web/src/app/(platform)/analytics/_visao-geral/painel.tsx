// ---------------------------------------------------------------------------
// A aba "Visão geral" com DADO REAL — o lado servidor.
// ---------------------------------------------------------------------------
// Este arquivo é a única cola entre três coisas que já existiam separadas:
//   • a autenticação e o RECORTE da Academy (cookies de contexto + as RPCs
//     ancoradas em `auth.uid()`), que decidem QUEM o gestor alcança;
//   • `lib/analytics/visao-geral/`, que transforma leitura crua na tela inteira
//     e NÃO resolve escopo de propósito (índice do módulo, §"o que esta camada
//     não faz") — ela recebe o universo já resolvido e obedece;
//   • `components/analytics/visao-geral/`, que desenha.
//
// POR QUE O ESCOPO NÃO É RESOLVIDO AQUI DO ZERO. Existe UMA cadeia gated no
// app (`auth_subtree_user_ids` → `getDirectTeamStudentIds` /
// `getManagedTeamStudentIds` / `getSubtreeStudentIdsAtNode`), e ela é o gate de
// segurança entre times. Escrever uma segunda resolução ao lado seria abrir um
// caminho paralelo a esse gate, que é literalmente como vazamento entre equipes
// acontece. O que este arquivo faz é ESCOLHER entre os dois ramos já existentes
// — o mesmo `if` de `analytics/page.tsx` L184-191, com o modo vindo da URL em
// vez do cookie. Nenhum ramo novo, nenhuma consulta que alargue alcance.
//
// SOMENTE LEITURA. Nenhuma escrita, nenhuma migration, nenhuma semente. O
// `.env.local` deste repositório aponta para o Supabase de PRODUÇÃO.
// ---------------------------------------------------------------------------

import type { CursoFiltravel } from "@/components/analytics/visao-geral/filtros-escopo"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import { carregarVisaoGeral } from "@/lib/analytics/visao-geral"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import { getTeamViewMode } from "@/lib/team-view-context"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"

const ACESSO: Role[] = ["leader", "manager", "admin", "instructor", "super_admin"]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** PostgREST devolve no máximo 1000 linhas por requisição. */
const PAGINA = 1000
const MAX_PAGINAS = 50

/**
 * O gate de escrita. Fail-closed: só liga com a string exata `"true"`.
 *
 * Dois nomes aceitos porque dois nomes já existem no projeto — o do briefing
 * desta rodada e o que a camada de dados estabeleceu. Ter um nome documentado
 * que silenciosamente não faz nada é pior que aceitar os dois.
 */
function acionamentoEstaAtivo(): boolean {
  return (
    process.env.NEXT_PUBLIC_ACIONAMENTO_ATIVO === "true" ||
    process.env.NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS === "true"
  )
}

function lerPeriodo(bruto: string | undefined): 7 | 30 | 90 {
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
  db: ReturnType<typeof createServiceClient>,
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

export async function PainelVisaoGeral({
  params,
}: {
  params: Record<string, string | undefined>
}) {
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
  // de escopo são ancoradas em `auth.uid()`. A divisão é a mesma de
  // `analytics/page.tsx` L120-127 e é deliberada.
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
        console.error("[visao-geral] auth_subtree_user_ids falhou, focus ignorado:", error.message)
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
    console.error("[visao-geral] leitura de cursos falhou:", erroCursos.message)
  }
  const cursos: CursoFiltravel[] = (cursosBrutos ?? []).map((c) => ({
    id: c.id as string,
    titulo: (c.title as string) ?? "Sem título",
  }))

  // --- filtro de curso ---------------------------------------------------
  // ESCOPO HONESTO DO QUE ISTO FAZ: narrowing de POPULAÇÃO, não de atividade.
  // Com um curso escolhido, o recorte passa a ser "quem está matriculado nele";
  // a atividade dessas pessoas continua sendo contada por inteiro, porque
  // `lerFonteVisaoGeral` lê sessão e reflexão sem eixo de curso e mudar isso é
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

  // A falha do filtro de curso NÃO pode virar "tenant inteiro" (alarga o
  // recorte) nem "recorte vazio" (finge que o curso não tem ninguém). As duas
  // mentem, cada uma para um lado. A tela para e diz que parou.
  if (erroCurso) {
    return (
      <TelaEmFalha
        titulo="Não foi possível aplicar o filtro de curso"
        detalhe={`MATRICULAS_DO_CURSO: ${erroCurso}`}
      />
    )
  }

  const agoraMs = Date.now()
  const dados = await carregarVisaoGeral({
    db,
    tenantId,
    gestorId: user.id,
    escopoAlunoIds,
    agoraMs,
    periodoDias,
    contexto: {
      tenantNome: nomeDoTenant(profile),
      gestorNome: profile.full_name ?? "Gestor",
      gestorPapel: papelLegivel(roleUnion),
      escopoEquipe: modo === "hierarchy" ? "hierarquia" : "diretos",
      cursoFiltroNome: cursoId ? (cursos.find((c) => c.id === cursoId)?.titulo ?? null) : null,
    },
  })

  return (
    <VisaoGeralTab
      data={dados}
      acionamentoAtivo={acionamentoEstaAtivo()}
      controles={{
        periodoDias,
        escopoEquipe: modo === "hierarchy" ? "hierarquia" : "diretos",
        escopoEditavel: ehGestorDeTime,
        cursoId,
        cursos,
        falhaCursos: Boolean(erroCursos),
      }}
    />
  )
}

/**
 * A tela quando ela não pode ser montada. Deliberadamente feia e explícita: o
 * gestor precisa saber que está olhando para uma falha, e não para a equipe
 * dele. É o invariante I-4 na única forma que importa — a visível.
 */
function TelaEmFalha({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="max-w-[720px] rounded-xl border border-border-medium bg-bg-card p-6">
      <p className="text-base font-semibold text-text-primary">{titulo}</p>
      <p className="mt-2 text-sm text-text-secondary">
        Nenhum número é exibido enquanto a leitura não for confiável.
      </p>
      <p className="mt-3 font-mono text-xs text-text-muted">{detalhe}</p>
    </div>
  )
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
