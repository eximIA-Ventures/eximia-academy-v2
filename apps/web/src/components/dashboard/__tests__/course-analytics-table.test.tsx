import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CourseAnalyticsTable } from "../course-analytics-table"

const mockCourses = [
  {
    courseId: "c1",
    title: "Curso A",
    studentCount: 30,
    completionRate: 70,
    avgReflectionDepth: 3.5,
    avgAiDetection: 85,
  },
]

describe("CourseAnalyticsTable", () => {
  it("renders courses with all columns when AI detection enabled", () => {
    render(<CourseAnalyticsTable courses={mockCourses} aiDetectionEnabled={true} />)

    expect(screen.getByText("Curso A")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
    expect(screen.getByText("70%")).toBeInTheDocument()
    expect(screen.getByText("3.5")).toBeInTheDocument()
    expect(screen.getByText("85%")).toBeInTheDocument()
    expect(screen.getByText("AI Detection (%)")).toBeInTheDocument()
  })

  it("hides AI detection column when feature flag is false", () => {
    render(<CourseAnalyticsTable courses={mockCourses} aiDetectionEnabled={false} />)

    expect(screen.getByText("Curso A")).toBeInTheDocument()
    expect(screen.queryByText("AI Detection (%)")).not.toBeInTheDocument()
    expect(screen.queryByText("85%")).not.toBeInTheDocument()
  })

  it("shows empty message when no courses", () => {
    render(<CourseAnalyticsTable courses={[]} aiDetectionEnabled={false} />)

    expect(screen.getByText("Nenhum curso encontrado")).toBeInTheDocument()
  })
})
