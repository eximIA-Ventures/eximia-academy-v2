import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CourseMetricsTable } from "../course-metrics-table"

const mockCourses = [
  {
    courseId: "c1",
    title: "React Avancado",
    studentCount: 25,
    completionRate: 60,
    sessionCount: 150,
    status: "published",
  },
  {
    courseId: "c2",
    title: "Node.js Basico",
    studentCount: 10,
    completionRate: 80,
    sessionCount: 50,
    status: "draft",
  },
]

describe("CourseMetricsTable", () => {
  it("renders course rows with metrics", () => {
    render(
      <CourseMetricsTable
        courses={mockCourses}
        onExpandCourse={() => {}}
        expandedCourseId={null}
        studentMetrics={null}
        loadingStudents={false}
        aiDetectionEnabled={false}
      />,
    )

    expect(screen.getByText("React Avancado")).toBeInTheDocument()
    expect(screen.getByText("25")).toBeInTheDocument()
    expect(screen.getByText("60%")).toBeInTheDocument()
    expect(screen.getByText("150")).toBeInTheDocument()
    expect(screen.getByText("Publicado")).toBeInTheDocument()
    expect(screen.getByText("Node.js Basico")).toBeInTheDocument()
    expect(screen.getByText("Rascunho")).toBeInTheDocument()
  })

  it("shows student metrics when course is expanded", () => {
    const students = [
      {
        studentId: "s1",
        name: "Ana Silva",
        progress: 75,
        sessionCount: 5,
        lastActivity: new Date().toISOString(),
        aiDetectionFlags: [],
      },
    ]

    render(
      <CourseMetricsTable
        courses={mockCourses}
        onExpandCourse={() => {}}
        expandedCourseId="c1"
        studentMetrics={students}
        loadingStudents={false}
        aiDetectionEnabled={false}
      />,
    )

    expect(screen.getByText("Ana Silva")).toBeInTheDocument()
    expect(screen.getByText("75%")).toBeInTheDocument()
  })

  it("shows loading state when expanding", () => {
    render(
      <CourseMetricsTable
        courses={mockCourses}
        onExpandCourse={() => {}}
        expandedCourseId="c1"
        studentMetrics={null}
        loadingStudents={true}
        aiDetectionEnabled={false}
      />,
    )

    expect(screen.getByText("Carregando metricas...")).toBeInTheDocument()
  })
})
