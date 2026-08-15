// ---------------------------------------------------------------------------
// Fixture determinística — aba "Visão geral" (Analytics do gestor).
//
// Fonte canônica: docs/sop/runs/_referencias/academy-analytics-gestor/FIXTURE.md
// (no repo JARVIS). Este módulo é a TRADUÇÃO LITERAL daquele contrato de dados.
//
// Regras herdadas do contrato:
//   • Determinismo total: nada depende de Date.now(), Math.random(), locale ou
//     fuso local. O instante "agora" é congelado em CONTEXTO_GLOBAL.agoraISO.
//   • Toda string exibida na tela está aqui LITERAL (acento, caixa, pontuação
//     final e tipo de separador contam — ver CRITERIOS.md grupo C).
//   • O PNG de referência vence a SPEC-FUNCIONAL.md em tudo que é visível.
//     As divergências pinadas estão em FIXTURE.md §13 e NÃO devem ser
//     "corrigidas" durante o loop.
//
// Esta fixture é a ÚNICA fonte de dados da rota de preview
// /gauntlet-preview/visao-geral. Nenhuma leitura de Supabase.
// ---------------------------------------------------------------------------

// ===========================================================================
// §2 — Tipos base
// ===========================================================================

/** Auditoria da fixture. NÃO é renderizado em lugar nenhum. */
export type Origem = "literal" | "gerado"

export type EstadoJornada =
  | "sustentando"
  | "perdendo-ritmo"
  | "parado"
  | "retomando"
  | "concluido"
  | "nao-iniciou"

export type Tom = "amber" | "red" | "green" | "blue" | "neutral"

export type Direcao = "up" | "down"

/** Leitura semântica da variação. NÃO é a direção da seta (ver C-17). */
export type ToneVariacao = "positivo" | "negativo"

// ===========================================================================
// §1 — Contexto global
// ===========================================================================

export interface ContextoGlobal {
  tenantNome: string
  gestorNome: string
  gestorPapel: string
  agoraISO: string
  atualizadoEmISO: string
  atualizadoLabel: string
  periodoInicioISO: string
  periodoFimISO: string
  periodoDias: number
  periodoAnteriorInicioISO: string
  periodoAnteriorFimISO: string
  escopoEquipe: "diretos" | "hierarquia"
  cursoFiltro: string | null
  totalMatriculados: number
}

export const CONTEXTO_GLOBAL: ContextoGlobal = {
  tenantNome: "ARGOS",
  gestorNome: "Mariana Costa",
  gestorPapel: "Gestora",
  agoraISO: "2026-08-15T12:00:00.000Z",
  atualizadoEmISO: "2026-08-15T10:00:00.000Z",
  atualizadoLabel: "Atualizado há 2h",
  periodoInicioISO: "2026-07-16T00:00:00.000Z",
  periodoFimISO: "2026-08-15T00:00:00.000Z",
  periodoDias: 30,
  periodoAnteriorInicioISO: "2026-06-16T00:00:00.000Z",
  periodoAnteriorFimISO: "2026-07-16T00:00:00.000Z",
  escopoEquipe: "hierarquia",
  cursoFiltro: null,
  totalMatriculados: 40,
}

// ===========================================================================
// §3 — Roster, 40 alunos
// ===========================================================================

export interface Aluno {
  id: string
  nome: string
  origem: Origem
  iniciais: string
  /** Derivado das INICIAIS, nunca do estado (ver CRITERIOS.md D-13). */
  avatarTone: Tom
  estado: EstadoJornada
  /** null = nunca acessou. */
  diasDesdeUltimaAtividade: number | null
  ultimaAtividadeLabel: string
  ativoNoPeriodo: boolean
  regular: boolean
  participou: boolean
  progressoPercent: number
  progressoEsperadoPercent: number
  estavaNoRitmoAntesDeParar: boolean
  acionamentosRecebidos: number
  retornoAposAcionamentoDias: number | null
}

// --- §3.1 Sustentando (18) ------------------------------------------------
function sustentando(
  id: string,
  nome: string,
  iniciais: string,
  avatarTone: Tom,
  dias: number,
  ultimaAtividadeLabel: string,
  progressoPercent: number,
): Aluno {
  return {
    id,
    nome,
    origem: "gerado",
    iniciais,
    avatarTone,
    estado: "sustentando",
    diasDesdeUltimaAtividade: dias,
    ultimaAtividadeLabel,
    ativoNoPeriodo: true,
    regular: true,
    participou: true,
    progressoPercent,
    progressoEsperadoPercent: 55,
    estavaNoRitmoAntesDeParar: false,
    acionamentosRecebidos: 0,
    retornoAposAcionamentoDias: null,
  }
}

// --- §3.2 Perdendo ritmo (5) ----------------------------------------------
function perdendoRitmo(
  id: string,
  nome: string,
  origem: Origem,
  iniciais: string,
  avatarTone: Tom,
  dias: number,
  ultimaAtividadeLabel: string,
  progressoPercent: number,
): Aluno {
  return {
    id,
    nome,
    origem,
    iniciais,
    avatarTone,
    estado: "perdendo-ritmo",
    diasDesdeUltimaAtividade: dias,
    ultimaAtividadeLabel,
    ativoNoPeriodo: true,
    regular: false,
    participou: false,
    progressoPercent,
    progressoEsperadoPercent: 55,
    estavaNoRitmoAntesDeParar: false,
    acionamentosRecebidos: 0,
    retornoAposAcionamentoDias: null,
  }
}

// --- §3.3 Parado (6) ------------------------------------------------------
function parado(
  id: string,
  nome: string,
  iniciais: string,
  avatarTone: Tom,
  dias: number,
  ultimaAtividadeLabel: string,
  progressoPercent: number,
  estavaNoRitmoAntesDeParar: boolean,
  acionamentosRecebidos: number,
): Aluno {
  return {
    id,
    nome,
    origem: "gerado",
    iniciais,
    avatarTone,
    estado: "parado",
    diasDesdeUltimaAtividade: dias,
    ultimaAtividadeLabel,
    ativoNoPeriodo: false,
    regular: false,
    participou: false,
    progressoPercent,
    progressoEsperadoPercent: 55,
    estavaNoRitmoAntesDeParar,
    acionamentosRecebidos,
    retornoAposAcionamentoDias: null,
  }
}

// --- §3.4 Retomando (3) ---------------------------------------------------
function retomando(
  id: string,
  nome: string,
  iniciais: string,
  avatarTone: Tom,
  dias: number,
  ultimaAtividadeLabel: string,
  progressoPercent: number,
  regular: boolean,
  acionamentosRecebidos: number,
  retornoAposAcionamentoDias: number,
): Aluno {
  return {
    id,
    nome,
    origem: "gerado",
    iniciais,
    avatarTone,
    estado: "retomando",
    diasDesdeUltimaAtividade: dias,
    ultimaAtividadeLabel,
    ativoNoPeriodo: true,
    regular,
    participou: true,
    progressoPercent,
    progressoEsperadoPercent: 55,
    estavaNoRitmoAntesDeParar: false,
    acionamentosRecebidos,
    retornoAposAcionamentoDias,
  }
}

// --- §3.5 Concluído (4) ---------------------------------------------------
function concluido(
  id: string,
  nome: string,
  iniciais: string,
  avatarTone: Tom,
  dias: number,
  ultimaAtividadeLabel: string,
  ativoNoPeriodo: boolean,
): Aluno {
  return {
    id,
    nome,
    origem: "gerado",
    iniciais,
    avatarTone,
    estado: "concluido",
    diasDesdeUltimaAtividade: dias,
    ultimaAtividadeLabel,
    ativoNoPeriodo,
    regular: false,
    participou: false,
    progressoPercent: 100,
    progressoEsperadoPercent: 100,
    estavaNoRitmoAntesDeParar: false,
    acionamentosRecebidos: 0,
    retornoAposAcionamentoDias: null,
  }
}

// --- §3.6 Não iniciou (4) -------------------------------------------------
function naoIniciou(
  id: string,
  nome: string,
  origem: Origem,
  iniciais: string,
  avatarTone: Tom,
): Aluno {
  return {
    id,
    nome,
    origem,
    iniciais,
    avatarTone,
    estado: "nao-iniciou",
    diasDesdeUltimaAtividade: null,
    ultimaAtividadeLabel: "—",
    ativoNoPeriodo: false,
    regular: false,
    participou: false,
    progressoPercent: 0,
    progressoEsperadoPercent: 55,
    estavaNoRitmoAntesDeParar: false,
    acionamentosRecebidos: 0,
    retornoAposAcionamentoDias: null,
  }
}

export const ROSTER: readonly Aluno[] = [
  // §3.1 — Sustentando (18). Alvos de reconhecimento: A01, A04, A11, A18.
  sustentando("A01", "Adriana Fontes", "AF", "amber", 1, "1 dia atrás", 62),
  sustentando("A02", "Bruno Tavares", "BT", "blue", 0, "hoje", 58),
  sustentando("A03", "Camila Rezende", "CR", "green", 2, "2 dias atrás", 71),
  sustentando("A04", "Diego Prado", "DP", "red", 1, "1 dia atrás", 66),
  sustentando("A05", "Elisa Moraes", "EM", "amber", 0, "hoje", 57),
  sustentando("A06", "Fábio Duarte", "FD", "green", 3, "3 dias atrás", 60),
  sustentando("A07", "Gabriela Nunes", "GN", "blue", 1, "1 dia atrás", 55),
  sustentando("A08", "Heitor Vasques", "HV", "red", 2, "2 dias atrás", 69),
  sustentando("A09", "Isabela Cordeiro", "IC", "amber", 0, "hoje", 74),
  sustentando("A10", "João Peixoto", "JP", "green", 1, "1 dia atrás", 59),
  sustentando("A11", "Karina Belmonte", "KB", "red", 4, "4 dias atrás", 63),
  sustentando("A12", "Leandro Bicalho", "LB", "blue", 2, "2 dias atrás", 56),
  sustentando("A13", "Marcela Vidigal", "MV", "amber", 1, "1 dia atrás", 68),
  sustentando("A14", "Nelson Aguiar", "NA", "green", 0, "hoje", 61),
  sustentando("A15", "Otávio Sampaio", "OS", "red", 3, "3 dias atrás", 57),
  sustentando("A16", "Priscila Camargo", "PC", "blue", 2, "2 dias atrás", 72),
  sustentando("A17", "Rafael Quintela", "RQ", "amber", 1, "1 dia atrás", 58),
  sustentando("A18", "Sofia Andrade", "SA", "green", 1, "1 dia atrás", 65),

  // §3.2 — Perdendo ritmo (5). A21 tem avatarTone verde DE PROPÓSITO (D-13).
  perdendoRitmo("A19", "Artur Barcelos", "literal", "AB", "amber", 14, "14 dias atrás", 38),
  perdendoRitmo("A20", "Cintia Santana", "literal", "CS", "amber", 7, "7 dias atrás", 41),
  perdendoRitmo("A21", "Neusa Jorge", "literal", "NJ", "green", 10, "10 dias atrás", 44),
  perdendoRitmo("A22", "Tiago Bezerra", "gerado", "TB", "red", 9, "9 dias atrás", 39),
  perdendoRitmo("A23", "Vanessa Lobo", "gerado", "VL", "blue", 11, "11 dias atrás", 43),

  // §3.3 — Parado (6). São os 6 alvos da recomendação 1.
  parado("A24", "Oziel Marinho", "OM", "red", 16, "16 dias atrás", 47, true, 2),
  parado("A25", "Beatriz Falcão", "BF", "amber", 31, "31 dias atrás", 45, true, 0),
  parado("A26", "Caio Nogueira", "CN", "green", 33, "33 dias atrás", 40, true, 0),
  parado("A27", "Denise Vilela", "DV", "blue", 35, "35 dias atrás", 36, true, 0),
  parado("A28", "Eduardo Rangel", "ER", "amber", 42, "42 dias atrás", 22, false, 0),
  parado("A29", "Fernanda Tomé", "FT", "red", 47, "47 dias atrás", 18, false, 0),

  // §3.4 — Retomando (3).
  retomando("A30", "Gustavo Lemes", "GL", "green", 1, "1 dia atrás", 49, true, 2, 3),
  retomando("A31", "Helena Braz", "HB", "amber", 3, "3 dias atrás", 46, false, 1, 5),
  retomando("A32", "Ivan Queiroz", "IQ", "red", 2, "2 dias atrás", 42, false, 1, 11),

  // §3.5 — Concluído (4).
  concluido("A33", "Juliana Rezek", "JR", "blue", 33, "33 dias atrás", false),
  concluido("A34", "Kleber Assunção", "KA", "green", 12, "12 dias atrás", true),
  concluido("A35", "Lívia Montenegro", "LM", "amber", 8, "8 dias atrás", true),
  concluido("A36", "Murilo Tanaka", "MT", "red", 55, "55 dias atrás", false),

  // §3.6 — Não iniciou (4).
  naoIniciou("A37", "Venilton Amaral", "literal", "VA", "red"),
  naoIniciou("A38", "Wagner Bittencourt", "gerado", "WB", "green"),
  naoIniciou("A39", "Yara Cavalcanti", "gerado", "YC", "blue"),
  naoIniciou("A40", "Zilda Rocha", "gerado", "ZR", "amber"),
]

// ===========================================================================
// §4.2 — Série de sessões
// ===========================================================================

export interface SerieSessoes {
  sessoesPeriodoAtual: number
  sessoesPeriodoAnterior: number
  /** 214 ÷ 261 − 1 = −18,01%; exibido como "18%" de queda. */
  variacaoPercent: number
}

export const SERIE_SESSOES: SerieSessoes = {
  sessoesPeriodoAtual: 214,
  sessoesPeriodoAnterior: 261,
  variacaoPercent: -18,
}

// ===========================================================================
// §5 — Sidebar
// ===========================================================================

export interface MarcaSidebar {
  wordmark: string
  /** Renderizado em laranja de ação, DENTRO do wordmark. */
  sufixoDestaque: string
  subtitulo: string
}

export interface ItemSidebar {
  id: string
  rotulo: string
  /** Nome do ícone Lucide. */
  icone: string
  ativo: boolean
  grupo: 1 | 2 | 3
}

export interface UsuarioSidebar {
  nome: string
  papel: string
  avatarUrl: string | null
  chevron: "up" | "down"
}

export interface Sidebar {
  marca: MarcaSidebar
  itens: readonly ItemSidebar[]
  usuario: UsuarioSidebar
}

export const SIDEBAR: Sidebar = {
  marca: {
    wordmark: "ExímIA",
    sufixoDestaque: "IA",
    subtitulo: "ACADEMY",
  },
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
  usuario: {
    nome: "Mariana Costa",
    papel: "Gestora",
    avatarUrl: null,
    chevron: "up",
  },
}

// ===========================================================================
// §6 — Cabeçalho, chips de filtro e abas
// ===========================================================================

export interface Cabecalho {
  titulo: string
  subtitulo: string
  atualizadoLabel: string
  atualizadoIcone: string
}

export const CABECALHO: Cabecalho = {
  titulo: "Ativação da Jornada",
  subtitulo: "Visão analítica para apoiar o engajamento e o ritmo da sua equipe.",
  atualizadoLabel: "Atualizado há 2h",
  atualizadoIcone: "clock",
}

export interface ChipFiltro {
  id: string
  rotulo: string
  icone: string
  chevron: true
}

export const CHIPS_FILTRO: readonly ChipFiltro[] = [
  { id: "escopo", rotulo: "Meu time", icone: "users", chevron: true },
  { id: "curso", rotulo: "Todos os cursos", icone: "book-open", chevron: true },
  { id: "periodo", rotulo: "Últimos 30 dias", icone: "calendar", chevron: true },
]

export interface Aba {
  id: string
  rotulo: string
  ativa: boolean
  href: string
}

/** Caixa de SENTENÇA obrigatória: "Visão Geral" com G maiúsculo é FAIL (C-03). */
export const ABAS: readonly Aba[] = [
  { id: "visao-geral", rotulo: "Visão geral", ativa: true, href: "?tab=visao-geral" },
  { id: "padroes", rotulo: "Padrões e tendências", ativa: false, href: "?tab=padroes" },
  { id: "mapa", rotulo: "Mapa da jornada", ativa: false, href: "?tab=mapa" },
]

// ===========================================================================
// §7 — Bloco "Placar da jornada"
// ===========================================================================

export interface MetricaPlacar {
  id: string
  rotulo: string
  icone: string
  iconeTom: Tom
  /** String pronta, já formatada. */
  valorPrincipal: string
  valorAbsoluto: string | null
  numerador: number
  baseDenominador: number
  deltaPp: number
  deltaDirecao: Direcao
  /** A COR vem daqui, nunca de deltaDirecao (C-17). */
  deltaTom: ToneVariacao
  deltaLabel: string
}

export interface BlocoPlacar {
  titulo: string
  /** null de propósito: o PNG não tem subtítulo, e o PNG vence (§13 D-a). */
  subtitulo: string | null
  metricas: readonly MetricaPlacar[]
}

export const BLOCO_PLACAR: BlocoPlacar = {
  titulo: "Placar da jornada",
  subtitulo: null,
  metricas: [
    {
      id: "ativos",
      rotulo: "Ativos no período",
      icone: "users",
      iconeTom: "green",
      valorPrincipal: "28 de 40 · 70%",
      valorAbsoluto: "28 de 40",
      numerador: 28,
      baseDenominador: 40,
      deltaPp: 8,
      deltaDirecao: "down",
      deltaTom: "negativo",
      deltaLabel: "↓ 8 pp",
    },
    {
      id: "regularidade",
      rotulo: "Regularidade",
      icone: "calendar-check",
      iconeTom: "amber",
      valorPrincipal: "48%",
      valorAbsoluto: null,
      numerador: 19,
      baseDenominador: 40,
      deltaPp: 5,
      deltaDirecao: "down",
      deltaTom: "negativo",
      deltaLabel: "↓ 5 pp",
    },
    {
      id: "no-ritmo",
      rotulo: "No ritmo",
      icone: "trending-up",
      iconeTom: "green",
      valorPrincipal: "45%",
      valorAbsoluto: null,
      numerador: 18,
      baseDenominador: 40,
      deltaPp: 6,
      deltaDirecao: "up",
      deltaTom: "positivo",
      deltaLabel: "↑ 6 pp",
    },
    {
      id: "participacao",
      rotulo: "Participação",
      icone: "hand",
      iconeTom: "blue",
      valorPrincipal: "53%",
      valorAbsoluto: null,
      numerador: 21,
      baseDenominador: 40,
      deltaPp: 2,
      deltaDirecao: "down",
      deltaTom: "negativo",
      deltaLabel: "↓ 2 pp",
    },
    {
      // Sobe 3 pp e é VERMELHO: a cor segue o sentido semântico, não a seta.
      id: "sem-acesso",
      rotulo: "Sem acesso",
      icone: "user-x",
      iconeTom: "red",
      valorPrincipal: "15%",
      valorAbsoluto: null,
      numerador: 6,
      baseDenominador: 40,
      deltaPp: 3,
      deltaDirecao: "up",
      deltaTom: "negativo",
      deltaLabel: "↑ 3 pp",
    },
  ],
}

// ===========================================================================
// §8 — Bloco "O que mudou"
// ===========================================================================

export interface ItemMudanca {
  id: string
  texto: string
  marcadorTom: Tom
  /** Disco sólido com glifo BRANCO vazado — única exceção a B-22. */
  marcadorGlifo: string
  ordem: number
}

export interface BlocoMudancas {
  titulo: string
  /** UM único link para o card inteiro (§13 D-c). */
  linkRodape: string
  itens: readonly ItemMudanca[]
}

export const BLOCO_MUDANCAS: BlocoMudancas = {
  titulo: "O que mudou",
  linkRodape: "Ver detalhes",
  itens: [
    {
      id: "sessoes",
      texto: "Sessões caíram 18% em relação ao período anterior.",
      marcadorTom: "red",
      marcadorGlifo: "arrow-down",
      ordem: 1,
    },
    {
      id: "perderam-ritmo",
      texto: "6 pessoas perderam ritmo nas últimas 2 semanas.",
      marcadorTom: "amber",
      marcadorGlifo: "alert-triangle",
      ordem: 2,
    },
    {
      id: "retomaram",
      texto: "3 pessoas retomaram a jornada depois de um acionamento.",
      marcadorTom: "green",
      marcadorGlifo: "check",
      ordem: 3,
    },
  ],
}

// ===========================================================================
// §9 — Bloco "Quem precisa da minha atenção agora?"
// ===========================================================================

export interface SegmentoAtencao {
  id: string
  rotulo: string
  valor: number
  icone: string
  iconeTom: Tom
}

export interface LinhaPrioritaria {
  id: string
  /** Chave estrangeira para Aluno.id. */
  alunoId: string
  nome: string
  iniciais: string
  avatarTone: Tom
  sinalRotulo: string
  /** Cor do dot (B-26). */
  sinalTom: Tom
  sinalSubtexto: string
  ultimaAtividadeLabel: string
  acaoRotulo: "Reativar" | "Apoiar"
  acaoIcone: string
}

export interface BlocoAtencao {
  titulo: string
  linkRodape: string
  /** Ordem FIXA, nunca ordenada por valor (D-19). */
  segmentos: readonly SegmentoAtencao[]
  cabecalhosTabela: readonly string[]
  /** Ordem PINADA do PNG, nunca por severidade (D-20 / invariante I-8). */
  linhas: readonly LinhaPrioritaria[]
}

export const BLOCO_ATENCAO: BlocoAtencao = {
  titulo: "Quem precisa da minha atenção agora?",
  linkRodape: "Ver todas as pessoas",
  segmentos: [
    {
      id: "perdendo-ritmo",
      rotulo: "Perdendo ritmo",
      valor: 5,
      icone: "trending-down",
      iconeTom: "red",
    },
    { id: "parados", rotulo: "Parados", valor: 6, icone: "pause-circle", iconeTom: "amber" },
    {
      id: "nao-iniciaram",
      rotulo: "Não iniciaram",
      valor: 4,
      icone: "circle-dashed",
      iconeTom: "amber",
    },
    {
      id: "sustentando",
      rotulo: "Sustentando",
      valor: 18,
      icone: "check-circle",
      iconeTom: "green",
    },
  ],
  cabecalhosTabela: ["Pessoa", "Sinal", "Última atividade", "Próxima ação"],
  linhas: [
    {
      id: "L1",
      alunoId: "A19",
      nome: "Artur Barcelos",
      iniciais: "AB",
      avatarTone: "amber",
      sinalRotulo: "Perdendo ritmo",
      sinalTom: "amber",
      sinalSubtexto: "Sem acesso há 14 dias",
      ultimaAtividadeLabel: "14 dias atrás",
      acaoRotulo: "Reativar",
      acaoIcone: "user-plus",
    },
    {
      id: "L2",
      alunoId: "A37",
      nome: "Venilton Amaral",
      iniciais: "VA",
      avatarTone: "red",
      sinalRotulo: "Não iniciou",
      sinalTom: "red",
      sinalSubtexto: "Nunca acessou",
      // Travessão U+2014. Nunca "0 dias", nunca vazio, nunca null (I-3 / C-24).
      ultimaAtividadeLabel: "—",
      acaoRotulo: "Reativar",
      acaoIcone: "user-plus",
    },
    {
      id: "L3",
      alunoId: "A20",
      nome: "Cintia Santana",
      iniciais: "CS",
      avatarTone: "amber",
      sinalRotulo: "Perdendo ritmo",
      sinalTom: "amber",
      sinalSubtexto: "Frequência caiu",
      ultimaAtividadeLabel: "7 dias atrás",
      acaoRotulo: "Apoiar",
      acaoIcone: "message-circle",
    },
    {
      // avatarTone VERDE com dot ÂMBAR: prova de que o avatar não é colorido
      // pelo estado (D-13).
      id: "L4",
      alunoId: "A21",
      nome: "Neusa Jorge",
      iniciais: "NJ",
      avatarTone: "green",
      sinalRotulo: "Perdendo ritmo",
      sinalTom: "amber",
      sinalSubtexto: "Sem acesso há 10 dias",
      ultimaAtividadeLabel: "10 dias atrás",
      acaoRotulo: "Apoiar",
      acaoIcone: "message-circle",
    },
  ],
}

// ===========================================================================
// §10 — Bloco "O que fazer agora"
// ===========================================================================

export interface Recomendacao {
  /** Prioridade de AÇÃO, não posição de pessoa. Não é ranking (C-39). */
  prioridade: 1 | 2 | 3
  badgeTom: Tom
  titulo: string
  contexto: string
  ctaRotulo: string
  ctaIcone: string
  alunosAlvo: readonly string[]
}

export interface BlocoRecomendacoes {
  titulo: string
  tituloIcone: string
  recomendacoes: readonly Recomendacao[]
}

export const BLOCO_RECOMENDACOES: BlocoRecomendacoes = {
  titulo: "O que fazer agora",
  tituloIcone: "sparkles",
  recomendacoes: [
    {
      prioridade: 1,
      badgeTom: "red",
      titulo: "Reativar 6 pessoas sem acesso há mais de 14 dias",
      contexto: "4 delas estavam no ritmo antes de parar.",
      ctaRotulo: "Ver pessoas",
      ctaIcone: "users",
      alunosAlvo: ["A24", "A25", "A26", "A27", "A28", "A29"],
    },
    {
      prioridade: 2,
      badgeTom: "amber",
      titulo: "Apoiar 5 pessoas que começaram a desacelerar",
      contexto: "O progresso ficou parado nos últimos 10 dias.",
      ctaRotulo: "Enviar lembrete",
      ctaIcone: "bell",
      alunosAlvo: ["A19", "A20", "A21", "A22", "A23"],
    },
    {
      prioridade: 3,
      badgeTom: "green",
      titulo: "Reconhecer 4 pessoas com ritmo consistente",
      contexto: "A consistência ajuda a sustentar o engajamento da turma.",
      ctaRotulo: "Reconhecer",
      ctaIcone: "award",
      alunosAlvo: ["A01", "A04", "A11", "A18"],
    },
  ],
}

// ===========================================================================
// §11 — Bloco "Resposta aos seus acionamentos"
// ===========================================================================

export interface EstatisticaResposta {
  id: string
  valor: string
  rotulo: string
  icone: string
  iconeTom: Tom
}

export interface BlocoResposta {
  titulo: string
  /** Ícone circular "?" à direita do título. */
  tituloAjuda: boolean
  /** Texto RENDERIZADO, sempre visível, nunca tooltip (invariante I-2). */
  disclaimer: string
  estatisticas: readonly EstatisticaResposta[]
  /** Base de cálculo (§11.1). Dedupe por destinatário, nunca por notificação. */
  notificacoesEnviadas: number
  pessoasAcionadas: number
  retomaramEmAte7Dias: number
}

export const BLOCO_RESPOSTA: BlocoResposta = {
  titulo: "Resposta aos seus acionamentos",
  tituloAjuda: true,
  disclaimer: "Resultado observado após o acionamento. Não representa comprovação causal.",
  estatisticas: [
    { id: "acionadas", valor: "4", rotulo: "pessoas acionadas", icone: "send", iconeTom: "amber" },
    {
      id: "retomaram",
      valor: "2",
      rotulo: "retomaram em até 7 dias",
      icone: "undo-2",
      iconeTom: "green",
    },
    {
      id: "taxa",
      valor: "50%",
      rotulo: "taxa observada de retorno",
      icone: "percent",
      iconeTom: "blue",
    },
  ],
  notificacoesEnviadas: 6,
  pessoasAcionadas: 4,
  retomaramEmAte7Dias: 2,
}

// ===========================================================================
// §12 — Bloco "Sinais fora do padrão"
// ===========================================================================

export interface SinalForaDoPadrao {
  id: string
  alunoId: string
  /** Somente PRIMEIRO nome, nunca nome completo (C-35). */
  primeiroNome: string
  texto: string
  icone: string
  iconeTom: Tom
}

export interface BlocoSinais {
  titulo: string
  linkRodape: string
  itens: readonly SinalForaDoPadrao[]
}

export const BLOCO_SINAIS: BlocoSinais = {
  titulo: "Sinais fora do padrão",
  linkRodape: "Ver todos os sinais",
  itens: [
    {
      id: "S1",
      alunoId: "A19",
      primeiroNome: "Artur",
      texto: "Artur está há 14 dias sem acessar. Seu padrão habitual era a cada 3 dias.",
      icone: "alert-triangle",
      iconeTom: "red",
    },
    {
      id: "S2",
      alunoId: "A37",
      primeiroNome: "Venilton",
      texto: "Venilton ainda não iniciou a jornada.",
      icone: "alert-circle",
      iconeTom: "amber",
    },
    {
      id: "S3",
      alunoId: "A20",
      primeiroNome: "Cintia",
      texto: "Cintia reduziu a frequência nas últimas 2 semanas.",
      icone: "alert-circle",
      iconeTom: "amber",
    },
  ],
}

// ===========================================================================
// §14 — Variantes de estado vazio (invariante I-3)
// ===========================================================================

export interface VarianteFixture {
  id: string
  blocoAfetado: string
  mutacao: string
  textoEsperado: string
}

export const VARIANTES_VAZIAS: readonly VarianteFixture[] = [
  {
    id: "vazio-acionamentos",
    blocoAfetado: "Resposta aos seus acionamentos",
    mutacao: "acionamentosRecebidos = 0 para todos os 40",
    textoEsperado: "Você ainda não realizou acionamentos neste período.",
  },
  {
    id: "vazio-sinais",
    blocoAfetado: "Sinais fora do padrão",
    mutacao: "nenhum aluno com desvio do padrão próprio",
    textoEsperado: "Nenhum sinal relevante fora do padrão foi identificado.",
  },
  {
    id: "vazio-mudancas",
    blocoAfetado: "O que mudou",
    mutacao: "período anterior sem dados",
    textoEsperado:
      "Precisamos de pelo menos dois períodos de atividade para identificar uma tendência.",
  },
  {
    id: "vazio-atencao",
    blocoAfetado: "Quem precisa da minha atenção agora?",
    mutacao: "40 alunos sustentando",
    textoEsperado: "Nenhum gargalo relevante foi identificado neste período.",
  },
]

// ===========================================================================
// §15 — Contrato de erro (invariante I-4)
// ===========================================================================

export interface ContratoErro {
  estado: "ok" | "vazio" | "erro"
  erro: { codigo: string; mensagem: string } | null
}

// ===========================================================================
// Agregado — a única fonte de dados do preview
// ===========================================================================

export interface VisaoGeralFixture extends ContratoErro {
  contexto: ContextoGlobal
  roster: readonly Aluno[]
  serieSessoes: SerieSessoes
  sidebar: Sidebar
  cabecalho: Cabecalho
  chipsFiltro: readonly ChipFiltro[]
  abas: readonly Aba[]
  placar: BlocoPlacar
  mudancas: BlocoMudancas
  atencao: BlocoAtencao
  recomendacoes: BlocoRecomendacoes
  resposta: BlocoResposta
  sinais: BlocoSinais
  variantesVazias: readonly VarianteFixture[]
}

export const VISAO_GERAL_COMPLETA: VisaoGeralFixture = {
  estado: "ok",
  erro: null,
  contexto: CONTEXTO_GLOBAL,
  roster: ROSTER,
  serieSessoes: SERIE_SESSOES,
  sidebar: SIDEBAR,
  cabecalho: CABECALHO,
  chipsFiltro: CHIPS_FILTRO,
  abas: ABAS,
  placar: BLOCO_PLACAR,
  mudancas: BLOCO_MUDANCAS,
  atencao: BLOCO_ATENCAO,
  recomendacoes: BLOCO_RECOMENDACOES,
  resposta: BLOCO_RESPOSTA,
  sinais: BLOCO_SINAIS,
  variantesVazias: VARIANTES_VAZIAS,
}
