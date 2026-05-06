import { date, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { learningTrails } from "./learning-trails"
import { tenants } from "./tenants"

export const emailNotifications = pgTable("email_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  trailId: uuid("trail_id").references(() => learningTrails.id, { onDelete: "set null" }),
  deadline: date("deadline"),
  recipientCount: integer("recipient_count").notNull().default(0),
  recipients: jsonb("recipients").notNull().default([]),
  status: text("status", { enum: ["draft", "sent", "failed"] })
    .notNull()
    .default("sent"),
  resendBatchId: text("resend_batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
})
