import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { UserList } from "../user-list"

// Mock window.confirm
vi.stubGlobal(
  "confirm",
  vi.fn(() => true),
)

const mockUsers = [
  {
    id: "u1",
    full_name: "Hugo Capitelli",
    email: "hugo@test.com",
    role: "admin",
    status: "active",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-02-01T00:00:00Z",
  },
  {
    id: "u2",
    full_name: "Maria Santos",
    email: "maria@test.com",
    role: "student",
    status: "active",
    avatar_url: null,
    created_at: "2026-01-15T00:00:00Z",
    last_sign_in_at: null,
  },
  {
    id: "u3",
    full_name: null,
    email: "john@test.com",
    role: "manager",
    status: "inactive",
    avatar_url: null,
    created_at: "2026-01-20T00:00:00Z",
    last_sign_in_at: null,
  },
]

describe("UserList", () => {
  it("renders table headers", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Nome")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Role")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Ultimo Login")).toBeInTheDocument()
  })

  it("renders user data in table rows", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Hugo Capitelli")).toBeInTheDocument()
    expect(screen.getByText("hugo@test.com")).toBeInTheDocument()
    expect(screen.getByText("Maria Santos")).toBeInTheDocument()
    expect(screen.getByText("maria@test.com")).toBeInTheDocument()
  })

  it("renders em dash for null full_name", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    // u3 has null full_name, shown as "—"
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it("renders active/inactive status badges", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    const activeBadges = screen.getAllByText("Ativo")
    expect(activeBadges).toHaveLength(2)
    expect(screen.getByText("Inativo")).toBeInTheDocument()
  })

  it("shows empty state when no users", () => {
    render(<UserList initialData={[]} initialCursor={null} currentUserId="u1" />)

    expect(screen.getByText("Nenhum usuário encontrado.")).toBeInTheDocument()
  })

  it("shows load more button when cursor exists", () => {
    render(<UserList initialData={mockUsers} initialCursor="cursor123" currentUserId="u1" />)

    expect(screen.getByText("Carregar mais")).toBeInTheDocument()
  })

  it("hides load more button when no cursor", () => {
    render(<UserList initialData={mockUsers} initialCursor={null} currentUserId="u1" />)

    expect(screen.queryByText("Carregar mais")).not.toBeInTheDocument()
  })
})
