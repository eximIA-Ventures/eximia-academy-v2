import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RITMO_BADGE, RitmoBadge } from "../ritmo-badge"

// ---------------------------------------------------------------------------
// TESTE VERMELHO — POP-FIX-001, run 2026-08-07-academy-manager-dashboard-copy-fixes
// Passo 2 (Identificar o Problema). Item 1 de 4 do `00-criterio.md`:
//
//   ritmo-badge.tsx:84   "Sem acesso"  →  "Sem acesso recente"
//
// Este arquivo NÃO existia: `ritmo-badge.tsx` era exercitado só de lado, via
// student-insights-table.test.tsx. O rótulo do estado `sem_acesso` é o texto que
// o GESTOR lê para decidir acionar ou não um aluno, em 5 telas — ele merece
// asserção direta, não cobertura por tabela.
//
// "Sem acesso" lê como estado absoluto ("nunca acessou"); o dado por trás é uma
// JANELA recente (triagem `sem_acesso`). O rótulo pedido já é o canônico da casa
// em outros 3 pontos vivos — ver `02-modo-de-falha.md`, seção do item 1.
// ---------------------------------------------------------------------------

describe("RITMO_BADGE — rótulo do estado sem_acesso (POP-FIX-001, item 1)", () => {
  it("o rótulo do estado sem_acesso é 'Sem acesso recente' (janela), nunca 'Sem acesso' (absoluto)", () => {
    expect(RITMO_BADGE.sem_acesso.label).toBe("Sem acesso recente")
  })

  it("o badge renderizado mostra 'Sem acesso recente' ao gestor", () => {
    render(<RitmoBadge display="sem_acesso" />)
    expect(screen.getByText("Sem acesso recente")).toBeInTheDocument()
  })

  it("os outros 4 rótulos ficam intactos (a correção é cirúrgica, não uma revisão da taxonomia)", () => {
    expect(RITMO_BADGE.concluido.label).toBe("Concluído")
    expect(RITMO_BADGE.no_ritmo.label).toBe("No ritmo")
    expect(RITMO_BADGE.atrasado.label).toBe("Atrasado")
    expect(RITMO_BADGE.nao_iniciado.label).toBe("Não iniciado")
  })
})
