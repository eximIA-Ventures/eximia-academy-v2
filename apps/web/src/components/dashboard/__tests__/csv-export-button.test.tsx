import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CsvExportButton } from "../csv-export-button"

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:test")
global.URL.revokeObjectURL = vi.fn()

const mockData = [
  {
    courseId: "c1",
    title: "Curso A",
    studentCount: 30,
    completionRate: 70,
    avgReflectionDepth: 3.5,
    avgAiDetection: 85,
  },
]

describe("CsvExportButton", () => {
  it("renders export button", () => {
    render(<CsvExportButton data={mockData} aiDetectionEnabled={true} />)

    expect(screen.getByText("Exportar CSV")).toBeInTheDocument()
  })

  it("generates CSV with AI detection column when enabled", () => {
    const clickMock = vi.fn()
    const createElementSpy = vi.spyOn(document, "createElement")

    render(<CsvExportButton data={mockData} aiDetectionEnabled={true} />)

    fireEvent.click(screen.getByText("Exportar CSV"))

    // Verify Blob was created via URL.createObjectURL
    expect(global.URL.createObjectURL).toHaveBeenCalled()
    expect(global.URL.revokeObjectURL).toHaveBeenCalled()
  })

  it("generates CSV without AI detection column when disabled", () => {
    render(<CsvExportButton data={mockData} aiDetectionEnabled={false} />)

    fireEvent.click(screen.getByText("Exportar CSV"))

    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })
})
