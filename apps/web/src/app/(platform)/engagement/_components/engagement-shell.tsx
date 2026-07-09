"use client"

// ---------------------------------------------------------------------------
// Engagement Center v2 — client shell (E4).
// ---------------------------------------------------------------------------
// OWNS: the contextual header pill, the 5 summary cards (from the server's
// GET /api/engagement/overview data), the tab structure, and the Individual
// Action Sheet mount. It renders every tab component with the props each will
// need (defined in ./types), so E5–E9 only fill their own component body.
//
// SINGLE SOURCE OF TRUTH FOR SCOPE (E4 AC2): the header pill AND the cards both
// read from the SAME `context` + `cards` the server resolved in one pass — no
// duplicated scope computation on the client.
// ---------------------------------------------------------------------------

import type { TemplateIntent } from "@/types/notifications"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import { AlertTriangle, Inbox, MailCheck, MailOpen, UserX } from "lucide-react"
import { useState } from "react"
import { CampaignsTab } from "./campaigns-tab"
import { HistoryTab } from "./history-tab"
import { IndividualActionSheet } from "./individual-action-sheet"
import { SuggestedActionsTab } from "./suggested-actions-tab"
import { TemplatesTab } from "./templates-tab"
import type {
  EngagementContext,
  EngagementOverviewCards,
  EngagementSuggestion,
  EngagementTab,
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

interface SummaryCardSpec {
  key: string
  icon: React.ReactNode
  label: string
  value: string
  sublabel: string
  iconBg: string
  iconColor: string
}

/**
 * Summary cards, ALWAYS from the current recorte (server-resolved). Visual
 * pattern mirrors dashboard/triage-cards.tsx (circular colored icon, big value,
 * small sublabel). Colors are hex-inline per the repo's theme convention
 * (triage-cards.tsx comment: Tailwind color classes aren't reliable in this
 * v4 theme). Semantic mapping (AC7): âmbar=sem acesso, vermelho=atenção,
 * azul=neutro, verde=leitura saudável.
 */
function buildSummaryCards(cards: EngagementOverviewCards): SummaryCardSpec[] {
  return [
    {
      key: "acoes-pendentes",
      icon: <Inbox size={20} />,
      label: "Ações pendentes",
      value: String(cards.acoesPendentes),
      sublabel: "sugestões para o recorte atual",
      iconBg: "rgba(59,130,246,0.13)",
      iconColor: "#2563eb",
    },
    {
      key: "alunos-atencao",
      icon: <AlertTriangle size={20} />,
      label: "Alunos em atenção",
      value: String(cards.alunosEmAtencao),
      sublabel: "nunca acessaram",
      iconBg: "rgba(239,68,68,0.13)",
      iconColor: "#dc2626",
    },
    {
      key: "sem-acesso",
      icon: <UserX size={20} />,
      label: "Sem acesso recente",
      value: String(cards.semAcessoRecente),
      sublabel: "14+ dias sem acessar",
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: "#d97706",
    },
    {
      key: "mensagens-enviadas",
      icon: <MailCheck size={20} />,
      label: "Mensagens enviadas",
      value: String(cards.mensagensEnviadas),
      sublabel: "in-app neste recorte",
      iconBg: "rgba(99,102,241,0.13)",
      iconColor: "#4f46e5",
    },
    {
      key: "taxa-leitura",
      icon: <MailOpen size={20} />,
      label: "Taxa de leitura",
      value: `${cards.taxaLeituraPct}%`,
      sublabel: "das mensagens enviadas",
      iconBg: "rgba(16,185,129,0.14)",
      iconColor: "#059669",
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
  /** Sheet deep-link entry (E6/E10): `?student&action=` resolved server-side. */
  initialStudentId: string | null
  initialAction: "remind" | "activate" | "recognize" | null
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
}: EngagementShellProps) {
  const [activeTab, setActiveTab] = useState<EngagementTab>("suggested")
  // The Individual Action Sheet (E6) opens if the page was deep-linked with a
  // student + action; E6/E5 will also open it programmatically later.
  const [sheetOpen, setSheetOpen] = useState<boolean>(Boolean(initialStudentId && initialAction))

  const summaryCards = buildSummaryCards(cards)

  return (
    <div className="space-y-8">
      {/* --- Contextual header (E4 AC2): pill + recorte + analyzed count --- */}
      <section className="rounded-2xl bg-bg-card p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Centro de Engajamento
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Ações contextuais para acompanhar, lembrar e reconhecer alunos do seu time.
            </p>
          </div>
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
        </div>
      </section>

      {/* --- Summary cards (E4 AC3): always the current recorte --- */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className="flex items-start gap-3 rounded-2xl bg-bg-card p-4 shadow-card"
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
              <p className="text-[26px] font-bold leading-tight text-text-primary">{card.value}</p>
              <p className="text-[11px] text-text-muted">{card.sublabel}</p>
            </div>
          </div>
        ))}
      </section>

      {/* --- Tabs (E4 AC4): Ações Sugeridas (default), Campanhas, Histórico, Templates --- */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EngagementTab)}>
        <TabsList>
          <TabsTrigger value="suggested">Ações Sugeridas</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="suggested">
          <SuggestedActionsTab
            initialSuggestions={suggestions}
            context={context}
            senderOptions={senderOptions}
            canAct={canAct}
          />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsTab
            initialCohorts={suggestions}
            context={context}
            senderOptions={senderOptions}
            canManageCampaigns={canManageCampaigns}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab context={context} focusedStudentId={initialStudentId} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab canEditTemplates={canManageCampaigns} intentOrder={INTENT_ORDER} />
        </TabsContent>
      </Tabs>

      {/* --- Individual Action Sheet (E6): mounted once, shell controls open --- */}
      <IndividualActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        studentId={initialStudentId}
        action={initialAction}
        senderOptions={senderOptions}
        context={context}
      />
    </div>
  )
}
