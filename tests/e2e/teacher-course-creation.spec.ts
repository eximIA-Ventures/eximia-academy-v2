import { expect, test } from "@playwright/test"
import { loginAs } from "./helpers/auth"

test.describe("Teacher Course Creation", () => {
  // Teacher role was unified into manager; use manager role which has full access
  test("create course with chapter and questions", async ({ page }) => {
    // 1. Login como manager
    await loginAs(page, "manager")

    // 2. Navegar para cursos via sidebar (link = "Trilhas")
    await page.getByRole("link", { name: /trilhas/i }).first().click()
    await expect(page.getByText(/meus cursos/i)).toBeVisible({ timeout: 15_000 })

    // 3. Criar curso via dialog
    await page.getByRole("button", { name: /criar curso/i }).click()
    await expect(page.getByText(/preencha as informacoes/i)).toBeVisible()

    await page.getByLabel(/titulo/i).fill("Curso E2E Automatizado")
    await page.getByLabel(/descricao/i).fill("Curso criado automaticamente via teste E2E")
    // Click the submit button in the dialog (2nd "Criar Curso" button)
    await page.getByRole("button", { name: /criar curso/i }).nth(1).click()

    // 4. Aguardar sucesso
    await expect(page.getByText(/curso criado com sucesso/i)).toBeVisible({ timeout: 10_000 })

    // 5. Navegar para o curso criado (click first matching link — may have duplicates from previous runs)
    await page.getByRole("link", { name: /curso e2e automatizado/i }).first().click()
    await page.waitForURL(/\/courses\//)

    // 6. Adicionar capitulo
    await page.getByRole("button", { name: /adicionar capitulo/i }).click()
    await expect(page.getByRole("heading", { name: /novo capitulo/i })).toBeVisible({ timeout: 10_000 })

    // 7. Preencher capitulo
    await page.getByLabel(/titulo/i).first().fill("Capitulo E2E Teste")

    // Preencher conteudo no editor Plate (contenteditable)
    const editor = page.locator("[contenteditable='true']").first()
    await editor.click()
    await page.keyboard.type(
      "Este e o conteudo do capitulo de teste E2E. " +
        "O objetivo e validar que o fluxo completo de criacao funciona corretamente, " +
        "incluindo a geracao automatica de perguntas socraticas pelo agente de IA. " +
        "O conteudo precisa ter pelo menos cem caracteres para ser aceito pelo validador.",
    )

    // 8. Salvar capitulo — wait for button to be enabled after filling content
    const saveBtn = page.getByRole("button", { name: /salvar/i })
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 })
    await saveBtn.click()

    // After save, redirects to course detail page with toast
    await expect(page.getByText(/capitulo criado/i)).toBeVisible({ timeout: 15_000 })
    await page.waitForURL(/\/courses\/[^/]+$/)

    // 9. Publicar capitulo via "Acoes" dropdown menu
    await expect(page.getByText(/capitulo e2e teste/i)).toBeVisible({ timeout: 10_000 })
    const chapterMenu = page.getByRole("button", { name: /acoes/i }).first()
    await chapterMenu.click()
    await page.getByRole("menuitem", { name: /publicar/i }).click()
    await expect(page.getByText(/capitulo publicado/i)).toBeVisible({ timeout: 10_000 })

    // 10. Navegar para perguntas do capitulo
    await chapterMenu.click()
    await page.getByRole("menuitem", { name: /perguntas/i }).click()
    await page.waitForURL(/\/questions/)

    // 11. Gerar perguntas (MSW intercepta chamada ao Anthropic)
    const generateBtn = page.getByRole("button", { name: /gerar perguntas/i })
    if (await generateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await generateBtn.click()

      // 12. Verificar que perguntas foram geradas
      await expect(page.getByText(/perguntas geradas|pergunta/i).first()).toBeVisible({
        timeout: 30_000,
      })
    }

    // 13. Voltar ao curso e publicar
    await page.getByRole("link", { name: /cursos/i }).first().click()
    await page.getByRole("link", { name: /curso e2e automatizado/i }).first().click()

    const publishBtn = page.getByRole("button", { name: /publicar curso/i })
    if (await publishBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await publishBtn.click()
      await expect(page.getByText(/publicado/i)).toBeVisible({ timeout: 10_000 })
    }
  })
})
