// ---------------------------------------------------------------------------
// Engagement Engine — Notification types
// ---------------------------------------------------------------------------
// Backed by migration 20260604120000_engagement_engine.sql:
//   notification_templates · notifications · nudge_suggestions · notification_audiences
//
// The old `email_notifications` table is LEGACY (not modelled here, not dropped).
//
// Two shapes are exported per table:
//   • a snake_case `*Row` interface mirroring the DB columns 1:1 (use for direct
//     Supabase reads/inserts where column names matter), and
//   • a camelCase domain interface for app/UI usage.
// ---------------------------------------------------------------------------

// --- Enums (must mirror the SQL CHECK constraints exactly) ---

export type NotificationCategory = "nudge" | "announcement" | "system"

export type NotificationChannel = "inapp" | "email"

export type NotificationOrigin = "nudge" | "manual" | "system"

/** Lifecycle: queued -> sent -> read -> acted. `returned_at` (efficacy) is orthogonal. */
export type NotificationStatus = "queued" | "sent" | "read" | "acted"

/** Mirrors the roster risk categories used by next-best-action. */
export type NudgeType =
  | "never_accessed"
  | "inactive"
  | "no_reflection"
  | "top_performer"
  | "announcement"
  | "custom"

export type NudgeSuggestionStatus = "pending" | "approved" | "dismissed"

/**
 * Saved-audience criteria. The app resolves this jsonb into a student set.
 * Reuses the area-gestor (manager_group_id) and roster-risk (risk) concepts.
 */
export interface NotificationAudienceCriteria {
  risk?: NudgeType
  unit_id?: string // areas.id (UNIDADE)
  manager_group_id?: string // manager_groups.id (ÁREA/GESTOR)
  course_id?: string // courses.id
}

/** Free-form context attached to a notification (drives cta_url, efficacy scoping). */
export interface NotificationContext {
  course_id?: string
  suggestion_id?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// notification_templates
// ---------------------------------------------------------------------------

/** 1:1 with the `notification_templates` table columns. */
export interface NotificationTemplateRow {
  id: string
  tenant_id: string
  key: string // tenant-unique slug
  name: string
  category: NotificationCategory
  channel_inapp: boolean
  channel_email: boolean
  title: string
  body_inapp: string | null
  email_subject: string | null
  email_html: string | null
  variables: string[] // declared {{...}} keys
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Camel-case domain view of a template. */
export interface NotificationTemplate {
  id: string
  tenantId: string
  key: string
  name: string
  category: NotificationCategory
  channelInapp: boolean
  channelEmail: boolean
  title: string
  bodyInapp: string | null
  emailSubject: string | null
  emailHtml: string | null
  variables: string[]
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

/** 1:1 with the `notifications` table columns. channel=inapp rows are the inbox. */
export interface NotificationRow {
  id: string
  tenant_id: string
  recipient_id: string
  template_id: string | null
  channel: NotificationChannel
  origin: NotificationOrigin
  title: string
  body: string | null
  cta_url: string | null
  context: NotificationContext
  status: NotificationStatus
  created_at: string
  sent_at: string | null
  read_at: string | null
  acted_at: string | null
  returned_at: string | null // efficacy: session after sent_at
}

/** Camel-case domain view of a notification. */
export interface Notification {
  id: string
  tenantId: string
  recipientId: string
  templateId: string | null
  channel: NotificationChannel
  origin: NotificationOrigin
  title: string
  body: string | null
  ctaUrl: string | null
  context: NotificationContext
  status: NotificationStatus
  createdAt: string
  sentAt: string | null
  readAt: string | null
  actedAt: string | null
  returnedAt: string | null
}

// ---------------------------------------------------------------------------
// nudge_suggestions
// ---------------------------------------------------------------------------

/** 1:1 with the `nudge_suggestions` table columns. */
export interface NudgeSuggestionRow {
  id: string
  tenant_id: string
  type: NudgeType
  target_student_ids: string[] // users.id[]
  template_key: string | null
  rationale: string | null
  status: NudgeSuggestionStatus
  suggested_at: string
  approved_by: string | null
  approved_at: string | null
}

/** Camel-case domain view of a nudge suggestion. */
export interface NudgeSuggestion {
  id: string
  tenantId: string
  type: NudgeType
  targetStudentIds: string[]
  templateKey: string | null
  rationale: string | null
  status: NudgeSuggestionStatus
  suggestedAt: string
  approvedBy: string | null
  approvedAt: string | null
}

// ---------------------------------------------------------------------------
// notification_audiences
// ---------------------------------------------------------------------------

/** 1:1 with the `notification_audiences` table columns. */
export interface NotificationAudienceRow {
  id: string
  tenant_id: string
  name: string
  criteria: NotificationAudienceCriteria
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Camel-case domain view of a saved audience. */
export interface NotificationAudience {
  id: string
  tenantId: string
  name: string
  criteria: NotificationAudienceCriteria
  createdBy: string | null
  createdAt: string
  updatedAt: string
}
