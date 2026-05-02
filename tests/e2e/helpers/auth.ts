import type { Page } from "@playwright/test"

export async function loginAs(page: Page, role: "student" | "manager" | "admin") {
  const credentials = {
    student: { email: "student@test.com", password: "Test123!@#" },
    manager: { email: "manager@test.com", password: "Test123!@#" },
    admin: { email: "admin@test.com", password: "Test123!@#" },
  }
  const { email, password } = credentials[role]
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/senha|password/i).fill(password)
  await page.getByRole("button", { name: /entrar|login|sign in/i }).click()
  await page.waitForURL(/dashboard/)
}
