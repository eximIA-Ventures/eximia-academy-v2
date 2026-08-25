// ---------------------------------------------------------------------------
// Aprendizagem do Time — contrato de saída da camada de dados (Tela 1: Visão
// Geral). Espelha a ARQUITETURA de `lib/analytics/visao-geral/tipos.ts`
// (ComEstado<T>, FalhaLeitura, MotivoAusencia) — não os campos, não as regras.
// Os dois domínios ficam semanticamente independentes por decisão do dono do
// produto: aqui não existe "sessão", "acesso" nem "progresso do curso" em
// lugar nenhum do tipo. Regra 3 da spec: atividade não é aprendizagem.
// ---------------------------------------------------------------------------

export interface FalhaLeitura {
  codigo: string
  mensagem: string
}

/**
 * Por que o bloco não tem dado. Sem isto, `estado: "vazio"` significaria
 * "não há evidência", "não há gente suficiente" e "os dados não são
 * comparáveis entre períodos" ao mesmo tempo — três decisões de leitura
 * diferentes para o gestor.
 */
export type MotivoVazio =
  | "amostra-insuficiente" // §7: <3 aprendizes elegíveis ou <5 evidências avaliáveis
  | "sem-tendencia" // §7: <2 períodos comparáveis
  | "sem-capacidades-no-curso" // curso sem currículo de capacidades semeado
  | "selecione-um-curso" // §4.2: capacidade nomeada não soma entre cursos
  | "sem-evidencia"
  | "falha-de-leitura"

export interface EstadoBloco {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  /** Texto literal para exibição quando `estado === "vazio"`. Nunca um numeral. */
  textoVazio: string | null
  motivoVazio: MotivoVazio | null
}

export type ComEstado<T> = T & EstadoBloco

export type CategoriaEvidencia = "cognitive" | "application" | "real_context"
export type EstadoMaturidade = "not_evidenced" | "emerging" | "developing" | "demonstrated"

// ===========================================================================
// Contexto global da tela
// ===========================================================================

export interface ContextoGlobal {
  tenantNome: string
  gestorNome: string
  gestorPapel: string
  agoraISO: string
  periodoDias: number
  periodoInicioISO: string
  periodoFimISO: string
  periodoAnteriorInicioISO: string
  periodoAnteriorFimISO: string
  escopoEquipe: "diretos" | "hierarquia"
  /** null = "Todos os cursos". */
  cursoFiltroNome: string | null
  totalAprendizesElegiveis: number
}

export interface Cabecalho {
  titulo: string
  subtitulo: string
}

// ===========================================================================
// §9 — Placar da aprendizagem
// ===========================================================================

export interface IndicadorPlacar {
  valorPercent: number | null
  /** null = sem período anterior comparável (nunca "0 pp"). */
  deltaPp: number | null
}

export interface PlacarAprendizagem {
  compreensao: IndicadorPlacar
  profundidade: IndicadorPlacar
  aplicacao: IndicadorPlacar
  /** §9.4: evolução da dimensão escolhida — profundidade média (decisão MVP documentada em placar.ts). */
  evolucao: IndicadorPlacar
}

// ===========================================================================
// §10 — O que mudou
// ===========================================================================

export interface SinalMudanca {
  id: string
  texto: string
  tom: "positivo" | "negativo" | "neutro"
}

export interface BlocoMudancas {
  sinais: readonly SinalMudanca[]
}

// ===========================================================================
// §11 — O que merece atenção agora?
// ===========================================================================

export interface ItemAtencao {
  id: string
  capacidadeId: string
  gap: string
  resumo: string
  acaoSugerida: string
}

export interface BlocoAtencao {
  itens: readonly ItemAtencao[]
}

// ===========================================================================
// §13 — O que fazer agora
// ===========================================================================

export interface Recomendacao {
  id: string
  prioridade: number
  titulo: string
  contexto: string
  cta: string
}

export interface BlocoRecomendacoes {
  itens: readonly Recomendacao[]
}

// ===========================================================================
// §14 — Capacidades com maior evolução
// ===========================================================================

export interface CapacidadeEvolucao {
  capacidadeId: string
  titulo: string
  estadoColetivoPercent: number
  deltaPp: number | null
}

export interface BlocoCapacidadesEvolucao {
  linhas: readonly CapacidadeEvolucao[]
}

// ===========================================================================
// §15 — Gaps prioritários
// ===========================================================================

export interface GapPrioritario {
  capacidadeId: string
  titulo: string
  descricao: string
  pessoasImpactadas: number
  percentImpactado: number
}

export interface BlocoGapsPrioritarios {
  linhas: readonly GapPrioritario[]
}

// ===========================================================================
// Objeto completo da Tela 1
// ===========================================================================

export interface VisaoGeralAprendizagemDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  contexto: ContextoGlobal
  cabecalho: Cabecalho
  placar: ComEstado<PlacarAprendizagem>
  mudancas: ComEstado<BlocoMudancas>
  atencao: ComEstado<BlocoAtencao>
  recomendacoes: ComEstado<BlocoRecomendacoes>
  capacidadesEvolucao: ComEstado<BlocoCapacidadesEvolucao>
  gapsPrioritarios: ComEstado<BlocoGapsPrioritarios>
}

// ===========================================================================
// TELA 2 — Padrões e Evolução (§17-24)
// ===========================================================================

// --- §18 — Evolução da profundidade ----------------------------------------

export interface PontoSerieSemanal {
  /** Início da semana (segunda-feira UTC), rótulo curto "dd/mm" para o eixo X. */
  rotulo: string
  inicioSemanaISO: string
  /** null = semana sem evidência avaliável nesse eixo (ponto ausente, não zero). */
  profundidadePercent: number | null
  aplicacaoPercent: number | null
}

export interface BlocoEvolucaoProfundidade {
  pontos: readonly PontoSerieSemanal[]
  /** §18.1: leitura textual obrigatória — o gráfico nunca aparece sem ela. */
  insight: string | null
}

// --- §20 — Padrões emergentes -----------------------------------------------

export interface SinalPadrao {
  id: string
  titulo: string
  texto: string
  tom: "positivo" | "negativo" | "neutro"
}

export interface BlocoPadroesEmergentes {
  sinais: readonly SinalPadrao[]
}

// --- §21 — Onde a aprendizagem trava ----------------------------------------

export interface LinhaOndeTrava {
  conceitoId: string
  modulo: string
  compreensaoPercent: number | null
  aplicacaoPercent: number | null
  gapPrincipal: string
}

export interface BlocoOndeTrava {
  linhas: readonly LinhaOndeTrava[]
}

// --- §22 — Conceitos frágeis -------------------------------------------------

export interface ConceitoFragil {
  conceitoId: string
  titulo: string
  pessoasAfetadas: number
  percentAfetado: number
}

export interface BlocoConceitosFrageis {
  linhas: readonly ConceitoFragil[]
}

// --- §23 — Módulos com maior evolução ----------------------------------------

export interface ModuloEvolucao {
  conceitoId: string
  titulo: string
  deltaPp: number
}

export interface BlocoModulosEvolucao {
  linhas: readonly ModuloEvolucao[]
}

// ===========================================================================
// TELA 3 — Mapa de Capacidades (§26-37)
// ===========================================================================

export type NivelPrioridade = "alta" | "media" | "baixa"

// --- §31 — Capacidades do time -----------------------------------------------

export interface CapacidadeDoTime {
  capacidadeId: string
  titulo: string
  /** § "percentual de pessoas classificadas como Em desenvolvimento ou Demonstrada". */
  percentMaduro: number
  prioridade: NivelPrioridade
}

export interface BlocoCapacidadesDoTime {
  linhas: readonly CapacidadeDoTime[]
}

// --- §32 — Capacidade com maior gap ------------------------------------------

export interface CapacidadeComMaiorGap {
  capacidadeId: string
  titulo: string
  texto: string
  sinais: readonly string[]
}

export interface BlocoCapacidadeComMaiorGap {
  capacidade: CapacidadeComMaiorGap | null
}

// --- §33 — Mapa capacidade × equipe -------------------------------------------

export interface ColunaMapa {
  capacidadeId: string
  titulo: string
}

export interface LinhaMapa {
  alunoId: string
  nome: string
  /** Chave = `capacidadeId`. */
  estados: Readonly<Record<string, EstadoMaturidade>>
}

export interface BlocoMapaCapacidadeEquipe {
  colunas: readonly ColunaMapa[]
  linhas: readonly LinhaMapa[]
}

// --- §35 — Evidências disponíveis --------------------------------------------

export interface BlocoEvidenciasDisponiveis {
  reflexoesAnalisadas: number
  casosPraticos: number
  validacoesGestor: number
}

// --- §36 — Pessoas que precisam de apoio -------------------------------------

export interface PessoaApoio {
  alunoId: string
  nome: string
  estado: EstadoMaturidade
  necessidade: string
}

export interface BlocoPessoasApoio {
  capacidadeGapTitulo: string | null
  linhas: readonly PessoaApoio[]
}

export interface MapaCapacidadesDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  contexto: ContextoGlobal
  cabecalho: Cabecalho
  capacidadesDoTime: ComEstado<BlocoCapacidadesDoTime>
  capacidadeComMaiorGap: ComEstado<BlocoCapacidadeComMaiorGap>
  mapaCapacidadeEquipe: ComEstado<BlocoMapaCapacidadeEquipe>
  evidenciasDisponiveis: ComEstado<BlocoEvidenciasDisponiveis>
  pessoasApoio: ComEstado<BlocoPessoasApoio>
  /** §37: reusa o mesmo contrato de "O que fazer agora" das Telas 1/2. */
  recomendacoes: ComEstado<BlocoRecomendacoes>
}

export interface PadroesEvolucaoDados {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  contexto: ContextoGlobal
  cabecalho: Cabecalho
  evolucaoProfundidade: ComEstado<BlocoEvolucaoProfundidade>
  padroesEmergentes: ComEstado<BlocoPadroesEmergentes>
  ondeTrava: ComEstado<BlocoOndeTrava>
  conceitosFrageis: ComEstado<BlocoConceitosFrageis>
  modulosEvolucao: ComEstado<BlocoModulosEvolucao>
  /** §24: reusa o mesmo contrato de "O que fazer agora" da Tela 1 (§13) — mesma anatomia, outro conteúdo. */
  recomendacoes: ComEstado<BlocoRecomendacoes>
}
