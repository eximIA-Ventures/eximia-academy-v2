// ---------------------------------------------------------------------------
// EXISTE CAMINHO ATÉ O OUTRO DOMÍNIO? — o teste que faltava.
// ---------------------------------------------------------------------------
// O DEFEITO QUE ESTE ARQUIVO TRANCA (2026-08-25). "Aprendizagem do Time" subiu
// para produção com typecheck limpo, lint limpo e 41 testes verdes — e o gestor
// não tinha como chegar nela. O seletor de domínio morava DENTRO da moldura do
// próprio domínio, que só renderiza quando `?dominio=aprendizagem` já está na
// URL. A única porta para a tela ficava dentro da tela. Circular.
//
// Nenhuma das réguas existentes reprova isso, e é o ponto: typecheck confere
// tipo, lint confere forma, teste de unidade confere cálculo. NENHUM deles
// pergunta "existe caminho de navegação até aqui?". É o mesmo defeito corrigido
// horas antes em `/jornada` (commit 790298e, "a rota existia e o caminho até ela
// não") — reapareceu no mesmo dia, noutra tela, porque nada o media.
//
// A ASSERÇÃO É SOBRE A SUPERFÍCIE DE ENTRADA, NÃO SOBRE O HELPER. Testar só
// `hrefDoDominio` seria satisfeito por uma função perfeita que ninguém chama —
// exatamente o estado em que o defeito nasceu. Por isso cada superfície por onde
// o gestor entra é RENDERIZADA, e o link é lido da árvore.
//
// TODA ASSERÇÃO VEM EM PAR (presença + variância), a mesma regra de
// `_trinca/__tests__/moldura.test.tsx`: verificar só que o href contém
// `dominio=aprendizagem` é satisfeito por um literal cravado; por isso os
// filtros também são verificados quando a entrada muda.
// ---------------------------------------------------------------------------

import { VISAO_GERAL_COMPLETA } from "@/components/analytics/visao-geral/fixture"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import { hrefDoDominio } from "@/lib/analytics/dominios"
import type { VisaoGeralDados } from "@/lib/analytics/visao-geral/tipos"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MolduraAprendizagem } from "../_aprendizagem-time/moldura"
import { MolduraAba } from "../_trinca/moldura"

// `FiltrosEscopo` é `"use client"` e usa os três hooks de rota. Em jsdom não há
// roteador: o mock existe para o componente montar, não para ser verificado.
vi.mock("next/navigation", () => ({
  usePathname: () => "/analytics",
  useSearchParams: () => new URLSearchParams("periodo=90&escopo=hierarquia"),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

afterEach(cleanup)

const CURSO = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
const QUERY = `periodo=90&escopo=hierarquia&curso=${CURSO}`

const CONTROLES = {
  periodoDias: 90,
  escopoEquipe: "hierarquia" as const,
  escopoEditavel: true,
  cursoId: CURSO,
  cursos: [{ id: CURSO, titulo: "Liderança na prática" }],
  falhaCursos: false,
}

const APRENDIZAGEM = "Aprendizagem do Time"
const ATIVACAO = "Ativação da Jornada"

/** O `href` do link, lido da árvore renderizada — nunca recalculado aqui. */
function hrefDa(rotulo: string): string {
  return screen.getByRole("link", { name: rotulo }).getAttribute("href") ?? ""
}

describe("caminho entre os dois domínios do Analytics", () => {
  // ─── A ENTRADA. É aqui que o gestor cai ao abrir /analytics, e era daqui
  // que o segundo domínio estava invisível. ─────────────────────────────────
  it("a Visão geral (tela de entrada) oferece o caminho para Aprendizagem do Time", () => {
    render(
      <VisaoGeralTab
        data={VISAO_GERAL_COMPLETA as unknown as VisaoGeralDados}
        destinoAbas={{ pathname: "/analytics", query: QUERY }}
      />,
    )

    expect(hrefDa(APRENDIZAGEM)).toContain("dominio=aprendizagem")
  })

  it("a Visão geral leva os filtros do recorte junto na troca de domínio", () => {
    render(
      <VisaoGeralTab
        data={VISAO_GERAL_COMPLETA as unknown as VisaoGeralDados}
        destinoAbas={{ pathname: "/analytics", query: QUERY }}
      />,
    )

    const href = hrefDa(APRENDIZAGEM)
    expect(href).toContain("periodo=90")
    expect(href).toContain(`curso=${CURSO}`)
    // Variância: o recorte NÃO é um literal cravado no componente.
    cleanup()
    render(
      <VisaoGeralTab
        data={VISAO_GERAL_COMPLETA as unknown as VisaoGeralDados}
        destinoAbas={{ pathname: "/analytics", query: "periodo=7" }}
      />,
    )
    const outro = hrefDa(APRENDIZAGEM)
    expect(outro).toContain("periodo=7")
    expect(outro).not.toContain("periodo=90")
  })

  // ─── AS OUTRAS DUAS ABAS de Ativação. Quem entra por elas também precisa
  // enxergar o segundo domínio, senão o caminho depende de qual aba o gestor
  // abriu por último. ───────────────────────────────────────────────────────
  it.each(["padroes", "mapa"] as const)(
    "a aba %s de Ativação oferece o caminho para Aprendizagem do Time",
    (aba) => {
      render(
        <MolduraAba
          aba={aba}
          destino={{ pathname: "/analytics", query: QUERY }}
          controles={CONTROLES}
        />,
      )

      expect(hrefDa(APRENDIZAGEM)).toContain("dominio=aprendizagem")
    },
  )

  // ─── A VOLTA. Um caminho de mão única deixaria o gestor preso do outro
  // lado, que é a mesma falha com o sinal trocado. ──────────────────────────
  it("Aprendizagem do Time oferece a volta para Ativação, sem carregar o dominio", () => {
    render(
      <MolduraAprendizagem
        vista="visao-geral"
        destino={{ pathname: "/analytics", query: QUERY }}
        controles={CONTROLES}
      />,
    )

    const volta = hrefDa(ATIVACAO)
    expect(volta).not.toContain("dominio=")
    // A volta também preserva o recorte — mesma população, outro assunto.
    expect(volta).toContain("periodo=90")
  })
})

describe("hrefDoDominio — o que sobrevive à troca e o que não", () => {
  it("preserva o recorte (periodo, curso, escopo)", () => {
    const href = hrefDoDominio("aprendizagem", QUERY)
    expect(href).toContain("periodo=90")
    expect(href).toContain("escopo=hierarquia")
    expect(href).toContain(`curso=${CURSO}`)
  })

  it("descarta ?tab= e ?vista=, que só têm significado dentro de um domínio", () => {
    // `tab` é a trinca de Ativação; levá-la para Aprendizagem deixaria na URL
    // uma chave sem destino.
    expect(hrefDoDominio("aprendizagem", "tab=padroes&periodo=30")).not.toContain("tab=")
    // `vista` é a trinca de Aprendizagem; o inverso vale igual.
    expect(hrefDoDominio("ativacao", "vista=mapa&periodo=30")).not.toContain("vista=")
    // E o que não é de ninguém em particular continua viajando.
    expect(hrefDoDominio("aprendizagem", "tab=padroes&periodo=30")).toContain("periodo=30")
  })

  it("Ativação é a entrada: sem query, é /analytics limpo — bookmark antigo não muda de destino", () => {
    expect(hrefDoDominio("ativacao")).toBe("/analytics")
    expect(hrefDoDominio("aprendizagem")).toBe("/analytics?dominio=aprendizagem")
  })
})
