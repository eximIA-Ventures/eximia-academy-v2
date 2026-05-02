import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

import * as Sentry from "@sentry/nextjs"
import DashboardError from "../error"

describe("DashboardError", () => {
  it("renders error UI with retry button", () => {
    const reset = vi.fn()
    const error = new Error("Test error")

    render(<DashboardError error={error} reset={reset} />)

    expect(screen.getByText("Erro no Dashboard")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it("captures exception with Sentry on mount", () => {
    const reset = vi.fn()
    const error = new Error("Test error")

    render(<DashboardError error={error} reset={reset} />)

    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })

  it("calls reset when retry button is clicked", async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    const error = new Error("Test error")

    render(<DashboardError error={error} reset={reset} />)

    await user.click(screen.getByRole("button", { name: /tentar novamente/i }))
    expect(reset).toHaveBeenCalled()
  })
})
