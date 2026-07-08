// ---------------------------------------------------------------------------
// Engagement Center v2 — shared prop contracts for the /engagement shell (E4).
// ---------------------------------------------------------------------------
// E4 owns the shell (page.tsx + engagement-shell.tsx) and DEFINES the prop
// interfaces here so E5–E9 only fill in the body of their own tab component,
// never touching page.tsx nor the shell. Each interface is derived from:
//   • the REAL response contracts of the /api/engagement/* routes (E3), and
//   • the acceptance criteria of the tab's own story (E5–E9).
//
// The `initial*` props are the server-rendered first paint (from page.tsx);
// tab components own their client-side refetch/reactivity on top of them.
// ---------------------------------------------------------------------------

import type { NudgeType, SenderIdentity, TemplateIntent } from "@/types/notifications"

// --- Context resolved server-side (header pill + card scoping) -------------

/**
 * How the manager's current recorte is labelled in the contextual header.
 *   • "team-direct"    → "Meu Time" viewing only direct members (x-team-view=direct)
 *   • "team-hierarchy" → "Meu Time" viewing the whole reachable subtree
 *   • "organization"   → the wider org context (not the team slice)
 *   • "tenant"         → admin/super_admin, tenant-wide (no student scoping)
 */
export type EngagementContextKind = "team-direct" | "team-hierarchy" | "organization" | "tenant"

export interface EngagementContext {
  kind: EngagementContextKind
  /** Human label for the context pill: "Meu Time" | "Diretos" | "Hierarquia" | "Organização" | "Todos". */
  contextLabel: string
  /** Name of the current recorte (team/unit/org name), when applicable. */
  recorteLabel: string | null
  /**
   * Number of students in the current recorte. `null` only for the tenant-wide
   * admin case where the universe is the whole tenant (shown as "Todos os alunos").
   */
  analyzedCount: number | null
  /** Whether the caller is scoped tenant-wide (admin/super_admin). */
  tenantWide: boolean
}

// --- Overview cards (GET /api/engagement/overview → `cards`) ---------------

/** Mirrors the `cards` block of GET /api/engagement/overview (E3). */
export interface EngagementOverviewCards {
  acoesPendentes: number
  alunosEmAtencao: number
  semAcessoRecente: number
  mensagensEnviadas: number
  taxaLeituraPct: number
}

/** Mirrors the `suggestions` block of GET /api/engagement/overview (E3). */
export interface EngagementSuggestion {
  id: string
  type: NudgeType
  targetStudentIds: string[]
  templateKey: string | null
  rationale: string | null
  status: string
  managerId: string | null
}

/** Full server response of GET /api/engagement/overview (E3). */
export interface EngagementOverviewResponse {
  scope: { tenantWide: boolean; studentCount: number | null }
  cards: EngagementOverviewCards
  suggestions: EngagementSuggestion[]
}

// --- Sender identity default (server-trusted manager name) -----------------

/**
 * The message-origin options a tab needs to render the "Origem da mensagem"
 * selector (E5/E6/E7). `managerName` is the server-trusted name of the caller;
 * a tab MUST never let the user type a different manager name (E3 forces the
 * server value on dispatch). `null` for admin/platform-only callers.
 */
export interface SenderIdentityOptions {
  defaultIdentity: SenderIdentity
  managerName: string | null
}

// ===========================================================================
// Per-tab prop contracts (each filled in by its own story)
// ===========================================================================

/**
 * E5 — Aba Ações Sugeridas (default tab). Renders the live-computed suggestion
 * cards for the current recorte. Data source: GET /api/engagement/overview
 * (`suggestions` block), already scoped. Dispatch/preview reuse E6's shared
 * MessagePreviewPanel and POST /api/engagement/{action,campaign}.
 */
export interface SuggestedActionsTabProps {
  /** Server-rendered first paint of suggestions (empty array = no pending actions). */
  initialSuggestions: EngagementSuggestion[]
  /** The recorte these suggestions belong to (for refetch + empty-state copy). */
  context: EngagementContext
  /** Message-origin defaults for the shared preview panel. */
  senderOptions: SenderIdentityOptions
  /** Whether the caller may dispatch/dismiss (admin/manager/instructor). */
  canAct: boolean
}

/**
 * E6 — Fluxo de Ação Individual (Sheet, not a tab). Owns the lateral Sheet
 * opened either by `?student&action=` query params (from the E10 table bridge)
 * or by clicking a single student inside E5. Dispatch: POST /api/engagement/action.
 * The shell mounts this once and controls its open state; the query params are
 * read by the Sheet itself.
 */
export interface IndividualActionSheetProps {
  /** Controlled open state (shell owns it so tabs can trigger the Sheet). */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Target student id + intent, when opened from the table bridge (E10) or E5. */
  studentId: string | null
  /** "remind" (Lembrar, lighter) | "activate" (Acionar, stronger, + comms history). */
  action: "remind" | "activate" | null
  /** Message-origin defaults (server-trusted manager name). */
  senderOptions: SenderIdentityOptions
  /** The active recorte (for the scope guard message + comms-history query). */
  context: EngagementContext
}

/**
 * E7 — Aba Campanhas. Lists the auto-generated contextual cohorts of the
 * current recorte and runs the mandatory preview→review→confirm flow. Data
 * source for cohorts: same GET /api/engagement/overview (`suggestions`).
 * Dispatch: POST /api/engagement/campaign (preview | confirm), cap 200.
 */
export interface CampaignsTabProps {
  /** Auto-generated cohorts (same source as suggestions, campaign lens). */
  initialCohorts: EngagementSuggestion[]
  context: EngagementContext
  senderOptions: SenderIdentityOptions
  /** Whether the caller may run campaigns (admin/manager only). */
  canManageCampaigns: boolean
}

/**
 * E8 — Aba Histórico. Scoped table of sent communications. Data source:
 * GET /api/engagement/history (already scoped by recipient_id ∈ allowedStudentIds).
 * Fetched client-side because it carries query-string filters.
 */
export interface HistoryTabProps {
  context: EngagementContext
  /**
   * Optional pre-focused student id (e.g. deep-linked from the table). Restricts
   * the initial history query to that student; the server still re-scopes.
   */
  focusedStudentId: string | null
}

/**
 * E9 — Aba Templates. Lists tenant templates grouped by human `intent` (never
 * the raw `key`). Data source: GET /api/engagement/templates; edit via
 * PATCH /api/engagement/templates/{id}. Edit is admin/manager only.
 */
export interface TemplatesTabProps {
  /** Whether the caller may edit templates (admin/manager, mirrors nt_write RLS). */
  canEditTemplates: boolean
  /**
   * The intent categories to group under, in display order (E9 AC1). The shell
   * passes the canonical order so an empty category still renders its heading.
   */
  intentOrder: TemplateIntent[]
}

// --- Tab identity ----------------------------------------------------------

/** The four in-page tabs (Ação Individual is a Sheet, E6, not a tab). */
export type EngagementTab = "suggested" | "campaigns" | "history" | "templates"
