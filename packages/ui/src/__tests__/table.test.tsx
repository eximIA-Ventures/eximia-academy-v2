import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/table"

function renderTable({ rowClassName }: { rowClassName?: string } = {}) {
  return render(
    <Table data-testid="table">
      <TableCaption data-testid="caption">A list of items</TableCaption>
      <TableHeader data-testid="header">
        <TableRow data-testid="header-row" className={rowClassName}>
          <TableHead data-testid="head">Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody data-testid="body">
        <TableRow data-testid="body-row">
          <TableCell data-testid="cell">Item 1</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter data-testid="footer">
        <TableRow data-testid="footer-row">
          <TableCell>Total</TableCell>
        </TableRow>
      </TableFooter>
    </Table>,
  )
}

describe("Table", () => {
  it("renders table element", () => {
    renderTable()
    expect(screen.getByTestId("table").tagName).toBe("TABLE")
  })

  it("TableHeader renders thead", () => {
    renderTable()
    expect(screen.getByTestId("header").tagName).toBe("THEAD")
  })

  it("TableBody renders tbody", () => {
    renderTable()
    expect(screen.getByTestId("body").tagName).toBe("TBODY")
  })

  it("TableRow renders tr", () => {
    renderTable()
    expect(screen.getByTestId("body-row").tagName).toBe("TR")
  })

  it("TableHead renders th with text-text-muted", () => {
    renderTable()
    const th = screen.getByTestId("head")
    expect(th.tagName).toBe("TH")
    expect(th.className).toContain("text-text-muted")
  })

  it("TableCell renders td", () => {
    renderTable()
    const td = screen.getByTestId("cell")
    expect(td.tagName).toBe("TD")
    expect(td).toHaveTextContent("Item 1")
  })

  it("TableCaption renders caption", () => {
    renderTable()
    const caption = screen.getByTestId("caption")
    expect(caption.tagName).toBe("CAPTION")
    expect(caption).toHaveTextContent("A list of items")
  })

  it("TableFooter renders tfoot", () => {
    renderTable()
    const tfoot = screen.getByTestId("footer")
    expect(tfoot.tagName).toBe("TFOOT")
    expect(tfoot.className).toContain("bg-bg-surface")
  })

  it("TableRow has hover:bg-bg-surface", () => {
    renderTable()
    expect(screen.getByTestId("body-row").className).toContain("hover:bg-bg-surface")
  })

  it("merges custom className", () => {
    renderTable({ rowClassName: "custom-row" })
    const row = screen.getByTestId("header-row")
    expect(row.className).toContain("custom-row")
    expect(row.className).toContain("border-b")
  })

  it("zero hardcoded color values in classNames", () => {
    renderTable()
    const testIds = ["table", "header", "body", "body-row", "head", "cell", "caption", "footer"]
    for (const id of testIds) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
