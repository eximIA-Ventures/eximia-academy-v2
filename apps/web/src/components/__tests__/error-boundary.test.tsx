import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  ErrorBoundary: ({
    children,
    fallback,
  }: {
    children: React.ReactNode
    fallback: (props: { error: Error; resetError: () => void }) => React.ReactNode
  }) => {
    // Simple mock that just renders children
    return <>{children}</>
  },
}))

import { SentryErrorBoundary } from "../error-boundary"

describe("SentryErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <SentryErrorBoundary>
        <div>Test content</div>
      </SentryErrorBoundary>,
    )
    expect(screen.getByText("Test content")).toBeInTheDocument()
  })
})
