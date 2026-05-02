import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/card"

describe("Card", () => {
  it("renders Card with children", () => {
    render(<Card data-testid="card">Card content</Card>)
    expect(screen.getByTestId("card")).toHaveTextContent("Card content")
  })

  it("renders CardHeader, CardTitle, CardDescription, CardContent, CardFooter", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle data-testid="title">Title</CardTitle>
          <CardDescription data-testid="description">Description</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">Body</CardContent>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>,
    )
    expect(screen.getByTestId("header")).toBeInTheDocument()
    expect(screen.getByTestId("title")).toHaveTextContent("Title")
    expect(screen.getByTestId("description")).toHaveTextContent("Description")
    expect(screen.getByTestId("content")).toHaveTextContent("Body")
    expect(screen.getByTestId("footer")).toHaveTextContent("Footer")
  })

  it("Card applies bg-bg-card class", () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId("card").className).toContain("bg-bg-card")
  })

  it("Card applies rounded-md class", () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId("card").className).toContain("rounded-md")
  })

  it("Card applies shadow-card class", () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId("card").className).toContain("shadow-card")
  })

  it("merges custom className", () => {
    render(
      <Card data-testid="card" className="custom-class">
        Content
      </Card>,
    )
    expect(screen.getByTestId("card").className).toContain("custom-class")
  })

  it("forwards ref on Card", () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>
    render(<Card ref={ref}>Content</Card>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it("zero hardcoded color values in className", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle data-testid="title">Title</CardTitle>
          <CardDescription data-testid="description">Desc</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">Body</CardContent>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>,
    )
    const elements = ["card", "header", "title", "description", "content", "footer"]
    for (const id of elements) {
      const classes = screen.getByTestId(id).className
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(classes).not.toMatch(/rgba?\(/)
    }
  })
})
