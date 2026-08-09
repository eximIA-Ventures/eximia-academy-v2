import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  DIRECT_TEAM_KEY,
  TeamFilterDropdown,
  type TeamFilterOption,
  effectiveTeamSelection,
  parseTeamsParam,
  serializeTeamsParam,
} from "../team-filter-dropdown"

let mockSearch = ""

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

const TEAM_A = "5a4d0000-0000-0000-0000-0000000000a1"
const TEAM_B = "5a4d0000-0000-0000-0000-0000000000b1"

const OPTIONS: TeamFilterOption[] = [
  {
    key: TEAM_A,
    label: "Time A",
    count: 3,
    subteam: { id: TEAM_A, name: "Time A", colorIndex: 0 },
  },
  {
    key: TEAM_B,
    label: "Time B",
    count: 2,
    subteam: { id: TEAM_B, name: "Time B", colorIndex: 1 },
  },
  { key: DIRECT_TEAM_KEY, label: "Direto" },
]

describe("parseTeamsParam", () => {
  it("null/empty => empty set", () => {
    expect(parseTeamsParam(null)).toEqual(new Set())
    expect(parseTeamsParam("")).toEqual(new Set())
  })

  it("'a,b' => {a,b}", () => {
    expect(parseTeamsParam("a,b")).toEqual(new Set(["a", "b"]))
  })

  it("'a,,a' => {a} (ignores empty tokens, dedups)", () => {
    expect(parseTeamsParam("a,,a")).toEqual(new Set(["a"]))
  })
})

describe("serializeTeamsParam", () => {
  it("empty => null (removes the param)", () => {
    expect(serializeTeamsParam(new Set())).toBeNull()
  })

  it("{b,a} => 'a,b' (sorted)", () => {
    expect(serializeTeamsParam(new Set(["b", "a"]))).toBe("a,b")
  })
})

describe("effectiveTeamSelection", () => {
  it("partial intersection keeps only existing keys", () => {
    const selected = new Set([TEAM_A, "stale-id"])
    expect(effectiveTeamSelection(selected, OPTIONS)).toEqual(new Set([TEAM_A]))
  })

  it("all-stale selection => empty (no filter)", () => {
    const selected = new Set(["stale-1", "stale-2"])
    expect(effectiveTeamSelection(selected, OPTIONS)).toEqual(new Set())
  })

  it("__direct__ respected when present in options", () => {
    const selected = new Set([DIRECT_TEAM_KEY])
    expect(effectiveTeamSelection(selected, OPTIONS)).toEqual(new Set([DIRECT_TEAM_KEY]))
  })
})

describe("TeamFilterDropdown", () => {
  beforeEach(() => {
    mockSearch = ""
    vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined)
  })

  it("renders null when options.length <= 1", () => {
    const { container } = render(<TeamFilterDropdown options={[OPTIONS[0]]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Todos os times" with no selection', () => {
    render(<TeamFilterDropdown options={OPTIONS} />)
    expect(screen.getByRole("button", { name: "Filtrar por time" })).toHaveTextContent(
      "Todos os times",
    )
  })

  it('shows "2 times" with 2 valid keys selected', () => {
    mockSearch = `teams=${TEAM_A},${TEAM_B}`
    render(<TeamFilterDropdown options={OPTIONS} />)
    expect(screen.getByRole("button", { name: "Filtrar por time" })).toHaveTextContent("2 times")
  })

  it("clicking an option writes the serialized param via history.replaceState (shallow, no router.replace)", () => {
    render(<TeamFilterDropdown options={OPTIONS} />)
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por time" }))
    fireEvent.click(screen.getByText("Time A"))

    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", `/dashboard?teams=${TEAM_A}`)
  })

  it('clicking "Todos os times" clears the param', () => {
    mockSearch = `teams=${TEAM_A}`
    render(<TeamFilterDropdown options={OPTIONS} />)
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por time" }))
    fireEvent.click(screen.getByText("Todos os times"))

    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/dashboard")
  })
})
