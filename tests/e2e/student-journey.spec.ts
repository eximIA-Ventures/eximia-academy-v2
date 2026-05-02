import { expect, test } from "@playwright/test"
import { loginAs } from "./helpers/auth"

test.describe("Student Journey", () => {
  test("complete socratic session flow", async ({ page }) => {
    // 1. Login como student
    await loginAs(page, "student")

    // 2. Dashboard visivel — welcome banner
    await expect(page.getByText(/ola,.*continue aprendendo/i)).toBeVisible()

    // 3. Navegar para cursos via sidebar
    await page.getByRole("link", { name: /trilhas/i }).click()

    // 4. Localizar curso de teste — should be visible (student already enrolled via seed)
    await expect(page.getByText(/curso de teste/i).first()).toBeVisible({ timeout: 15_000 })

    // 5. Acessar curso via "Continuar" link (may navigate directly to chapter)
    await page.getByRole("link", { name: /continuar/i }).first().click()
    await page.waitForURL(/\/courses\//)

    // 6. If on course detail page, click chapter; otherwise already on chapter page
    const chapterLink = page.getByRole("link", { name: /capitulo 1/i }).first()
    const sessionBtnEarly = page.getByRole("button", { name: /iniciar sessao socratica|continuar sessao/i })
    // Wait for either chapter link (course detail) or session button (chapter page)
    await Promise.race([
      chapterLink.waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
      sessionBtnEarly.waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
    ])
    if (await chapterLink.isEnabled({ timeout: 1_000 }).catch(() => false)) {
      await chapterLink.click()
      await page.waitForURL(/\/chapters\//)
    }

    // 7. Iniciar sessao socratica
    const sessionBtn = page.getByRole("button", {
      name: /iniciar sessao socratica|continuar sessao/i,
    })
    await expect(sessionBtn).toBeEnabled({ timeout: 15_000 })
    await sessionBtn.click()

    // Handle question chooser sheet if multiple questions
    const randomBtn = page.getByRole("button", { name: /aleatoria/i })
    if (await randomBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await randomBtn.click()
    }

    // 8. Enviar 3 mensagens — wait for AI response between each
    for (let i = 0; i < 3; i++) {
      const chatInput = page.getByPlaceholder(/escreva sua reflexao/i)
      await expect(chatInput).toBeVisible({ timeout: 15_000 })
      await chatInput.fill(
        `Minha reflexao ${i + 1}: acredito que este conceito se aplica na pratica quando analisamos os fundamentos teoricos apresentados.`,
      )

      // Wait for the API response to complete after clicking send
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes("/messages") && resp.status() === 200,
        { timeout: 30_000 },
      )
      await page.getByRole("button", { name: /enviar/i }).click()
      await responsePromise

      // Wait for either input re-enabled (next turn) or session completed (final turn)
      await Promise.race([
        expect(chatInput).toBeEnabled({ timeout: 15_000 }).catch(() => null),
        page.getByText(/sessao concluida/i).waitFor({ state: "visible", timeout: 15_000 }).catch(() => null),
      ])
    }

    // 9. Verificar conclusao da sessao
    await expect(page.getByText(/sessao concluida/i)).toBeVisible({ timeout: 15_000 })
  })
})
