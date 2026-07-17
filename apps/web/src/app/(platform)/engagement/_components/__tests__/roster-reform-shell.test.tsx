import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { EngagementShell } from "../engagement-shell"
import type { EngagementCardStudentIds } from "../types"

// =============================================================================
// Fatia 16 (spec §7.1.3) — shell behaviour of the roster reform:
//   • clicking a semáforo card SELECTS the "Lista" (roster) tab inline;
//   • toggling the active card off does not lock the tabs;
//   • TABS_BY_CARD.no_ritmo now includes "roster" (the fatia 12 interim
//     decision, resolved by Hugo's explicit order — all 3 cards get a Lista).
// Child tabs are mocked: this test exercises the SHELL's selection wiring, not
// the tabs' internals. RosterTab's mock renders the studentIds it received so
// the test can also assert the card→cohort wiring (cardStudentIds[activeCard]).
// =============================================================================

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/engagement",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("../roster-tab", () => ({
  RosterTab: ({ studentIds }: { studentIds: string[] | null }) => (
    <div data-testid="roster-mock">{studentIds === null ? "null" : studentIds.join(",")}</div>
  ),
}))
vi.mock("../suggested-actions-tab", () => ({
  SuggestedActionsTab: () => <div data-testid="suggested-mock" />,
}))
vi.mock("../send-center-tab", () => ({
  SendCenterTab: () => <div data-testid="send-center-mock" />,
}))
vi.mock("../campaigns-tab", () => ({
  CampaignsTab: () => <div data-testid="campaigns-mock" />,
}))
vi.mock("../templates-tab", () => ({
  TemplatesTab: () => <div data-testid="templates-mock" />,
}))
vi.mock("../history-tab", () => ({
  HistoryTab: () => <div data-testid="history-mock" />,
}))

const CARD_STUDENT_IDS: EngagementCardStudentIds = {
  no_ritmo: ["nr-1", "nr-2"],
  sem_acesso: ["sa-1"],
  atencao: ["at-1", "at-2", "at-3"],
}

function renderShell() {
  return render(
    <EngagementShell
      context={{
        kind: "tenant",
        contextLabel: "Todos",
        recorteLabel: "Todos os alunos",
        analyzedCount: null,
        tenantWide: true,
      }}
      cards={{
        analisados: 6,
        noRitmo: 2,
        semAcesso: 1,
        atencao: 3,
        noRitmoPct: 33,
        semAcessoPct: 17,
        atencaoPct: 50,
        mensagensEnviadas: 0,
      }}
      suggestions={[]}
      senderOptions={{ defaultIdentity: "platform", managerName: null }}
      canAct={true}
      canManageCampaigns={true}
      initialStudentId={null}
      initialAction={null}
      initialType={null}
      cardStudentIds={CARD_STUDENT_IDS}
      teamScope={null}
    />,
  )
}

function cardButton(label: RegExp): HTMLElement {
  // The semáforo cards are aria-pressed toggle buttons; tab triggers are
  // role="tab", so this never collides with the "Lista" trigger.
  return screen
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-pressed"))
    .find((b) => label.test(b.textContent ?? "")) as HTMLElement
}

describe("EngagementShell — roster reform (fatia 16)", () => {
  it("clicking a card auto-selects the Lista tab with that card's FULL cohort", () => {
    renderShell()
    // Default mount: card "atencao" selected, tab "suggested" (unchanged — the
    // GOAL is about CLICK, not load).
    expect(screen.getByTestId("suggested-mock")).toBeInTheDocument()
    expect(screen.queryByTestId("roster-mock")).not.toBeInTheDocument()

    fireEvent.click(cardButton(/Sem acesso/))

    // Lista is now the active tab, inline, fed by cardStudentIds.sem_acesso.
    expect(screen.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("sa-1")
  })

  it('TABS_BY_CARD.no_ritmo now includes "roster": No ritmo gets a Lista with its whole bucket', () => {
    renderShell()
    fireEvent.click(cardButton(/No ritmo/))

    expect(screen.getByRole("tab", { name: "Lista" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("nr-1,nr-2")
  })

  it("switching cards with Lista open swaps to the NEW card's cohort (never another card's)", () => {
    renderShell()
    // "atencao" is the DEFAULT active card on mount, so start by selecting a
    // different one (a click on the default card would be a toggle-off).
    fireEvent.click(cardButton(/Sem acesso/))
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("sa-1")

    fireEvent.click(cardButton(/Atenção/))
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("at-1,at-2,at-3")
    expect(screen.getByTestId("roster-mock")).not.toHaveTextContent("sa-1")
  })

  it("toggling the active card OFF does not lock the tabs (roster gets null, tabs keep rendering)", () => {
    renderShell()
    const semAcesso = cardButton(/Sem acesso/)
    fireEvent.click(semAcesso) // select → roster
    fireEvent.click(semAcesso) // toggle off

    // No crash, tablist still there, and the roster tab (still active via the
    // orphan-guard fallback set) now renders its "no card" state (null).
    expect(screen.getByRole("tablist")).toBeInTheDocument()
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("null")
    // Tabs remain clickable after the toggle-off.
    fireEvent.click(screen.getByRole("tab", { name: "Ações Sugeridas" }))
    expect(screen.getByTestId("suggested-mock")).toBeInTheDocument()
  })
})
