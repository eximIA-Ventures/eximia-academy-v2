// ---------------------------------------------------------------------------
// O modo MOTOR do preview da "Autogestão da minha Jornada" — Tela 3 (Meu Mapa
// da Jornada). Banco real, tenant descartável, somente leitura.
// ---------------------------------------------------------------------------
// MESMA anatomia de `../autogestao-visao-geral/leitura-real.ts` (mesmo tenant
// fixo "gauntlet-descartavel", mesmo par de e-mails semeados, mesma janela
// dupla de `periodoDias`) — decisão IDS: ADAPTAR, não REUSAR por import
// direto: o tipo de saída (`MapaJornadaAutogestaoDados`) e o montador chamado
// (`montarMapaAutogestao`) são outros, então não há uma função só para as
// duas rotas compartilharem sem introduzir um módulo novo fora do escopo
// pedido (as 3 rotas gêmeas do gestor já seguem esse mesmo padrão de
// duplicação deliberada, uma por aba).
//
// A JANELA DE LEITURA (`periodoDias`) TEM DUAS PERGUNTAS DIFERENTES, QUE NÃO
// PODEM COMPARTILHAR UM LITERAL FIXO (esse foi o próprio defeito medido em
// 2026-08-22: um painel analisou capturas de 7 dias acreditando ver os 30 do
// produto real, e atribuiu ao produto uma contradição que era do instrumento).
//   • a janela da OBSERVAÇÃO — o que o aluno vê — é 30 dias, o MESMO default
//     do produto (`PERIODO_PADRAO_DIAS` em `_contexto.ts`/`recorte.ts`/
//     `moldura.tsx`);
//   • a janela da PROVA é 7 dias, porque é o valor que `semear.mjs` e
//     `provar-elo4-nucleo.ts` usam para as janelas atual/anterior do cenário
//     plantado — usar 30 ali divergiria do que o cenário foi desenhado para
//     preencher.
// Por isso `periodoDias` entra por PARÂMETRO nesta função — a página resolve
// o valor via `?periodo=` (`lerPeriodoAutogestao`, default 30), e o 7 segue
// alcançável explicitamente (`?periodo=7`), que é de onde a prova do elo 4
// depende.
//
// A rota real (`_autogestao/_mapa/painel.tsx`) resolve `studentId` via sessão
// autenticada (`_autogestao/recorte.ts`). Este harness não tem sessão — o
// aluno é resolvido por E-MAIL SEMEADO (`?aluno=a|b`), nunca por `user.id`.
//
// SOMENTE LEITURA: a única função de dado chamada é `lerFonteAutogestao` mais
// o montador puro `montarMapaAutogestao`. Nenhuma linha aqui grava, migra ou
// semeia — a semeadura é responsabilidade exclusiva de
// `scripts/gauntlet/semear.mjs`, rodado ANTES da captura.
// ---------------------------------------------------------------------------

import { lerFonteAutogestao } from "@/lib/analytics/autogestao/fonte-supabase"
import { montarMapaAutogestao } from "@/lib/analytics/autogestao/montagem"
import type { MapaJornadaAutogestaoDados } from "@/lib/analytics/autogestao/tipos"
import { createServiceClient } from "@/lib/supabase/service"

/** O tenant DEFAULT deste harness (nenhum `?tenant=` informado). Semeado por `scripts/gauntlet/semear.mjs`. */
const SLUG_TENANT_DESCARTAVEL = "gauntlet-descartavel"

/** Os dois e-mails semeados — literais idênticos a `scripts/gauntlet/semear.mjs`. */
const EMAIL_ALUNO_A = "elo4.aluno.a@gauntlet-descartavel.eximia.test"
const EMAIL_ALUNO_B = "elo4.aluno.b@gauntlet-descartavel.eximia.test"

/** `?estudante=` aceita UUID (id de `users`) ou e-mail — este regex decide qual coluna consultar. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Aluno = "a" | "b"

export type ResultadoAutogestao =
  | { ok: true; dados: MapaJornadaAutogestaoDados }
  | { ok: false; motivo: string }

interface CenarioResolvido {
  tenantId: string
  studentId: string
  courseId: string
}

const INSTRUCAO_SEMEAR = "Rode: node scripts/gauntlet/semear.mjs --agora <ISO>"

/**
 * Resolve (tenant, aluno, curso). `error` de cada consulta é desestruturado e
 * devolvido como VALOR (I-4) — nunca um `throw` genérico.
 *
 * `tenantSlug` e `estudante` vêm de `?tenant=`/`?estudante=` (ver a página).
 * Quando `estudante` está ausente, o comportamento é o ORIGINAL: resolve pelo
 * e-mail semeado de `aluno` (a|b).
 */
async function resolverCenario(
  db: ReturnType<typeof createServiceClient>,
  aluno: Aluno,
  tenantSlug: string,
  estudante: string | undefined,
): Promise<CenarioResolvido | { erroMotivo: string }> {
  const { data: tenantRow, error: erroTenant } = await db
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle()
  if (erroTenant) {
    return { erroMotivo: `falha ao resolver o tenant "${tenantSlug}": ${erroTenant.message}` }
  }
  const tenantId = (tenantRow as { id?: string } | null)?.id
  if (!tenantId) {
    return {
      erroMotivo: `o tenant "${tenantSlug}" não existe. ${INSTRUCAO_SEMEAR}`,
    }
  }

  let studentId: string | undefined
  let identificadorAluno: string

  if (estudante) {
    identificadorAluno = estudante
    const consulta = db.from("users").select("id").eq("tenant_id", tenantId)
    const { data: userRow, error: erroUser } = UUID_RE.test(estudante)
      ? await consulta.eq("id", estudante).maybeSingle()
      : await consulta.eq("email", estudante).maybeSingle()
    if (erroUser) {
      return { erroMotivo: `falha ao resolver o aluno "${estudante}": ${erroUser.message}` }
    }
    studentId = (userRow as { id?: string } | null)?.id
    if (!studentId) {
      return {
        erroMotivo: `o aluno "${estudante}" não existe no tenant "${tenantSlug}".`,
      }
    }
  } else {
    const email = aluno === "b" ? EMAIL_ALUNO_B : EMAIL_ALUNO_A
    identificadorAluno = email
    const { data: userRow, error: erroUser } = await db
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .maybeSingle()
    if (erroUser) return { erroMotivo: `falha ao resolver o aluno "${email}": ${erroUser.message}` }
    studentId = (userRow as { id?: string } | null)?.id
    if (!studentId) {
      return {
        erroMotivo: `cenário não semeado — o aluno "${email}" não existe. ${INSTRUCAO_SEMEAR}`,
      }
    }
  }

  // Filtro de status alinhado a `_autogestao/recorte.ts` (a resolução REAL de
  // produção): "active" sozinho ignora aluno com curso concluído — divergência
  // que só aparecia com tenant real (o cenário sintético só semeia "active").
  const { data: enrollRow, error: erroEnroll } = await db
    .from("enrollments")
    .select("course_id")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .in("status", ["active", "completed"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (erroEnroll) {
    return {
      erroMotivo: `falha ao resolver a matrícula do aluno "${identificadorAluno}": ${erroEnroll.message}`,
    }
  }
  const courseId = (enrollRow as { course_id?: string } | null)?.course_id
  if (!courseId) {
    return {
      erroMotivo: estudante
        ? `o aluno "${identificadorAluno}" não tem matrícula ativa no tenant "${tenantSlug}".`
        : `cenário não semeado — o aluno "${identificadorAluno}" não tem matrícula ativa. ${INSTRUCAO_SEMEAR}`,
    }
  }

  return { tenantId, studentId, courseId }
}

/**
 * Lê o banco e monta a Tela 3. `agoraMs` entra por PARÂMETRO — nenhuma função
 * pura desta tela chama o relógio por conta própria, o que permite congelar
 * o instante via `?agora=`. `periodoDias` também entra por PARÂMETRO, já
 * resolvido pela página — ver o comentário de topo deste arquivo sobre as
 * duas janelas (OBSERVAÇÃO x PROVA).
 *
 * `tenantSlug` (default "gauntlet-descartavel") e `estudante` (uuid ou
 * e-mail, opcional) vêm de `?tenant=`/`?estudante=`.
 */
export async function carregarMapaAutogestao(
  agoraMs: number,
  aluno: Aluno,
  periodoDias: 7 | 30 | 90,
  tenantSlug: string = SLUG_TENANT_DESCARTAVEL,
  estudante?: string,
): Promise<ResultadoAutogestao> {
  let db: ReturnType<typeof createServiceClient>
  try {
    db = createServiceClient()
  } catch (e) {
    return {
      ok: false,
      motivo: `sem credencial de serviço: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  const resolvido = await resolverCenario(db, aluno, tenantSlug, estudante)
  if ("erroMotivo" in resolvido) return { ok: false, motivo: resolvido.erroMotivo }

  const fonte = await lerFonteAutogestao({
    db,
    tenantId: resolvido.tenantId,
    studentId: resolvido.studentId,
    courseId: resolvido.courseId,
    periodoDias,
  })
  const dados = montarMapaAutogestao(fonte, new Date(agoraMs))
  return { ok: true, dados }
}
