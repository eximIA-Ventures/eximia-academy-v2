import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Toast, ToastProvider, useToast } from "../components/toast"

/* ---------------------- Helper: test consumer component ------------------- */

function ToastTrigger({
  variant,
  title,
  description,
  duration,
}: {
  variant?: "default" | "success" | "error" | "warning" | "info"
  title?: string
  description?: string
  duration?: number
}) {
  const { toast } = useToast()
  return (
    <button
      data-testid="trigger"
      onClick={() =>
        toast({
          variant,
          title: title ?? "Test Toast",
          description,
          duration,
        })
      }
    >
      Trigger
    </button>
  )
}

function renderToastSystem(triggerProps: Parameters<typeof ToastTrigger>[0] = {}) {
  return render(
    <ToastProvider>
      <ToastTrigger {...triggerProps} />
    </ToastProvider>,
  )
}

/* -------------------------------- Tests ---------------------------------- */

describe("Toast", () => {
  it("renders with title", () => {
    render(<Toast data-testid="toast" title="Hello World" />)
    expect(screen.getByTestId("toast")).toHaveTextContent("Hello World")
  })

  it("renders with description", () => {
    render(<Toast data-testid="toast" title="Title" description="Some description" />)
    expect(screen.getByTestId("toast")).toHaveTextContent("Some description")
  })

  it('has role="alert"', () => {
    render(<Toast data-testid="toast" title="Alert" />)
    expect(screen.getByTestId("toast")).toHaveAttribute("role", "alert")
  })

  it("default variant has bg-bg-card", () => {
    render(<Toast data-testid="toast" title="Default" />)
    expect(screen.getByTestId("toast").className).toContain("bg-bg-card")
  })

  it("success variant has border-l-semantic-success", () => {
    render(<Toast data-testid="toast" title="Success" variant="success" />)
    expect(screen.getByTestId("toast").className).toContain("border-l-semantic-success")
  })

  it("error variant has border-l-semantic-error", () => {
    render(<Toast data-testid="toast" title="Error" variant="error" />)
    expect(screen.getByTestId("toast").className).toContain("border-l-semantic-error")
  })

  it("warning variant has border-l-semantic-warning", () => {
    render(<Toast data-testid="toast" title="Warning" variant="warning" />)
    expect(screen.getByTestId("toast").className).toContain("border-l-semantic-warning")
  })

  it("info variant has border-l-semantic-info", () => {
    render(<Toast data-testid="toast" title="Info" variant="info" />)
    expect(screen.getByTestId("toast").className).toContain("border-l-semantic-info")
  })

  it("close button calls onClose", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Toast data-testid="toast" title="Closeable" onClose={onClose} />)

    await user.click(screen.getByLabelText("Close"))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("merges custom className", () => {
    render(<Toast data-testid="toast" title="Custom" className="my-custom-class" />)
    const el = screen.getByTestId("toast")
    expect(el.className).toContain("my-custom-class")
    expect(el.className).toContain("bg-bg-card")
  })

  it("zero hardcoded color values in className", () => {
    render(<Toast data-testid="toast" title="Colors" variant="success" onClose={() => {}} />)
    const elements = screen.getByTestId("toast").querySelectorAll("*")
    const allElements = [screen.getByTestId("toast"), ...Array.from(elements)]
    for (const el of allElements) {
      if (el instanceof HTMLElement) {
        expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
        expect(el.className).not.toMatch(/rgba?\(/)
      }
    }
  })
})

describe("ToastProvider", () => {
  it("renders children", () => {
    render(
      <ToastProvider>
        <div data-testid="child">Child content</div>
      </ToastProvider>,
    )
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("useToast adds toast", async () => {
    const user = userEvent.setup()
    renderToastSystem({ title: "Dynamic Toast" })

    await user.click(screen.getByTestId("trigger"))
    expect(screen.getByText("Dynamic Toast")).toBeInTheDocument()
  })

  it("auto-dismisses toast after duration", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    })
    renderToastSystem({ title: "Temp Toast", duration: 500 })

    await user.click(screen.getByTestId("trigger"))
    expect(screen.getByText("Temp Toast")).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(screen.queryByText("Temp Toast")).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})
