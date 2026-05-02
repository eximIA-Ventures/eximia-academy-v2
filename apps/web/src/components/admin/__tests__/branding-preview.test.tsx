import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BrandingPreview } from "../branding-preview"

describe("BrandingPreview", () => {
  it("renders preview label", () => {
    render(
      <BrandingPreview
        primaryColor="#2a6ab0"
        secondaryColor="#1e1e1e"
        tenantName="exímIA Academy"
      />,
    )

    expect(screen.getByText("Preview em tempo real")).toBeInTheDocument()
  })

  it("renders tenant name in preview", () => {
    render(
      <BrandingPreview
        primaryColor="#2a6ab0"
        secondaryColor="#1e1e1e"
        tenantName="Minha Instituicao"
      />,
    )

    expect(screen.getByText("Minha Instituicao")).toBeInTheDocument()
  })

  it("renders logo image when logoUrl is provided", () => {
    const { container } = render(
      <BrandingPreview
        primaryColor="#2a6ab0"
        secondaryColor="#1e1e1e"
        tenantName="Test"
        logoUrl="https://example.com/logo.png"
      />,
    )

    const img = container.querySelector("img")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("src")).toBe("https://example.com/logo.png")
  })

  it("renders fallback initials when no logo", () => {
    render(<BrandingPreview primaryColor="#2a6ab0" secondaryColor="#1e1e1e" tenantName="Test" />)

    expect(screen.getByText("eA")).toBeInTheDocument()
  })

  it("renders management panel text", () => {
    render(<BrandingPreview primaryColor="#2a6ab0" secondaryColor="#1e1e1e" tenantName="Test" />)

    expect(screen.getByText("Painel de Gestao")).toBeInTheDocument()
  })
})
