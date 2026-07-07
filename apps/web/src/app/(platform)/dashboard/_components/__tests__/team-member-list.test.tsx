import type { TeamEngagementBuckets } from "@/lib/engagement-helpers"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TeamMemberList } from "../team-member-list"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}))

const BUCKETS: TeamEngagementBuckets = {
  accessed: [
    {
      id: "u1",
      name: "Ana Lider",
      email: "ana@example.com",
      daysSinceLastActivity: 1,
      bucket: "accessed",
    },
  ],
  devendo: [],
  inativos: [],
  summary: { accessedCount: 1, devendoCount: 0, inativosCount: 0, teamTotal: 1 },
}

describe("TeamMemberList — D-1 (S12): colapsável fechado por padrão", () => {
  it("starts closed: header shows the count, member cards are not rendered", () => {
    render(<TeamMemberList buckets={BUCKETS} />)

    expect(screen.getByText("Membros do time")).toBeInTheDocument()
    expect(screen.getByText("AL")).toBeInTheDocument() // avatar de iniciais no preview
    expect(screen.queryByText("Ana Lider")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ver todos|Ocultar/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })

  it("expands on click, revealing the member cards; the drilldown link keeps working", () => {
    const subteamCounts = new Map([["u1", 5]])
    render(<TeamMemberList buckets={BUCKETS} subteamCounts={subteamCounts} />)

    fireEvent.click(screen.getByRole("button", { name: /Ver todos|Ocultar/ }))

    expect(screen.getByText("Ana Lider")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Entrar no time de Ana Lider" })
    expect(link).toHaveAttribute("href", "?focus=u1")
  })

  it("toggles closed again on a second click", () => {
    render(<TeamMemberList buckets={BUCKETS} />)
    const trigger = screen.getByRole("button", { name: /Ver todos|Ocultar/ })

    fireEvent.click(trigger)
    expect(screen.getByText("Ana Lider")).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByText("Ana Lider")).not.toBeInTheDocument()
  })

  it("empty buckets: still closed by default, shows the empty state only when expanded", () => {
    const empty: TeamEngagementBuckets = {
      accessed: [],
      devendo: [],
      inativos: [],
      summary: { accessedCount: 0, devendoCount: 0, inativosCount: 0, teamTotal: 0 },
    }
    render(<TeamMemberList buckets={empty} />)

    expect(screen.getByText("Membros do time")).toBeInTheDocument()
    expect(screen.queryByText("Nenhum membro direto neste recorte.")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Ver todos|Ocultar/ }))
    expect(screen.getByText("Nenhum membro direto neste recorte.")).toBeInTheDocument()
  })
})
