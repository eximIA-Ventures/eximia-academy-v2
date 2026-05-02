import { expect, test } from "@playwright/test"
import { loginAs } from "./helpers/auth"

test.describe("Course Designer Pipeline", () => {
  test("navigate to wizard via Criar Blueprint button and fill brief", async ({ page }) => {
    // 1. Login as manager
    await loginAs(page, "manager")

    // 2. Navigate to courses via sidebar
    await page.getByRole("link", { name: /trilhas/i }).first().click()
    await expect(page.getByText(/meus cursos/i)).toBeVisible({ timeout: 15_000 })

    // 3. Click "Criar Blueprint" button
    await page.getByRole("link", { name: /criar blueprint/i }).click()
    await page.waitForURL(/\/courses\/new\/design/)

    // 4. Verify wizard Step 1 (Propósito)
    await expect(page.getByText(/prop.sito do curso/i)).toBeVisible({ timeout: 10_000 })

    // 5. Fill Step 1
    await page.getByLabel(/t.tulo do curso/i).fill("Curso E2E Blueprint Teste")
    await page.getByLabel(/objetivo de neg.cio/i).fill(
      "Aumentar a produtividade da equipe em 30% nos proximos 3 meses",
    )
    await page.getByLabel(/mudan.a comportamental/i).fill(
      "Colaboradores aplicam tecnicas de gestao de tempo no dia a dia",
    )

    // 6. Advance to Step 2
    await page.getByRole("button", { name: /pr.ximo/i }).click()
    await expect(page.getByText(/audi.ncia/i).first()).toBeVisible({ timeout: 5_000 })

    // 7. Fill Step 2 (Audiência) — role is required
    await page.getByLabel(/cargo.*fun..o/i).fill("Analista de Negocios")

    // 8. Advance to Step 3 (Escopo) — no required fields
    await page.getByRole("button", { name: /pr.ximo/i }).click()
    await expect(page.getByText(/escopo/i).first()).toBeVisible({ timeout: 5_000 })

    // 9. Advance to Step 4 (Restrições) — total_duration_hours defaults to 8
    await page.getByRole("button", { name: /pr.ximo/i }).click()

    // 10. Advance to Step 5 (Preferências) — framework defaults to "auto"
    await page.getByRole("button", { name: /pr.ximo/i }).click()

    // 11. Advance to Step 6 (Gerar) — prevalidation
    await page.getByRole("button", { name: /pr.ximo/i }).click()
    await expect(page.getByText(/revis.o.*gera..o/i)).toBeVisible({ timeout: 5_000 })

    // 12. Verify brief summary is visible
    await expect(page.getByText("Curso E2E Blueprint Teste")).toBeVisible()
    await expect(page.getByText("Analista de Negocios")).toBeVisible()
    await expect(page.getByText("8h")).toBeVisible()

    // 13. Verify "Gerar Blueprint" button is enabled
    const generateBtn = page.getByRole("button", { name: /gerar blueprint/i })
    await expect(generateBtn).toBeEnabled()

    // 14. Click generate — pipeline starts via SSE (MSW intercepts AI calls)
    await generateBtn.click()

    // 15. Verify progress UI appears
    await expect(page.getByText(/gerando blueprint/i)).toBeVisible({ timeout: 10_000 })

    // 16. Wait for pipeline completion — shows phase progress steps
    // The pipeline runs 5 phases, each intercepted by MSW, then saves to DB
    await expect(
      page.getByText(/blueprint gerado|redirecionando/i),
    ).toBeVisible({ timeout: 60_000 })

    // 17. Verify redirect to blueprint viewer (or that it completes)
    await page.waitForURL(/\/courses\/.*\/blueprint/, { timeout: 30_000 })

    // 18. Verify blueprint viewer renders with fixture data
    await expect(page.getByText(/curso e2e blueprint teste/i)).toBeVisible({ timeout: 10_000 })
  })

  test("Criar Blueprint button visible on courses list", async ({ page }) => {
    await loginAs(page, "manager")

    await page.getByRole("link", { name: /trilhas/i }).first().click()
    await expect(page.getByText(/meus cursos/i)).toBeVisible({ timeout: 15_000 })

    // Verify the button exists and links to the design wizard
    const blueprintLink = page.getByRole("link", { name: /criar blueprint/i })
    await expect(blueprintLink).toBeVisible()
    await expect(blueprintLink).toHaveAttribute("href", "/courses/new/design")
  })

  test("mode selector shows Designer de Blueprint option", async ({ page }) => {
    await loginAs(page, "manager")

    await page.goto("/courses/new")

    // Verify all 3 options are visible
    await expect(page.getByText(/criar manualmente/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/importar com ia/i)).toBeVisible()
    await expect(page.getByText(/designer de blueprint/i)).toBeVisible()
  })
})
