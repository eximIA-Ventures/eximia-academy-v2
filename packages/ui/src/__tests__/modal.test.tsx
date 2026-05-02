import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "../components/modal"

function renderModal({
  open = true,
  onOpenChange = vi.fn(),
  size,
  contentClassName,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  size?: "sm" | "md" | "lg" | "xl"
  contentClassName?: string
} = {}) {
  return render(
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay data-testid="overlay" />
      <ModalContent data-testid="content" size={size} className={contentClassName}>
        <ModalHeader data-testid="header">
          <ModalTitle data-testid="title">Confirm Action</ModalTitle>
          <ModalDescription data-testid="description">Are you sure?</ModalDescription>
        </ModalHeader>
        <ModalFooter data-testid="footer">
          <ModalClose data-testid="close">Cancel</ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>,
  )
}

describe("Modal", () => {
  it("does not render content when open=false", () => {
    renderModal({ open: false })
    expect(screen.queryByTestId("content")).not.toBeInTheDocument()
  })

  it("renders content when open=true", () => {
    renderModal({ open: true })
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("renders ModalTitle text", () => {
    renderModal()
    expect(screen.getByTestId("title")).toHaveTextContent("Confirm Action")
  })

  it("renders ModalDescription text", () => {
    renderModal()
    expect(screen.getByTestId("description")).toHaveTextContent("Are you sure?")
  })

  it('has role="dialog" on ModalContent', () => {
    renderModal()
    expect(screen.getByTestId("content")).toHaveAttribute("role", "dialog")
  })

  it('has aria-modal="true"', () => {
    renderModal()
    expect(screen.getByTestId("content")).toHaveAttribute("aria-modal", "true")
  })

  it("applies size variant sm", () => {
    renderModal({ size: "sm" })
    expect(screen.getByTestId("content").className).toContain("max-w-sm")
  })

  it("applies size variant md (default)", () => {
    renderModal()
    expect(screen.getByTestId("content").className).toContain("max-w-md")
  })

  it("applies size variant lg", () => {
    renderModal({ size: "lg" })
    expect(screen.getByTestId("content").className).toContain("max-w-lg")
  })

  it("applies size variant xl", () => {
    renderModal({ size: "xl" })
    expect(screen.getByTestId("content").className).toContain("max-w-xl")
  })

  it("calls onOpenChange(false) when Escape pressed", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderModal({ onOpenChange })

    await user.keyboard("{Escape}")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("calls onOpenChange(false) when overlay clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderModal({ onOpenChange })

    await user.click(screen.getByTestId("overlay"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not close when content clicked (stopPropagation)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderModal({ onOpenChange })

    await user.click(screen.getByTestId("content"))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("ModalClose calls onOpenChange(false)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderModal({ onOpenChange })

    await user.click(screen.getByTestId("close"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("merges custom className on ModalContent", () => {
    renderModal({ contentClassName: "custom-modal" })
    const content = screen.getByTestId("content")
    expect(content.className).toContain("custom-modal")
    expect(content.className).toContain("bg-bg-card")
  })

  it("zero hardcoded color values in className", () => {
    renderModal()
    const testIds = ["overlay", "content", "header", "title", "description", "footer", "close"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
