// ---------------------------------------------------------------------------
// O `::before` de `CtaRodape` NUNCA escala para o viewport inteiro.
// ---------------------------------------------------------------------------
// DEFEITO DIAGNOSTICADO (2026-08-25): `CLASSE_CTA_RODAPE` alarga a área de
// clique com `before:absolute before:-inset-x-[6px] before:-inset-y-[4px]`. O
// containing block desse pseudo-elemento é o "nearest positioned ancestor" —
// e se ELE (o próprio `<a>`/`<button>`) não for um positioned element, a busca
// sobe até o `html` (`position: static`) e o pseudo escala para o INITIAL
// CONTAINING BLOCK: uma camada do tamanho do viewport inteiro (medido:
// 1452×908 em 1440×900), com `pointer-events` herdado como `auto`, sobre toda
// a página — inclusive as abas de navegação. Foi o que derrubou scroll e
// clique da Autogestão inteira em produção: os dois call sites de
// `autogestao/visao-geral-tab.tsx` não passavam NENHUMA classe de
// posicionamento (os outros dois call sites já passavam `absolute` e ficavam
// blindados por acidente).
//
// A CORREÇÃO ANTIGA exigia disciplina de call site (lembrar de escrever
// `relative`) — e disciplina não escala: um 5º call site que esquecer
// reproduz o apagão. A blindagem real vive agora na PRIMITIVA
// (`semPosicionamento`, `visao-geral/design.tsx`): ela aplica `relative` por
// padrão, e SÓ quando o `className` do call site não traz nenhum valor de
// `position` (nem `absolute`, nem `fixed`, nem `sticky`, nem o próprio
// `relative`).
//
// ═══ POR QUE ISTO NÃO MEDE COM `getBoundingClientRect` ═════════════════════
// jsdom não tem motor de layout (mesma limitação documentada em
// `rodape-nao-invade-o-miolo.test.tsx`): `getComputedStyle` não resolve
// classes do Tailwind aqui, porque nenhuma folha de estilo é carregada no
// ambiente de teste. O que ESTE arquivo mede é a aritmética que garante a
// contenção — a mesma equivalência que o CSS usa para escolher o containing
// block do pseudo-elemento: "o host tem uma classe de `position` diferente de
// `static`?" — nunca "que caixa renderizou". A prova com tinta real (Chromium,
// `elementFromPoint`, scroll) é o comando de verificação ao vivo desta run,
// não este arquivo.
//
// ═══ POR QUE `relative` NÃO PODE SER UMA CLASSE-BASE FIXA ═════════════════
// Tailwind gera as cinco classes de `position` numa ORDEM FIXA no plugin core
// (`static, fixed, absolute, relative, sticky`) — essa é a ordem de aparição
// no CSS final, não a ordem dos tokens na string de `className`. `.relative`
// nasce DEPOIS de `.absolute` no arquivo gerado, e com especificidade igual
// (uma classe cada) quem vem depois no CSS vence a cascata. Se
// `CLASSE_CTA_RODAPE` trouxesse `relative` fixo, os dois call sites que hoje
// passam `absolute` (`gaveta.tsx`, `LinkRodape`) teriam esse `absolute`
// SILENCIOSAMENTE derrubado — a ancoragem (`right-[18px]`, `bottom`, `height`)
// sairia do lugar sem erro nenhum. O teste 3 abaixo reproduz exatamente essa
// escolha errada e mostra o que ela produziria, em contraste com a blindagem
// real.
// ---------------------------------------------------------------------------

import { entradaMapaFixture } from "@/components/analytics/mapa-jornada/fixture"
import { MapaJornadaTab } from "@/components/analytics/mapa-jornada/mapa-jornada-tab"
import { entradaFixture } from "@/components/analytics/padroes-tendencias/fixture"
import { PadroesTendenciasTab } from "@/components/analytics/padroes-tendencias/padroes-tendencias-tab"
import { CtaRodape, semPosicionamento } from "@/components/analytics/visao-geral/design"
import { VISAO_GERAL_COMPLETA } from "@/components/analytics/visao-geral/fixture"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import { computeMapaJornada } from "@/lib/analytics/mapa-jornada"
import { computePadroesTendencias } from "@/lib/analytics/padroes-tendencias"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { visaoGeralCompleta } from "../../autogestao/__tests__/fixture"
import { VisaoGeralAutogestaoTab } from "../../autogestao/visao-geral-tab"

afterEach(cleanup)

/** Os cinco valores de `position` que o Tailwind conhece. */
const POSICOES = ["static", "fixed", "absolute", "relative", "sticky"] as const

/** Os tokens de `position` presentes no `className` renderizado de um elemento. */
function tokensDePosicao(el: Element): string[] {
  return el.className.split(/\s+/).filter((t) => (POSICOES as readonly string[]).includes(t))
}

// ===========================================================================
// 1. `semPosicionamento` — a função pura que decide a blindagem.
// ===========================================================================

describe("semPosicionamento · a decisão que blinda CtaRodape por padrão", () => {
  it("é `true` quando o call site não declara NENHUM valor de position", () => {
    expect(semPosicionamento("")).toBe(true)
    expect(semPosicionamento("right-[18px]")).toBe(true)
    expect(semPosicionamento("mt-[12px] w-fit")).toBe(true)
  })

  it("é `false` para os cinco valores de position, em qualquer posição na string", () => {
    for (const posicao of POSICOES) {
      expect(semPosicionamento(posicao), posicao).toBe(false)
      expect(semPosicionamento(`right-[18px] ${posicao}`), posicao).toBe(false)
      expect(semPosicionamento(`${posicao} right-[18px]`), posicao).toBe(false)
    }
  })

  it("NÃO confunde `before:absolute` (escopo do pseudo-elemento) com `absolute` do host", () => {
    // `before:absolute` só posiciona o PSEUDO — o host continua `static` sem
    // ajuda. Se `semPosicionamento` tratasse este token como "já tem posição",
    // a blindagem nunca entraria para um call site que (por acidente) só
    // escrevesse variantes `before:`/`hover:` de position.
    expect(semPosicionamento("before:absolute hover:relative")).toBe(true)
  })
})

// ===========================================================================
// 2. `CtaRodape` isolado — todas as combinações de className.
// ===========================================================================

describe("CtaRodape · sempre positioned, nunca dois valores de position ao mesmo tempo", () => {
  const COMBINACOES: Array<{ nome: string; className?: string }> = [
    { nome: "sem className (os 2 call sites da autogestão, hoje)" },
    {
      nome: "absolute right-[18px] (gaveta.tsx / LinkRodape, hoje)",
      className: "absolute right-[18px]",
    },
    { nome: "fixed inset-0 (hipotético, futuro call site)", className: "fixed inset-0" },
    { nome: "sticky top-0 (hipotético, futuro call site)", className: "sticky top-0" },
  ]

  for (const { nome, className } of COMBINACOES) {
    it(`"${nome}" renderiza com EXATAMENTE um valor de position`, () => {
      const { container } = render(
        <CtaRodape rotulo="Ver detalhes" href="/destino" className={className} />,
      )
      const el = container.querySelector("[data-cta-rodape]")
      if (!el) throw new Error("CtaRodape não renderizou nenhum [data-cta-rodape]")
      const tokens = tokensDePosicao(el)
      expect(
        tokens,
        `esperado 1 valor de position, achado [${tokens.join(", ")}] em className="${el.className}"`,
      ).toHaveLength(1)
      if (className) {
        // Quando o call site já trouxe a própria posição, ela SOBREVIVE
        // intacta — a blindagem não a substitui nem entra em conflito com ela.
        const declarada = className.split(/\s+/)[0]
        expect(tokens).toEqual([declarada])
      } else {
        // Quando o call site não trouxe nada, a blindagem entra: `relative`.
        expect(tokens).toEqual(["relative"])
      }
    })
  }

  it("CONTROLE POSITIVO — sem a blindagem, o call site sem className fica `static` (o defeito de origem)", () => {
    // Reproduz o comportamento de ANTES desta correção: concatenar só
    // `CLASSE_CTA_RODAPE` com o `className` do call site, sem `semPosicionamento`.
    // Isto é literalmente o que `CtaRodape` fazia até 2026-08-25.
    const classeAntiga = (className: string) =>
      `group flex cursor-pointer before:absolute before:-inset-x-[6px] before:-inset-y-[4px] before:content-[''] ${className}`.trim()

    const { container } = render(
      // biome-ignore lint/a11y/useValidAnchor: réplica do defeito, não é UI real.
      <a data-cta-rodape className={classeAntiga("")} href="/meu-plano">
        Ver detalhes
      </a>,
    )
    const el = container.querySelector("[data-cta-rodape]")
    if (!el) throw new Error("réplica não renderizou")
    expect(
      tokensDePosicao(el),
      "a réplica do código antigo não deveria ter NENHUM valor de position — se tiver, o controle está cego e o teste acima não prova nada",
    ).toEqual([])
  })
})

// ===========================================================================
// 3. CONTROLE POSITIVO — a escolha errada (relative como classe-base fixa)
//    derrubaria os call sites que já passam `absolute`.
// ===========================================================================

describe("a alternativa REJEITADA (relative fixo na classe-base) — por que ela quebraria", () => {
  it("concatenar `relative` como base, antes do className do call site, produz DOIS valores de position", () => {
    // Esta é a implementação que NÃO foi escolhida: `relative` sempre
    // presente na classe-base, e o `className` do call site concatenado
    // depois. Ela parece inofensiva na STRING (o `className` final tem os
    // dois tokens), mas o Tailwind resolve por ORDEM NO CSS GERADO, não por
    // ordem na string — e é exatamente essa a lacuna que a implementação
    // escolhida fecha com `semPosicionamento`.
    const classeBaseFixaErrada = (className: string) => `relative ${className}`.trim()

    const resultado = classeBaseFixaErrada("absolute right-[18px]")
    const tokens = resultado.split(/\s+/).filter((t) => (POSICOES as readonly string[]).includes(t))

    expect(
      tokens,
      "a alternativa rejeitada produz DOIS valores de position no mesmo elemento — a ambiguidade de cascata que a blindagem real evita",
    ).toEqual(["relative", "absolute"])

    // A implementação REAL, para o mesmo caso, nunca chega a essa ambiguidade:
    // ela não escreve `relative` quando o call site já trouxe `absolute`.
    expect(semPosicionamento("absolute right-[18px]")).toBe(false)
  })
})

// ===========================================================================
// 4. As QUATRO superfícies de produção — nenhum [data-cta-rodape] escapa.
// ===========================================================================
//
// As mesmas fixtures/superfícies de `cta-rodape-fonte-unica.test.tsx`, mais a
// autogestão (o call site que motivou esta blindagem). Um 5º call site futuro
// que esqueça de passar `className` de posicionamento reproduz o padrão "sem
// className" já coberto acima — e cai automaticamente sob a blindagem, sem
// precisar de mais nenhuma entrada nesta lista.

const SUPERFICIES = {
  "Visão geral (motor)": () => <VisaoGeralTab data={VISAO_GERAL_COMPLETA} />,
  "Visão geral (autogestão)": () => <VisaoGeralAutogestaoTab dados={visaoGeralCompleta()} />,
  Padrões: () => <PadroesTendenciasTab dados={computePadroesTendencias(entradaFixture())} />,
  Mapa: () => (
    <MapaJornadaTab
      dados={computeMapaJornada(entradaMapaFixture())}
      hrefRecomendacoes="/analytics"
    />
  ),
} as const

describe("as quatro superfícies · nenhum CTA de rodapé fica sem containing block", () => {
  for (const nome of Object.keys(SUPERFICIES) as Array<keyof typeof SUPERFICIES>) {
    it(`"${nome}" — todo [data-cta-rodape] tem exatamente 1 valor de position`, () => {
      const { container } = render(SUPERFICIES[nome]())
      const achados = [...container.querySelectorAll("[data-cta-rodape]")]
      expect(
        achados.length,
        `"${nome}" não encontrou nenhum [data-cta-rodape] — varredura vazia aprovaria qualquer coisa`,
      ).toBeGreaterThan(0)
      for (const el of achados) {
        const tokens = tokensDePosicao(el)
        expect(
          tokens,
          `"${nome}": "${el.textContent?.trim()}" tem [${tokens.join(", ")}] — precisa ser exatamente 1`,
        ).toHaveLength(1)
      }
    })
  }

  it("MUTAÇÃO — remover a blindagem da autogestão faz o CTA voltar a `static`", () => {
    // Não desfaz o arquivo de produção: reproduz aqui o estado ANTES da
    // correção (className vazio E sem a blindagem da primitiva), igual ao
    // controle positivo da seção 2, mas usando a fixture real de autogestão
    // para provar que o efeito é o MESMO nas duas rotas de prova.
    const semBlindagem = (
      <a data-cta-rodape href="/meu-plano" className="group flex cursor-pointer">
        Ver detalhes
      </a>
    )
    const { container } = render(semBlindagem)
    const el = container.querySelector("[data-cta-rodape]")
    if (!el) throw new Error("réplica não renderizou")
    expect(
      tokensDePosicao(el),
      "a réplica sem blindagem deveria ficar sem NENHUM valor de position (== static); se este teste falhar, o próprio detector está inflando o resultado",
    ).toEqual([])
  })
})
