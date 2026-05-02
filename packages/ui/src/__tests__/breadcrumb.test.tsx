import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/breadcrumb"

function renderBreadcrumb({
  navClassName,
  listClassName,
  separatorChildren,
}: {
  navClassName?: string
  listClassName?: string
  separatorChildren?: React.ReactNode
} = {}) {
  return render(
    <Breadcrumb data-testid="breadcrumb-nav" className={navClassName}>
      <BreadcrumbList data-testid="breadcrumb-list" className={listClassName}>
        <BreadcrumbItem data-testid="item-1">
          <BreadcrumbLink data-testid="link-1" href="/home">
            Home
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator data-testid="separator-1">{separatorChildren}</BreadcrumbSeparator>
        <BreadcrumbItem data-testid="item-2">
          <BreadcrumbLink data-testid="link-2" href="/products">
            Products
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator data-testid="separator-2" />
        <BreadcrumbItem data-testid="item-3">
          <BreadcrumbPage data-testid="page">Current Page</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>,
  )
}

describe("Breadcrumb", () => {
  it("renders nav with aria-label='Breadcrumb'", () => {
    renderBreadcrumb()
    const nav = screen.getByTestId("breadcrumb-nav")
    expect(nav.tagName).toBe("NAV")
    expect(nav).toHaveAttribute("aria-label", "Breadcrumb")
  })

  it("BreadcrumbList renders ol", () => {
    renderBreadcrumb()
    expect(screen.getByTestId("breadcrumb-list").tagName).toBe("OL")
  })

  it("BreadcrumbLink renders anchor with href", () => {
    renderBreadcrumb()
    const link = screen.getByTestId("link-1")
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("href", "/home")
  })

  it("BreadcrumbSeparator has aria-hidden='true'", () => {
    renderBreadcrumb()
    expect(screen.getByTestId("separator-1")).toHaveAttribute("aria-hidden", "true")
  })

  it("BreadcrumbSeparator has role='presentation'", () => {
    renderBreadcrumb()
    expect(screen.getByTestId("separator-1")).toHaveAttribute("role", "presentation")
  })

  it("BreadcrumbSeparator renders '/' by default", () => {
    renderBreadcrumb()
    expect(screen.getByTestId("separator-2")).toHaveTextContent("/")
  })

  it("BreadcrumbPage has aria-current='page'", () => {
    renderBreadcrumb()
    expect(screen.getByTestId("page")).toHaveAttribute("aria-current", "page")
  })

  it("BreadcrumbPage has aria-disabled='true'", () => {
    renderBreadcrumb()
    expect(screen.getByTestId("page")).toHaveAttribute("aria-disabled", "true")
  })

  it("merges custom className on Breadcrumb nav", () => {
    renderBreadcrumb({ navClassName: "custom-nav" })
    expect(screen.getByTestId("breadcrumb-nav").className).toContain("custom-nav")
  })

  it("merges custom className on BreadcrumbList", () => {
    renderBreadcrumb({ listClassName: "custom-list" })
    const list = screen.getByTestId("breadcrumb-list")
    expect(list.className).toContain("custom-list")
    expect(list.className).toContain("text-text-muted")
  })

  it("zero hardcoded color values in className", () => {
    renderBreadcrumb()
    const testIds = ["breadcrumb-nav", "breadcrumb-list", "item-1", "link-1", "separator-1", "page"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
