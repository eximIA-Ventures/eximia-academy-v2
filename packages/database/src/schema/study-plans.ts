import { date, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { enrollments } from "./enrollments"
import { tenants } from "./tenants"
import { users } from "./users"

// ---------------------------------------------------------------------------
// study_plans — a Jornada persistida do aluno (EPIC-JORNADA, evolução do design
// nunca-aplicado em docs/architecture/meu-plano-arquitetura-implementacao.md §3).
// Uma jornada ATIVA por enrollment (índice único parcial WHERE status='active',
// definido na migration 20260723000000_jornada_study_plans.sql).
//
// Diferença-chave vs o design original: guarda o modelo da DEMO aprovada —
// duração POR MÓDULO (moduleDurations, dias/capítulo) + preferências
// (auto-ajuste, unidade semanas/dias) + preset, não só o ritmo semanal.
// Chaves denormalizadas (student/course/tenant) são predicados diretos de RLS.
// ---------------------------------------------------------------------------
export const studyPlans = pgTable("study_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["draft", "active", "completed", "paused"] })
    .notNull()
    .default("active"),
  // JRN-E (2026-07-25) — `{chapterId, days}[]`, ANCORADO POR CAPÍTULO.
  //
  // Era `int[]` posicional puro (índice ↔ i-ésimo capítulo publicado por
  // `order`). Nessa forma, publicar, despublicar ou reordenar um capítulo
  // DESLIZAVA silenciosamente todas as durações salvas — o aluno via o plano
  // dele mudar sozinho, sem nenhum erro. A troca foi feita na janela em que
  // `study_plans` tinha 0 linhas em produção: gratuita então, cara depois.
  //
  // Regras inalteradas: min 4 dias/módulo vivo, 0 exato para módulo concluído,
  // soma dos vivos clampada à janela que RESTA (normalizeRemainingDurations).
  // A coluna segue `jsonb`, então a mudança de forma não exigiu DDL — o leitor
  // (parsePersistedDurations) aceita as duas formas e reancora a antiga.
  moduleDurations: jsonb("module_durations").notNull(),
  // Qual modelo do "Sugerir jornada" está aceso: 1.3 | 1 | 0.75 | null.
  preset: real("preset"),
  // { cascade: boolean (Auto-ajuste), unit: "w" | "d" }. Default LIGADO/semanas.
  preferences: jsonb("preferences").notNull().default({ cascade: true, unit: "w" }),
  // T0 — âncora do relógio da jornada.
  startDate: date("start_date").notNull(),
  // Snapshots nullable dos prazos de coorte (degradam quando o curso não tem).
  finalDeadlineDate: date("final_deadline_date"),
  managerDeadlineDate: date("manager_deadline_date"),
  // JRN-E — âncora do replanejamento do que RESTA (o dia em que o aluno montou
  // ou revisou). Reusa a coluna que já existia: zero coluna nova para isto.
  recalculatedAt: timestamp("recalculated_at", { withTimezone: true }),
  // JRN-E — fotografia do progresso na PRIMEIRA confirmação (o "ponto de
  // partida"). `{capturedAt, progressPct, sessionsDone, reflectionsDone,
  // completedChapterIds[]}`. Nullable: jornada anterior ao JRN-E não tem.
  // Escrita UMA vez; revisar a jornada não reescreve, senão o progresso feito
  // DENTRO da jornada seria reabsorvido como "veio de antes" a cada revisão.
  baseline: jsonb("baseline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
