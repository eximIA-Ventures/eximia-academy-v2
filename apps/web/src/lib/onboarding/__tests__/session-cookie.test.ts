// @vitest-environment jsdom

// ---------------------------------------------------------------------------
// O cookie de "um modal de cada vez" precisa MORRER SOZINHO.
//
// Ele nasceu sem `Max-Age`, com a justificativa de que "o cookie morre quando o
// navegador fecha, que é a definição de sessão". A definição estava certa e a
// consequência estava errada: há dois anúncios na fila com janelas sobrepostas
// (N1 `priority` 10 por 21 dias, N2 `priority` 20 por 28 dias) e
// `resolveOnboarding()` devolve UM por vez. O segundo só sai quando o cookie
// morre — e navegador que não fecha (Chrome com "continuar de onde parou",
// Chrome no Android) não mata cookie de sessão por semanas. "Um por sessão"
// virava "um por vida do navegador", e a janela de 28 dias de N2 podia fechar
// inteira sem ele ter aparecido nenhuma vez. Como N2 é quem ARMA
// `jornada-builder-tour`, o tour do construtor morria junto, sem sintoma.
//
// Este teste existe para que a remoção do `Max-Age` — que pareceria uma
// simplificação inofensiva — quebre alto em vez de quebrar em silêncio.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest"
import { markModalShownThisSession } from "../client"
import { MODAL_SESSION_COOKIE, MODAL_SESSION_MAX_AGE_SECONDS } from "../session"

describe("markModalShownThisSession", () => {
  it("grava o cookie com Max-Age explícito (não pode depender de o navegador fechar)", () => {
    const escrito: string[] = []
    // `document.cookie` no jsdom não expõe atributos na leitura, então o teste
    // observa a ESCRITA — que é exatamente o que precisa ser verificado aqui.
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (v: string) => {
        escrito.push(v)
      },
    })

    markModalShownThisSession()

    expect(escrito).toHaveLength(1)
    expect(escrito[0]).toContain(`${MODAL_SESSION_COOKIE}=1`)
    expect(escrito[0]).toContain(`Max-Age=${MODAL_SESSION_MAX_AGE_SECONDS}`)
  })

  it("a validade é finita e curta — teto de 24h", () => {
    // Um `Max-Age` grande demais reintroduz o defeito por outro caminho: a fila
    // de anúncios voltaria a andar devagar demais para a janela de 28 dias.
    expect(MODAL_SESSION_MAX_AGE_SECONDS).toBeGreaterThan(0)
    expect(MODAL_SESSION_MAX_AGE_SECONDS).toBeLessThanOrEqual(24 * 60 * 60)
  })
})
