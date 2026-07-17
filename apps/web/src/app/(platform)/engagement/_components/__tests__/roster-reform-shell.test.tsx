import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EngagementShell } from "../engagement-shell"
import type { EngagementCardStudentIds } from "../types"

// =============================================================================
// Fatia 16b (spec-roster-reforma-v2.md §7) — shell behaviour of the roster
// REPOSITIONING (Hugo: tabela aprovada, posicionamento rejeitado — "não tem
// que ter uma aba chamada Lista, tem que estar em todas as abas"):
//   1. no tab named Lista exists, for any of the 3 cards;
//   2. clicking a card shows the PERSISTENT SECTION (roster-section) with that
//      card's FULL cohort, without changing the active tab;
//   3. the section persists across EVERY tab switch (including Histórico via
//      the header link), with the same cohort;
//   4. switching cards swaps the section's cohort, never showing another
//      card's content (fatia 11 invariant);
//   5. toggling the active card off removes the section, tabs keep working;
//   6. the `?student&action` deep-link still lands on Central de Envios with
//      NO section (activeCard null).
// Child tabs are mocked: this exercises the SHELL's wiring, not tab internals.
// RosterTab's mock renders the studentIds it received (now string[], never
// null — the shell only mounts the section with an active card).
// =============================================================================

// Mutable search params so the deep-link test (case 6) can simulate a URL with
// `?student&action` while every other test sees an empty query string.
let mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/engagement",
  useSearchParams: () => mockSearchParams,
}))

vi.mock("../roster-tab", () => ({
  RosterTab: ({ studentIds, canNudge }: { studentIds: string[]; canNudge: boolean }) => (
    <div data-testid="roster-mock" data-can-nudge={String(canNudge)}>
      {studentIds.join(",")}
    </div>
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

function renderShell(
  overrides: {
    initialStudentId?: string | null
    initialAction?: "remind" | null
    canAct?: boolean
  } = {},
) {
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
      canAct={overrides.canAct ?? true}
      canManageCampaigns={true}
      initialStudentId={overrides.initialStudentId ?? null}
      initialAction={overrides.initialAction ?? null}
      initialType={null}
      cardStudentIds={CARD_STUDENT_IDS}
      teamScope={null}
    />,
  )
}

function cardButton(label: RegExp): HTMLElement {
  // The semáforo cards are aria-pressed toggle buttons; tab triggers are
  // role="tab", so this never collides with a trigger.
  return screen
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-pressed"))
    .find((b) => label.test(b.textContent ?? "")) as HTMLElement
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams()
})

describe("EngagementShell — roster repositioning (fatia 16b)", () => {
  it("§7.1: no tab named Lista exists, with each of the 3 cards active", () => {
    renderShell()
    // "atencao" is the default active card on mount.
    expect(screen.queryByRole("tab", { name: "Lista" })).toBeNull()

    fireEvent.click(cardButton(/Sem acesso/))
    expect(screen.queryByRole("tab", { name: "Lista" })).toBeNull()

    fireEvent.click(cardButton(/No ritmo/))
    expect(screen.queryByRole("tab", { name: "Lista" })).toBeNull()
  })

  it("§7.2: clicking a card shows the persistent section with its FULL cohort, active tab stays suggested", () => {
    renderShell()
    fireEvent.click(cardButton(/Sem acesso/))

    const section = screen.getByTestId("roster-section")
    expect(section).toBeInTheDocument()
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("sa-1")
    // The click does NOT touch tabs anymore (fatia 16's auto-select is gone):
    // the default tab remains selected and its content still renders.
    expect(screen.getByRole("tab", { name: "Ações Sugeridas" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByTestId("suggested-mock")).toBeInTheDocument()
  })

  it("§7.3: the section persists across EVERY tab, including Histórico via the header link", () => {
    renderShell()
    fireEvent.click(cardButton(/Sem acesso/))
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("sa-1")

    // Every visible trigger of the "sem_acesso" card's tab bar.
    for (const tabName of ["Central de Envios", "Campanhas", "Templates", "Ações Sugeridas"]) {
      fireEvent.click(screen.getByRole("tab", { name: tabName }))
      expect(screen.getByRole("tab", { name: tabName })).toHaveAttribute("aria-selected", "true")
      expect(screen.getByTestId("roster-section")).toBeInTheDocument()
      expect(screen.getByTestId("roster-mock")).toHaveTextContent("sa-1")
    }

    // Histórico is reached via the "Mensagens enviadas" header link (no
    // top-level trigger) — the section must survive that path too.
    fireEvent.click(screen.getByRole("button", { name: /Mensagens enviadas/ }))
    expect(screen.getByTestId("history-mock")).toBeInTheDocument()
    expect(screen.getByTestId("roster-section")).toBeInTheDocument()
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("sa-1")
  })

  it("§7.4: switching cards swaps the section's cohort, never another card's content", () => {
    renderShell()
    fireEvent.click(cardButton(/Sem acesso/))
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("sa-1")

    fireEvent.click(cardButton(/Atenção/))
    expect(screen.getByTestId("roster-mock")).toHaveTextContent("at-1,at-2,at-3")
    expect(screen.getByTestId("roster-mock")).not.toHaveTextContent("sa-1")
  })

  it("§7.5: toggling the active card off removes the section, tabs keep working", () => {
    renderShell()
    const semAcesso = cardButton(/Sem acesso/)
    fireEvent.click(semAcesso) // select → section appears
    expect(screen.getByTestId("roster-section")).toBeInTheDocument()

    fireEvent.click(semAcesso) // toggle off → section gone
    expect(screen.queryByTestId("roster-section")).toBeNull()
    expect(screen.getByRole("tablist")).toBeInTheDocument()
    // Tabs remain clickable after the toggle-off.
    fireEvent.click(screen.getByRole("tab", { name: "Central de Envios" }))
    expect(screen.getByTestId("send-center-mock")).toBeInTheDocument()
  })

  it("fatia 16c §6.4: the shell passes canNudge === canAct to the RosterTab", () => {
    // canAct=false → the section's table must NOT get action permission.
    const { unmount } = renderShell({ canAct: false })
    fireEvent.click(cardButton(/Sem acesso/))
    expect(screen.getByTestId("roster-mock")).toHaveAttribute("data-can-nudge", "false")
    unmount()

    // Default canAct=true → canNudge=true (Ação column enabled downstream).
    renderShell()
    fireEvent.click(cardButton(/Sem acesso/))
    expect(screen.getByTestId("roster-mock")).toHaveAttribute("data-can-nudge", "true")
  })

  it("§7.6: `?student&action` deep-link lands on Central de Envios with NO section", () => {
    mockSearchParams = new URLSearchParams(
      "student=00000000-0000-0000-0000-000000000001&action=remind",
    )
    renderShell({
      initialStudentId: "00000000-0000-0000-0000-000000000001",
      initialAction: "remind",
    })

    expect(screen.getByRole("tab", { name: "Central de Envios" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByTestId("send-center-mock")).toBeInTheDocument()
    // Deep-link mounts with activeCard null → no persistent section.
    expect(screen.queryByTestId("roster-section")).toBeNull()
  })
})
