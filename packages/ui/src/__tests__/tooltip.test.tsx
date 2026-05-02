import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip"

describe("Tooltip", () => {
  it("renders trigger content", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tip</TooltipContent>
      </Tooltip>,
    )
    expect(screen.getByText("Hover me")).toBeInTheDocument()
  })

  it("renders tooltip content", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>,
    )
    expect(screen.getByText("Tooltip text")).toBeInTheDocument()
  })

  it("has role='tooltip' on content", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tip</TooltipContent>
      </Tooltip>,
    )
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
  })

  it("applies side='top' positioning classes (bottom-full)", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent side="top" data-testid="content">
          Tip
        </TooltipContent>
      </Tooltip>,
    )
    const content = screen.getByTestId("content")
    expect(content.className).toContain("bottom-full")
    expect(content.className).toContain("mb-2")
  })

  it("applies side='bottom' positioning classes (top-full)", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent side="bottom" data-testid="content">
          Tip
        </TooltipContent>
      </Tooltip>,
    )
    const content = screen.getByTestId("content")
    expect(content.className).toContain("top-full")
    expect(content.className).toContain("mt-2")
  })

  it("applies side='left' positioning classes (right-full)", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent side="left" data-testid="content">
          Tip
        </TooltipContent>
      </Tooltip>,
    )
    const content = screen.getByTestId("content")
    expect(content.className).toContain("right-full")
    expect(content.className).toContain("mr-2")
  })

  it("applies side='right' positioning classes (left-full)", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent side="right" data-testid="content">
          Tip
        </TooltipContent>
      </Tooltip>,
    )
    const content = screen.getByTestId("content")
    expect(content.className).toContain("left-full")
    expect(content.className).toContain("ml-2")
  })

  it("defaults to side='top'", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent data-testid="content">Tip</TooltipContent>
      </Tooltip>,
    )
    expect(screen.getByTestId("content").className).toContain("bottom-full")
  })

  it("merges custom className on content", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent className="custom-tooltip" data-testid="content">
          Tip
        </TooltipContent>
      </Tooltip>,
    )
    expect(screen.getByTestId("content").className).toContain("custom-tooltip")
  })

  it("has zero hardcoded color values", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent data-testid="content">Tip</TooltipContent>
      </Tooltip>,
    )
    const classes = screen.getByTestId("content").className
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(classes).not.toMatch(/rgba?\(/)
  })

  it("forwards ref on Tooltip wrapper", () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>
    render(
      <Tooltip ref={ref}>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tip</TooltipContent>
      </Tooltip>,
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
