import { expect, test } from "@playwright/test"
import { loginAs } from "./helpers/auth"

test.describe("Manager Dashboard", () => {
  test("view metrics and export CSV", async ({ page }) => {
    // 1. Login como manager
    await loginAs(page, "manager")

    // 2. Dashboard com painel executivo visivel
    await expect(page.getByText(/painel executivo/i)).toBeVisible()

    // 3. Verificar metricas presentes
    await expect(page.getByText(/alunos ativos/i)).toBeVisible()
    await expect(page.getByText(/sessoes este mes/i)).toBeVisible()

    // 4. Verificar secao Analytics (pode demorar para carregar o client component)
    await expect(page.getByText(/analytics/i).first()).toBeVisible({ timeout: 15_000 })

    // 5. Alterar filtro de periodo (botoes, nao combobox)
    await page.getByRole("button", { name: "30 dias" }).click()

    // 6. Exportar CSV
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: /exportar csv/i }).click()
    const download = await downloadPromise

    // 7. Verificar download
    const filename = download.suggestedFilename()
    expect(filename).toContain(".csv")

    // 8. Validate CSV content has rows
    const filePath = await download.path()
    if (filePath) {
      const fs = await import("node:fs/promises")
      const content = await fs.readFile(filePath, "utf-8")
      const rows = content.trim().split("\n")
      // At least header row + 1 data row
      expect(rows.length).toBeGreaterThanOrEqual(2)
    }
  })
})
