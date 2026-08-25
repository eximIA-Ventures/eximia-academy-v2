// ---------------------------------------------------------------------------
// PainelVisaoGeralAutogestao — Autogestão da minha Jornada, Tela 1.
// ---------------------------------------------------------------------------
// Mesmo padrão de `_padroes/__tests__/painel.test.tsx`: `PainelVisaoGeralAutogestao`
// é um Server Component assíncrono, chamado diretamente como função (o retorno
// é a árvore JSX pronta para `render()`). `resolverRecorteAutogestao` e a
// camada de dados são mockadas — o que está sob teste é a COSTURA do
// componente com o contrato (`tipos.ts`), não a lógica de negócio de
// `montagem.ts` (já coberta em `lib/analytics/autogestao/__tests__`).
//
// A REGRA DURA QUE ESTE ARQUIVO GUARDA (CONTRATO-DE-DADOS.md, 1.3/1.5/1.19):
// os campos SEM LASTRO desta tela NUNCA viram número — "Falta prova." mais o
// motivo real, nunca "0", nunca travessão mudo. E os DOIS estados nascem
// juntos (decisão do dono, 2026-08-21): "com plano" e "sem plano" — o
// callout §31 aparece SOMENTE quando o motivo é `MOTIVO_PLANO_AUSENTE`
// (nunca para plano com duração zerada, que TEM plano).
// ---------------------------------------------------------------------------

import { MOTIVO_PLANO_AUSENTE, MOTIVO_SEM_META_FREQUENCIA } from "@/lib/analytics/autogestao/textos"
import type { VisaoGeralAutogestaoDados } from "@/lib/analytics/autogestao/tipos"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const STUDENT = "11111111-1111-1111-1111-111111111111"
const TENANT = "tenant-1"
const COURSE = "33333333-3333-3333-3333-333333333333"

const mockResolverRecorte = vi.fn()
const mockLerFonteAutogestao = vi.fn()
const mockMontarVisaoGeralAutogestao = vi.fn()

vi.mock("../../recorte", () => ({
  resolverRecorteAutogestao: (...args: unknown[]) => mockResolverRecorte(...args),
}))
vi.mock("@/lib/analytics/autogestao/fonte-supabase", () => ({
  lerFonteAutogestao: (...args: unknown[]) => mockLerFonteAutogestao(...args),
}))
vi.mock("@/lib/analytics/autogestao/montagem", () => ({
  montarVisaoGeralAutogestao: (...args: unknown[]) => mockMontarVisaoGeralAutogestao(...args),
}))

// `FiltroPeriodoAutogestao` (dentro da moldura) é `"use client"` e usa hooks
// de rota — sem roteador em jsdom, o mock existe só para o componente montar
// (mesmo padrão de `_padroes/__tests__/painel.test.tsx`).
vi.mock("next/navigation", () => ({
  usePathname: () => "/jornada",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const BLOCO_OK = { estado: "ok" as const, erro: null, textoVazio: null, motivoVazio: null }
const SEM_LASTRO_FREQUENCIA = { lastro: "ausente" as const, motivo: MOTIVO_SEM_META_FREQUENCIA }
const SEM_LASTRO_PLANO_AUSENTE = { lastro: "ausente" as const, motivo: MOTIVO_PLANO_AUSENTE }

/** Base "com plano": `progresso.metaHoje` TEM lastro — o callout §31 não aparece. */
function dadosComPlano(): VisaoGeralAutogestaoDados {
  return {
    estado: "ok",
    erro: null,
    comoEstou: {
      ...BLOCO_OK,
      conteudo: {
        ritmo: { estado: "no-ritmo", rotulo: "No ritmo" },
        regularidade: {
          vezesPorSemana: 1.8,
          rotulo: "1,8x por semana",
          meta: SEM_LASTRO_FREQUENCIA,
        },
        progresso: {
          percentual: 50,
          rotulo: "50%",
          metaHoje: { percentual: 48, rotulo: "48%" },
          deltaPp: 2,
          deltaRotulo: "+2 p.p. em relação ao planejado",
        },
        ultimaAtividade: {
          dias: 3,
          rotulo: "3 dias atrás",
          proximaSessaoRecomendadaISO: null,
          proximaSessaoRotulo: null,
        },
      },
    },
    sintese: {
      texto: "Você está acompanhando seu plano. Continue mantendo a consistência.",
      tom: "green",
    },
    mudancas: {
      ...BLOCO_OK,
      itens: [
        {
          id: "sessoes",
          texto: "+1 sessão em relação ao período anterior.",
          tom: "positivo",
          ordem: 1,
        },
      ],
    },
    atencao: { ...BLOCO_OK, itens: [] },
    proximoMovimento: {
      tipo: "manutencao-de-ritmo",
      titulo: "Você sustentou seu ritmo",
      texto: "Mantenha o padrão.",
      ctaPrincipal: "Ver meu plano",
      ctaSecundario: null,
    },
    respostaAosAjustes: {
      estado: "vazio",
      erro: null,
      textoVazio: "Você ainda não fez nenhum ajuste no seu plano.",
      motivoVazio: "sem-ajuste",
      conteudo: null,
    },
    sinaisDoMomento: { ...BLOCO_OK, itens: [] },
  }
}

/**
 * "Sem plano" (§31, decisão do dono 2026-08-21) — `progresso.metaHoje` é
 * SEM LASTRO com o motivo EXATO de plano ausente (`MOTIVO_PLANO_AUSENTE`).
 * É o caminho MAJORITÁRIO medido em produção (297 de 302 matrículas), não uma
 * borda — por isso o resto do bloco (ritmo, regularidade, progresso real)
 * continua computado normalmente, só a META some.
 */
function dadosSemPlano(): VisaoGeralAutogestaoDados {
  const base = dadosComPlano()
  return {
    ...base,
    comoEstou: {
      ...base.comoEstou,
      conteudo: base.comoEstou.conteudo && {
        ...base.comoEstou.conteudo,
        progresso: {
          ...base.comoEstou.conteudo.progresso,
          metaHoje: SEM_LASTRO_PLANO_AUSENTE,
          deltaPp: null,
          deltaRotulo: null,
        },
      },
    },
  }
}

function dadosVazio(): VisaoGeralAutogestaoDados {
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
    comoEstou: { ...vazio, conteudo: null },
    sintese: { texto: vazio.textoVazio, tom: "neutral" },
    mudancas: { ...vazio, itens: [] },
    atencao: { ...vazio, itens: [] },
    proximoMovimento: {
      tipo: "manutencao-de-ritmo",
      titulo: "Você sustentou seu ritmo",
      texto: "Mantenha o padrão.",
      ctaPrincipal: "Ver meu plano",
      ctaSecundario: null,
    },
    respostaAosAjustes: { ...vazio, conteudo: null },
    sinaisDoMomento: { ...vazio, itens: [] },
  }
}

function dadosErro(): VisaoGeralAutogestaoDados {
  const erro = {
    estado: "erro" as const,
    erro: { codigo: "SESSOES", mensagem: "conexão recusada" },
    textoVazio: null,
    motivoVazio: null,
  }
  return {
    estado: "erro",
    erro: erro.erro,
    comoEstou: { ...erro, conteudo: null },
    sintese: { texto: "Não foi possível carregar este bloco agora.", tom: "neutral" },
    mudancas: { ...erro, itens: [] },
    atencao: { ...erro, itens: [] },
    proximoMovimento: {
      tipo: "manutencao-de-ritmo",
      titulo: "Você sustentou seu ritmo",
      texto: "Mantenha o padrão.",
      ctaPrincipal: "Ver meu plano",
      ctaSecundario: null,
    },
    respostaAosAjustes: { ...erro, conteudo: null },
    sinaisDoMomento: { ...erro, itens: [] },
  }
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
  const { PainelVisaoGeralAutogestao } = await import("../painel")
  const jsx = await PainelVisaoGeralAutogestao({ queryAtual })
  return render(jsx)
}

describe("PainelVisaoGeralAutogestao — Tela 1 (Visão Geral)", () => {
  it("com plano — não mostra o callout de 'sem plano', mostra a meta real", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarVisaoGeralAutogestao.mockReturnValue(dadosComPlano())

    await montarPainel("periodo=30")

    expect(screen.getByText("No ritmo")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
    expect(screen.getByText("+2 p.p. em relação ao planejado")).toBeInTheDocument()
    expect(screen.queryByText(/Você ainda não definiu seu plano/)).not.toBeInTheDocument()
    expect(screen.queryByText("Criar meu plano")).not.toBeInTheDocument()
  })

  it("SEM PLANO (§31, o caminho majoritário) — o callout aparece com o CTA 'Criar meu plano'", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarVisaoGeralAutogestao.mockReturnValue(dadosSemPlano())

    await montarPainel("periodo=30")

    expect(screen.getByText(/Você ainda não definiu seu plano/)).toBeInTheDocument()
    // "Criar meu plano" aparece DUAS vezes de propósito (callout §31 + CTA
    // primário de "Meu próximo movimento", achado do painel 2026-08-22) — o
    // link do callout é a instância endereçável por role, a segunda é o CTA
    // primário (sem href, span) verificado à parte.
    expect(screen.getByRole("link", { name: "Criar meu plano" })).toHaveAttribute(
      "href",
      "/meu-plano",
    )
    expect(screen.getAllByText("Criar meu plano")).toHaveLength(2)
    // O resto do bloco continua computado (regularidade, progresso REAL) —
    // sem plano não é tela vazia, é o mesmo capricho da tela cheia. O tile
    // Ritmo, porém, NUNCA herda o rótulo calculado com plano ("No ritmo")
    // sem lastro para sustentá-lo — vira "Sem referência" (achado do painel,
    // 2026-08-22): afirmar "No ritmo" aqui é a própria mentira que esta run
    // corrige.
    expect(screen.getByText("Sem referência")).toBeInTheDocument()
    expect(screen.queryByText("No ritmo")).not.toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
  })

  it("SEM LASTRO (1.3) — meta de regularidade nunca vira número, sempre 'Falta prova'", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarVisaoGeralAutogestao.mockReturnValue(dadosComPlano())

    await montarPainel("periodo=30")

    expect(screen.getByText("Falta prova.")).toBeInTheDocument()
    expect(screen.getByText(new RegExp(MOTIVO_SEM_META_FREQUENCIA))).toBeInTheDocument()
    // Nunca "0" nem "0x por semana" no lugar da meta ausente.
    expect(screen.queryByText("0x por semana")).not.toBeInTheDocument()
  })

  it("estado VAZIO (sem-jornada-iniciada) — nenhum número, só a frase da spec", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarVisaoGeralAutogestao.mockReturnValue(dadosVazio())

    await montarPainel("periodo=30")

    expect(
      screen.getByText(
        "Você ainda não começou sua jornada. Assim que iniciar, seus indicadores aparecem aqui.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("No ritmo")).not.toBeInTheDocument()
    expect(screen.queryByText("50%")).not.toBeInTheDocument()
  })

  it("estado ERRO — nenhum número finge que 'não houve', a tela diz que falhou", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarVisaoGeralAutogestao.mockReturnValue(dadosErro())

    await montarPainel("periodo=30")

    expect(screen.getByText("Não foi possível carregar esta tela agora")).toBeInTheDocument()
    expect(screen.queryByText("50%")).not.toBeInTheDocument()
  })

  it("sem matrícula — mostra o estado compartilhado de 'sem matrícula ativa', nunca chama a fonte", async () => {
    mockResolverRecorte.mockResolvedValue({ ok: false, motivo: "sem-matricula" })

    await montarPainel("periodo=30")

    expect(screen.getByText(/ainda não tem uma matrícula ativa/)).toBeInTheDocument()
    expect(mockLerFonteAutogestao).not.toHaveBeenCalled()
    expect(mockMontarVisaoGeralAutogestao).not.toHaveBeenCalled()
  })

  it("as 3 abas da moldura estão presentes, com 'Visão Geral' ativa", async () => {
    mockResolverRecorte.mockResolvedValue(recorteOk())
    mockLerFonteAutogestao.mockResolvedValue({})
    mockMontarVisaoGeralAutogestao.mockReturnValue(dadosComPlano())

    await montarPainel("periodo=30")

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Autogestão da minha Jornada",
    )
    const ativa = screen.getByRole("link", { name: "Visão Geral" })
    expect(ativa).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Meus Padrões e Tendências" })).not.toHaveAttribute(
      "aria-current",
    )
    expect(screen.getByRole("link", { name: "Meu Mapa da Jornada" })).not.toHaveAttribute(
      "aria-current",
    )
  })
})
