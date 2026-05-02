import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/pagination"

function renderPagination({ linkClassName }: { linkClassName?: string } = {}) {
  return render(
    <Pagination data-testid="nav">
      <PaginationContent data-testid="content">
        <PaginationItem data-testid="item-prev">
          <PaginationPrevious data-testid="prev" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink data-testid="link-1" isActive>
            1
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink data-testid="link-2" className={linkClassName}>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis data-testid="ellipsis" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink data-testid="link-disabled" disabled>
            5
          </PaginationLink>
        </PaginationItem>
        <PaginationItem data-testid="item-next">
          <PaginationNext data-testid="next" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>,
  )
}

describe("Pagination", () => {
  it("renders as nav element", () => {
    renderPagination()
    expect(screen.getByTestId("nav").tagName).toBe("NAV")
  })

  it('renders aria-label="pagination"', () => {
    renderPagination()
    expect(screen.getByTestId("nav")).toHaveAttribute("aria-label", "pagination")
  })

  it("PaginationLink renders button", () => {
    renderPagination()
    const link = screen.getByTestId("link-1")
    expect(link.tagName).toBe("BUTTON")
  })

  it("active link has bg-accent-blue-mid", () => {
    renderPagination()
    expect(screen.getByTestId("link-1").className).toContain("bg-accent-blue-mid")
  })

  it("inactive link has text-text-secondary", () => {
    renderPagination()
    expect(screen.getByTestId("link-2").className).toContain("text-text-secondary")
  })

  it("disabled link has opacity-40", () => {
    renderPagination()
    expect(screen.getByTestId("link-disabled").className).toContain("opacity-40")
  })

  it("PaginationPrevious has aria-label", () => {
    renderPagination()
    expect(screen.getByTestId("prev")).toHaveAttribute("aria-label", "Go to previous page")
  })

  it("PaginationNext has aria-label", () => {
    renderPagination()
    expect(screen.getByTestId("next")).toHaveAttribute("aria-label", "Go to next page")
  })

  it("PaginationEllipsis has aria-hidden", () => {
    renderPagination()
    expect(screen.getByTestId("ellipsis")).toHaveAttribute("aria-hidden", "true")
  })

  it("merges custom className", () => {
    renderPagination({ linkClassName: "custom-link" })
    const link = screen.getByTestId("link-2")
    expect(link.className).toContain("custom-link")
    expect(link.className).toContain("text-text-secondary")
  })

  it("zero hardcoded color values in className", () => {
    renderPagination()
    const testIds = ["nav", "content", "link-1", "link-2", "prev", "next", "ellipsis"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
