import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TeamViewSwitch } from "../team-view-switch"

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockReplace = vi.fn()
let mockSearch = ""

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace,
  }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

const mockSetTeamView = vi.fn(async (_next: string) => undefined)
vi.mock("@/app/(platform)/context/actions", () => ({
  setTeamView: (next: string) => mockSetTeamView(next),
}))

describe("TeamViewSwitch", () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockRefresh.mockClear()
    mockReplace.mockClear()
    mockSetTeamView.mockClear()
  })

  it("switching to Diretos with ?teams=x&focus=y clears teams but keeps focus (AC8)", async () => {
    mockSearch = "teams=x&focus=y"
    render(<TeamViewSwitch mode="hierarchy" />)

    fireEvent.click(screen.getByRole("tab", { name: /Diretos/ }))

    await waitFor(() => expect(mockSetTeamView).toHaveBeenCalledWith("direct"))
    expect(mockReplace).toHaveBeenCalledWith("/dashboard?focus=y", { scroll: false })
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it("switching to Hierarquia (no ?teams= to clear) just refreshes", async () => {
    mockSearch = "focus=y"
    render(<TeamViewSwitch mode="direct" />)

    fireEvent.click(screen.getByRole("tab", { name: /Hierarquia/ }))

    await waitFor(() => expect(mockSetTeamView).toHaveBeenCalledWith("hierarchy"))
    expect(mockRefresh).toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("clicking the already-active mode is a no-op", () => {
    mockSearch = ""
    render(<TeamViewSwitch mode="direct" />)

    fireEvent.click(screen.getByRole("tab", { name: /Diretos/ }))

    expect(mockSetTeamView).not.toHaveBeenCalled()
  })
})
