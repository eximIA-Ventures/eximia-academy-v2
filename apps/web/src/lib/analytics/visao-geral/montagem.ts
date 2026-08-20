// ---------------------------------------------------------------------------
// Montagem da tela — a função PURA que transforma leitura crua em Visão geral.
// ---------------------------------------------------------------------------
// Nenhum `Date.now()`, nenhuma consulta, nenhum acesso a `process.env`. Tudo
// entra por parâmetro, inclusive o instante "agora". É o que permite ao teste
// deslocar o tempo, cruzar a meia-noite UTC e duplicar a população sem mock
// nenhum — e é o que faz de I-5 e I-6 propriedades verificáveis em vez de
// promessas.
//
// A saída tem a MESMA FORMA de `components/analytics/visao-geral/fixture.ts`.
// A prova mecânica está em `compat-fixture.ts`.
// ---------------------------------------------------------------------------

import { abasComAtiva } from "./abas"
import { montarAcionamentos } from "./acionamentos"
import { montarAtencao } from "./atencao"
import { type BaseCalculo, montarBase } from "./base"
import type { FonteVisaoGeral } from "./fonte"
import { primeiraFalha } from "./fonte"
import { montarMudancas } from "./mudancas"
import { montarPlacar } from "./placar"
import { montarRecomendacoes } from "./recomendacoes"
import { montarSinais } from "./sinais"
import { rotuloUltimaAtividade } from "./textos"
import type {
  Aba,
  Aluno,
  Cabecalho,
  ChipFiltro,
  ContextoGlobal,
  SerieSessoes,
  Sidebar,
  VisaoGeralDados,
} from "./tipos"

/** O que a tela precisa saber e não está no banco de aprendizagem. */
export interface ContextoDeTela {
  tenantNome: string
  gestorNome: string
  gestorPapel: string
  escopoEquipe: "diretos" | "hierarquia"
  /** Nome do curso filtrado, ou null para "Todos os cursos". */
  cursoFiltroNome: string | null
  /** Quando os dados foram lidos. Igual a `agoraMs` numa leitura sem cache. */
  atualizadoEmMs: number
}

const SIDEBAR_PADRAO: Omit<Sidebar, "usuario"> = {
  marca: { wordmark: "ExímIA", sufixoDestaque: "IA", subtitulo: "ACADEMY" },
  itens: [
    { id: "inicio", rotulo: "Início", icone: "home", ativo: false, grupo: 1 },
    { id: "jornada", rotulo: "Jornada", icone: "route", ativo: false, grupo: 1 },
    { id: "alunos", rotulo: "Alunos", icone: "users", ativo: false, grupo: 1 },
    { id: "turmas", rotulo: "Turmas", icone: "users-round", ativo: false, grupo: 1 },
    { id: "conteudos", rotulo: "Conteúdos", icone: "book-open", ativo: false, grupo: 1 },
    { id: "comunicacoes", rotulo: "Comunicações", icone: "message-square", ativo: false, grupo: 2 },
    { id: "relatorios", rotulo: "Relatórios", icone: "file-text", ativo: false, grupo: 2 },
    { id: "analytics", rotulo: "Analytics", icone: "bar-chart-3", ativo: true, grupo: 2 },
    { id: "configuracoes", rotulo: "Configurações", icone: "settings", ativo: false, grupo: 3 },
  ],
}

/**
 * A trinca mudou de casa (`./abas.ts`) quando a tela "em construção" das outras
 * duas abas passou a renderizar a MESMA barra. Os rótulos, a ordem e o formato
 * do `href` são idênticos — o que deixou de existir é a segunda cópia deles.
 */
const ABAS: readonly Aba[] = abasComAtiva("visao-geral")

function rotuloAtualizado(agoraMs: number, atualizadoEmMs: number): string {
  const minutos = Math.max(0, Math.floor((agoraMs - atualizadoEmMs) / 60_000))
  if (minutos < 1) return "Atualizado agora"
  if (minutos < 60) return `Atualizado há ${minutos}min`
  return `Atualizado há ${Math.floor(minutos / 60)}h`
}

function montarRoster(
  base: BaseCalculo,
  acionamentosPorAluno: ReadonlyMap<string, number>,
  retornoEmDiasPorAluno: ReadonlyMap<string, number>,
): Aluno[] {
  return [...base.roster]
    .map((id): Aluno => {
      const dias = base.diasSemAtividadePorAluno.get(id) ?? null
      const estado = base.estadoPorAluno.get(id) ?? "sustentando"
      return {
        id,
        nome: base.nomePorAluno.get(id) ?? "Sem nome",
        origem: "real",
        iniciais: base.iniciaisPorAluno.get(id) ?? "?",
        avatarTone: base.tomAvatarPorAluno.get(id) ?? "neutral",
        estado,
        diasDesdeUltimaAtividade: dias,
        ultimaAtividadeLabel: rotuloUltimaAtividade(dias),
        ativoNoPeriodo: base.ativosNoPeriodo.has(id),
        regular: base.regularesNoPeriodo.has(id),
        participou: base.participaramNoPeriodo.has(id),
        progressoPercent: Math.round(base.progressoPorAluno.get(id) ?? 0),
        progressoEsperadoPercent: base.esperadoPorAluno.get(id) ?? 0,
        // "Estava em dia no cronograma quando parou" = parado E não atrasado.
        // É o mesmo predicado que define `sem_acesso` na triagem canônica.
        estavaNoRitmoAntesDeParar: estado === "parado" && !base.atrasados.has(id),
        acionamentosRecebidos: acionamentosPorAluno.get(id) ?? 0,
        retornoAposAcionamentoDias: retornoEmDiasPorAluno.get(id) ?? null,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

export function montarVisaoGeral(
  fonte: FonteVisaoGeral,
  contextoDeTela: ContextoDeTela,
): VisaoGeralDados {
  const base = montarBase(fonte)
  const { falhas } = fonte

  const placar = montarPlacar(base, falhas)
  const mudancas = montarMudancas(base, falhas)
  const atencao = montarAtencao(base, falhas)
  const recomendacoes = montarRecomendacoes(base, falhas)
  const sinais = montarSinais(base, falhas)
  const resposta = montarAcionamentos(base, fonte.acionamentos, falhas)

  const contexto: ContextoGlobal = {
    tenantNome: contextoDeTela.tenantNome,
    gestorNome: contextoDeTela.gestorNome,
    gestorPapel: contextoDeTela.gestorPapel,
    agoraISO: new Date(fonte.agoraMs).toISOString(),
    atualizadoEmISO: new Date(contextoDeTela.atualizadoEmMs).toISOString(),
    atualizadoLabel: rotuloAtualizado(fonte.agoraMs, contextoDeTela.atualizadoEmMs),
    periodoInicioISO: new Date(base.janelas.atualInicio).toISOString(),
    periodoFimISO: new Date(base.janelas.atualFim).toISOString(),
    periodoDias: fonte.periodoDias,
    periodoAnteriorInicioISO: new Date(base.janelas.anteriorInicio).toISOString(),
    periodoAnteriorFimISO: new Date(base.janelas.anteriorFim).toISOString(),
    escopoEquipe: contextoDeTela.escopoEquipe,
    cursoFiltro: contextoDeTela.cursoFiltroNome,
    totalMatriculados: base.roster.size,
  }

  const anterior = base.sessoesNoPeriodoAnterior
  const serieSessoes: SerieSessoes = {
    sessoesPeriodoAtual: base.sessoesNoPeriodo,
    sessoesPeriodoAnterior: anterior,
    // Contagens cruas. A LEITURA honesta dessa variação (inclusive o "não dá
    // para comparar") mora no bloco "O que mudou", que sabe declarar vazio;
    // aqui é só o número, e 0 significa "sem base para percentual".
    variacaoPercent: anterior > 0 ? Math.round((base.sessoesNoPeriodo / anterior - 1) * 100) : 0,
  }

  const cabecalho: Cabecalho = {
    titulo: "Ativação da Jornada",
    subtitulo: "Visão analítica para apoiar o engajamento e o ritmo da sua equipe.",
    atualizadoLabel: contexto.atualizadoLabel,
    atualizadoIcone: "clock",
  }

  const chipsFiltro: readonly ChipFiltro[] = [
    { id: "escopo", rotulo: "Meu time", icone: "users", chevron: true },
    {
      id: "curso",
      rotulo: contextoDeTela.cursoFiltroNome ?? "Todos os cursos",
      icone: "book-open",
      chevron: true,
    },
    {
      id: "periodo",
      rotulo: `Últimos ${fonte.periodoDias} dias`,
      icone: "calendar",
      chevron: true,
    },
  ]

  const sidebar: Sidebar = {
    ...SIDEBAR_PADRAO,
    usuario: {
      nome: contextoDeTela.gestorNome,
      papel: contextoDeTela.gestorPapel,
      avatarUrl: null,
      chevron: "up",
    },
  }

  const blocos = [placar, mudancas, atencao, recomendacoes, sinais, resposta.bloco]
  const falhaGeral = primeiraFalha(falhas, [
    "roster",
    "sessoes",
    "reflexoes",
    "matriculas",
    "cursos",
    "participacao",
    "acionamentos",
    "capitulos",
  ])

  // O estado do TOPO é conservador: falha na leitura do roster invalida a tela
  // inteira (sem universo, todo denominador é chute). Falha parcial deixa a
  // tela em "ok" e o bloco afetado em "erro" — que é o ponto de ter estado por
  // bloco em vez de um booleano global.
  const estado: "ok" | "vazio" | "erro" = falhas.roster
    ? "erro"
    : blocos.every((b) => b.estado === "vazio")
      ? "vazio"
      : "ok"

  return {
    estado,
    erro: falhaGeral,
    contexto,
    roster: montarRoster(base, resposta.acionamentosPorAluno, resposta.retornoEmDiasPorAluno),
    serieSessoes,
    sidebar,
    cabecalho,
    chipsFiltro,
    abas: ABAS,
    placar,
    mudancas,
    atencao,
    recomendacoes,
    resposta: resposta.bloco,
    sinais,
  }
}
