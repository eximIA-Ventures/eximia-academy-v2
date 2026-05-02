import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/accordion"

function renderAccordion({
  type = "single" as const,
  value,
  onValueChange,
  className,
}: {
  type?: "single" | "multiple"
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  className?: string
} = {}) {
  return render(
    <Accordion
      data-testid="accordion"
      type={type}
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      <AccordionItem data-testid="item-1" value="item-1">
        <AccordionTrigger data-testid="trigger-1">Section 1</AccordionTrigger>
        <AccordionContent data-testid="content-1">Content 1</AccordionContent>
      </AccordionItem>
      <AccordionItem data-testid="item-2" value="item-2">
        <AccordionTrigger data-testid="trigger-2">Section 2</AccordionTrigger>
        <AccordionContent data-testid="content-2">Content 2</AccordionContent>
      </AccordionItem>
      <AccordionItem data-testid="item-3" value="item-3" disabled>
        <AccordionTrigger data-testid="trigger-3">Section 3</AccordionTrigger>
        <AccordionContent data-testid="content-3">Content 3</AccordionContent>
      </AccordionItem>
    </Accordion>,
  )
}

describe("Accordion", () => {
  it("renders accordion items", () => {
    renderAccordion()
    expect(screen.getByTestId("item-1")).toBeInTheDocument()
    expect(screen.getByTestId("item-2")).toBeInTheDocument()
    expect(screen.getByTestId("item-3")).toBeInTheDocument()
  })

  it("clicking trigger expands content", async () => {
    const user = userEvent.setup()
    renderAccordion()

    expect(screen.getByTestId("item-1")).toHaveAttribute("data-state", "closed")
    await user.click(screen.getByTestId("trigger-1"))
    expect(screen.getByTestId("item-1")).toHaveAttribute("data-state", "open")
  })

  it("clicking again collapses in single mode", async () => {
    const user = userEvent.setup()
    renderAccordion()

    await user.click(screen.getByTestId("trigger-1"))
    expect(screen.getByTestId("item-1")).toHaveAttribute("data-state", "open")

    await user.click(screen.getByTestId("trigger-1"))
    expect(screen.getByTestId("item-1")).toHaveAttribute("data-state", "closed")
  })

  it('content has role="region"', async () => {
    const user = userEvent.setup()
    renderAccordion()

    await user.click(screen.getByTestId("trigger-1"))
    expect(screen.getByTestId("content-1")).toHaveAttribute("role", "region")
  })

  it("trigger has aria-expanded", () => {
    renderAccordion()
    expect(screen.getByTestId("trigger-1")).toHaveAttribute("aria-expanded", "false")
  })

  it("trigger aria-expanded updates when opened", async () => {
    const user = userEvent.setup()
    renderAccordion()

    await user.click(screen.getByTestId("trigger-1"))
    expect(screen.getByTestId("trigger-1")).toHaveAttribute("aria-expanded", "true")
  })

  it("single mode: only one item open at a time", async () => {
    const user = userEvent.setup()
    renderAccordion({ type: "single" })

    await user.click(screen.getByTestId("trigger-1"))
    expect(screen.getByTestId("item-1")).toHaveAttribute("data-state", "open")

    await user.click(screen.getByTestId("trigger-2"))
    expect(screen.getByTestId("item-1")).toHaveAttribute("data-state", "closed")
    expect(screen.getByTestId("item-2")).toHaveAttribute("data-state", "open")
  })

  it("multiple mode: multiple items can be open", async () => {
    const user = userEvent.setup()
    renderAccordion({ type: "multiple" })

    await user.click(screen.getByTestId("trigger-1"))
    await user.click(screen.getByTestId("trigger-2"))

    expect(screen.getByTestId("content-1")).toBeInTheDocument()
    expect(screen.getByTestId("content-2")).toBeInTheDocument()
  })

  it("disabled item cannot be toggled", async () => {
    const user = userEvent.setup()
    renderAccordion()

    await user.click(screen.getByTestId("trigger-3"))
    expect(screen.getByTestId("trigger-3")).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByTestId("item-3")).toHaveAttribute("data-state", "closed")
  })

  it("merges custom className on accordion", () => {
    renderAccordion({ className: "custom-accordion" })
    const accordion = screen.getByTestId("accordion")
    expect(accordion.className).toContain("custom-accordion")
  })

  it("AccordionItem has border-b border-border-subtle", () => {
    renderAccordion()
    const item = screen.getByTestId("item-1")
    expect(item.className).toContain("border-b")
    expect(item.className).toContain("border-border-subtle")
  })

  it("zero hardcoded color values in className", async () => {
    const user = userEvent.setup()
    renderAccordion()

    await user.click(screen.getByTestId("trigger-1"))

    const testIds = ["accordion", "item-1", "item-2", "trigger-1", "trigger-2", "content-1"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
