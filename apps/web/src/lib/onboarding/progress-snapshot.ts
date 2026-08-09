// ---------------------------------------------------------------------------
// Os números do PRÓPRIO aluno para a novidade 1 (`percorrido-vs-conclusao`).
//
// POR QUE ESTE MÓDULO EXISTE
// --------------------------
// O modal afirmava "Percorrido em 100% e Conclusão em 50%… falta fechar 4
// módulos" para TODA pessoa (literal em `announcement-content.tsx` e em
// `Cartoes()`), enquanto a tabela "Meu ritmo", na MESMA tela, mostrava a
// verdade daquele aluno. Hugo reportou com print em 2026-08-05.
//
// POR QUE NÃO `computeStudentComparison`
// --------------------------------------
// Seria o caminho óbvio — é ele quem serve a tabela "Meu ritmo" —, mas ele pede
// o SERVICE client e varre a organização inteira (média da Turma, cache por
// tenant). O modal não precisa de comparação nenhuma: precisa dos DOIS números
// do próprio aluno. Esta leitura é auto-escopada, roda com o client autenticado
// da sessão (RLS `cvp_student_select`, `student_id = auth.uid()`) e não toca
// linha de terceiro.
//
// O que ela REUSA, em vez de reimplementar:
//   • `readViewProgressByStudent` — a MESMA leitura de percorrido do gestor,
//     com o mesmo piso por evidência (reflexão e sessão provam presença).
//   • `computeBehindAndProgress` — a MESMA definição de conclusão: o maior
//     percentual entre os cursos do aluno (o "curso líder").
//   • O `Math.round` das duas pontas, que é o que faz o modal e a tabela
//     falarem a mesma régua (ver `area-gestor.ts`, "ARREDONDADO aqui, e só aqui").
//
// FAIL-OPEN é requisito, não zelo: esta leitura serve um modal opcional na home
// do aluno. Qualquer falha devolve o snapshot vazio (três `null`), o modal
// degrada o bloco "No seu caso" e a home fica de pé. Mesma direção de
// `resolve.ts` e de `view-progress-read.ts`.
// ---------------------------------------------------------------------------

import {
  type ReflectionSlideRow,
  type SessionChapterRow,
  type ViewProgressQueryClient,
  readViewProgressByStudent,
} from "@/lib/analytics/view-progress-read"
import type { EnrollmentRow } from "@/lib/notifications/engagement-triage"
import { computeBehindAndProgress } from "@/lib/notifications/engagement-triage"
import type { createClient } from "@/lib/supabase/server"
import { FEATURE_KEYS, type PendingArtifact, type StudentProgressSnapshot } from "./types"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Nada afirmável sobre esta pessoa. É também o valor de qualquer falha. */
export const EMPTY_PROGRESS_SNAPSHOT: StudentProgressSnapshot = {
  percorridoPct: null,
  conclusaoPct: null,
  totalModules: null,
}

interface EnrollmentQueryRow {
  course_id: string
  status: string | null
  created_at: string
  progress: unknown
}

/**
 * `enrollments.progress` é `number` OU `{ percentage }` conforme a época do
 * registro — a mesma dupla forma que `student-dashboard-page.tsx` já normaliza.
 * `computeBehindAndProgress` só entende a segunda, então a conversão acontece
 * aqui, na fronteira, e não dentro do cálculo compartilhado.
 */
function toProgressShape(raw: unknown): EnrollmentRow["progress"] {
  if (typeof raw === "number") return { percentage: raw }
  if (typeof raw === "object" && raw !== null && "percentage" in raw) {
    return raw as { percentage?: number | string | null }
  }
  return null
}

/**
 * Os dois números do aluno, na régua da tabela "Meu ritmo".
 *
 * Devolve `null` em cada campo que não pôde ser afirmado — nunca `0`, que
 * acusaria de não ter estudado quem estudou antes de a medição existir (B9,
 * `student-home-indicators.ts`).
 */
export async function readStudentProgressSnapshot(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<StudentProgressSnapshot> {
  try {
    // Os MESMOS filtros da lista "Seus Cursos" (`student-dashboard-page.tsx`):
    // curso arquivado e matrícula apagada não contam em lugar nenhum, e não
    // podem contar aqui — inflariam o denominador de módulos com curso que o
    // aluno nem vê.
    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("course_id, status, created_at, progress, courses!inner(status)")
      .eq("student_id", userId)
      .in("status", ["active", "completed"])
      .is("deleted_at", null)
      .neq("courses.status", "archived")

    if (enrollmentError || !enrollmentRows || enrollmentRows.length === 0) {
      return EMPTY_PROGRESS_SNAPSHOT
    }

    const enrollments = enrollmentRows as unknown as EnrollmentQueryRow[]
    const courseIds = new Set(enrollments.map((e) => e.course_id).filter(Boolean))
    if (courseIds.size === 0) return EMPTY_PROGRESS_SNAPSHOT

    // CONCLUSÃO — o curso líder, pela definição canônica já em uso na tabela.
    // `deadlineByCourse` vazio de propósito: ele governa `behind`/`expectedPct`,
    // que este módulo não usa; `progressByStudent` não depende dele.
    const { progressByStudent } = computeBehindAndProgress(
      enrollments.map((e) => ({
        student_id: userId,
        status: e.status,
        created_at: e.created_at,
        progress: toProgressShape(e.progress),
        course_id: e.course_id,
      })),
      new Map(),
      Date.now(),
    )
    const rawConclusao = progressByStudent.get(userId)
    const conclusaoPct = rawConclusao == null ? null : Math.round(rawConclusao)

    // PERCORRIDO — piso por evidência: reflexão e sessão provam presença no
    // slide/capítulo onde aconteceram (contrato §2.1). As duas varreduras são
    // auto-escopadas e vão em paralelo com a do próprio percorrido.
    const [{ data: sessionRows }, { data: reflectionRows }] = await Promise.all([
      supabase.from("sessions").select("chapter_id, status").eq("student_id", userId),
      supabase.from("slide_reflections").select("slide_id").eq("student_id", userId),
    ])

    const sessions: SessionChapterRow[] = (
      (sessionRows ?? []) as Array<{ chapter_id: string | null; status: string | null }>
    ).map((s) => ({ student_id: userId, chapter_id: s.chapter_id, status: s.status }))

    const reflections: ReflectionSlideRow[] = (
      (reflectionRows ?? []) as Array<{ slide_id: string | null }>
    ).map((r) => ({ student_id: userId, slide_id: r.slide_id }))

    const byStudent = await readViewProgressByStudent(
      supabase as unknown as ViewProgressQueryClient,
      [userId],
      new Map([[userId, courseIds]]),
      reflections,
      sessions,
    )

    const view = byStudent.get(userId)

    return {
      percorridoPct: view?.pct == null ? null : Math.round(view.pct),
      conclusaoPct,
      // O denominador de "N de M módulos" sai da MESMA leitura que produziu o
      // percorrido — mesmo universo de capítulos, portanto as duas afirmações do
      // modal não têm como discordar. Ausente (sem leitura afirmável) → `null`, e
      // a frase deixa de citar módulos em vez de citar um total inventado.
      totalModules: view?.chaptersTotal ?? null,
    }
  } catch (error) {
    console.error("[onboarding:progress-snapshot] degrading to empty:", error)
    return EMPTY_PROGRESS_SNAPSHOT
  }
}

/**
 * Os números para o artefato que o gate (ou a demonstração) acabou de resolver,
 * ou `null` quando não há nada individual a dizer.
 *
 * A LEITURA ACONTECE DEPOIS DO GATE, e não em paralelo com ele, de propósito.
 * Ela só faz sentido quando a novidade 1 está de fato pendente para esta pessoa,
 * agora — e essa é a exceção, não a regra: o anúncio aparece uma vez, dentro de
 * uma janela de no máximo 35 dias. Rodá-la junto com o gate custaria três
 * consultas em TODO carregamento da home, para um modal que quase nunca vai
 * abrir. Serializar paga o custo só quando ele compra alguma coisa.
 *
 * O MODO DEMONSTRAÇÃO (`?onboarding=percorrido`) PASSA POR AQUI IGUAL a
 * qualquer outro (Hugo, 2026-08-05). Ele mostrava um snapshot canned fixo
 * (100%/50%), e por isso quem conferia via URL continuava vendo os números de
 * ninguém — exatamente o sintoma que a correção existia para matar. Não há
 * parâmetro `isPreview` aqui, e a ausência dele É o mecanismo: não existe ramo
 * que possa divergir.
 *
 * O que a demonstração preserva é o que sempre importou nela: **não grava linha
 * nenhuma** e **funciona com a migration de onboarding NÃO aplicada**. As
 * tabelas lidas abaixo (`enrollments`, `sessions`, `slide_reflections`,
 * `chapter_view_progress`) são as que a home já lê em todo carregamento;
 * `product_announcements` e `product_announcement_views` continuam intocadas
 * pelo caminho de demonstração, que sai de `resolveOnboarding()` antes de
 * qualquer query.
 */
export async function resolveAnnouncementStats(
  supabase: SupabaseServerClient,
  userId: string,
  artifact: PendingArtifact | null,
): Promise<StudentProgressSnapshot | null> {
  // A novidade 2 (jornada) não tem número de pessoa nenhuma a mostrar, e sem
  // artefato não há modal — nos dois casos, nem se consulta o banco.
  if (artifact?.featureKey !== FEATURE_KEYS.percorrido) return null
  // `readStudentProgressSnapshot` já degrada internamente para os três `null`;
  // este `catch` é a segunda rede, pela mesma razão do fail-open do gate.
  try {
    return await readStudentProgressSnapshot(supabase, userId)
  } catch (error) {
    console.error("[onboarding:progress-snapshot] resolve degrading to none:", error)
    return null
  }
}
