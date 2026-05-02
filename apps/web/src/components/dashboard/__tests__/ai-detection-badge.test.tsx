import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AiDetectionBadge } from "../ai-detection-badge"

describe("AiDetectionBadge", () => {
  it("renders icon when enabled", () => {
    const { container } = render(
      <AiDetectionBadge verdict="likely_human" confidence="high" enabled={true} />,
    )
    expect(container.querySelector("svg")).toBeInTheDocument()
  })

  it("does not render when ai_detection feature flag is false", () => {
    const { container } = render(
      <AiDetectionBadge verdict="likely_human" confidence="high" enabled={false} />,
    )
    expect(container.querySelector("svg")).not.toBeInTheDocument()
  })

  it("shows tooltip with verdict and confidence on hover", () => {
    const { container } = render(
      <AiDetectionBadge verdict="likely_human" confidence="high" enabled={true} />,
    )

    const iconWrapper = container.querySelector("div")
    if (iconWrapper) fireEvent.mouseEnter(iconWrapper)

    expect(screen.getByText("Provavelmente humano")).toBeInTheDocument()
    expect(screen.getByText("Confianca: high")).toBeInTheDocument()
  })

  it("renders uncertain verdict", () => {
    const { container } = render(
      <AiDetectionBadge verdict="uncertain" confidence="medium" enabled={true} />,
    )

    const iconWrapper = container.querySelector("div")
    if (iconWrapper) fireEvent.mouseEnter(iconWrapper)

    expect(screen.getByText("Incerto")).toBeInTheDocument()
  })
})
