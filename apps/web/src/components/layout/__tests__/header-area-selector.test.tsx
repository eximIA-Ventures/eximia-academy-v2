import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { AvailableContext } from "@/lib/context-resolver"
import type { Role } from "@eximia/shared"
import { Header } from "../header"

/**
 * Header — "Unidade" (AreaSelector) visibility by active context.
 *
 * BUG FIXED (workspaces): the "Unidade" filter leaked into "Minha Trilha" (personal
 * context) for multi-hat users bound to >1 unidade. The filter is a place/scope
 * selector and has NO meaning in the personal trail, so it must be absent there.
 *
 * The gate is server-resolved (showAreaSelector = !isSelfContext in the platform
 * layout, same pattern as canSwitchWorkspace) → passed as a prop, no client flicker.
 * Here we assert the Header honors that prop. AreaSelector is mocked to a sentinel
 * so this test isolates the gate, not the selector's own userAreas guard.
 */

vi.mock("../area-selector", () => ({
  AreaSelector: () => <div data-testid="area-selector">Unidade</div>,
}))

// Heavy children stubbed — irrelevant to the AreaSelector gate.
vi.mock("../context-switcher", () => ({ ContextSwitcher: () => <div>ctx</div> }))
vi.mock("../notification-bell", () => ({ NotificationBell: () => <div>bell</div> }))
vi.mock("../tenant-selector", () => ({ TenantSelector: () => <div>tenant</div> }))
vi.mock("../theme-toggle", () => ({ ThemeToggle: () => <div>theme</div> }))
vi.mock("../workspace-switch-button", () => ({ WorkspaceSwitchButton: () => <div>ws</div> }))
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }))

const personal: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }
const team: AvailableContext = { type: "team", id: null, label: "Meu Time" }
const organization: AvailableContext = {
  type: "organization",
  id: null,
  label: "Minha Organização",
}

function renderHeader(props: { activeContext: AvailableContext; showAreaSelector: boolean }) {
  return render(
    <Header
      user={{ full_name: "Rinaldo", roles: ["student", "manager", "instructor"] as Role[] }}
      activeContext={props.activeContext}
      availableContexts={[personal, team, organization]}
      showAreaSelector={props.showAreaSelector}
    />,
  )
}

describe("Header — AreaSelector visibility by context", () => {
  it("hides the Unidade selector in the personal context (regression: leak into Minha Trilha)", () => {
    renderHeader({ activeContext: personal, showAreaSelector: false })
    expect(screen.queryByTestId("area-selector")).not.toBeInTheDocument()
  })

  it("shows the Unidade selector in the team context", () => {
    renderHeader({ activeContext: team, showAreaSelector: true })
    expect(screen.getByTestId("area-selector")).toBeInTheDocument()
  })

  it("shows the Unidade selector in the organization context", () => {
    renderHeader({ activeContext: organization, showAreaSelector: true })
    expect(screen.getByTestId("area-selector")).toBeInTheDocument()
  })
})
