import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs"

function renderTabs({
  value = "tab1",
  onValueChange = vi.fn(),
  disabledTab,
  listClassName,
  triggerClassName,
  contentClassName,
}: {
  value?: string
  onValueChange?: (value: string) => void
  disabledTab?: boolean
  listClassName?: string
  triggerClassName?: string
  contentClassName?: string
} = {}) {
  return render(
    <Tabs value={value} onValueChange={onValueChange} data-testid="tabs-root">
      <TabsList data-testid="tabs-list" className={listClassName}>
        <TabsTrigger data-testid="trigger-1" value="tab1" className={triggerClassName}>
          Tab 1
        </TabsTrigger>
        <TabsTrigger data-testid="trigger-2" value="tab2" disabled={disabledTab}>
          Tab 2
        </TabsTrigger>
        <TabsTrigger data-testid="trigger-3" value="tab3">
          Tab 3
        </TabsTrigger>
      </TabsList>
      <TabsContent data-testid="content-1" value="tab1" className={contentClassName}>
        Content 1
      </TabsContent>
      <TabsContent data-testid="content-2" value="tab2">
        Content 2
      </TabsContent>
      <TabsContent data-testid="content-3" value="tab3">
        Content 3
      </TabsContent>
    </Tabs>,
  )
}

describe("Tabs", () => {
  it("renders TabsList with role='tablist'", () => {
    renderTabs()
    expect(screen.getByTestId("tabs-list")).toHaveAttribute("role", "tablist")
  })

  it("TabsTrigger has role='tab'", () => {
    renderTabs()
    expect(screen.getByTestId("trigger-1")).toHaveAttribute("role", "tab")
  })

  it("TabsContent has role='tabpanel'", () => {
    renderTabs({ value: "tab1" })
    expect(screen.getByTestId("content-1")).toHaveAttribute("role", "tabpanel")
  })

  it("active trigger has aria-selected='true'", () => {
    renderTabs({ value: "tab1" })
    expect(screen.getByTestId("trigger-1")).toHaveAttribute("aria-selected", "true")
  })

  it("inactive trigger has aria-selected='false'", () => {
    renderTabs({ value: "tab1" })
    expect(screen.getByTestId("trigger-2")).toHaveAttribute("aria-selected", "false")
  })

  it("clicking trigger calls onValueChange", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderTabs({ value: "tab1", onValueChange })

    await user.click(screen.getByTestId("trigger-2"))
    expect(onValueChange).toHaveBeenCalledWith("tab2")
  })

  it("only active TabsContent renders its children", () => {
    renderTabs({ value: "tab1" })
    expect(screen.getByTestId("content-1")).toHaveTextContent("Content 1")
    expect(screen.queryByTestId("content-2")).not.toBeInTheDocument()
    expect(screen.queryByTestId("content-3")).not.toBeInTheDocument()
  })

  it("disabled trigger cannot be clicked", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    renderTabs({ value: "tab1", onValueChange, disabledTab: true })

    await user.click(screen.getByTestId("trigger-2"))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("active trigger has bg-bg-card class", () => {
    renderTabs({ value: "tab1" })
    expect(screen.getByTestId("trigger-1").className).toContain("bg-bg-card")
  })

  it("merges custom className on TabsList", () => {
    renderTabs({ listClassName: "custom-list" })
    const list = screen.getByTestId("tabs-list")
    expect(list.className).toContain("custom-list")
    expect(list.className).toContain("bg-bg-surface")
  })

  it("merges custom className on TabsTrigger", () => {
    renderTabs({ triggerClassName: "custom-trigger" })
    expect(screen.getByTestId("trigger-1").className).toContain("custom-trigger")
  })

  it("merges custom className on TabsContent", () => {
    renderTabs({ value: "tab1", contentClassName: "custom-content" })
    expect(screen.getByTestId("content-1").className).toContain("custom-content")
  })

  it("zero hardcoded color values in className", () => {
    renderTabs()
    const testIds = ["tabs-root", "tabs-list", "trigger-1", "trigger-2", "trigger-3", "content-1"]
    for (const id of testIds) {
      const el = screen.queryByTestId(id)
      if (el) {
        const classes = el.className
        expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
        expect(classes).not.toMatch(/rgba?\(/)
      }
    }
  })
})
