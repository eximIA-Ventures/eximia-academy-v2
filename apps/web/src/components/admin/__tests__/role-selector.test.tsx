import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RoleSelector } from "../role-selector"

describe("RoleSelector", () => {
  it("renders select with current role value", () => {
    render(
      <RoleSelector
        userId="u1"
        currentRole="student"
        currentUserIsAdmin
        isOwnUser={false}
        onRoleChanged={vi.fn()}
      />,
    )

    const select = screen.getByRole("combobox")
    expect(select).toHaveValue("student")
  })

  it("renders all role options including instructor", () => {
    render(
      <RoleSelector
        userId="u1"
        currentRole="student"
        currentUserIsAdmin
        isOwnUser={false}
        onRoleChanged={vi.fn()}
      />,
    )

    expect(screen.getByText("Estudante")).toBeInTheDocument()
    expect(screen.getByText("Gestor")).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Instrutor")).toBeInTheDocument()
  })

  it("renders static badge for own admin account", () => {
    render(
      <RoleSelector
        userId="u1"
        currentRole="admin"
        currentUserIsAdmin
        isOwnUser
        onRoleChanged={vi.fn()}
      />,
    )

    // Should render a badge, not a select
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
  })

  it("disables select when currentUserIsAdmin is false", () => {
    render(
      <RoleSelector
        userId="u1"
        currentRole="student"
        currentUserIsAdmin={false}
        isOwnUser={false}
        onRoleChanged={vi.fn()}
      />,
    )

    const select = screen.getByRole("combobox")
    expect(select).toBeDisabled()
  })
})
