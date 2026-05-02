import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "../components/sidebar"

function renderSidebar({
  collapsed = false,
  className,
}: {
  collapsed?: boolean
  className?: string
} = {}) {
  return render(
    <Sidebar data-testid="sidebar" collapsed={collapsed} className={className}>
      <SidebarHeader data-testid="header">Header</SidebarHeader>
      <SidebarContent data-testid="content">
        <SidebarSection data-testid="section">
          <SidebarLabel data-testid="label">Section Label</SidebarLabel>
          <SidebarItem data-testid="item">Dashboard</SidebarItem>
          <SidebarItem data-testid="item-active" isActive>
            Active Item
          </SidebarItem>
          <SidebarItem data-testid="item-disabled" disabled>
            Disabled Item
          </SidebarItem>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter data-testid="footer">Footer</SidebarFooter>
    </Sidebar>,
  )
}

describe("Sidebar", () => {
  it("renders as aside element", () => {
    renderSidebar()
    const sidebar = screen.getByTestId("sidebar")
    expect(sidebar.tagName).toBe("ASIDE")
  })

  it("applies w-[220px] when not collapsed", () => {
    renderSidebar({ collapsed: false })
    expect(screen.getByTestId("sidebar").className).toContain("w-[220px]")
  })

  it("applies w-16 when collapsed", () => {
    renderSidebar({ collapsed: true })
    const sidebar = screen.getByTestId("sidebar")
    expect(sidebar.className).toContain("w-16")
    expect(sidebar.className).not.toContain("w-[220px]")
  })

  it("SidebarItem renders button", () => {
    renderSidebar()
    const item = screen.getByTestId("item")
    expect(item.tagName).toBe("BUTTON")
  })

  it("active SidebarItem has bg-bg-surface", () => {
    renderSidebar()
    expect(screen.getByTestId("item-active").className).toContain("bg-bg-surface")
  })

  it("renders SidebarHeader, SidebarContent, SidebarFooter", () => {
    renderSidebar()
    expect(screen.getByTestId("header")).toBeInTheDocument()
    expect(screen.getByTestId("content")).toBeInTheDocument()
    expect(screen.getByTestId("footer")).toBeInTheDocument()
  })

  it("SidebarLabel hidden when collapsed", () => {
    renderSidebar({ collapsed: true })
    expect(screen.getByTestId("label").className).toContain("sr-only")
  })

  it("merges custom className", () => {
    renderSidebar({ className: "custom-sidebar" })
    const sidebar = screen.getByTestId("sidebar")
    expect(sidebar.className).toContain("custom-sidebar")
    expect(sidebar.className).toContain("bg-bg-sidebar")
  })

  it("disabled SidebarItem has opacity-40 and cursor-not-allowed", () => {
    renderSidebar()
    const item = screen.getByTestId("item-disabled")
    expect(item.className).toContain("opacity-40")
    expect(item.className).toContain("cursor-not-allowed")
  })

  it("zero hardcoded color values in className", () => {
    renderSidebar()
    const testIds = [
      "sidebar",
      "header",
      "content",
      "footer",
      "section",
      "label",
      "item",
      "item-active",
    ]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
