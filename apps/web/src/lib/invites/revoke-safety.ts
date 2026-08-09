import { createServiceClient } from "@/lib/supabase/service"

/**
 * A trava da operação destrutiva desta story (CFG-2.2, AC5).
 *
 * ## O fato que torna isto obrigatório
 *
 * `public.users.id` é `REFERENCES auth.users(id) ON DELETE CASCADE`
 * (`20260207000000_initial_schema.sql:27`). Ou seja: `auth.admin.deleteUser()`
 * sozinho **já apaga a linha de `public.users`** — e, em cascata, tudo que
 * pendura nela. O levantamento das migrations encontrou **24 tabelas** com FK
 * para `public.users` e **14** com FK direta para `auth.users`; a maioria é
 * `ON DELETE CASCADE`. Matrícula, sessão de estudo, tentativa de quiz,
 * certificado, reflexão de slide, curso criado: tudo sumiria em silêncio, sem
 * erro, sem log, sem volta.
 *
 * Por isso a verificação acontece ANTES do `deleteUser`, e não entre ele e o
 * `delete` da linha de `users`: depois do `deleteUser` já não há o que proteger.
 *
 * ## Fail-closed deliberado
 *
 * Se qualquer checagem não puder ser feita (erro de rede, permissão, coluna
 * renomeada), a revogação é RECUSADA. Numa operação irreversível, "não consegui
 * verificar" tem que valer como "não vou apagar". A única exceção é a tabela
 * inexistente (drift de schema): se a tabela não existe, não há dado dela a
 * perder — bloquear aí seria fail-closed sobre o nada.
 *
 * ## Por que service client
 *
 * A checagem roda com service role de propósito. Sob RLS, uma linha dependente
 * invisível para o admin chamador viraria "usuário virgem" e seria apagada em
 * cascata. Aqui a pergunta é sobre a existência física do dado, não sobre quem
 * pode vê-lo.
 */

interface Dependency {
  table: string
  column: string
  /** Rótulo em português, exibido ao admin quando bloqueia. */
  label: string
}

/**
 * O que impede uma revogação. Só entram vínculos que representam **dado do
 * usuário ou autoria dele** — o que se perderia de verdade.
 *
 * Ficam de fora, deliberadamente, os vínculos que são ATRIBUIÇÃO feita pelo
 * próprio admin ao convidar (`user_areas`, `user_roles`, `user_departments`,
 * `instructor_permissions`, `user_gamification`, `notifications`): eles nascem
 * com o convite e devem morrer com ele. Bloquear neles tornaria a revogação
 * impossível no caso normal, que é justamente o caso que a story pede.
 */
const DEPENDENCIES: Dependency[] = [
  // Atividade do aluno
  { table: "enrollments", column: "student_id", label: "matrículas" },
  { table: "sessions", column: "student_id", label: "sessões de estudo" },
  { table: "quiz_attempts", column: "student_id", label: "tentativas de quiz" },
  { table: "assessment_history", column: "user_id", label: "histórico de avaliações" },
  { table: "certificates", column: "user_id", label: "certificados" },
  { table: "study_plans", column: "student_id", label: "planos de estudo" },
  { table: "slide_reflections", column: "student_id", label: "reflexões" },
  { table: "scenario_attempts", column: "student_id", label: "tentativas de cenário" },
  { table: "assignment_submissions", column: "student_id", label: "entregas de atividade" },
  { table: "consciousness_responses", column: "student_id", label: "respostas de consciência" },
  { table: "learner_profiles", column: "student_id", label: "perfil de aprendizagem" },
  { table: "live_registrations", column: "user_id", label: "inscrições em eventos ao vivo" },
  { table: "user_tenant_memberships", column: "user_id", label: "vínculos com empresas" },
  // Autoria / conteúdo criado
  { table: "courses", column: "created_by", label: "cursos criados" },
  { table: "chapters", column: "created_by", label: "capítulos criados" },
  { table: "learning_trails", column: "created_by", label: "trilhas criadas" },
  { table: "quiz_sessions", column: "created_by", label: "sessões de quiz criadas" },
  { table: "content_ingestions", column: "created_by", label: "conteúdos importados" },
  { table: "question_generation_jobs", column: "triggered_by", label: "gerações de questões" },
  { table: "enrichment_jobs", column: "triggered_by", label: "enriquecimentos de curso" },
  { table: "email_notifications", column: "sender_id", label: "e-mails enviados" },
  { table: "api_keys", column: "created_by", label: "chaves de API" },
  { table: "webhooks", column: "created_by", label: "webhooks" },
  { table: "job_roles", column: "created_by", label: "cargos criados" },
  // Papel de liderança / gestão
  { table: "leader_comments", column: "leader_id", label: "comentários de líder" },
  { table: "manager_groups", column: "manager_id", label: "times que gerencia" },
  { table: "manager_group_members", column: "student_id", label: "participação em times" },
]

/** Erros de "essa tabela/coluna não existe aqui" — drift, não risco. */
function isMissingRelation(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ""
  if (code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204") {
    return true
  }
  const message = (error.message ?? "").toLowerCase()
  return message.includes("does not exist") || message.includes("could not find")
}

export interface RevokeSafetyReport {
  /** Vínculos encontrados de verdade — cada um é motivo suficiente para abortar. */
  blockers: string[]
  /** Vínculos que não pôde verificar — também abortam (fail-closed). */
  unverifiable: string[]
}

export function isRevokeSafe(report: RevokeSafetyReport): boolean {
  return report.blockers.length === 0 && report.unverifiable.length === 0
}

/**
 * Pergunta a cada tabela dependente se existe ao menos UMA linha do usuário.
 * `head: true` + `count: "exact"` não traz payload: é uma contagem, não uma
 * leitura dos dados do usuário.
 */
export async function inspectRevokeSafety(userId: string): Promise<RevokeSafetyReport> {
  const blockers: string[] = []
  const unverifiable: string[] = []

  let serviceClient: ReturnType<typeof createServiceClient>
  try {
    serviceClient = createServiceClient()
  } catch {
    // Sem acesso privilegiado não há verificação possível — e sem verificação
    // não há revogação.
    return { blockers, unverifiable: DEPENDENCIES.map((d) => d.label) }
  }

  const results = await Promise.all(
    DEPENDENCIES.map(async (dep) => {
      try {
        const { count, error } = await serviceClient
          .from(dep.table)
          .select(dep.column, { count: "exact", head: true })
          .eq(dep.column, userId)

        if (error) {
          return isMissingRelation(error)
            ? { dep, verdict: "absent" as const }
            : { dep, verdict: "unverifiable" as const }
        }

        return { dep, verdict: (count ?? 0) > 0 ? ("blocked" as const) : ("absent" as const) }
      } catch {
        return { dep, verdict: "unverifiable" as const }
      }
    }),
  )

  for (const { dep, verdict } of results) {
    if (verdict === "blocked") blockers.push(dep.label)
    if (verdict === "unverifiable") unverifiable.push(dep.label)
  }

  return { blockers, unverifiable }
}

/** Mensagem única, para a API e para o teste não divergirem. */
export function revokeBlockedMessage(report: RevokeSafetyReport): string {
  if (report.blockers.length > 0) {
    return `Este usuário já tem dados vinculados (${report.blockers.join(", ")}). Revogar o convite apagaria esses dados — use Desativar.`
  }
  return `Não foi possível verificar se este usuário tem dados vinculados (${report.unverifiable.join(", ")}). A revogação foi cancelada por segurança.`
}
