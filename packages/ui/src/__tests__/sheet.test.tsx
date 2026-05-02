import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
} from "../components/sheet"

function renderSheet({
  open = true,
  onOpenChange = vi.fn(),
  side,
  contentClassName,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: "right" | "left" | "top" | "bottom"
  contentClassName?: string
} = {}) {
  return render(
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetOverlay data-testid="overlay" />
      <SheetContent data-testid="content" side={side} className={contentClassName}>
        <SheetHeader data-testid="header">
          <SheetTitle data-testid="title">Sheet Title</SheetTitle>
          <SheetDescription data-testid="description">Sheet description text</SheetDescription>
        </SheetHeader>
        <SheetFooter data-testid="footer">
          <SheetClose data-testid="close">Close</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>,
  )
}

describe("Sheet", () => {
  it("does not render when open=false", () => {
    renderSheet({ open: false })
    expect(screen.queryByTestId("content")).not.toBeInTheDocument()
  })

  it("renders when open=true", () => {
    renderSheet({ open: true })
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it('SheetContent has default side="right" positioning', () => {
    renderSheet()
    const content = screen.getByTestId("content")
    expect(content.className).toContain("right-0")
    expect(content.className).toContain("border-l")
  })

  it("side=left applies left-0", () => {
    renderSheet({ side: "left" })
    const content = screen.getByTestId("content")
    expect(content.className).toContain("left-0")
    expect(content.className).toContain("border-r")
  })

  it("side=bottom applies bottom-0", () => {
    renderSheet({ side: "bottom" })
    const content = screen.getByTestId("content")
    expect(content.className).toContain("bottom-0")
    expect(content.className).toContain("border-t")
  })

  it("side=top applies top-0 and border-b", () => {
    renderSheet({ side: "top" })
    const content = screen.getByTestId("content")
    expect(content.className).toContain("top-0")
    expect(content.className).toContain("border-b")
  })

  it("Escape key calls onOpenChange(false)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    await user.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("overlay click closes", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    await user.click(screen.getByTestId("overlay"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("content click does not close (stopPropagation)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    await user.click(screen.getByTestId("content"))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("SheetClose calls onOpenChange(false)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    await user.click(screen.getByTestId("close"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("merges custom className on SheetContent", () => {
    renderSheet({ contentClassName: "custom-sheet" })
    const content = screen.getByTestId("content")
    expect(content.className).toContain("custom-sheet")
    expect(content.className).toContain("bg-bg-card")
  })

  it("zero hardcoded color values in className", () => {
    renderSheet()
    const testIds = ["overlay", "content", "header", "title", "description", "footer", "close"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
