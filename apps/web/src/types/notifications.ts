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
  | "behind_teaching_plan"

export type NudgeSuggestionStatus = "pending" | "approved" | "dismissed"

/** Origin of a notification message (Engagement Center v2, E1). */
export type SenderIdentity = "manager" | "platform"

/**
 * Campaign lifecycle (E14 / migration 20260711000000): a campaign is `open` while
 * inside its return-measurement window and `closed` once the window expires (cron,
 * `closed_reason='auto'`) or the manager ends it (`closed_reason='manual'`).
 */
export type CampaignStatus = "open" | "closed"

/**
 * How a campaign closed (E14 / D5): `auto` = the cron closed it because the
 * measurement window expired; `manual` = the owning manager ended it early.
 */
export type CampaignCloseReason = "auto" | "manual"

/**
 * The unified-semáforo state a campaign was launched from (E14 / D3), mirroring
 * `StudentTriagem` from `student-triage.ts`: `atencao` (🔴), `sem_acesso` (🟡),
 * `no_ritmo` (🟢 reconhecimento). Persisted as `campaigns.segment` (CHECK-guarded).
 *
 * Fatia 15 (gap doc02, in progress): `no_reflection` is a 4th, ORTHOGONAL
 * segment — students with >=2 completed sessions and 0 reflections, resolved
 * via `classifyNudgeCohorts`/`loadStudentSignals` (engine.ts), NOT via
 * `StudentTriagem`/`computeEngagementTriage` like the other 3. It is NOT yet
 * a member of the `campaigns.segment` DB CHECK constraint (migration
 * 20260711000000, `CHECK (segment IN ('atencao','sem_acesso','no_ritmo'))`) —
 * persisting a campaign header with this value will violate that constraint
 * until either the CHECK is extended or the persisted value is mapped to an
 * existing member. Escalated to Eng-Capataz before wiring the confirm/dispatch
 * path; safe to use for preview-only resolution in the meantime.
 */
export type CampaignSegment = "atencao" | "sem_acesso" | "no_ritmo" | "no_reflection"

/**
 * Per-line variation provenance (E14 / D4 convention). Stamped into a
 * notification's `context.variation` so analytics/UI can tell a template-derived
 * message from a hand-edited one. The load-bearing storage is `notifications.body`
 * (already rendered per row); this marker is a documented convention, not new infra.
 */
export type CampaignVariation = "template" | "override"

/** Human intent of a template (Engagement Center v2, E1). Drives UI grouping. */
export type TemplateIntent =
  | "primeiro_acesso"
  | "retomada"
  | "atraso_plano"
  | "reflexao_pendente"
  | "reconhecimento"
  | "manual"

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
  /**
   * E14 (§2.3): the campaign that dispatched this notification, mirrored into
   * `context` for query convenience. The authoritative link is the typed
   * `notifications.campaign_id` FK column; this is the E13 §2.3 convention.
   */
  campaign_id?: string
  /** E14 (D4 convention): whether this line used the template or a hand-edited override. */
  variation?: CampaignVariation
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
  intent: TemplateIntent | null // Engagement Center v2 (E1)
  tone: string | null // Engagement Center v2 (E1)
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
  intent: TemplateIntent | null
  tone: string | null
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
  sender_identity: SenderIdentity // Engagement Center v2 (E1); default 'platform'
  sender_name: string | null // Engagement Center v2 (E1); set when identity=manager
  campaign_id: string | null // E14: FK to the campaign that dispatched this; NULL when not from a campaign
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
  senderIdentity: SenderIdentity
  senderName: string | null
  campaignId: string | null // E14: FK to the dispatching campaign; null when not from one
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
  manager_id: string | null // Engagement Center v2 (E1); owning manager, NULL for legacy
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
  managerId: string | null
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

// ---------------------------------------------------------------------------
// campaigns (E14 — migration 20260711000000_engagement_campaigns.sql)
// ---------------------------------------------------------------------------
// A campaign is the HEADER + lifecycle of a manager dispatch batch. The
// individual messages live in `notifications` (via campaign_id); this row never
// holds a recipient or a message body. `window_end` = created_at +
// return_window_days (set by a BEFORE INSERT trigger when not supplied).

/** 1:1 with the `campaigns` table columns. */
export interface CampaignRow {
  id: string
  tenant_id: string
  created_by: string | null // owning manager (RLS scope key)
  name: string | null // optional human label
  segment: CampaignSegment // D3: entry semáforo state
  focus_node: string | null // optional recorte focus (?focus= node id)
  return_window_days: number // D2: measurement window (default 7)
  window_end: string | null // derived deadline (created_at + return_window_days)
  status: CampaignStatus // D5: open | closed
  closed_at: string | null
  closed_by: string | null // manager id when manual; null when auto
  closed_reason: CampaignCloseReason | null // auto (cron) | manual (manager button)
  created_at: string
  updated_at: string
}

/** Camel-case domain view of a campaign. */
export interface Campaign {
  id: string
  tenantId: string
  createdBy: string | null
  name: string | null
  segment: CampaignSegment
  focusNode: string | null
  returnWindowDays: number
  windowEnd: string | null
  status: CampaignStatus
  closedAt: string | null
  closedBy: string | null
  closedReason: CampaignCloseReason | null
  createdAt: string
  updatedAt: string
}

/**
 * Return shape of the `campaign_result(uuid)` SQL function (E14 §5 / E16). The
 * loop-closing aggregation: "N of M recipients returned". `returnRate` is 0..1
 * (null when recipients=0). Fail-closed to zero rows for a caller who may not see
 * the campaign — the function re-asserts the caller's authority internally.
 */
export interface CampaignResultRow {
  campaign_id: string
  status: CampaignStatus
  window_end: string | null
  recipients: number // M: distinct in-app nudge recipients dispatched
  read_count: number
  returned_count: number // N: how many returned to study within/after the nudge
  return_rate: number | null // returned / recipients, 0..1 (null when recipients=0)
}
