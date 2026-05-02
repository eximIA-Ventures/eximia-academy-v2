import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Avatar } from "../components/avatar"

describe("Avatar", () => {
  it("renders fallback initials when no src", () => {
    render(<Avatar data-testid="avatar" fallback="JD" />)
    expect(screen.getByTestId("avatar")).toHaveTextContent("JD")
  })

  it("renders img when src provided", () => {
    render(<Avatar data-testid="avatar" src="/photo.jpg" alt="John" fallback="JD" />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "/photo.jpg")
    expect(img).toHaveAttribute("alt", "John")
  })

  it("applies size variants (sm, default, lg)", () => {
    const { rerender } = render(<Avatar data-testid="avatar" fallback="JD" size="sm" />)
    expect(screen.getByTestId("avatar").className).toContain("h-8")
    expect(screen.getByTestId("avatar").className).toContain("w-8")

    rerender(<Avatar data-testid="avatar" fallback="JD" size="default" />)
    expect(screen.getByTestId("avatar").className).toContain("h-10")
    expect(screen.getByTestId("avatar").className).toContain("w-10")

    rerender(<Avatar data-testid="avatar" fallback="JD" size="lg" />)
    expect(screen.getByTestId("avatar").className).toContain("h-12")
    expect(screen.getByTestId("avatar").className).toContain("w-12")
  })

  it("merges custom className", () => {
    render(<Avatar data-testid="avatar" fallback="JD" className="custom-class" />)
    expect(screen.getByTestId("avatar").className).toContain("custom-class")
  })

  it("has rounded-full class", () => {
    render(<Avatar data-testid="avatar" fallback="JD" />)
    expect(screen.getByTestId("avatar").className).toContain("rounded-full")
  })
})
