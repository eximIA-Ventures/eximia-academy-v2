// ---------------------------------------------------------------------------
// PainelPadroes — Autogestão da minha Jornada, Tela 2.
// ---------------------------------------------------------------------------
// `PainelPadroes` é um Server Component assíncrono: chamado diretamente como
// função (não via harness de rota — mesmo padrão de `_trinca/moldura.test.tsx`
// do gestor), o retorno é a árvore JSX pronta para `render()`. `resolverRecorteAutogestao`
// e a camada de dados (`lerFonteAutogestao`/`montarPadroesAutogestao`) são
// mockadas: o que está sob teste aqui é a COSTURA do componente com o
// contrato (`tipos.ts`), não a lógica de negócio (isso já é
// `montagem.test.ts`, de outro agente).
//
// A REGRA DURA QUE ESTE ARQUIVO GUARDA (CONTRATO-DE-DADOS.md, item 2.2): o
// único campo SEM LASTRO desta tela é `serie.metaLinha` — e ele não é um
// NÚMERO na tela, é a decisão de desenhar (ou não) a linha tracejada de meta
// no gráfico. Por isso a prova de "nunca inventa o dado ausente" aqui é
// estrutural (a linha não existe no SVG), não textual ("falta prova").
// ---------------------------------------------------------------------------

import { MAPA_DE_CALOR_SEMANAS_MAX } from "@/lib/analytics/autogestao/parametros"
import type {
  BlocoContinuidade,
  BlocoFavorece,
  BlocoSerieRegularidade,
  BlocoTendencia,
  CalendarioMapaDeCalor,
  GradeMapaDeCalor,
  MapaDeCalorAtividade,
  MetaRegularidade,
  PadroesAutogestaoDados,
} from "@/lib/analytics/autogestao/tipos"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const STUDENT = "11111111-1111-1111-1111-111111111111"
const TENANT = "tenant-1"
const COURSE = "33333333-3333-3333-3333-333333333333"

const mockResolverRecorte = vi.fn()
const mockLerFonteAutogestao = vi.fn()
const mockMontarPadroesAutogestao = vi.fn()
const mockCarimbosDeAtividade = vi.fn()
const mockMontarMapaDeCalorAtividade = vi.fn()

vi.mock("../../recorte", () => ({
  resolverRecorteAutogestao: (...args: unknown[]) => mockResolverRecorte(...args),
}))
vi.mock("@/lib/analytics/autogestao/fonte-supabase", () => ({
  lerFonteAutogestao: (...args: unknown[]) => mockLerFonteAutogestao(...args),
}))
vi.mock("@/lib/analytics/autogestao/montagem", () => ({
  montarPadroesAutogestao: (...args: unknown[]) => mockMontarPadroesAutogestao(...args),
  carimbosDeAtividade: (...args: unknown[]) => mockCarimbosDeAtividade(...args),
}))
vi.mock("@/lib/analytics/autogestao/mapa-de-calor", () => ({
  montarMapaDeCalorAtividade: (...args: unknown[]) => mockMontarMapaDeCalorAtividade(...args),
}))

// Default: mapa de calor SEM LASTRO em todo teste que não sobrescrever — a
// maioria destes testes não é SOBRE o mapa de calor (é sobre §16-§19), e o
// card de ausência ("Falta prova.") é o comportamento mais barato de não
// quebrar as asserções existentes (que já usam `getByText`/`getAllByText`
// exatos, sensíveis a texto extra na árvore).
mockCarimbosDeAtividade.mockReturnValue([])
mockMontarMapaDeCalorAtividade.mockReturnValue({
  lastro: "ausente",
  motivo: "você ainda tem poucos registros de atividade para revelar um padrão de dias e horários",
})

// `FiltroPeriodoAutogestao` (dentro da moldura) é `"use client"` e usa os
// hooks de rota — sem roteador em jsdom, o mock existe só para o componente
// montar (mesmo padrão de `_trinca/moldura.test.tsx` do gestor).
vi.mock("next/navigation", () => ({
  usePathname: () => "/jornada",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const BLOCO_OK = { estado: "ok" as const, erro: null, textoVazio: null, motivoVazio: null }
const SEM_LASTRO: MetaRegularidade | { lastro: "ausente"; motivo: string } = {
  lastro: "ausente",
  motivo: "não existe meta de frequência semanal definida no seu plano",
}

function dadosOk(): PadroesAutogestaoDados {
  return {
    estado: "ok",
    erro: null,
    serie: {
      ...BLOCO_OK,
      pontos: [
        {
          indice: 0,
          rotulo: "2 – 8 jun",
          inicioISO: "2026-06-02T00:00:00.000Z",
          fimISO: "2026-06-09T00:00:00.000Z",
          diasAtivos: 2,
        },
        {
          indice: 1,
          rotulo: "9 – 15 jun",
          inicioISO: "2026-06-09T00:00:00.000Z",
          fimISO: "2026-06-16T00:00:00.000Z",
          diasAtivos: 3,
        },
      ],
      metaLinha: SEM_LASTRO,
      insight: "Você manteve o ritmo nas últimas duas semanas.",
    },
    continuidade: {
      ...BLOCO_OK,
      conteudo: {
        frequenciaMedia: 1.8,
        frequenciaRotulo: "1,8x por semana",
        maiorIntervaloDias: 12,
        sequenciaAtualSemanas: 3,
        retomadas: 2,
      },
    },
    favorece: {
      ...BLOCO_OK,
      itens: [
        {
          id: "distribuicao-de-dias",
          texto:
            "Nas semanas em que você estuda em pelo menos 2 dias diferentes, sua atividade se mantém mais consistente.",
        },
      ],
    },
    tendencia: {
      ...BLOCO_OK,
      conteudo: {
        estado: "retomando",
        texto: "Você retomou o ritmo nas últimas duas semanas.",
        linhaTemporal: [{ rotulo: "2 – 8 jun: 2 dias ativos" }],
      },
    },
  }
}

function dadosVazio(): PadroesAutogestaoDados {
  const vazio = {
    estado: "vazio" as const,
    erro: null,
    textoVazio:
      "Você ainda não começou sua jornada. Assim que iniciar, seus indicadores aparecem aqui.",
    motivoVazio: "sem-jornada-iniciada" as const,
  }
  return {
    estado: "vazio",
    erro: null,
    serie: { ...vazio, pontos: [], metaLinha: SEM_LASTRO, insight: null },
    continuidade: { ...vazio, conteudo: null },
    favorece: { ...vazio, itens: [] },
    tendencia: { ...vazio, conteudo: null },
  }
}

/**
 * "Pouco histórico" (spec §31) — o topo continua `ok` (o aluno TEM atividade),
 * mas o bloco §16 sozinho cai em `vazio` porque menos de
 * `SERIE_SEMANAS_MIN` semanas tiveram atividade dentro da janela visível. É
 * um estado DIFERENTE do `dadosVazio()` acima (que é "nunca começou a
 * jornada", os 4 blocos vazios ao mesmo tempo): aqui só a série não tem
 * lastro para uma tendência, e o resto da tela seria computado normalmente —
 * fixado como vazio/nulo aqui só porque este teste não precisa dos outros 3.
 */
function dadosPoucoHistorico(): PadroesAutogestaoDados {
  const vazioSerie = {
    estado: "vazio" as const,
    erro: null,
    textoVazio:
      "Ainda precisamos de mais algumas semanas de atividade para identificar seus padrões.",
    motivoVazio: "sem-historico-suficiente" as const,
  }
  return {
    estado: "ok",
    erro: null,
    serie: { ...vazioSerie, pontos: [], metaLinha: SEM_LASTRO, insight: null },
    continuidade: { ...BLOCO_OK, conteudo: null },
    favorece: { ...vazioSerie, itens: [] },
    tendencia: { ...BLOCO_OK, conteudo: null },
  }
}

/**
 * §18 abaixo do n mínimo — o topo é `ok`, a série tem lastro, mas o bloco
 * "O que favorece meu ritmo?" fica `vazio`: menos de `FAVORECE_MIN_SEMANAS`
 * semanas regulares. A régua aqui é NEGATIVA: nenhum insight aparece, nunca
 * um insight estimado a partir de amostra insuficiente.
 */
function dadosFavoreceSuprimido(): PadroesAutogestaoDados {
  const dados = dadosOk()
  return {
    ...dados,
    favorece: {
      estado: "vazio",
      erro: null,
      textoVazio: "Ainda não há padrão suficiente para apontar o que favorece seu ritmo.",
      motivoVazio: "sem-historico-suficiente",
      itens: [],
    },
  }
}

/**
 * A régua real que motivou a troca: 12 semanas, 9 delas "0 dias ativos" — o
 * mesmo defeito que o dono apontou na tela ("ficou muito ruim e difícil de
 * entender"). Transições, lidas do MESMO `diasAtivos` que a caixinha antiga
 * exibia: 0→1 no índice 3 (retomou), 2→0 no índice 5 (parou), 0→1 no índice 9
 * (retomou). O primeiro ponto (índice 0) nunca é marco — não há "antes" para
 * comparar dentro da própria janela.
 */
function dadosTendenciaComVirada(): PadroesAutogestaoDados {
  const dados = dadosOk()
  return {
    ...dados,
    tendencia: {
      ...BLOCO_OK,
      conteudo: {
        estado: "retomando",
        texto: "Você retomou o ritmo nas últimas duas semanas.",
        linhaTemporal: [
          { rotulo: "28 abr – 4 mai: 0 dias ativos" },
          { rotulo: "5 – 11 mai: 0 dias ativos" },
          { rotulo: "12 – 18 mai: 0 dias ativos" },
          { rotulo: "19 – 25 mai: 1 dia ativo" },
          { rotulo: "26 mai – 1 jun: 2 dias ativos" },
          { rotulo: "2 – 8 jun: 0 dias ativos" },
          { rotulo: "9 – 15 jun: 0 dias ativos" },
          { rotulo: "16 – 22 jun: 0 dias ativos" },
          { rotulo: "23 – 29 jun: 0 dias ativos" },
          { rotulo: "30 jun – 6 jul: 1 dia ativo" },
          { rotulo: "7 – 13 jul: 3 dias ativos" },
          { rotulo: "14 – 20 jul: 4 dias ativos" },
        ],
      },
    },
  }
}

/** §19 com `estado: "sem-padrao-suficiente"` — pouco histórico para tendência. */
function dadosTendenciaSemPadrao(): PadroesAutogestaoDados {
  const dados = dadosOk()
  return {
    ...dados,
    tendencia: {
      ...BLOCO_OK,
      conteudo: {
        estado: "sem-padrao-suficiente",
        texto: "Sem padrão suficiente.",
        linhaTemporal: [{ rotulo: "2 – 8 jun: 0 dias ativos" }],
      },
    },
  }
}

function dadosErro(): PadroesAutogestaoDados {
  const erro = {
    estado: "erro" as const,
    erro: { codigo: "SESSOES", mensagem: "conexão recusada" },
    textoVazio: null,
    motivoVazio: null,
  }
  return {
    estado: "erro",
    erro: erro.erro,
    serie: { ...erro, pontos: [], metaLinha: SEM_LASTRO, insight: null },
    continuidade: { ...erro, conteudo: null },
    favorece: { ...erro, itens: [] },
    tendencia: { ...erro, conteudo: null },
  }
}

/** 2 semanas × 7 dias, e uma grade 7×12 densa — a forma mínima de um `resultado` COM lastro. */
function mapaDeCalorFixture(): MapaDeCalorAtividade {
  const grade: GradeMapaDeCalor = {
    celulas: Array.from({ length: 7 }, (_, diaSemana) =>
      Array.from({ length: 12 }, (_, faixa) => ({
        diaSemana,
        faixa,
        contagem: diaSemana === 2 && faixa === 10 ? 3 : 0,
      })),
    ),
    maximo: 3,
  }
  const calendario: CalendarioMapaDeCalor = {
    semanas: [0, 1].map((indice) => ({
      indice,
      inicioMs: indice * 604_800_000,
      fimMs: (indice + 1) * 604_800_000,
      rotulo: indice === 0 ? "2 – 8 jun" : "9 – 15 jun",
      dias: Array.from({ length: 7 }, (_, i) => ({
        diaUtc: `2026-06-${String(indice * 7 + i + 1).padStart(2, "0")}`,
        contagem: i === 3 ? 2 : 0,
      })),
    })),
    maximo: 2,
  }
  return { grade, calendario }
}

function recorteOk() {
  return {
    ok: true as const,
    recorte: {
      db: {},
      studentId: STUDENT,
      studentNome: "Aluno Teste",
      tenantId: TENANT,
      courseId: COURSE,
      periodoDias: 30 as const,
      agora: new Date("2026-08-21T12:00:00.000Z"),
    },
  }
}

async function montarPainel(queryAtual = "") {
  const { PainelPadroes } = await import("../painel")
  const jsx = await PainelPadroes({ queryAtual })
  return render(jsx)
}

describe("PainelPadroes — Tela 2 (Meus Padrões e Tendências)", () => {
  it("estado OK — desenha continuidade, favorece e tendência com os dados da montagem", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())

    const { container } = await montarPainel("periodo=30")

    expect(screen.getByText("1,8x por semana")).toBeInTheDocument()
    expect(screen.getByText("12 dias")).toBeInTheDocument()
    expect(screen.getByText("3 semanas ativo")).toBeInTheDocument()
    expect(screen.getByText("2 vezes")).toBeInTheDocument()
    expect(screen.getByText(/Nas semanas em que você estuda/)).toBeInTheDocument()
    expect(screen.getByText("Retomando")).toBeInTheDocument()
    expect(screen.getByText(/retomou o ritmo/)).toBeInTheDocument()
    expect(screen.getByText("Você manteve o ritmo nas últimas duas semanas.")).toBeInTheDocument()

    // §18, regra transversal (spec §2/§18): NUNCA afirmar causalidade em
    // texto renderizado nesta tela — nem no insight de "favorece", nem em
    // nenhum outro bloco. Varre TODO o texto da tela, não só o card do §18.
    const textoInteiro = (container.textContent ?? "").toLowerCase()
    expect(textoInteiro).not.toContain("porque")
    expect(textoInteiro).not.toContain("isso causa")
  })

  it("SEM LASTRO (2.2) — sem meta de frequência, o gráfico NUNCA desenha a linha de meta", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())

    const { container } = await montarPainel("periodo=30")

    // A régua deixou de CONTAR linhas e passou a checá-las por NOME
    // (2026-08-23). Motivo: contagem não distingue naturezas. Desde que o
    // gráfico ganhou a média das semanas exibidas — que é lastreada nos pontos
    // desenhados —, "quantas linhas existem" responde a mesma coisa para uma
    // média honesta e para uma meta inventada. Nome por nome responde a
    // pergunta certa: nenhuma linha anônima, e a de meta ausente.
    const linhas = [...container.querySelectorAll("svg line")]
    expect(linhas.length).toBeGreaterThan(0)
    for (const linha of linhas) {
      const nomeada =
        linha.hasAttribute("data-linha-grade") || linha.hasAttribute("data-linha-media")
      expect(nomeada).toBe(true)
    }

    // `data-linha-meta` continua sendo o alvo do teste de mutação (ver
    // `grafico-regularidade.tsx`): nasce SE E SOMENTE SE `temLastro`.
    expect(container.querySelector("[data-linha-meta]")).not.toBeInTheDocument()
    // E nada na tela nomeia uma meta que não existe.
    expect(container.textContent ?? "").not.toContain("Meta do plano")

    // A ausência não é muda: ao lado do título, "Falta prova." mais o motivo
    // real substitui a linha que a régua proíbe desenhar (Regra de Lastro).
    //
    // `getAllByText`, não `getByText` (2026-08-24): quando o mapa de calor
    // entrou nesta mesma tela, passaram a existir DUAS ausências declaradas —
    // a da meta de frequência (aqui) e a do próprio mapa abaixo do limiar de
    // amostra. O teste quebrou com "Found multiple elements", e a leitura certa
    // NÃO é que a tela regrediu: é que o seletor era ambíguo desde sempre e só
    // agora encontrou um segundo caso. Um bloco novo que declara ausência com
    // honestidade é o comportamento desejado, não uma colisão a evitar.
    //
    // O que este teste guarda continua sendo UMA coisa: que a ausência da META
    // é declarada. Por isso a asserção forte é a do MOTIVO, que é único.
    expect(screen.getAllByText("Falta prova.").length).toBeGreaterThan(0)
    expect(
      screen.getByText(/não existe meta de frequência semanal definida no seu plano/),
    ).toBeInTheDocument()
  })

  it("a linha tracejada que EXISTE é a média dos pontos desenhados — na altura exata da média", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())

    const { container } = await montarPainel("periodo=30")

    // Os pontos mockados são 2 e 3 dias ativos: média 2,5.
    const media = container.querySelector("[data-linha-media]")
    expect(media).toBeInTheDocument()

    // A prova é GEOMÉTRICA e não depende de nenhuma constante interna do
    // componente: a média de 2 e 3 tem de cair exatamente no meio do caminho
    // entre a linha de grade do 2 e a do 3. Uma linha desenhada em qualquer
    // outra altura (no zero, no meio do cartão, na meta que não existe) falha
    // aqui — que é o ponto: o teste mede a POSIÇÃO, não a presença.
    const yDaGrade = (valor: number) => {
      const rotulo = [...container.querySelectorAll("svg text")].find(
        (t) => t.textContent === String(valor),
      )
      expect(rotulo, `rótulo do eixo Y "${valor}" ausente`).toBeTruthy()
      return Number(rotulo?.getAttribute("y"))
    }
    const esperado = (yDaGrade(2) + yDaGrade(3)) / 2
    expect(Number(media?.getAttribute("y1"))).toBeCloseTo(esperado, 3)

    // A legenda nomeia a MESMA média, com o escopo explícito — e nunca a
    // apresenta como meta.
    expect(screen.getByText(/Média das semanas exibidas: 2,5/)).toBeInTheDocument()
  })

  it("o topo do eixo acompanha a série — nunca sobra escala vazia acima do máximo", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())

    const { container } = await montarPainel("periodo=30")

    // Máximo da série mockada = 3 dias ativos. A grade tem de terminar em 3:
    // com o antigo domínio fixo 0–7 (grade 0/2/4/6) sobrava mais de metade da
    // altura acima do maior ponto, e a curva colava na base do cartão.
    const rotulos = [...container.querySelectorAll("svg text")].map((t) => t.textContent)
    expect(rotulos).toEqual(["0", "1", "2", "3"])

    // O maior ponto pousa EXATAMENTE na linha de grade do topo — prova de que
    // a escala foi ajustada à série, e não de que o rótulo mudou sozinho.
    const yDoTopo = [...container.querySelectorAll("svg text")]
      .find((t) => t.textContent === "3")
      ?.getAttribute("y")
    const yDosPontos = [...container.querySelectorAll("svg circle")].map((c) =>
      Number(c.getAttribute("cy")),
    )
    expect(Math.min(...yDosPontos)).toBeCloseTo(Number(yDoTopo), 3)
  })

  it("§31 pouco histórico — a série NÃO inventa tendência, mostra a frase da spec", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosPoucoHistorico())

    const { container } = await montarPainel("periodo=30")

    // Nenhum gráfico é desenhado — nem a série real, nem (com mais razão
    // ainda) uma linha de meta. `data-linha-serie` é o traço verde do §16.
    expect(container.querySelector("[data-linha-serie]")).not.toBeInTheDocument()
    expect(container.querySelector("[data-linha-meta]")).not.toBeInTheDocument()
    // Nem a média: sem ponto algum, uma "média" seria zero disfarçado de fato.
    expect(container.querySelector("[data-linha-media]")).not.toBeInTheDocument()
    expect(screen.queryByText(/Média das semanas exibidas/)).not.toBeInTheDocument()
    expect(
      screen.getAllByText(
        "Ainda precisamos de mais algumas semanas de atividade para identificar seus padrões.",
      ).length,
    ).toBeGreaterThan(0)
    // Nenhum numeral do estado OK vaza para esta tela.
    expect(screen.queryByText("1,8x por semana")).not.toBeInTheDocument()
  })

  it("§18 abaixo do n mínimo — o insight é SUPRIMIDO, nunca estimado com amostra insuficiente", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosFavoreceSuprimido())

    await montarPainel("periodo=30")

    // A frase de vazio aparece; nenhum item de insight é renderizado.
    expect(
      screen.getByText("Ainda não há padrão suficiente para apontar o que favorece seu ritmo."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Nas semanas em que você estuda/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Observamos que/)).not.toBeInTheDocument()
    // O resto da tela (§16, §17, §19) continua computado normalmente — a
    // supressão é CIRÚRGICA, de um bloco só.
    expect(screen.getByText("1,8x por semana")).toBeInTheDocument()
    expect(screen.getByText("Retomando")).toBeInTheDocument()
  })

  it("estado VAZIO (sem-jornada-iniciada) — cada bloco mostra a frase da spec, nunca um número", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosVazio())

    await montarPainel("periodo=30")

    const frases = screen.getAllByText(
      "Você ainda não começou sua jornada. Assim que iniciar, seus indicadores aparecem aqui.",
    )
    // 4 blocos, 4 ocorrências da mesma frase de vazio.
    expect(frases).toHaveLength(4)
    expect(screen.queryByText("1,8x por semana")).not.toBeInTheDocument()
  })

  it("estado ERRO — nenhum bloco finge que 'não houve', todos dizem que falharam", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosErro())

    await montarPainel("periodo=30")

    const falhas = screen.getAllByText("Não foi possível carregar este bloco agora.")
    expect(falhas).toHaveLength(4)
    expect(screen.getAllByText(/SESSOES: conexão recusada/).length).toBeGreaterThan(0)
  })

  it("sem matrícula — mostra o estado compartilhado 'sem matrícula ativa', nunca chama a fonte", async () => {
    mockResolverRecorte.mockResolvedValue({ ok: false, motivo: "sem-matricula" })

    await montarPainel("periodo=30")

    expect(screen.getByText(/ainda não tem uma matrícula ativa/)).toBeInTheDocument()
    // Sem curso resolvido, não há moldura/abas para trocar (mesmo padrão de
    // `_mapa/painel.tsx`, via `EstadoSemMatricula`).
    expect(
      screen.queryByRole("link", { name: "Meus Padrões e Tendências" }),
    ).not.toBeInTheDocument()
    expect(mockLerFonteAutogestao).not.toHaveBeenCalled()
    expect(mockMontarPadroesAutogestao).not.toHaveBeenCalled()
  })

  it("§19 linha temporal — vira linha contínua com marcos, sem rótulo por semana zerada", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosTendenciaComVirada())

    const { container } = await montarPainel("periodo=30")

    // A régua antiga escrevia "N dias ativos"/"N dia ativo" 12 vezes, 9 delas
    // "0 dias ativos" — exatamente o ruído que motivou a troca. A nova nunca
    // escreve isso por semana; o número só existe internamente ao SVG.
    expect(screen.queryAllByText(/dias? ativos?$/)).toHaveLength(0)

    // Só os marcos entram como texto — aqui, duas retomadas (0→1 duas vezes)
    // e uma parada (2→0), lidas do MESMO `diasAtivos` que a caixinha antiga
    // exibia por semana.
    expect(screen.getAllByText("retomou aqui")).toHaveLength(2)
    expect(screen.getAllByText("parou aqui")).toHaveLength(1)

    // A linha contínua existe (um único traço, não 12 caixas).
    expect(container.querySelector("[data-linha-temporal]")).toBeInTheDocument()
    expect(container.querySelectorAll("[data-linha-temporal]")).toHaveLength(1)

    // A pílula de estado continua no lugar, como antes.
    expect(screen.getByText("Retomando")).toBeInTheDocument()
  })

  it("§19 sem padrão suficiente — a linha temporal declara pouco histórico em vez de desenhar tendência", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosTendenciaSemPadrao())

    const { container } = await montarPainel("periodo=30")

    expect(
      screen.getByText(
        "Ainda precisamos de mais algumas semanas de atividade para identificar seus padrões.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Sem padrão suficiente")).toBeInTheDocument()
    expect(screen.queryByText("retomou aqui")).not.toBeInTheDocument()
    expect(screen.queryByText("parou aqui")).not.toBeInTheDocument()
    expect(container.querySelector("[data-linha-temporal]")).not.toBeInTheDocument()
  })

  it("as 3 abas da moldura estão presentes, com 'Meus Padrões e Tendências' ativa", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())

    await montarPainel("periodo=30")

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Autogestão da minha Jornada",
    )
    const ativa = screen.getByRole("link", { name: "Meus Padrões e Tendências" })
    expect(ativa).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Visão Geral" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("link", { name: "Meu Mapa da Jornada" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("mapa de calor — costura: `painel.tsx` chama `carimbosDeAtividade`/`montarMapaDeCalorAtividade` com a fonte, o relógio e o teto de semanas", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    const fonteFake = { fusoHorarioMinutosOffset: -180, sessoes: [] }
    mockLerFonteAutogestao.mockResolvedValue(fonteFake)
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())
    const carimbosFake = [1, 2, 3]
    mockCarimbosDeAtividade.mockReturnValue(carimbosFake)

    await montarPainel("periodo=30")

    expect(mockCarimbosDeAtividade).toHaveBeenCalledWith(fonteFake)
    expect(mockMontarMapaDeCalorAtividade).toHaveBeenCalledWith(
      carimbosFake,
      recorteOk().recorte.agora,
      fonteFake.fusoHorarioMinutosOffset,
      MAPA_DE_CALOR_SEMANAS_MAX,
    )
  })

  it("mapa de calor SEM LASTRO — os dois cards declaram a ausência, nenhuma grade é desenhada", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())
    mockMontarMapaDeCalorAtividade.mockReturnValue({
      lastro: "ausente",
      motivo:
        "você ainda tem poucos registros de atividade para revelar um padrão de dias e horários",
    })

    const { container } = await montarPainel("periodo=30")

    expect(screen.getByText("Meus horários de estudo")).toBeInTheDocument()
    expect(screen.getByText("Meu calendário de atividade")).toBeInTheDocument()
    expect(
      screen.getAllByText(/você ainda tem poucos registros de atividade/).length,
    ).toBeGreaterThanOrEqual(2)
    expect(container.querySelector("[data-celula-horario]")).not.toBeInTheDocument()
    expect(container.querySelector("[data-celula-calendario]")).not.toBeInTheDocument()
  })

  it("mapa de calor COM LASTRO — desenha as 84 células da grade e as células do calendário", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarPadroesAutogestao.mockReturnValue(dadosOk())
    mockMontarMapaDeCalorAtividade.mockReturnValue(mapaDeCalorFixture())

    const { container } = await montarPainel("periodo=30")

    expect(container.querySelectorAll("[data-celula-horario]")).toHaveLength(84)
    expect(container.querySelectorAll("[data-celula-calendario]")).toHaveLength(2 * 7)
    // Rótulo de dia (linha) e de faixa (topo) presentes na grade.
    expect(screen.getAllByText("dom").length).toBeGreaterThan(0)
    expect(screen.getByText("22")).toBeInTheDocument()
  })
})
