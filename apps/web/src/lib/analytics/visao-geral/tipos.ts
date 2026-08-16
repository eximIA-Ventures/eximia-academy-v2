// ---------------------------------------------------------------------------
// Visão geral — contrato de saída da camada de dados.
// ---------------------------------------------------------------------------
// A FORMA é a de `components/analytics/visao-geral/fixture.ts`. Trocar a
// fixture por dado real não pode exigir remontar a UI. A prova mecânica dessa
// compatibilidade está em `compat-fixture.ts` (o compilador reprova se alguém
// divergir), não neste comentário.
//
// DUAS FAMÍLIAS DE DIFERENÇA em relação à fixture, ambas exigidas por I-3
// ("ausência de dado nunca vira zero"):
//
//   1. ALARGAMENTO — os quatro campos de variação (`deltaPp`, `deltaDirecao`,
//      `deltaTom`, `deltaLabel`) passam a aceitar `null`. Sem isso, "No ritmo"
//      (que NÃO tem histórico de progresso em banco, ver `placar.ts`) seria
//      obrigado a exibir `0 pp`, que é uma afirmação sobre a equipe que o dado
//      não sustenta. Alargar mantém a fixture atribuível a este tipo.
//
//   2. CAMPOS ADITIVOS OPCIONAIS — `estado`/`erro`/`textoVazio`/`motivoVazio`
//      por bloco, e `deltaAusenteMotivo` por métrica. São opcionais no tipo
//      público (para a fixture continuar válida) e OBRIGATÓRIOS na saída dos
//      produtores, via `ComEstado<T>`. O compilador força quem produz a
//      declarar se o bloco é ok/vazio/erro; quem consome recebe a garantia.
//
// A UI passa a importar os tipos DAQUI em vez de `./fixture`, e ganha as três
// ramificações que I-3 e I-4 exigem: `ok` renderiza, `vazio` mostra o texto da
// §32, `erro` mostra falha e NENHUM numeral.
// ---------------------------------------------------------------------------

// ===========================================================================
// Tipos base (idênticos à fixture, exceto `Origem`, alargado com "real")
// ===========================================================================

/** Auditoria. `"real"` = veio do banco; os outros dois são da fixture. */
export type Origem = "literal" | "gerado" | "real"

export type EstadoJornada =
  | "sustentando"
  | "perdendo-ritmo"
  | "parado"
  | "retomando"
  | "concluido"
  | "nao-iniciou"

export type Tom = "amber" | "red" | "green" | "blue" | "neutral"

export type Direcao = "up" | "down"

/** Leitura semântica da variação. NÃO é a direção da seta (C-17). */
export type ToneVariacao = "positivo" | "negativo"

// ===========================================================================
// Estado por bloco — I-3 e I-4 representáveis no tipo
// ===========================================================================

export interface FalhaLeitura {
  codigo: string
  mensagem: string
}

/**
 * Por que o dado não está lá. Sem isto, `null` significaria as três coisas ao
 * mesmo tempo: "não houve", "não dá para saber" e "a consulta quebrou" — que é
 * o colapso que o achado A-1 mediu em 16 páginas da Academy.
 */
export type MotivoAusencia =
  | "sem-escopo"
  | "sem-base"
  | "sem-periodo-anterior"
  | "sem-historico-comparavel"
  | "sem-acionamentos"
  | "sem-sinais"
  | "sem-gargalos"
  | "sem-historico-suficiente"
  | "falha-de-leitura"

export interface EstadoBloco {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
  /** Literal da §32 quando `estado === "vazio"`. Nunca um numeral. */
  textoVazio: string | null
  motivoVazio: MotivoAusencia | null
}

/** O que os produtores DEVEM devolver: o bloco com o estado resolvido. */
export type ComEstado<T> = T & EstadoBloco

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

// ===========================================================================
// §3 — Roster
// ===========================================================================

export interface Aluno {
  id: string
  nome: string
  origem: Origem
  iniciais: string
  /** Derivado das INICIAIS, nunca do estado (D-13). */
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

// ===========================================================================
// §4.2 — Série de sessões
// ===========================================================================

export interface SerieSessoes {
  sessoesPeriodoAtual: number
  sessoesPeriodoAnterior: number
  variacaoPercent: number
}

// ===========================================================================
// §5/§6 — Moldura (sidebar, cabeçalho, chips, abas)
// ===========================================================================

export interface MarcaSidebar {
  wordmark: string
  sufixoDestaque: string
  subtitulo: string
}

export interface ItemSidebar {
  id: string
  rotulo: string
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

export interface Cabecalho {
  titulo: string
  subtitulo: string
  atualizadoLabel: string
  atualizadoIcone: string
}

export interface ChipFiltro {
  id: string
  rotulo: string
  icone: string
  chevron: true
}

export interface Aba {
  id: string
  rotulo: string
  ativa: boolean
  href: string
}

// ===========================================================================
// §7 — Placar da jornada
// ===========================================================================

export interface MetricaPlacar {
  id: string
  rotulo: string
  icone: string
  iconeTom: Tom
  /** String pronta. Quando não há base, o travessão — nunca "0%". */
  valorPrincipal: string
  valorAbsoluto: string | null
  numerador: number
  baseDenominador: number
  /** null = não há comparação possível. Ver `deltaAusenteMotivo`. */
  deltaPp: number | null
  deltaDirecao: Direcao | null
  /** A COR vem daqui, nunca de `deltaDirecao` (C-17). */
  deltaTom: ToneVariacao | null
  deltaLabel: string | null
  // --- aditivos (a fixture não os traz; a UI pode ignorá-los) ---
  deltaAusenteMotivo?: MotivoAusencia | null
  /** true quando o denominador não existe: o card não mostra percentual. */
  semBase?: boolean
  textoVazio?: string | null
}

export interface BlocoPlacar extends Partial<EstadoBloco> {
  titulo: string
  subtitulo: string | null
  metricas: readonly MetricaPlacar[]
}

// ===========================================================================
// §8 — O que mudou
// ===========================================================================

export interface ItemMudanca {
  id: string
  texto: string
  marcadorTom: Tom
  marcadorGlifo: string
  ordem: number
}

export interface BlocoMudancas extends Partial<EstadoBloco> {
  titulo: string
  linkRodape: string
  itens: readonly ItemMudanca[]
}

// ===========================================================================
// §9 — Quem precisa da minha atenção agora?
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
  alunoId: string
  nome: string
  iniciais: string
  avatarTone: Tom
  sinalRotulo: string
  sinalTom: Tom
  sinalSubtexto: string
  ultimaAtividadeLabel: string
  acaoRotulo: "Reativar" | "Apoiar"
  acaoIcone: string
}

export interface BlocoAtencao extends Partial<EstadoBloco> {
  titulo: string
  linkRodape: string
  /** Ordem FIXA, nunca ordenada por valor (D-19). */
  segmentos: readonly SegmentoAtencao[]
  cabecalhosTabela: readonly string[]
  /** Fila de triagem, nunca pódio (I-8): sem numeração e sem nota. */
  linhas: readonly LinhaPrioritaria[]
}

// ===========================================================================
// §10 — O que fazer agora
// ===========================================================================

export interface Recomendacao {
  /**
   * Identidade ESTÁVEL da recomendação — a regra §29 que a emitiu.
   *
   * Existe porque `prioridade` NÃO serve de chave: ela é ordinal de exibição, e
   * duas listas diferentes têm ambas um "1". A chave do React precisa distinguir
   * *qual* recomendação é, não *em que posição* ela caiu.
   */
  id: string
  /**
   * POSIÇÃO na lista de no máximo 3 (§11: a coluna "Prioridade" da spec vale
   * 1, 2 e 3 em três linhas — é ordinal, não escala de gravidade). É o numeral
   * do badge, ÚNICO por construção, atribuído depois da ordenação.
   *
   * Prioridade de AÇÃO, não posição de pessoa (C-39): ordena o que o gestor
   * faz primeiro, nunca classifica gente.
   *
   * A GRAVIDADE (crítico/atenção/positivo) não vive aqui: ela ordena a lista
   * dentro de `recomendacoes.ts` e chega à tela como `badgeTom`.
   */
  prioridade: 1 | 2 | 3
  badgeTom: Tom
  titulo: string
  contexto: string
  ctaRotulo: string
  ctaIcone: string
  alunosAlvo: readonly string[]
  /**
   * Aditivo: o CTA que escreve em banco (lembrete/reconhecimento) fica INERTE
   * enquanto o gate de escrita estiver desligado. A camada de dados declara
   * aqui; quem renderiza decide como mostrar. Ver `index.ts`.
   */
  ctaEscreve?: boolean
}

export interface BlocoRecomendacoes extends Partial<EstadoBloco> {
  titulo: string
  tituloIcone: string
  recomendacoes: readonly Recomendacao[]
}

// ===========================================================================
// §11 — Resposta aos seus acionamentos
// ===========================================================================

export interface EstatisticaResposta {
  id: string
  valor: string
  rotulo: string
  icone: string
  iconeTom: Tom
}

export interface BlocoResposta extends Partial<EstadoBloco> {
  titulo: string
  tituloAjuda: boolean
  /** Texto RENDERIZADO, sempre visível, nunca tooltip (I-2). */
  disclaimer: string
  estatisticas: readonly EstatisticaResposta[]
  /** Dedupe por destinatário, nunca por notificação (I-1). */
  notificacoesEnviadas: number
  pessoasAcionadas: number
  retomaramEmAte7Dias: number
}

// ===========================================================================
// §12 — Sinais fora do padrão
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

export interface BlocoSinais extends Partial<EstadoBloco> {
  titulo: string
  linkRodape: string
  itens: readonly SinalForaDoPadrao[]
  /**
   * Aditivo: quantas pessoas do recorte têm histórico para comparação. Silêncio
   * explicado e silêncio mudo são mensagens diferentes — "nenhum sinal" pode
   * significar time saudável OU dois terços do roster sem hábito mensurável.
   */
  textoComplementar?: string | null
}

// ===========================================================================
// Agregado
// ===========================================================================

export interface ContratoErro {
  estado: "ok" | "vazio" | "erro"
  erro: FalhaLeitura | null
}

export interface VisaoGeralDados extends ContratoErro {
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
  /**
   * Só a fixture carrega variantes de estado vazio (é metadado de auditoria do
   * gauntlet, não dado de tela). Opcional aqui para o dado real poder omitir.
   */
  variantesVazias?: readonly { id: string; blocoAfetado: string; textoEsperado: string }[]
}
