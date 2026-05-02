import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { TopBar, TopBarCenter, TopBarLeft, TopBarRight } from "../components/top-bar"

function renderTopBar({
  className,
}: {
  className?: string
} = {}) {
  return render(
    <TopBar data-testid="topbar" className={className}>
      <TopBarLeft data-testid="left">Left Content</TopBarLeft>
      <TopBarCenter data-testid="center">Center Content</TopBarCenter>
      <TopBarRight data-testid="right">Right Content</TopBarRight>
    </TopBar>,
  )
}

describe("TopBar", () => {
  it("renders as header element", () => {
    renderTopBar()
    const topbar = screen.getByTestId("topbar")
    expect(topbar.tagName).toBe("HEADER")
  })

  it("has sticky class", () => {
    renderTopBar()
    expect(screen.getByTestId("topbar").className).toContain("sticky")
  })

  it("has z-[30] class", () => {
    renderTopBar()
    expect(screen.getByTestId("topbar").className).toContain("z-[30]")
  })

  it("renders TopBarLeft, TopBarCenter, TopBarRight", () => {
    renderTopBar()
    expect(screen.getByTestId("left")).toBeInTheDocument()
    expect(screen.getByTestId("center")).toBeInTheDocument()
    expect(screen.getByTestId("right")).toBeInTheDocument()
  })

  it("TopBarRight has ml-auto", () => {
    renderTopBar()
    expect(screen.getByTestId("right").className).toContain("ml-auto")
  })

  it("TopBarCenter has flex-1", () => {
    renderTopBar()
    expect(screen.getByTestId("center").className).toContain("flex-1")
  })

  it("merges custom className", () => {
    renderTopBar({ className: "custom-topbar" })
    const topbar = screen.getByTestId("topbar")
    expect(topbar.className).toContain("custom-topbar")
    expect(topbar.className).toContain("bg-bg-card")
  })

  it("zero hardcoded color values in className", () => {
    renderTopBar()
    const testIds = ["topbar", "left", "center", "right"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
