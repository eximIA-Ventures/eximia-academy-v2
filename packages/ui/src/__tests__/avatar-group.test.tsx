import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Avatar } from "../components/avatar"
import { AvatarGroup } from "../components/avatar-group"

function renderAvatarGroup({
  max,
  count = 5,
  className,
}: {
  max?: number
  count?: number
  className?: string
} = {}) {
  const avatars = Array.from({ length: count }, (_, i) => (
    <Avatar key={i} fallback={`U${i + 1}`} data-testid={`avatar-${i + 1}`} />
  ))

  return render(
    <AvatarGroup max={max} className={className} data-testid="avatar-group">
      {avatars}
    </AvatarGroup>,
  )
}

describe("AvatarGroup", () => {
  it("renders all avatars when count <= max", () => {
    renderAvatarGroup({ count: 2, max: 3 })
    expect(screen.getByTestId("avatar-1")).toBeInTheDocument()
    expect(screen.getByTestId("avatar-2")).toBeInTheDocument()
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument()
  })

  it("shows only max avatars when count > max", () => {
    renderAvatarGroup({ count: 5, max: 2 })
    expect(screen.getByTestId("avatar-1")).toBeInTheDocument()
    expect(screen.getByTestId("avatar-2")).toBeInTheDocument()
    expect(screen.queryByTestId("avatar-3")).not.toBeInTheDocument()
  })

  it("shows '+N' overflow indicator", () => {
    renderAvatarGroup({ count: 5, max: 2 })
    expect(screen.getByText("+3")).toBeInTheDocument()
  })

  it("overflow shows correct count", () => {
    renderAvatarGroup({ count: 7, max: 4 })
    expect(screen.getByText("+3")).toBeInTheDocument()
  })

  it("default max is 3", () => {
    renderAvatarGroup({ count: 5 })
    expect(screen.getByTestId("avatar-1")).toBeInTheDocument()
    expect(screen.getByTestId("avatar-2")).toBeInTheDocument()
    expect(screen.getByTestId("avatar-3")).toBeInTheDocument()
    expect(screen.queryByTestId("avatar-4")).not.toBeInTheDocument()
    expect(screen.getByText("+2")).toBeInTheDocument()
  })

  it("merges custom className", () => {
    renderAvatarGroup({ className: "custom-group" })
    const group = screen.getByTestId("avatar-group")
    expect(group.className).toContain("custom-group")
    expect(group.className).toContain("-space-x-2")
  })

  it("zero hardcoded color values in className", () => {
    renderAvatarGroup()
    const group = screen.getByTestId("avatar-group")
    expect(group.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(group.className).not.toMatch(/rgba?\(/)
  })

  it("does not show overflow indicator when count equals max", () => {
    renderAvatarGroup({ count: 3, max: 3 })
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument()
  })
})
