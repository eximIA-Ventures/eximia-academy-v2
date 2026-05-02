export async function register() {
  if (process.env.E2E_TESTING !== "true") return
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { server } = await import("./mocks/server")
      server.listen({ onUnhandledRequest: "bypass" })
      console.log("[E2E] MSW intercepting Anthropic API calls")
    } catch {
      // msw not available (production build) — skip silently
    }
  }
}
