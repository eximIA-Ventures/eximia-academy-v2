// ---------------------------------------------------------------------------
// A DOUTRINA DO TEXTO — as 6 regras que governam o que os 4 geradores emitem.
// ---------------------------------------------------------------------------
// Destilada dos três pareceres independentes sobre as 27 frases emissíveis do
// Analytics do gestor (2026-08-19). Cada regra abaixo tem checagem executável e
// PAR DE VARIÂNCIA: sacode a causa e prova que o efeito se moveu. É a lição
// cara desta obra aplicada a texto — "a função constante satisfaz toda
// invariância", e três dos quatro `contexto` de `recomendacoes.ts` eram
// exatamente isso: strings literais que passam qualquer teste de estabilidade,
// qualquer snapshot e qualquer crítico cego, sem nunca ler o dado.
//
//   D-1 · FATO NOVO POR TELA. Nenhum par (valor, unidade) sai de dois cards da
//         mesma aba. Redundância documentada em comentário é AGRAVANTE, não
//         isenção: ela transforma um defeito de produto em compromisso
//         arquitetural que o próximo mantenedor vai defender.
//   D-2 · BASE JUNTO DO PERCENTUAL. Com 6 pessoas, "66%" são 4 — e o gestor
//         decide sobre nomes, não sobre populações. Todo percentual emitido em
//         texto carrega a contagem e o denominador.
//   D-3 · NENHUMA FRASE CONSTANTE. Texto que não se move quando a realidade se
//         move não é insight, é legenda impressa. Inspeção ESTÁTICA (o corpo
//         precisa interpolar) mais par de variância dinâmico.
//   D-4 · CONCORDÂNCIA DINÂMICA. Nunca "Todas" para 1 pessoa, nunca
//         "Mantiveram" para uma só.
//   D-5 · SUPRESSÃO DE REDUNDÂNCIA ENTRE CARDS, por MECANISMO. Se a tabela de
//         atenção já nomeia Venilton como "não iniciou", o card de sinais não
//         repete. E o mecanismo é declarar FATOS: só se suprime quem não
//         acrescenta nenhum.
//   D-6 · SILÊNCIO EXPLICADO E ORDEM DECLARADA. O estado vazio diz o que foi
//         VERIFICADO, não só o que faltou; e a ordem dos itens sai de critério
//         escrito, nunca da ordem em que o código deu push.
//
// Este arquivo é a rubrica desta frente. Ele reprova ANTES da correção — a
// saída literal do vermelho está no relatório da rodada.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  apenas as apenasMapa,
  calcular as calcularMapa,
} from "../../mapa-jornada/__tests__/contrato"
import { entradaBase as entradaMapa } from "../../mapa-jornada/__tests__/contrato"
import { computePadroesTendencias } from "../../padroes-tendencias"
import {
  DIAS_REGULARES,
  DIA_NA_JANELA_ANTERIOR,
  PONTE_SEM_PAUSA,
  cenario,
  cenarioModulos,
  cenarioRegularidadeCai,
} from "../../padroes-tendencias/__tests__/cenario"
import {
  computeVisaoGeral,
  fonteDaEntrada,
  montarAtencao,
  montarBase,
  montarRecomendacoes,
  montarSinais,
} from "../../visao-geral"
import type { EntradaVisaoGeral } from "../../visao-geral/entrada"
import { SEM_FALHAS } from "../../visao-geral/fonte"
import { textoDoMotivo } from "../../visao-geral/textos"
import { comBaseEPercentual } from "../texto"

const AQUI = dirname(fileURLToPath(import.meta.url))
const AGORA_ISO = "2026-08-15T12:00:00.000Z"
const AGORA_MS = Date.parse(AGORA_ISO)
const DIA_MS = 86_400_000

const diasAtras = (n: number, horaUtc = 10): string => {
  const base = new Date(AGORA_MS - n * DIA_MS)
  base.setUTCHours(horaUtc, 0, 0, 0)
  return base.toISOString()
}

// ===========================================================================
// Fixtures — todas com a base minúscula que a obra vai encontrar em produção
// ===========================================================================

/**
 * `n` pessoas paradas no MESMO módulo, cada uma há um número diferente de dias.
 * Dispara a regra A (§29 concentração). Sem prazo no curso, ninguém fica
 * "atrasado", então o estado é `parado` puro.
 */
function mundoConcentracao(diasPorPessoa: readonly number[]): EntradaVisaoGeral {
  const alunos = diasPorPessoa.map((_, i) => ({ id: `A${i + 1}`, nome: `Pessoa ${i + 1}` }))
  return {
    agoraISO: AGORA_ISO,
    periodoDias: 30,
    gestorId: "G1",
    escopo: alunos.map((a) => a.id),
    alunos,
    atividades: diasPorPessoa.map((d, i) => ({
      studentId: `A${i + 1}`,
      createdAt: diasAtras(d),
      tipo: "sessao" as const,
      chapterId: "M1",
    })),
    acionamentos: [],
    matriculas: alunos.map((a) => ({
      studentId: a.id,
      courseId: "C1",
      status: "active" as const,
      createdAt: diasAtras(60),
      progressPercent: 40,
    })),
    cursos: [{ id: "C1", deadlineDays: null }],
    capitulos: [{ id: "M1", courseId: "C1", titulo: "Padronização", ordem: 1 }],
  }
}

/** `n` pessoas em `sem_acesso`: iniciaram, não estão atrasadas, e sumiram. */
function mundoSemAcesso(diasPorPessoa: readonly number[]): EntradaVisaoGeral {
  const alunos = diasPorPessoa.map((_, i) => ({ id: `S${i + 1}`, nome: `Sumida ${i + 1}` }))
  return {
    agoraISO: AGORA_ISO,
    periodoDias: 30,
    gestorId: "G1",
    escopo: alunos.map((a) => a.id),
    alunos,
    atividades: diasPorPessoa.map((d, i) => ({
      studentId: `S${i + 1}`,
      createdAt: diasAtras(d),
      tipo: "sessao" as const,
    })),
    acionamentos: [],
    matriculas: alunos.map((a) => ({
      studentId: a.id,
      courseId: "C1",
      status: "active" as const,
      createdAt: diasAtras(60),
      progressPercent: 50,
    })),
    cursos: [{ id: "C1", deadlineDays: null }],
  }
}

/** `n` pessoas com ritmo consistente por 3 semanas. Dispara a regra D. */
function mundoRitmo(quantas: number): EntradaVisaoGeral {
  const nomes = ["Ana Prado", "Bruno Lima", "Carla Dias"]
  const alunos = Array.from({ length: quantas }, (_, i) => ({
    id: `R${i + 1}`,
    nome: nomes[i] ?? `Pessoa ${i + 1}`,
  }))
  const atividades = alunos.flatMap((a) =>
    [1, 4, 8, 11, 15, 18].map((d) => ({
      studentId: a.id,
      createdAt: diasAtras(d),
      tipo: "sessao" as const,
    })),
  )
  return {
    agoraISO: AGORA_ISO,
    periodoDias: 30,
    gestorId: "G1",
    escopo: alunos.map((a) => a.id),
    alunos,
    atividades,
    acionamentos: [],
    matriculas: alunos.map((a) => ({
      studentId: a.id,
      courseId: "C1",
      status: "active" as const,
      createdAt: diasAtras(60),
      progressPercent: 50,
    })),
    cursos: [{ id: "C1", deadlineDays: null }],
  }
}

/**
 * 10 pessoas na aba de Padrões: 4 regulares agora (o que dispara o sinal de
 * limiar) e `quantosSemHistorico` sem carimbo nenhum na janela ANTERIOR — que é
 * a definição de "não tem com que se comparar" (`base.semHistoricoComparavel`).
 *
 * Existe porque os cenários canônicos daquela aba dão a TODA gente um carimbo na
 * janela anterior, então `semHistoricoComparavel` é sempre 0 e o complemento de
 * cobertura do bloco de sinais NUNCA é exercitado. O ramo estava sem teste desde
 * que nasceu, e é exatamente onde o plural fixo sobreviveu.
 */
function mundoPadroesSemHistorico(quantosSemHistorico: number): EntradaVisaoGeral {
  const REGULARES = 4
  const TOTAL = 10
  const pessoas = Array.from({ length: TOTAL }, (_, i) => {
    if (i < REGULARES) {
      return {
        id: `p${i}`,
        sessoes: [...DIAS_REGULARES, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR],
      }
    }
    // Os últimos só têm carimbo na janela ATUAL: existem, e não têm passado.
    if (i >= TOTAL - quantosSemHistorico) return { id: `p${i}`, sessoes: [2] }
    return { id: `p${i}`, sessoes: [DIA_NA_JANELA_ANTERIOR] }
  })
  return cenario({ pessoas })
}

// ===========================================================================
// Coletores — o que cada gerador REALMENTE emite
// ===========================================================================

function textosDaVisaoGeral(entrada: EntradaVisaoGeral): string[] {
  const d = computeVisaoGeral(entrada)
  const out: string[] = []
  for (const i of d.sinais.itens) out.push(i.texto)
  if (d.sinais.textoVazio) out.push(d.sinais.textoVazio)
  if (d.sinais.textoComplementar) out.push(d.sinais.textoComplementar)
  for (const r of d.recomendacoes.recomendacoes) {
    out.push(r.titulo)
    out.push(r.contexto)
  }
  if (d.recomendacoes.textoVazio) out.push(d.recomendacoes.textoVazio)
  return out
}

function textosDosPadroes(entrada: EntradaVisaoGeral): string[] {
  const d = computePadroesTendencias(entrada)
  const out: string[] = []
  for (const i of d.sinais.itens) {
    out.push(i.titulo)
    out.push(i.descricao)
  }
  if (d.sinais.textoVazio) out.push(d.sinais.textoVazio)
  if (d.sinais.textoComplementar) out.push(d.sinais.textoComplementar)
  return out
}

async function textosDoMapa(entrada: Parameters<typeof calcularMapa>[0]): Promise<string[]> {
  const d = await calcularMapa(entrada)
  const out: string[] = []
  for (const i of d.insights.itens) out.push(i.texto)
  if (d.insights.acao) out.push(d.insights.acao.texto)
  if (d.insights.textoVazio) out.push(d.insights.textoVazio)
  return out
}

/** Todo par (valor, unidade) que um texto afirma. É a moeda de D-1 e D-2. */
const RE_VALOR = /(\d+(?:[.,]\d+)?)\s*(%|p\.p\.|pessoas?|dias?|módulos?)?/g

function paresDe(texto: string): string[] {
  const out: string[] = []
  for (const m of texto.matchAll(RE_VALOR)) out.push(`${m[1]}|${m[2] ?? ""}`)
  return out
}

// ===========================================================================
// D-1 · Fato novo por tela
// ===========================================================================

describe("D-1 · nenhum card repete o número que outro card da mesma tela já diz", () => {
  it("MAPA — o card de insights não reimprime o percentual do tile ao lado", async () => {
    const d = await calcularMapa(entradaMapa())
    const pctDosTiles = new Set(d.distribuicao.tiles.map((t) => `${t.pct}%`))
    const repetidos = d.insights.itens
      .flatMap((i) => [...i.texto.matchAll(/(\d+)%/g)].map((m) => m[0]))
      .filter((token) => pctDosTiles.has(token))

    expect(
      repetidos,
      `insights reimprimem o percentual do tile: ${repetidos.join(", ")}`,
    ).toHaveLength(0)
  })

  it("PADRÕES — 'p.p.' da regularidade sai de um card só, e não é o de sinais", () => {
    const textos = textosDosPadroes(cenarioRegularidadeCai(4))
    const comPp = textos.filter((t) => t.includes("p.p."))
    expect(comPp, `sinais emergentes citam p.p.: ${comPp.join(" / ")}`).toHaveLength(0)
  })

  it("ANTI-VACUIDADE — o detector de D-1 acusa uma repetição plantada", () => {
    const pares = paresDe("66% da equipe já concluiu.")
    expect(pares).toContain("66|%")
  })
})

// ===========================================================================
// D-2 · Base junto do percentual
// ===========================================================================

describe("D-2 · percentual nunca viaja sozinho em base pequena", () => {
  const temPercentual = (t: string) => /\d+\s*%/.test(t)
  const temBase = (t: string) => /\d+\s+de\s+\d+/.test(t)

  it("MAPA — todo texto com percentual traz a contagem e o denominador", async () => {
    const textos = await textosDoMapa(entradaMapa())
    const nus = textos.filter((t) => temPercentual(t) && !temBase(t))
    expect(nus, `percentual sem base: ${nus.join(" / ")}`).toHaveLength(0)
  })

  it("VISÃO GERAL — idem", () => {
    const textos = [
      ...textosDaVisaoGeral(mundoConcentracao([20, 30, 40])),
      ...textosDaVisaoGeral(mundoSemAcesso([21])),
    ]
    const nus = textos.filter((t) => temPercentual(t) && !temBase(t))
    expect(nus, `percentual sem base: ${nus.join(" / ")}`).toHaveLength(0)
  })

  /**
   * A TERCEIRA ABA também é prosa, e estava fora do detector.
   *
   * ═══ O QUE ESTE TESTE NÃO COBRE, E POR QUE ESTÁ ESCRITO AQUI ══════════════
   * `participacao.frase` emite "A regularidade caiu 40 p.p. no período." — um
   * ponto percentual NU em prosa, que amplia exatamente como o percentual (num
   * recorte de 6, "17 p.p." é uma pessoa). A regra deveria alcançá-lo, e não
   * alcança: `p.p.` não é `%`, e o gerador da frase vive em
   * `padroes-tendencias/participacao.ts`, fora do conjunto de arquivos desta
   * frente. Alargar o detector aqui deixaria um vermelho que esta frente não
   * tem permissão para consertar.
   *
   * Fica registrado como lacuna NOMEADA, não como omissão: o detector abaixo
   * guarda de verdade o que está ao alcance (percentual nu em prosa de padrões),
   * e este comentário impede que o verde dele seja lido como "a aba está limpa".
   */
  it("PADRÕES — a prosa dos sinais não publica percentual nu", () => {
    const textos = textosDosPadroes(cenarioRegularidadeCai(4))
    expect(textos.length, "sem texto em cena o detector seria vácuo").toBeGreaterThan(0)
    const nus = textos.filter((t) => temPercentual(t) && !temBase(t))
    expect(nus, `percentual sem base: ${nus.join(" / ")}`).toHaveLength(0)
  })

  it("A FORMA CANÔNICA — `comBaseEPercentual` escreve os dois lados e o parêntese", () => {
    // Pino da primitiva que declara o limiar (que é zero: prosa nunca publica
    // percentual sozinho, em nenhum N). Sem este pino ela seria um export sem
    // consumidor, e um contrato sem consumidor deriva sem ninguém notar.
    // 4/6 = 66,67 → 67. E o dono VIU "66%" na tela, o que NÃO é contradição:
    // o tile passa por `percentuaisQueFecham` (`mapa-jornada/distribuicao.ts`),
    // que arredonda [4,1,0,1]/6 em [67,17,0,17], soma 101, e desconta o excesso
    // do MAIOR balde — 67 vira 66 para a partição fechar em 100.
    //
    // Dois números legítimos para a mesma fração, em duas superfícies. É a razão
    // concreta de a prosa não publicar percentual e o tile publicar: se as duas
    // publicassem, a tela mostraria 66 e 67 para o mesmo fato, e nenhuma das
    // duas estaria errada.
    expect(comBaseEPercentual(4, 6)).toBe("4 de 6 (67%)")
    expect(comBaseEPercentual(1, 6)).toBe("1 de 6 (17%)")
    // Denominador zero não vira divisão por zero nem "NaN%": some o percentual.
    expect(comBaseEPercentual(0, 0)).toBe("0 de 0")
    expect(temBase(comBaseEPercentual(4, 6))).toBe(true)
  })

  it("ANTI-VACUIDADE — o detector acusa um percentual nu plantado", () => {
    expect(temPercentual("66% da equipe já concluiu a jornada.")).toBe(true)
    expect(temBase("66% da equipe já concluiu a jornada.")).toBe(false)
    expect(temBase("4 de 6 pessoas concluíram (66%).")).toBe(true)
  })
})

// ===========================================================================
// D-3 · Nenhuma frase constante
// ===========================================================================

/** Campo que carrega a AFIRMAÇÃO (não o rótulo do card) atribuído a literal. */
const RE_AFIRMACAO_CONSTANTE = /^\s*(contexto|descricao|texto)\s*:\s*"/gm

function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .split("\n")
    .map((linha) => linha.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n")
}

describe("D-3 · a afirmação interpola o dado; nunca é literal", () => {
  const ARQUIVOS = [
    "../../visao-geral/recomendacoes.ts",
    "../../visao-geral/sinais.ts",
    "../../padroes-tendencias/sinais.ts",
    "../../mapa-jornada/insights.ts",
  ] as const

  it("ESTÁTICO — nenhum campo de afirmação recebe string literal", () => {
    const violacoes: string[] = []
    for (const relativo of ARQUIVOS) {
      const caminho = resolve(AQUI, relativo)
      const fonte = semComentarios(readFileSync(caminho, "utf8"))
      for (const m of fonte.matchAll(RE_AFIRMACAO_CONSTANTE)) {
        const linha = fonte.slice(0, m.index).split("\n").length
        violacoes.push(`${relativo}:${linha} → ${m[0].trim()}`)
      }
    }
    expect(violacoes, `afirmação constante:\n${violacoes.join("\n")}`).toHaveLength(0)
  })

  it("ANTI-VACUIDADE — o detector acusa uma constante plantada", () => {
    const plantado = semComentarios('  contexto: "Todas estavam em dia no cronograma."\n')
    expect([...plantado.matchAll(RE_AFIRMACAO_CONSTANTE)]).toHaveLength(1)
  })

  it("VARIÂNCIA — mover os dias move o contexto da regra de concentração", () => {
    const a = computeVisaoGeral(mundoConcentracao([20, 30, 40]))
    const b = computeVisaoGeral(mundoConcentracao([25, 35, 45]))
    const ctxA = a.recomendacoes.recomendacoes.find((r) => r.id === "concentracao-modulo")?.contexto
    const ctxB = b.recomendacoes.recomendacoes.find((r) => r.id === "concentracao-modulo")?.contexto

    expect(ctxA).toBeDefined()
    expect(ctxB).toBeDefined()
    expect(ctxB).not.toBe(ctxA)
  })

  it("VARIÂNCIA — mover os dias move o contexto da regra de reativação", () => {
    const a = computeVisaoGeral(mundoSemAcesso([21, 30]))
    const b = computeVisaoGeral(mundoSemAcesso([40, 55]))
    const ctxA = a.recomendacoes.recomendacoes.find((r) => r.id === "reativar-sem-acesso")?.contexto
    const ctxB = b.recomendacoes.recomendacoes.find((r) => r.id === "reativar-sem-acesso")?.contexto

    expect(ctxA).toBeDefined()
    expect(ctxB).not.toBe(ctxA)
  })

  it("VARIÂNCIA — trocar quem sustenta o ritmo troca o contexto do reconhecimento", () => {
    const a = computeVisaoGeral(mundoRitmo(1))
    const b = computeVisaoGeral(mundoRitmo(2))
    const ctxA = a.recomendacoes.recomendacoes.find((r) => r.id === "reconhecer-ritmo")?.contexto
    const ctxB = b.recomendacoes.recomendacoes.find((r) => r.id === "reconhecer-ritmo")?.contexto

    expect(ctxA).toBeDefined()
    expect(ctxB).not.toBe(ctxA)
  })
})

// ===========================================================================
// D-4 · Concordância dinâmica
// ===========================================================================

describe("D-4 · nunca 'Todas' para uma pessoa", () => {
  /** Marcas de plural fixo medidas no catálogo das 27 frases. */
  const PLURAL_FIXO = [
    "Todas estavam",
    "Mantiveram",
    "pessoas paradas",
    "pessoas que deixaram",
    "pessoas sem acesso",
    "pessoas têm",
    "pessoas do recorte ainda não têm",
  ] as const

  const acusar = (textos: readonly string[]): string[] =>
    textos.flatMap((t) => PLURAL_FIXO.filter((p) => t.includes(p)).map((p) => `"${p}" em: ${t}`))

  it("uma pessoa sem acesso não recebe texto no plural", () => {
    const violacoes = acusar(textosDaVisaoGeral(mundoSemAcesso([21])))
    expect(violacoes, violacoes.join("\n")).toHaveLength(0)
  })

  it("uma pessoa com ritmo consistente não recebe texto no plural", () => {
    const violacoes = acusar(textosDaVisaoGeral(mundoRitmo(1)))
    expect(violacoes, violacoes.join("\n")).toHaveLength(0)
  })

  it("uma pessoa parada num módulo não recebe texto no plural", () => {
    const violacoes = acusar(textosDaVisaoGeral(mundoConcentracao([20])))
    expect(violacoes, violacoes.join("\n")).toHaveLength(0)
  })

  it("VARIÂNCIA — com duas pessoas o plural VOLTA (o detector não é cego)", () => {
    const textos = textosDaVisaoGeral(mundoSemAcesso([21, 30]))
    expect(textos.some((t) => t.includes("pessoas sem acesso"))).toBe(true)
  })

  /**
   * O MESMO texto de cobertura existe DUAS VEZES em `padroes-tendencias/sinais.ts`:
   * a função `textoDeCobertura`, que separa os dois eixos de concordância, e uma
   * cópia interpolada à mão no ramo de silêncio PARCIAL (bloco com item, mas com
   * menos itens do que caberia). A cópia nasceu depois e não passou pelo helper.
   *
   * Os dois eixos: o SUBSTANTIVO concorda com o TOTAL ("de 10 pessoas"), o VERBO
   * com o NUMERADOR ("1 ... tem"). A cópia prende os dois no plural.
   */
  it("PADRÕES — o complemento de cobertura concorda quando é UMA pessoa", () => {
    const textos = textosDosPadroes(mundoPadroesSemHistorico(1))
    const complemento = textos.find((t) => t.includes("histórico suficiente"))
    expect(complemento, "sem o complemento em cena o teste seria vácuo").toBeDefined()

    const violacoes = acusar(textos)
    expect(violacoes, violacoes.join("\n")).toHaveLength(0)
  })

  it("VARIÂNCIA — com duas sem histórico o plural VOLTA no complemento", () => {
    const textos = textosDosPadroes(mundoPadroesSemHistorico(2))
    const complemento = textos.find((t) => t.includes("histórico suficiente"))
    expect(complemento).toContain("2 de 10")
    expect(complemento, "com numerador 2 o verbo é plural, e deve ser").toContain("ainda não têm")
  })
})

// ===========================================================================
// D-5 · Supressão de redundância entre cards, por mecanismo
// ===========================================================================

describe("D-5 · o card de sinais não repete o que a tabela de atenção já nomeia", () => {
  const base = () => montarBase(fonteDaEntrada(entradaBaseComVenilton()))

  it("INVARIÂNCIA — 'ainda não iniciou' não sai duas vezes na mesma tela", () => {
    const b = base()
    const atencao = montarAtencao(b, SEM_FALHAS)
    const sinais = montarSinais(b, SEM_FALHAS)

    const nomeados = new Set(atencao.linhas.map((l) => l.alunoId))
    expect(nomeados.size, "a tabela precisa nomear alguém, senão o teste é vácuo").toBeGreaterThan(
      0,
    )
    // CONTROLE POSITIVO ancorado no defeito: sem alguém em "não iniciou" e
    // nomeado pela tabela, este teste ficaria verde numa tela onde a supressão
    // nunca rodou. É a diferença entre suprimir e não ter o que suprimir.
    expect(b.estadoPorAluno.get("P6")).toBe("nao-iniciou")
    expect(nomeados.has("P6")).toBe(true)

    const repetidos = sinais.itens.filter(
      (i) => nomeados.has(i.alunoId) && i.texto.includes("ainda não iniciou"),
    )
    expect(
      repetidos.map((r) => r.texto),
      "o sinal repete uma linha que a tabela acima já traz",
    ).toHaveLength(0)
  })

  it("VARIÂNCIA — quando a tabela não pode falar, o sinal VOLTA a falar", () => {
    const b = base()
    // `matriculas` não é fonte dos sinais, e É fonte da atenção: o bloco de
    // atenção vai para `erro` e não nomeia ninguém. Aí o sinal deixa de ser
    // repetição e passa a ser a única voz sobre quem nunca começou.
    const falhas = { ...SEM_FALHAS, matriculas: { codigo: "PGRST", mensagem: "sem matrículas" } }
    const atencao = montarAtencao(b, falhas)
    const sinais = montarSinais(b, falhas)

    expect(atencao.estado).toBe("erro")
    expect(atencao.linhas).toHaveLength(0)
    expect(sinais.estado).toBe("ok")
    expect(sinais.itens.some((i) => i.texto.includes("ainda não iniciou"))).toBe(true)
  })

  it("INVARIÂNCIA — o sinal com base própria SOBREVIVE à supressão", () => {
    // A pessoa parada aparece nas duas superfícies, e deve: a tabela diz o
    // estado, o sinal diz o RITMO PRÓPRIO dela. Fato novo não se suprime.
    const b = montarBase(fonteDaEntrada(mundoRitmoQuebrado()))
    const atencao = montarAtencao(b, SEM_FALHAS)
    const sinais = montarSinais(b, SEM_FALHAS)

    expect(atencao.linhas.length).toBeGreaterThan(0)
    expect(sinais.itens.some((i) => i.texto.includes("Seu padrão habitual"))).toBe(true)
  })
})

/** A fixture do tenant real: 6 pessoas, e Venilton nunca acessou. */
function entradaBaseComVenilton(): EntradaVisaoGeral {
  const alunos = [
    { id: "P1", nome: "Adriana Fontes" },
    { id: "P2", nome: "Bruno Tavares" },
    { id: "P3", nome: "Camila Rezende" },
    { id: "P4", nome: "Diego Prado" },
    { id: "P5", nome: "Elisa Moraes" },
    { id: "P6", nome: "Venilton Amaral" },
  ]
  const atividades = [
    ...[1, 4, 8, 11, 15, 18, 22, 25].map((d) => ({
      studentId: "P1",
      createdAt: diasAtras(d),
      tipo: "sessao" as const,
    })),
    { studentId: "P2", createdAt: diasAtras(3), tipo: "sessao" as const },
    { studentId: "P3", createdAt: diasAtras(30), tipo: "sessao" as const },
    { studentId: "P4", createdAt: diasAtras(12), tipo: "sessao" as const },
    { studentId: "P5", createdAt: diasAtras(20), tipo: "sessao" as const },
    // P6 — nenhuma atividade, de propósito.
  ]
  return {
    agoraISO: AGORA_ISO,
    periodoDias: 30,
    gestorId: "G1",
    escopo: alunos.map((a) => a.id),
    alunos,
    atividades,
    acionamentos: [],
    matriculas: alunos.map((a) => ({
      studentId: a.id,
      courseId: "C1",
      status: "active" as const,
      createdAt: diasAtras(60),
      // Venilton tem progresso ZERO, e isso não é detalhe de fixture: "não
      // iniciou" é `totalSessions === 0 && progressPct === 0` (student-triage).
      // Com 40% aqui ele viraria "parado sem carimbo" e o candidato de §13 nem
      // nasceria — o teste ficaria verde sem nunca ter exercitado a supressão.
      progressPercent: a.id === "P6" ? 0 : 40,
    })),
    cursos: [{ id: "C1", deadlineDays: null }],
  }
}

/**
 * Uma pessoa com hábito mensurável (mediana ~3 dias por 5 semanas) que sumiu há
 * 30 dias: o sinal de §13 dispara COM baseline próprio, e a tabela de atenção a
 * nomeia como "Parado". As duas superfícies falam da mesma pessoa e dizem
 * coisas diferentes — é o caso que a supressão NÃO pode engolir.
 */
function mundoRitmoQuebrado(): EntradaVisaoGeral {
  const dias = [30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63]
  return {
    agoraISO: AGORA_ISO,
    periodoDias: 30,
    gestorId: "G1",
    escopo: ["U1"],
    alunos: [{ id: "U1", nome: "Ulisses Prado" }],
    atividades: dias.map((d) => ({
      studentId: "U1",
      createdAt: diasAtras(d),
      tipo: "sessao" as const,
    })),
    acionamentos: [],
    matriculas: [
      {
        studentId: "U1",
        courseId: "C1",
        status: "active" as const,
        createdAt: diasAtras(90),
        progressPercent: 40,
      },
    ],
    cursos: [{ id: "C1", deadlineDays: null }],
  }
}

// ===========================================================================
// D-6 · Silêncio explicado e ordem declarada
// ===========================================================================

describe("D-6 · o vazio diz o que foi verificado, e a ordem é declarada", () => {
  it("VISÃO GERAL — 'não olhei' e 'olhei e está estável' são frases DIFERENTES", () => {
    // Colapsar as duas manda o gestor descansar quando o certo era ir falar com
    // as pessoas. Com 6 pessoas o segundo caso é o comum.
    expect(textoDoMotivo("sem-historico-suficiente")).not.toBe(textoDoMotivo("sem-sinais"))
  })

  it("VISÃO GERAL — o vazio de sinais declara sobre quantos comparou", () => {
    const b = montarBase(fonteDaEntrada(mundoSemAcesso([21, 30])))
    const sinais = montarSinais(b, SEM_FALHAS)
    expect(sinais.estado).toBe("vazio")
    expect(sinais.textoComplementar).toMatch(/\d+ de \d+/)
  })

  it("MAPA — sem item nenhum o bloco sai VAZIO com texto, nunca 'ok' mudo", async () => {
    const d = await calcularMapa(apenasMapa(entradaMapa(), ["P01"]))
    if (d.insights.itens.length === 0) {
      expect(d.insights.estado).toBe("vazio")
      expect(d.insights.textoVazio).not.toBeNull()
    }
    expect(d.insights.estado === "ok" && d.insights.itens.length === 0).toBe(false)
  })

  it("MAPA — a ordem dos insights obedece a critério declarado (gargalo primeiro)", async () => {
    const d = await calcularMapa(entradaMapa())
    const ids = d.insights.itens.map((i) => i.id)
    expect(ids.length, "fixture sem insight nenhum tornaria a ordem vácua").toBeGreaterThan(1)
    expect(ids[0]).toBe("gargalo")
  })

  it("PADRÕES — o vazio de sinais continua explicando a base rasa", () => {
    const { sinais } = computePadroesTendencias(
      cenarioModulos([{ id: "m1", titulo: "Executar Ações Corretivas", antes: 6, agora: 1 }]),
    )
    expect(sinais.estado).toBe("ok")
    expect(sinais.itens.length).toBeGreaterThan(0)
  })
})
