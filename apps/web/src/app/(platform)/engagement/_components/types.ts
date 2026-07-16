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

import type {
  CampaignSegment,
  NudgeType,
  SenderIdentity,
  TemplateIntent,
} from "@/types/notifications"

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

/**
 * TEAM-SCOPE drill-down model (Rodada 3, 2026-07-09). Resolved server-side from
 * resolveDrilldownNav + the x-team-view cookie, this is what the shell needs to
 * render the SAME "Recorte da equipe" control the analytics dashboard has
 * (TeamScopeControl): the Diretos/Hierarquia toggle + the root→focus breadcrumb.
 * `null` when the caller is NOT a manager in a team recorte (admin tenant-wide,
 * instructor, organization) — the shell renders no team control in that case.
 */
export interface EngagementTeamScope {
  /** Diretos | Hierarquia — the x-team-view cookie state (default "direct"). */
  mode: TeamViewModeValue
  /** Breadcrumb trail root→focus; each segment sets ?focus= (root clears it). */
  trail: Array<{ id: string; fullName: string }>
  /** Manager's own user id (the subtree root). Focusing it clears ?focus. */
  rootId: string
  /** Whether the current focus is the root node. */
  isRoot: boolean
  /** Focused node label ("Meu Time" at root, else the node's name). */
  focusedLabel: string
  /**
   * Direct-report MANAGERS under the focused node, each with its subtree's
   * student count. This is the "descer"/"Times abaixo" affordance — clicking one
   * sets ?focus= and drills the WHOLE page + tabs into that subteam. Empty for a
   * leaf node (nothing left to expand). Only surfaced in Hierarquia mode (the
   * shell hides it in Diretos, mirroring the analytics dashboard's tree).
   */
  subteams: Array<{ id: string; fullName: string; studentCount: number }>
}

/** Diretos | Hierarquia. Re-declared here (not imported from lib) so the client
 *  bundle of the shell does not pull in the server-only team-view-context module. */
export type TeamViewModeValue = "direct" | "hierarchy"

// --- Overview cards (GET /api/engagement/overview → `cards`) ---------------

/**
 * Mirrors the `cards` block of GET /api/engagement/overview (E3).
 *
 * E12 Rodada 5 (items 1-3): the top cards are now the CANONICAL triage buckets
 * (No ritmo / Sem acesso / Atenção — the exact three the dashboard's TriageCards
 * render, same colours + calc, item 3) plus "Mensagens enviadas" (the channel
 * metric the dashboard doesn't carry). `acoesPendentes` (redundant with Atenção,
 * item 2) and `taxaLeituraPct` ("lido" for an email pixel is a lie, item 3) were
 * removed from the top strip.
 */
export interface EngagementOverviewCards {
  /** Total students analysed in the recorte (the denominator for the %s). */
  analisados: number
  noRitmo: number
  semAcesso: number
  atencao: number
  noRitmoPct: number
  semAcessoPct: number
  atencaoPct: number
  mensagensEnviadas: number
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
  /** Active drill-down node (Rodada 3): appended to /api/engagement/* refetches
   *  so a tab's data lands on the SAME node the server-rendered cards do. */
  focus?: string | null
  /**
   * Cards Mestre-Detalhe (fatia 3/6, doc 03 §4 decisão 1): when present, only
   * suggestions of this `NudgeType` render (e.g. the "Destaques" block inside
   * the "No ritmo" card composition filters to `top_performer`). `undefined`/
   * `null` = no filter (every live cohort renders, today's default behaviour).
   * Not yet wired to the `?type=` deep-link (fatia 6 connects it).
   */
  initialType?: NudgeType | null
  /**
   * Cards Mestre-Detalhe (fatia 4/6, doc 03 §4 decisão 4): restricts which
   * cohorts a CARD's block shows (e.g. "Atenção" only shows never_accessed +
   * behind_teaching_plan + no_reflection; "Sem acesso" only shows inactive).
   * DISTINCT from `initialType` (a single-value deep-link filter) — the two
   * can coexist: `allowedTypes` narrows first, `initialType` highlights/filters
   * within what remains. `undefined` = no restriction (every live cohort
   * renders, today's default for cards that don't use this yet).
   */
  allowedTypes?: NudgeType[]
}

/**
 * The individual action verb the Central de Envios composes for:
 *   • "remind"    (Lembrar, lighter)   • "activate" (Acionar, stronger, + comms history)
 *   • "recognize" (Parabenizar, POSITIVE tone — green, top_performer)
 *   • "manual"    (free composition — the manager writes a template from scratch)
 * `remind|activate|recognize` are the deep-link verbs (`?action=`); `manual` is a
 * picker-only mode that never arrives via URL.
 */
export type EngagementActionKind = "remind" | "activate" | "recognize" | "manual"

/** The `?action=` deep-link verbs (subset of EngagementActionKind, no `manual`). */
export type EngagementDeepLinkAction = "remind" | "activate" | "recognize"

/**
 * Scoped per-student projection returned by GET /api/engagement/students?ids= .
 * Promoted from the old overlay's local declaration (E6 Dev Agent Record
 * registered this lacuna: "if the shell needs this shape it should be lifted into
 * types.ts") because the Central de Envios (a shell-hosted tab) now consumes it.
 */
export interface EngagementStudentDetail {
  id: string
  fullName: string | null
  totalSessions: number
  completedSessions: number
  reflectionsCount: number
  /** Whole days since the last session; null if the student never accessed. */
  daysSinceLastActivity: number | null
  /** Highest enrollment progress %, 0..100. */
  progressPct: number
  behindSchedule: boolean
  ritmo: "no_ritmo" | "atrasado" | "nao_iniciado"
  /** Human triage status for the "Status atual" badge. */
  status: "no_ritmo" | "atencao" | "sem_acesso"
  /**
   * Rodada 4 (E12): enrollment counts, so consumers can derive the SAME
   * RitmoDisplay pill as the main table (the "Concluído" state needs
   * coursesCompleted === coursesEnrolled). Optional to keep prior consumers intact.
   */
  coursesEnrolled?: number
  coursesCompleted?: number
  nudgeType: NudgeType
  /** Template key that pre-fills the preview, from NUDGE_TYPE_TEMPLATE_KEY. */
  templateKey: string | null
}

/** Light student row for the manual picker (GET /api/engagement/students?q=). */
export interface EngagementStudentOption {
  id: string
  fullName: string | null
}

/**
 * Central de Envios — INLINE tab that replaces the old individual-action overlay
 * (decisão de produto Hugo, 2026-07-09). Serves two flows:
 *   (a) automated  — opened pre-filled from the students table via `?student=&action=`
 *   (b) manual     — the manager opens it directly and picks a student from a
 *                    scoped picker, then composes the message.
 * Dispatch: POST /api/engagement/action (server re-scopes). Data: the scoped
 * GET /api/engagement/students (detail via ids, picker via q) + GET /history.
 */
export interface SendCenterTabProps {
  /** Deep-link student id from `?student=` (automated flow); null = manual mode. */
  initialStudentId: string | null
  /** Deep-link action verb from `?action=` (automated flow); null = manual mode. */
  initialAction: EngagementDeepLinkAction | null
  /** Message-origin defaults (server-trusted manager name). */
  senderOptions: SenderIdentityOptions
  /** The active recorte (scope guard copy + the manual picker's universe). */
  context: EngagementContext
  /** Whether the caller may dispatch (admin/manager/instructor). */
  canAct: boolean
  /** Called after a successful send so the shell can clear the querystring. */
  onSent?: () => void
  /** Active drill-down node (Rodada 3): appended to the picker/detail/history
   *  reads so the composer's universe matches the current tree node. */
  focus?: string | null
  /**
   * Cards Mestre-Detalhe (fatia 5/6, doc 03 §4 decisão 3): when present and
   * non-empty, the manual picker additionally narrows to these ids (e.g. the
   * "Atenção" card only lets the manager pick among its own cohorts). Sent to
   * the route as `?studentIds=`, which INTERSECTS this list with the
   * already-resolved recorte server-side — it can only narrow, never widen.
   * `undefined`/empty = no additional restriction (today's default picker,
   * still bounded to the recorte).
   */
  restrictToStudentIds?: string[]
}

/**
 * E17 — Aba Campanhas (redesign E13). Entry is the 3 unified-semáforo SEGMENTS of
 * the current recorte (not the 5 nudgeTypes); each segment opens a per-aluno
 * review table (variation by line, D4) that dispatches a campaign, then shows the
 * campaign as an observable object (aberta/encerrada, loop fechado — E16).
 * Preview/confirm: POST /api/engagement/campaign (segment | recipients), cap 200.
 * Result/close: GET/PATCH /api/engagement/campaign/:id.
 */
export interface CampaignsTabProps {
  /**
   * Segment counts of the current recorte (E17 AC1), from the overview cards. The
   * 3 unified-semáforo states — the SAME taxonomy the top cards + dashboard use.
   * 🟢 no_ritmo is an OPTIONAL reconhecimento segment (D3).
   */
  segmentCounts: { atencao: number; semAcesso: number; noRitmo: number }
  context: EngagementContext
  senderOptions: SenderIdentityOptions
  /** Whether the caller may run campaigns (admin/manager only). */
  canManageCampaigns: boolean
  /** Active drill-down node (Rodada 3): appended to preview/confirm/result so a
   *  campaign is gated to the current tree node. */
  focus?: string | null
  /**
   * Cards Mestre-Detalhe (fatia 10, replacing the fatia 3/6 cosmetic-hint
   * prop this superseded): when present, the component operates in SCOPED
   * mode for this ONE segment — it NEVER renders the 3-segment picker, not
   * even transiently.
   * It starts straight in a loading state, fetches automatically, and lands
   * on the review table (e.g. the "Reconhecer em lote" tab for the "No
   * ritmo" card, scoped to `no_ritmo`). On failure, it offers a retry for
   * THIS segment only (no "back to segments" — there is nowhere else to go
   * in scoped mode). `undefined`/`null` = normal behaviour, picker shown
   * first (the standalone "Campanhas" tab).
   */
  scopedSegment?: CampaignSegment | null
  /**
   * Cards Mestre-Detalhe (fatia 14, Achado 1 do bug ao vivo do Hugo): when
   * present, the standalone "Campanhas" picker screen shows ONLY the
   * segments listed here (e.g. `["atencao", "no_reflection"]` for the
   * "Atenção" card, `["sem_acesso"]` for "Sem acesso") instead of all 4.
   * DISTINCT from `scopedSegment` above: this FILTERS the picker, it does
   * NOT skip it — a card can map to more than one segment (Atenção maps to
   * 2, atencao + no_reflection since fatia 15), so there is a genuine choice
   * to present, unlike "Reconhecer em lote" (1 segment, no picker needed at
   * all). `undefined`/`null` = all 4 segments shown (the "No ritmo" card has
   * no Campanhas tab at all — it uses `scopedSegment` on a separate tab).
   */
  restrictToSegments?: CampaignSegment[]
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
  /** Active drill-down node (Rodada 3): appended to the history read so the table
   *  reflects the current tree node (distinct from `focusedStudentId`, which is a
   *  single-student filter). */
  focus?: string | null
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

/**
 * The in-page tabs. "send-center" (Central de Envios) is the inline composer
 * that replaced the individual-action overlay (decisão Hugo 2026-07-09).
 * "batch-recognition" (fatia 8, Hugo ao vivo): "Reconhecer em lote" promoted
 * from a block embedded inside "suggested" (fatia 3) to its own top-level tab,
 * visible only for the "No ritmo" card. Named distinctly from `"recognize"`
 * (EngagementActionKind/EngagementDeepLinkAction below — a DIFFERENT union)
 * to avoid confusion when reading the code, even though the two never collide.
 */
export type EngagementTab =
  | "suggested"
  | "send-center"
  | "campaigns"
  | "history"
  | "templates"
  | "batch-recognition"
