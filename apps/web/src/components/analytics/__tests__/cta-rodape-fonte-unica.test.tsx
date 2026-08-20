// ---------------------------------------------------------------------------
// O CTA DE RODAPÉ TEM UMA FONTE ÚNICA DE APARÊNCIA — nas TRÊS abas.
// ---------------------------------------------------------------------------
// DEFEITO DIAGNOSTICADO (2026-08-19, ACH-01/ACH-02/ACH-06/ACH-10): o mesmo CTA
// de rodapé existia em SEIS implementações, e cinco delas eram cópia manual de
// classes. A cópia envelheceu: a correção de geometria de 2026-08-19 entrou só
// no original (`LinkRodape`), e `BotaoRodapeGaveta` — que serve as abas Padrões
// e Mapa — ficou sem `bottom`, sem `height` e sem `data-rodape-card`. O único
// teste que trancava o rodapé varre `[data-rodape-card]` e por isso é CEGO às
// 6 CTAs de Padrões e às 2 do Mapa: ele conta 3 faixas na Visão geral e dá PASS.
//
// Nenhum dos seis declarava hover, e nenhum teste travava a APARÊNCIA. Ou seja:
// não havia nada impedindo o sétimo desenho.
//
// ═══ O QUE ESTE ARQUIVO MEDE (e o que ele NÃO mede) ═══════════════════════════
// Ele NÃO mede geometria — posição, `bottom`, `height`, ancoragem, altura
// reservada. Essa dimensão é de quem cuida do layout e continua trancada em
// `rodape-nao-invade-o-miolo.test.tsx`. Aqui se mede APARÊNCIA: a tipografia, a
// tinta, o hover, o foco, o chevron e a área de clique.
//
// O instrumento é o atributo `data-cta-rodape`, emitido pela primitiva única
// (`CtaRodape` em `visao-geral/design.tsx`) e por mais ninguém. Um call site que
// volte a escrever as classes na mão não emite o atributo — e some da varredura.
// Por isso a contagem por superfície é FIXA: sem ela, um seletor quebrado viraria
// uma lista vazia e o arquivo passaria por vacuidade, que é a armadilha já
// registrada no teste vizinho.
//
// ═══ POR QUE HÁ CONTROLE POSITIVO EM TODA INVARIÂNCIA ════════════════════════
// "As assinaturas têm cardinalidade 1" é satisfeito por uma tela sem CTA nenhum,
// por um seletor que não acha nada, e por um extrator que devolve sempre o mesmo
// conjunto vazio. A função constante satisfaz toda invariância. Então cada
// afirmação de igualdade aqui vem com o PAR de variância: sacode-se a causa
// (reintroduz-se a cópia manual literal, clareia-se o laranja) e exige-se que o
// efeito se mova. Se o par não reprovar, o detector está cego e o arquivo inteiro
// deixa de valer.
// ---------------------------------------------------------------------------

import { entradaMapaFixture } from "@/components/analytics/mapa-jornada/fixture"
import { MapaJornadaTab } from "@/components/analytics/mapa-jornada/mapa-jornada-tab"
import { entradaFixture } from "@/components/analytics/padroes-tendencias/fixture"
import { PadroesTendenciasTab } from "@/components/analytics/padroes-tendencias/padroes-tendencias-tab"
import { COR_ACAO, COR_ACAO_HOVER, COR_CARD } from "@/components/analytics/visao-geral/design"
import { VISAO_GERAL_COMPLETA } from "@/components/analytics/visao-geral/fixture"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import { computeMapaJornada } from "@/lib/analytics/mapa-jornada"
import { computePadroesTendencias } from "@/lib/analytics/padroes-tendencias"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

afterEach(cleanup)

// ===========================================================================
// As três superfícies
// ===========================================================================

/**
 * Cada aba renderizada com a PRÓPRIA fixture — a mesma que a rota de preview
 * usa. Não é mock de componente: se o call site parar de consumir a primitiva,
 * o atributo some daqui exatamente como sumiria da tela.
 *
 * `hrefRecomendacoes` presente no Mapa de propósito: sem ele o CTA de
 * recomendações cai no ramo inerte de preview, e a superfície que este arquivo
 * precisa medir é a de PRODUÇÃO.
 */
const SUPERFICIES = {
  "Visão geral": () => <VisaoGeralTab data={VISAO_GERAL_COMPLETA} />,
  Padrões: () => <PadroesTendenciasTab dados={computePadroesTendencias(entradaFixture())} />,
  Mapa: () => (
    <MapaJornadaTab
      dados={computeMapaJornada(entradaMapaFixture())}
      hrefRecomendacoes="/analytics"
    />
  ),
} as const

type NomeSuperficie = keyof typeof SUPERFICIES

function ctasDe(nome: NomeSuperficie, seletor: string): HTMLElement[] {
  const { container } = render(SUPERFICIES[nome]())
  return [...container.querySelectorAll<HTMLElement>(seletor)]
}

// ===========================================================================
// A assinatura de aparência
// ===========================================================================

/**
 * Os prefixos que este arquivo considera APARÊNCIA. Tudo que não casa aqui
 * (`absolute`, `right-[18px]`, `mt-[8px]`, `inline-flex`) é geometria e fica
 * FORA da comparação de propósito: os call sites têm ancoragens legitimamente
 * diferentes, e exigir igualdade ali seria invadir a alçada do layout.
 */
const PREFIXOS_APARENCIA = [
  "text-[",
  "font-",
  "leading-",
  "tracking-",
  "hover:",
  "focus-visible:",
  "transition",
  "duration-",
  "before:",
  "rounded-",
  "border-[",
  "bg-",
]

function assinatura(el: Element): string {
  return el.className
    .split(/\s+/)
    .filter((c) => c === "group" || PREFIXOS_APARENCIA.some((p) => c.startsWith(p)))
    .sort()
    .join(" ")
}

/** Cor inline ainda declarada no elemento — o que sobrou de cópia manual. */
function tintaInline(el: Element): string {
  return (el as HTMLElement).style.color || ""
}

// ===========================================================================
// Contraste WCAG 2.x — função pura, com o par de variância logo abaixo
// ===========================================================================

function canalLinear(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminancia(hex: string): number {
  const n = hex.replace("#", "")
  const r = Number.parseInt(n.slice(0, 2), 16)
  const g = Number.parseInt(n.slice(2, 4), 16)
  const b = Number.parseInt(n.slice(4, 6), 16)
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b)
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

/** Texto normal (< 18,66px) exige 4,5:1 — e o rótulo do CTA tem 11,5px. */
const PISO_AA = 4.5

// ===========================================================================
// Rótulos
// ===========================================================================

/**
 * ═══ REGRA REJEITADA (2026-08-20) — mantida em disco, DESATIVADA ════════════
 *
 * A tese era: "o adjetivo de completude é ruído, o CTA já significa mais". Ela
 * foi REMOVIDA por determinação do orquestrador da frente, e a asserção que a
 * media está logo abaixo como `it.skip`, não apagada, para a rejeição ficar
 * legível em vez de virar um silêncio.
 *
 * A EVIDÊNCIA CONTRÁRIA, que é o que decide:
 *   • `lib/analytics/mapa-jornada/parametros.ts:34` registra, literalmente:
 *     "F-10 · o PNG mostra 5 linhas + `Ver todos os módulos ›`". O PNG é o
 *     artefato de referência aprovado pelo dono, e ele mostra o adjetivo.
 *   • `lib/analytics/mapa-jornada/__tests__/f-36-nenhum-cta-morto.test.ts` é
 *     rubrica COMMITADA e nomeia "Ver todos os módulos" e "Ver funil completo"
 *     nos próprios títulos de caso. `f-44-ctas-inertes.test.ts` congela os sete
 *     rótulos de Padrões como "os literais da spec e do PNG".
 *   • o adjetivo carrega INFORMAÇÃO: "Ver todas as pessoas" num card que mostra
 *     2 de 6 diz que há mais atrás do link. "Ver pessoas" perde isso. É a
 *     promessa do destino, não enfeite.
 *
 * O DEFEITO DE PROCESSO, que é o que importa reter: esta regra foi escrita no
 * MESMO trabalho que ela media, e reprovava o que a régua real valida. Régua
 * escrita pelo construtor, contra artefato que o dono aprovou, perde.
 *
 * O que sobrevive dela é a asserção de FORMA logo adiante — e forma é o que um
 * teste consegue medir sem inventar régua. Julgar se um rótulo "descreve bem" o
 * destino é justamente o julgamento que não cabe aqui.
 */
const RUIDO_DE_COMPLETUDE = /\b(todos|todas|completo|completa)\b/i

/**
 * A única sobrevivente, e ela é sobrevivente por IMPEDIMENTO, não por decisão:
 * "Ver todos os sinais" nasce em `lib/analytics/visao-geral/sinais.ts`, arquivo
 * fora do alcance desta frente. A exceção é fixada em UM item para que ela não
 * cresça em silêncio — um segundo rótulo fora da regra reprova aqui.
 */
const TRAVADO_FORA_DO_ALCANCE = ["Ver todos os sinais"]

describe("CTA de rodapé · uma fonte única de aparência para as três abas", () => {
  // -------------------------------------------------------------------------
  // 1. Presença: nenhuma superfície declara a aparência por conta própria.
  // -------------------------------------------------------------------------
  const ESPERADO: Record<NomeSuperficie, number> = {
    "Visão geral": 3,
    Padrões: 6,
    Mapa: 2,
  }

  for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
    it(`"${nome}" serve os CTAs de rodapé pela primitiva única`, () => {
      const achados = ctasDe(nome, "[data-cta-rodape]")
      expect(
        achados.length,
        `"${nome}" devolveu ${achados.length} CTA(s) marcados pela primitiva; o esperado é ${ESPERADO[nome]}. Zero significa que o call site voltou a escrever as classes na mão — ou que o seletor quebrou e esta varredura virou uma lista vazia.`,
      ).toBe(ESPERADO[nome])
    })
  }

  // -------------------------------------------------------------------------
  // 2. Cardinalidade 1 — o desenho é UM só, atravessando as três abas.
  // -------------------------------------------------------------------------
  it("as três superfícies produzem UMA assinatura de aparência, não três", () => {
    const porAssinatura = new Map<string, string[]>()
    for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
      for (const el of ctasDe(nome, "[data-cta-rodape]")) {
        const chave = assinatura(el)
        porAssinatura.set(chave, [...(porAssinatura.get(chave) ?? []), nome])
      }
      cleanup()
    }
    expect(
      [...porAssinatura.keys()],
      `assinaturas divergentes entre abas: ${[...porAssinatura.entries()]
        .map(([k, v]) => `[${[...new Set(v)].join("/")}] ${k}`)
        .join(" ‖ ")}`,
    ).toHaveLength(1)
  })

  it("nenhum CTA repinta a tinta por fora da primitiva (cor inline é cópia manual)", () => {
    // A tinta vive numa CLASSE de propósito: `style` vence qualquer classe, e um
    // `color` inline apagaria silenciosamente o `hover:` da primitiva. Um CTA
    // com cor inline é um CTA sem hover, e a tela não denuncia isso.
    const teimosos: string[] = []
    for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
      for (const el of ctasDe(nome, "[data-cta-rodape]")) {
        if (tintaInline(el))
          teimosos.push(`${nome}: "${el.textContent?.trim()}" → ${tintaInline(el)}`)
      }
      cleanup()
    }
    expect(teimosos).toEqual([])
  })

  it("todo CTA carrega o chevron, e o chevron reage ao hover", () => {
    const mudos: string[] = []
    for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
      for (const el of ctasDe(nome, "[data-cta-rodape]")) {
        const glifo = el.querySelector("svg")
        if (!glifo) mudos.push(`${nome}: "${el.textContent?.trim()}" sem chevron`)
        else if (!glifo.getAttribute("class")?.includes("group-hover:"))
          mudos.push(`${nome}: "${el.textContent?.trim()}" com chevron inerte`)
      }
      cleanup()
    }
    expect(mudos).toEqual([])
  })

  it("todo CTA é alcançável por teclado — nenhum é `<span>` em produção", () => {
    const inertes: string[] = []
    for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
      for (const el of ctasDe(nome, "[data-cta-rodape]")) {
        const tag = el.tagName.toLowerCase()
        if (tag !== "a" && tag !== "button")
          inertes.push(`${nome}: "${el.textContent?.trim()}" é <${tag}>`)
      }
      cleanup()
    }
    expect(
      inertes,
      "um CTA que não vê nada é pior que nenhum CTA: ou ganha destino, ou sai da tela",
    ).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 3. CONTROLE POSITIVO — a cópia manual literal REPROVA o mesmo detector.
  // -------------------------------------------------------------------------
  it("CONTROLE POSITIVO — reintroduzir a cópia manual de classes quebra a cardinalidade", () => {
    // Estas são as classes LITERAIS do `BotaoRodapeGaveta` de antes desta
    // correção (`gaveta.tsx`, 2026-08-19), coladas aqui congeladas. Não é uma
    // divergência inventada para o teste passar: é o código que existia.
    const COPIA_DE_ONTEM =
      "absolute right-[18px] flex cursor-pointer items-center text-left text-[11.5px] leading-[16px] font-semibold whitespace-nowrap"

    const { container } = render(
      <>
        <VisaoGeralTab data={VISAO_GERAL_COMPLETA} />
        {/* biome-ignore lint/a11y/useButtonType: réplica congelada do defeito, não é UI. */}
        <button data-cta-rodape className={COPIA_DE_ONTEM} style={{ color: COR_ACAO }}>
          Ver detalhes
        </button>
      </>,
    )
    const assinaturas = new Set(
      [...container.querySelectorAll("[data-cta-rodape]")].map((el) => assinatura(el)),
    )
    expect(
      assinaturas.size,
      "o detector não enxerga a cópia manual — ele está cego e as invariâncias acima não valem nada",
    ).toBe(2)
  })

  // -------------------------------------------------------------------------
  // 4. Contraste AA, com o par de variância.
  // -------------------------------------------------------------------------
  it("o laranja de ação passa AA sobre o branco do card, em texto pequeno", () => {
    const medido = contraste(COR_ACAO, COR_CARD)
    expect(
      Number(medido.toFixed(3)),
      `${COR_ACAO} sobre ${COR_CARD} mede ${medido.toFixed(3)}:1 — o piso de texto normal é ${PISO_AA}:1`,
    ).toBeGreaterThanOrEqual(PISO_AA)
  })

  it("CONTROLE POSITIVO — um laranja mais claro REPROVA a mesma medida", () => {
    // Sem isto, `contraste()` poderia devolver 21 para tudo e o teste acima
    // seria decorativo. A margem real do tom atual é de 0,007 — clarear um
    // degrau já derruba.
    expect(contraste("#E8631F", COR_CARD)).toBeLessThan(PISO_AA)
  })

  it("o hover só ESCURECE — clarear é proibido com 0,007 de margem", () => {
    expect(luminancia(COR_ACAO_HOVER)).toBeLessThan(luminancia(COR_ACAO))
    expect(contraste(COR_ACAO_HOVER, COR_CARD)).toBeGreaterThan(contraste(COR_ACAO, COR_CARD))
  })

  // -------------------------------------------------------------------------
  // 5. Rótulos.
  // -------------------------------------------------------------------------
  /**
   * A regra que ficou: CONSISTÊNCIA DE FORMA, não vocabulário.
   *
   * Um verbo só para os onze CTAs, e um objeto depois dele — é isso que um
   * teste consegue afirmar sem opinar. "Diz para onde leva" é medido como "há
   * um objeto depois do verbo", e não como julgamento sobre a qualidade da
   * frase: essa segunda coisa é régua de gosto, e régua de gosto escrita por
   * quem construiu a tela foi exatamente o que se rejeitou acima.
   *
   * O total é fixado pela MESMA fonte da cardinalidade por superfície, porque
   * uma varredura vazia aprovaria qualquer coisa — a armadilha registrada no
   * cabeçalho deste arquivo.
   */
  it("os rótulos têm UMA forma: um verbo só, e um objeto depois dele", () => {
    const fora: string[] = []
    const vistos: string[] = []
    for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
      for (const el of ctasDe(nome, "[data-cta-rodape]")) {
        const rotulo = el.textContent?.trim() ?? ""
        vistos.push(rotulo)
        if (!rotulo.startsWith("Ver "))
          fora.push(`${nome}: "${rotulo}" não começa com o verbo "Ver "`)
        else if (rotulo.slice(4).trim() === "")
          fora.push(`${nome}: "${rotulo}" é o verbo sozinho, sem dizer o que está atrás`)
      }
      cleanup()
    }
    expect(vistos, "varredura vazia aprova qualquer coisa").toHaveLength(
      Object.values(ESPERADO).reduce((a, b) => a + b, 0),
    )
    expect(fora).toEqual([])
  })

  // ═══ DESATIVADA POR DETERMINAÇÃO DO ORQUESTRADOR (2026-08-20) ═════════════
  // A justificativa completa, com a evidência contrária, está no bloco de
  // `RUIDO_DE_COMPLETUDE` lá em cima. Fica como `skip` e não apagada para a
  // decisão aparecer no relatório do runner, em vez de sumir do arquivo.
  // `TRAVADO_FORA_DO_ALCANCE` só é consumido aqui: sob a regra de FORMA acima
  // nenhum rótulo precisa de exceção, e a lista segue medida pelo caso logo
  // abaixo apenas como catraca, para ela não voltar a crescer.
  it.skip("REJEITADA — sem adjetivo de completude nos rótulos", () => {
    const fora: string[] = []
    for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
      for (const el of ctasDe(nome, "[data-cta-rodape]")) {
        const rotulo = el.textContent?.trim() ?? ""
        if (TRAVADO_FORA_DO_ALCANCE.includes(rotulo)) continue
        if (RUIDO_DE_COMPLETUDE.test(rotulo))
          fora.push(`${nome}: "${rotulo}" carrega adjetivo de completude`)
      }
      cleanup()
    }
    expect(fora).toEqual([])
  })

  it("a lista de exceções travadas não cresce em silêncio", () => {
    // Uma exceção é uma dívida nomeada. Duas é uma regra que morreu.
    expect(TRAVADO_FORA_DO_ALCANCE).toHaveLength(1)
  })
})

// ===========================================================================
// A segunda espécie: a pílula de contorno
// ===========================================================================

describe("CTA de pílula · a segunda espécie também tem uma fonte só", () => {
  it("as pílulas de ação das abas produzem UMA assinatura", () => {
    const porAssinatura = new Map<string, string[]>()
    let total = 0
    for (const nome of Object.keys(SUPERFICIES) as NomeSuperficie[]) {
      for (const el of ctasDe(nome, "[data-cta-pilula]")) {
        total += 1
        const chave = assinatura(el)
        porAssinatura.set(chave, [...(porAssinatura.get(chave) ?? []), nome])
      }
      cleanup()
    }
    // A fixture do Mapa traz "Ver pessoas (N)" e "Ver recomendações"; a da
    // Visão geral e a de Padrões não têm pílula de AÇÃO. Fixar o total impede
    // que um seletor quebrado transforme isto numa lista vazia.
    expect(total, "nenhuma pílula encontrada — varredura vazia aprova qualquer coisa").toBe(2)
    expect([...porAssinatura.keys()]).toHaveLength(1)
  })
})
