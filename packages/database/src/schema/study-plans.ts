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
  // int[] dias por módulo, ordenado por chapter.order, min 4/módulo, soma
  // clampada ao teto duro (finalDeadline) por fitToDeadline.
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
  recalculatedAt: timestamp("recalculated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
