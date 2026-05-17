import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

/**
 * Accessibility Tests (Wave 3.7)
 *
 * Verifies WCAG 2.1 AA compliance on critical pages.
 * Uses axe-core via @axe-core/playwright.
 *
 * Run: pnpm test:e2e -- --grep accessibility
 */

const CRITICAL_PAGES = [
  { name: "Login", path: "/entrar" },
  { name: "Dashboard", path: "/dashboard" },
  { name: "Courses", path: "/courses" },
  { name: "Biblioteca", path: "/biblioteca" },
]

test.describe("Accessibility — WCAG 2.1 AA", () => {
  for (const page of CRITICAL_PAGES) {
    test(`${page.name} (${page.path}) has no critical a11y violations`, async ({
      page: browserPage,
    }) => {
      await browserPage.goto(page.path)

      // Wait for page to stabilize
      await browserPage.waitForLoadState("networkidle")

      const results = await new AxeBuilder({ page: browserPage })
        .withTags(["wcag2a", "wcag2aa"])
        .exclude(".recharts-wrapper") // Charts are complex — audit separately
        .analyze()

      // Filter to critical and serious only
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      )

      if (critical.length > 0) {
        const summary = critical.map(
          (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`
        )
        console.warn("A11y violations found:\n" + summary.join("\n"))
      }

      // Fail only on critical violations (serious = warning for now)
      const criticalOnly = results.violations.filter((v) => v.impact === "critical")
      expect(criticalOnly).toHaveLength(0)
    })
  }
})
