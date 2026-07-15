"use client"

// ---------------------------------------------------------------------------
// Engagement Center v2 — client shell (E4).
// ---------------------------------------------------------------------------
// OWNS: the contextual header pill, the 3 triage summary cards (from the
// server's GET /api/engagement/overview data) and the tab structure. It renders
// every tab component with the props each needs (defined in ./types).
//
// Central de Envios (decisão Hugo 2026-07-09): the individual action flow is no
// longer an overlay Sheet — it is the inline "Central de Envios" tab. When the
// page is deep-linked with `?student=&action=`, the shell auto-selects that tab
// and hands the params to it pre-filled; after a successful send the shell clears
// the querystring (router.replace) so the composer resets to manual mode.
//
// HISTÓRICO DEMOTED (E12 item 6, decisão Hugo 2026-07-09): the Histórico tab no
// longer competes as an equal-weight action tab. Its content + route are UNCHANGED
// — it is simply reached now via the "Mensagens enviadas" header link (Cards
// Mestre-Detalhe, fatia 1/6: this link moved off the summary grid, which is now
// 3 selectable triage cards). The tab value ("history") still exists so the
// deep-link and the header link can select it; it just isn't rendered as a
// top-level trigger.
//
// SINGLE SOURCE OF TRUTH FOR SCOPE (E4 AC2): the header pill AND the cards both
// read from the SAME `context` + `cards` the server resolved in one pass — no
// duplicated scope computation on the client.
// ---------------------------------------------------------------------------

import { SubtreeNodeList } from "@/app/(platform)/dashboard/_components/subtree-node-list"
import { TeamScopeControl } from "@/app/(platform)/dashboard/_components/team-scope-control"
import type { StudentTriagem } from "@/lib/student-triage"
import type { TemplateIntent } from "@/types/notifications"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MailCheck,
  TrendingUp,
  UserX,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { CampaignsTab } from "./campaigns-tab"
import { HistoryTab } from "./history-tab"
import { SendCenterTab } from "./send-center-tab"
import { SuggestedActionsTab } from "./suggested-actions-tab"
import { TemplatesTab } from "./templates-tab"
import type {
  EngagementContext,
  EngagementDeepLinkAction,
  EngagementOverviewCards,
  EngagementSuggestion,
  EngagementTab,
  EngagementTeamScope,
  SenderIdentityOptions,
} from "./types"

const INTENT_ORDER: TemplateIntent[] = [
  "primeiro_acesso",
  "retomada",
  "atraso_plano",
  "reflexao_pendente",
  "reconhecimento",
  "manual",
]

// "history" is intentionally excluded: it has no top-level trigger (E12 item
// 6) — it is reached only via the "Mensagens enviadas" header link, never as
// part of a card's contextual tab set.
type VisibleEngagementTab = Exclude<EngagementTab, "history">

const TAB_LABELS: Record<VisibleEngagementTab, string> = {
  suggested: "Ações Sugeridas",
  "send-center": "Central de Envios",
  campaigns: "Campanhas",
  templates: "Templates",
}

// Cards Mestre-Detalhe (fatia 2/6, doc 03 §1 item 2): which tabs are visible
// for each selected triage card. Fatia 2 established the LOOKUP MECHANISM with
// all 3 cards resolving to the SAME 4 tabs; fatia 3 (below) is the first to
// actually diverge one ("no_ritmo"). Central de Envios and Templates filtered
// by card is still later work (fatias 4-5).
//
// CONTRACT (Eng-Revisor, fatia 2 review): "send-center" MUST stay in every
// array below, no matter how later fatias diverge them. The pre-existing
// deep-link effect (`?student&action=`) unconditionally forces
// `activeTab = "send-center"` on every navigation, not just on mount — if a
// future card's array ever drops "send-center", that effect still wins (it
// fires independent of `activeCard`) and the CONTENT stays correct, but the
// TabsList would show no highlighted trigger for it (cosmetic, but a real
// bug). If fatia 5 needs a card whose array excludes "send-center", the guard
// effect below must also learn to defer to an active deep-link
// (`deepLinkStudent && deepLinkAction`) instead of it being solved by an
// always-present entry.
// Cards Mestre-Detalhe (fatia 3/6, doc 03 §4 decisão 1): "no_ritmo" drops
// "campaigns" — its collective-recognition flow ("Reconhecer em lote", the
// `no_ritmo` Campanhas segment) is embedded directly inside the "suggested"
// TabsContent as one of 2 simultaneous blocks (see the composition below),
// not a separate tab. The other 2 cards are untouched from fatia 2.
const TABS_BY_CARD: Record<StudentTriagem, VisibleEngagementTab[]> = {
  no_ritmo: ["suggested", "send-center", "templates"],
  sem_acesso: ["suggested", "send-center", "campaigns", "templates"],
  atencao: ["suggested", "send-center", "campaigns", "templates"],
}

interface SummaryCardSpec {
  key: string
  /** Canonical triage this card selects (Cards Mestre-Detalhe, fatia 1/6) —
   *  distinct from `key`, which stays a plain React/visual identifier. */
  triagem: StudentTriagem
  icon: React.ReactNode
  label: string
  value: string
  /** Optional "(pct%)" appended after the value, matching the dashboard cards. */
  pct?: number
  /** Colour of the big number (hex inline), matching the dashboard's palette. */
  valueColor?: string
  sublabel: string
  iconBg: string
  iconColor: string
}

/**
 * Summary cards, ALWAYS from the current recorte (server-resolved).
 *
 * E12 Rodada 5 (item 3): the top strip is the SAME three triage cards the
 * manager dashboard shows (dashboard/triage-cards.tsx) — No ritmo (verde) / Sem
 * acesso (âmbar) / Atenção (vermelho), same colours, same labels, same "(pct%)",
 * computed by the SAME canonical taxonomy (item 1). The old "Ações pendentes"
 * (redundant with Atenção, item 2) and "Taxa de leitura" ("lido" for an email
 * pixel is a lie, item 3) cards were removed. Colours are hex-inline per the
 * repo's theme convention (triage-cards.tsx comment: Tailwind color classes
 * aren't reliable in this v4 theme).
 *
 * Cards Mestre-Detalhe (fatia 1/6, doc 03): "Mensagens enviadas" left the grid
 * — it is a header link now (still lands on the "history" tab), not a
 * selectable card. The 3 remaining cards each carry a `triagem` so clicking one
 * can drive `activeCard` (this fatia only sets the state; wiring it to the tabs
 * and content comes in a later fatia).
 */
function buildSummaryCards(cards: EngagementOverviewCards): SummaryCardSpec[] {
  return [
    // Order mirrors TriageCards (Hugo 2026-07-07): verde → âmbar → vermelho.
    {
      key: "no-ritmo",
      triagem: "no_ritmo",
      icon: <TrendingUp size={20} />,
      label: "No ritmo",
      value: String(cards.noRitmo),
      pct: cards.noRitmoPct,
      valueColor: "#059669",
      sublabel: "ou adiantados",
      iconBg: "rgba(16,185,129,0.14)",
      iconColor: "#059669",
    },
    {
      key: "sem-acesso",
      triagem: "sem_acesso",
      icon: <UserX size={20} />,
      label: "Sem acesso",
      value: String(cards.semAcesso),
      pct: cards.semAcessoPct,
      valueColor: "#d97706",
      sublabel: "14+ dias sem acessar, em dia no curso",
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: "#d97706",
    },
    {
      key: "atencao",
      triagem: "atencao",
      icon: <AlertTriangle size={20} />,
      label: "Atenção",
      value: String(cards.atencao),
      pct: cards.atencaoPct,
      valueColor: "#dc2626",
      sublabel: "atrasados ou não iniciados",
      iconBg: "rgba(239,68,68,0.13)",
      iconColor: "#dc2626",
    },
  ]
}

export interface EngagementShellProps {
  context: EngagementContext
  cards: EngagementOverviewCards
  suggestions: EngagementSuggestion[]
  senderOptions: SenderIdentityOptions
  /** admin/manager/instructor may dispatch individual actions + dismiss. */
  canAct: boolean
  /** admin/manager only may run campaigns and edit templates. */
  canManageCampaigns: boolean
  /** Central de Envios deep-link (E10 table bridge): `?student&action=`. */
  initialStudentId: string | null
  initialAction: EngagementDeepLinkAction | null
  /**
   * Team-scope drill-down model (Rodada 3). Non-null only for a manager scoped
   * to a team recorte — drives the "Recorte da equipe" control (Diretos/Hierarquia
   * toggle + root→focus breadcrumb). `null` = no team control (admin tenant-wide,
   * instructor, organization).
   */
  teamScope: EngagementTeamScope | null
}

export function EngagementShell({
  context,
  cards,
  suggestions,
  senderOptions,
  canAct,
  canManageCampaigns,
  initialStudentId,
  initialAction,
  teamScope,
}: EngagementShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Current drill-down node (Rodada 3): the `?focus=` the breadcrumb sets. The
  // client tab refetches append it so their /api/engagement/* reads land on the
  // SAME node the server-rendered cards do (page & tabs never disagree — AC2).
  const focus = searchParams.get("focus")

  // Deep-link with a student + action → land straight on the Central de Envios,
  // pre-filled; otherwise the default tab is Ações Sugeridas.
  const deepLinked = Boolean(initialStudentId && initialAction)
  const [activeTab, setActiveTab] = useState<EngagementTab>(
    deepLinked ? "send-center" : "suggested",
  )

  // Cards Mestre-Detalhe (fatia 1/6, doc 03 §1): which triage card is selected,
  // if any. Fatia 2 default (Eng-Orquestrador decisão noturna reversível,
  // registrada em .floor/state.md, Hugo confirma de manhã): without a
  // deep-link, default to "atencao" (the most actionable/urgent card, same
  // bias "Ações Sugeridas" already has today as the always-visible default
  // tab). WITH a deep-link, leave it `null` — the Central de Envios opens
  // directly regardless of card, an independent flow (see the deep-link effect
  // below, unchanged from fatia 1).
  const [activeCard, setActiveCard] = useState<StudentTriagem | null>(deepLinked ? null : "atencao")

  // Cards Mestre-Detalhe (fatia 2/6, doc 03 §1 item 2): the tabs visible for
  // the current card. `activeCard ?? "atencao"` covers the deep-linked-null
  // case, keeping "send-center" reliably present for the deep-link flow
  // regardless of which/whether a card is selected (fatia 3 note: "no_ritmo"
  // now DIVERGES from the other 2 — see TABS_BY_CARD above — this fallback to
  // "atencao"'s array is still correct since both include "send-center").
  const visibleTabs = TABS_BY_CARD[activeCard ?? "atencao"]

  // Guards against an ORPHANED activeTab: if switching cards (or toggling one
  // off) makes the currently-selected tab disappear from the new card's
  // visible set, fall back to that set's first tab. Load-bearing as of fatia 3
  // (switching INTO "no_ritmo" while on "campaigns" now genuinely orphans it —
  // this effect is what falls back to "suggested" instead of a dead trigger).
  useEffect(() => {
    setActiveTab((current) =>
      visibleTabs.some((tab) => tab === current) ? current : visibleTabs[0],
    )
  }, [visibleTabs])

  // E12 Rodada 6 item 1 (CRÍTICO — Hugo ao vivo): "Revisar mensagem"/"Ação
  // individual" navigate CLIENT-SIDE to `/engagement?student=&action=` from a page
  // already mounted on `/engagement`. The `useState` initializer above ONLY runs on
  // the FIRST mount, so it never reacts to the deep-link params arriving later — the
  // URL changed but the tab never switched, and the buttons looked dead. This effect
  // makes the tab switch REACT to a newly-arriving deep-link (student + action both
  // present) instead of only seeding it once at mount.
  //
  // Rodada 7 hardening: key the effect on the RAW `?student` + `?action` query
  // values (searchParams), not only on the derived props. A repeat navigation to
  // the SAME student (deep-link A → back to Ações → deep-link A again) does not
  // change `initialStudentId`, so the prop-only deps would not re-fire and the tab
  // would stay put after the manager manually switched away. Reading the live query
  // string makes every genuine `router.push('/engagement?student=…')` re-select the
  // Central de Envios, matching what the manager expects from the button.
  const deepLinkStudent = searchParams.get("student")
  const deepLinkAction = searchParams.get("action")
  useEffect(() => {
    if (deepLinkStudent && deepLinkAction) {
      setActiveTab("send-center")
    }
  }, [deepLinkStudent, deepLinkAction])

  // After a successful send, clear `?student=&action=` so the composer resets to
  // manual mode and a browser refresh does not re-open the pre-filled flow.
  const handleSent = useCallback(() => {
    router.replace(pathname)
  }, [router, pathname])

  const summaryCards = buildSummaryCards(cards)

  // Shared by the standalone "campaigns" tab AND the "No ritmo" card's
  // embedded "Reconhecer em lote" block (fatia 3/6) — same 3 counts either way.
  const segmentCounts = {
    atencao: cards.atencao,
    semAcesso: cards.semAcesso,
    noRitmo: cards.noRitmo,
  }

  return (
    <div className="space-y-8">
      {/* --- Contextual header (E4 AC2): title + recorte control --- */}
      <section className="rounded-2xl bg-bg-card p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Ações de Engajamento
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Ações contextuais para acompanhar, lembrar e reconhecer alunos do seu time.
            </p>
            {/* Cards Mestre-Detalhe (fatia 1/6): "Mensagens enviadas" left the
                summary grid — it is a header link now, still landing on the
                (unrenamed) "history" tab value. */}
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <MailCheck size={14} className="text-cerrado-600" aria-hidden="true" />
              Mensagens enviadas
              <span className="font-semibold text-text-primary">{cards.mensagensEnviadas}</span>
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>
          {/* Admin tenant-wide / instructor / organization: static badge (no team
              control to drill). A manager in a team recorte gets the interactive
              control below instead. */}
          {!teamScope && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-cerrado-600/10 px-3 py-1 text-xs font-semibold text-cerrado-600 ring-1 ring-cerrado-600/30">
                {context.contextLabel}
              </span>
              {context.recorteLabel && (
                <span className="inline-flex items-center rounded-full bg-bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
                  {context.recorteLabel}
                </span>
              )}
              <span className="text-xs text-text-muted">
                {context.analyzedCount === null
                  ? "Todos os alunos"
                  : `${context.analyzedCount} aluno${context.analyzedCount === 1 ? "" : "s"} analisado${context.analyzedCount === 1 ? "" : "s"}`}
              </span>
            </div>
          )}
        </div>

        {/* RECORTE DA EQUIPE (Rodada 3, Hugo 2026-07-09): the pills are no longer
            static labels — they are the REAL Diretos/Hierarquia toggle + the
            root→focus drill-down breadcrumb, reusing the analytics dashboard's
            TeamScopeControl verbatim. Switching the toggle sets x-team-view and
            router.refresh()es (default = Diretos/"Meu Time"); clicking a breadcrumb
            segment sets ?focus= and re-renders the whole page + tabs at that node.
            The tree starts at the manager's own reports (Diretos) and expands node
            by node — never flattened by default. */}
        {teamScope && (
          <div className="mt-5 space-y-5 border-t border-border-subtle pt-5">
            <TeamScopeControl
              trail={teamScope.trail}
              rootId={teamScope.rootId}
              rootLabel="Meu Time"
              mode={teamScope.mode}
              isRoot={teamScope.isRoot}
              focusedLabel={teamScope.focusedLabel}
              analyzedCount={context.analyzedCount ?? undefined}
            />
            {/* "Times abaixo" — the DESCER affordance (Hugo's "ir abrindo a
                hierarquia"). Only in Hierarquia mode: the manager starts at their
                own level and expands node by node, never flattened. In Diretos the
                page is already the direct-reports slice, so no drill list. Reuses
                the dashboard's SubtreeNodeList verbatim: clicking a subteam sets
                ?focus= and re-renders the whole page + tabs at that node. */}
            {teamScope.mode === "hierarchy" && teamScope.subteams.length > 0 && (
              <SubtreeNodeList
                subteams={teamScope.subteams.map((s) => ({
                  id: s.id,
                  fullName: s.fullName,
                  studentCount: s.studentCount,
                }))}
              />
            )}
          </div>
        )}
      </section>

      {/* --- Summary cards (E4 AC3): always the current recorte --- */}
      {/* Cards Mestre-Detalhe (fatia 1/6, doc 03 §1): the 3 triage cards are now
          selectors, not static tiles. Clicking one sets `activeCard`; clicking
          the already-active card toggles it back off. This fatia ONLY tracks
          the selection + its `ring-2` highlight — it does not yet filter tab
          content or the URL (later fatias). */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => {
          const isActive = activeCard === card.triagem
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveCard(isActive ? null : card.triagem)}
              className={`flex items-start gap-3 rounded-2xl bg-bg-card p-4 text-left shadow-card transition-shadow ${
                isActive ? "ring-2 ring-cerrado-600" : ""
              }`}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: card.iconBg, color: card.iconColor }}
                aria-hidden="true"
              >
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-muted">{card.label}</p>
                <p className="text-[26px] font-bold leading-tight text-text-primary">
                  <span style={card.valueColor ? { color: card.valueColor } : undefined}>
                    {card.value}
                  </span>
                  {typeof card.pct === "number" && (
                    <span className="text-sm font-normal text-text-muted"> ({card.pct}%)</span>
                  )}
                </p>
                <p className="text-[11px] text-text-muted">{card.sublabel}</p>
              </div>
            </button>
          )
        })}
      </section>

      {/* --- Tabs: contextual per selected card (Cards Mestre-Detalhe, fatia 2/6,
          doc 03 §1 item 2) --- the TabsList is no longer a fixed 4-trigger
          array: it renders `visibleTabs` (TABS_BY_CARD[activeCard]). As of
          fatia 3, "no_ritmo" genuinely diverges (no "campaigns" trigger — its
          collective-recognition flow moved into the "suggested" composition
          below); "atencao"/"sem_acesso" are still the 4-tab default.
          Histórico is NO LONGER a top-level trigger (E12 item 6) — it is reached
          from the "Mensagens enviadas" header link (Cards Mestre-Detalhe, fatia
          1/6, moved off the summary grid). Its TabsContent stays mounted below
          so the value can still be selected. --- */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EngagementTab)}>
        <TabsList>
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="suggested">
          {activeCard === "no_ritmo" ? (
            // Cards Mestre-Detalhe (fatia 3/6, doc 03 §4 decisão 1): "No ritmo"
            // shows 2 SIMULTANEOUS blocks on the same screen (not tabs, not
            // navigation between states) — "Destaques" (curated top-3,
            // individual action, `initialType="top_performer"`) and "Reconhecer
            // em lote" (the full no_ritmo cohort, collective action via
            // Campanhas' `no_ritmo` segment, `autoOpenSegment="no_ritmo"`
            // skips its picker). Neither prop is wired to a `?type=`/`?segment=`
            // deep-link yet — that is fatia 6.
            <div className="space-y-8">
              <section>
                <h2 className="mb-3 text-sm font-semibold text-text-primary">Destaques</h2>
                <SuggestedActionsTab
                  initialSuggestions={suggestions}
                  context={context}
                  senderOptions={senderOptions}
                  canAct={canAct}
                  focus={focus}
                  initialType="top_performer"
                />
              </section>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-text-primary">Reconhecer em lote</h2>
                <CampaignsTab
                  segmentCounts={segmentCounts}
                  context={context}
                  senderOptions={senderOptions}
                  canManageCampaigns={canManageCampaigns}
                  focus={focus}
                  autoOpenSegment="no_ritmo"
                />
              </section>
            </div>
          ) : (
            <SuggestedActionsTab
              initialSuggestions={suggestions}
              context={context}
              senderOptions={senderOptions}
              canAct={canAct}
              focus={focus}
            />
          )}
        </TabsContent>

        <TabsContent value="send-center">
          <SendCenterTab
            initialStudentId={initialStudentId}
            initialAction={initialAction}
            senderOptions={senderOptions}
            context={context}
            canAct={canAct}
            onSent={handleSent}
            focus={focus}
          />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsTab
            segmentCounts={segmentCounts}
            context={context}
            senderOptions={senderOptions}
            canManageCampaigns={canManageCampaigns}
            focus={focus}
          />
        </TabsContent>

        <TabsContent value="history">
          {/* Histórico has no top-level trigger (E12 item 6), so give an explicit
              way back to the action tabs — the user arrived here via the card link. */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("suggested")}
              className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Voltar às ações
            </button>
          </div>
          <HistoryTab context={context} focusedStudentId={initialStudentId} focus={focus} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab canEditTemplates={canManageCampaigns} intentOrder={INTENT_ORDER} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
