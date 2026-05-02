import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu"

function renderDropdown({
  open,
  onOpenChange,
  contentClassName,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  contentClassName?: string
} = {}) {
  return render(
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger data-testid="trigger">
        <button type="button">Open Menu</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="content" className={contentClassName}>
        <DropdownMenuItem data-testid="item-1" onClick={vi.fn()}>
          Item 1
        </DropdownMenuItem>
        <DropdownMenuSeparator data-testid="separator" />
        <DropdownMenuItem data-testid="item-2">Item 2</DropdownMenuItem>
        <DropdownMenuItem data-testid="item-disabled" disabled>
          Disabled
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  )
}

describe("DropdownMenu", () => {
  it("does not render content when closed", () => {
    renderDropdown({ open: false })
    expect(screen.queryByTestId("content")).not.toBeInTheDocument()
  })

  it("renders content when open", () => {
    renderDropdown({ open: true })
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("clicking trigger toggles open", async () => {
    const user = userEvent.setup()
    renderDropdown()

    expect(screen.queryByTestId("content")).not.toBeInTheDocument()
    await user.click(screen.getByTestId("trigger"))
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it('content has role="menu"', () => {
    renderDropdown({ open: true })
    expect(screen.getByTestId("content")).toHaveAttribute("role", "menu")
  })

  it('menu item has role="menuitem"', () => {
    renderDropdown({ open: true })
    expect(screen.getByTestId("item-1")).toHaveAttribute("role", "menuitem")
  })

  it("clicking menu item triggers onClick", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <DropdownMenu open={true} onOpenChange={vi.fn()}>
        <DropdownMenuTrigger data-testid="trigger">
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="click-item" onClick={onClick}>
            Clickable
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    await user.click(screen.getByTestId("click-item"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("Escape key closes menu", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderDropdown({ open: true, onOpenChange })

    await user.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('separator has role="separator"', () => {
    renderDropdown({ open: true })
    expect(screen.getByTestId("separator")).toHaveAttribute("role", "separator")
  })

  it("disabled item has opacity-40", () => {
    renderDropdown({ open: true })
    expect(screen.getByTestId("item-disabled").className).toContain("opacity-40")
  })

  it("disabled item does not trigger onClick when clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <DropdownMenu open={true} onOpenChange={vi.fn()}>
        <DropdownMenuTrigger>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="disabled-click" disabled onClick={onClick}>
            Disabled
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    await user.click(screen.getByTestId("disabled-click"))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("merges custom className on content", () => {
    renderDropdown({ open: true, contentClassName: "custom-dropdown" })
    const content = screen.getByTestId("content")
    expect(content.className).toContain("custom-dropdown")
    expect(content.className).toContain("bg-bg-card")
  })

  it("trigger has aria-expanded and aria-haspopup", () => {
    renderDropdown({ open: true })
    const trigger = screen.getByTestId("trigger")
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
  })

  it("zero hardcoded color values in className", () => {
    renderDropdown({ open: true })
    const testIds = ["trigger", "content", "item-1", "item-2", "separator"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
