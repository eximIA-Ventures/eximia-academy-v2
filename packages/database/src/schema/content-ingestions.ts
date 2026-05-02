import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { tenants } from "./tenants"
import { users } from "./users"

export const contentIngestions = pgTable("content_ingestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sourceType: text("source_type", {
    enum: ["pdf", "docx", "pptx", "txt", "audio", "video_url", "paste"],
  }).notNull(),
  sourceUrl: text("source_url"),
  sourceFilename: text("source_filename"),
  sourceSizeBytes: integer("source_size_bytes"),
  rawText: text("raw_text"),
  aiOutput: jsonb("ai_output"),
  status: text("status", {
    enum: ["uploading", "extracting", "processing", "review", "approved", "failed"],
  })
    .notNull()
    .default("uploading"),
  errorMessage: text("error_message"),
  processingMetadata: jsonb("processing_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
