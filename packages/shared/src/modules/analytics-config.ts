// ---------------------------------------------------------------------------
// PLACEHOLDER — reserva de lugar, NÃO conectado a nada ainda.
// ---------------------------------------------------------------------------
// Este arquivo NÃO é um módulo real do registry (não adiciona ID a
// `MODULE_IDS` nem entrada em `MODULE_DEFINITIONS` de `registry.ts`) e NÃO é
// importado por nenhum outro arquivo hoje — nenhuma tela, Server Action ou
// função de cálculo lê estes tipos/valores. É o ponto de partida para quando
// o painel de configurações completo da plataforma for construído (o Hugo:
// "isso é para depois... deixa só isso, salvo lá").
//
// Fonte do inventário de parâmetros: plano de arquitetura do terminal Maestri
// "Régua", `docs/architecture/meu-ritmo-configuracao-futura.md` (2026-07-19),
// re-confirmado contra o código em produção nesta mesma data (os 4 arquivos
// citados no doc — comparison-insights-table.tsx, student-home-indicators.ts,
// ritmo-summary.ts, area-gestor.ts — estavam sendo editados ao vivo por outro
// terminal, "Bússola", então os valores abaixo refletem o estado do código no
// momento em que este placeholder foi criado, não o snapshot original do doc).
//
// Fase 1 do plano da Régua (extração para objeto central, ainda hardcoded,
// trocar as constantes por leitura de `config.xxx`) e a exportação deste
// arquivo em `./index.ts` ficam para depois — nenhuma das duas é feita aqui.
// ---------------------------------------------------------------------------

/** As 5 linhas da tabela "Meu ritmo" (`RowKey` em comparison-insights-table.tsx). */
export type RitmoIndicatorKey =
  | "lastAccess"
  | "progress"
  | "sessions"
  | "reflections"
  | "engagement"

/** Sinais de atividade que contam um aluno como membro ativo da população de
 * referência ("Turma"). Doc §2.2, B1. */
export type ActivitySignal = "session" | "reflection" | "last_seen_at"

export interface AnalyticsConfig {
  /**
   * Faixa de tolerância relativa em torno da referência (Turma) que ainda lê
   * como "empate" (tie) — fora da faixa já é vitória ou "atrás", sem
   * gradiente intermediário. Hoje: `TONE_THRESHOLDS.tolerancePct` em
   * `comparison-insights-table.tsx`. Doc §2.3 (C1, redesenhado na SH-2.5).
   */
  toneTolerancePct: number

  /**
   * Bandas absolutas de recência (em dias) usadas pela leitura própria da
   * linha "Última sessão de estudo" (`recencyReadingFor`, desacoplada da
   * comparação com a Turma). Hoje: `RECENCY_THRESHOLDS` em
   * comparison-insights-table.tsx. Doc §2.3 (item 3 da SH-2.5).
   */
  recencyBandsDays: {
    /** Estudou há <= N dias → lido como "recente" (tom win). */
    recentDays: number
    /** Estudou há mais que `recentDays` mas <= N dias → tom neutro (tie).
     * Acima disso → "atrás" (behind). */
    staleDays: number
  }

  /**
   * Janela de "aluno ativo recentemente" (em dias) usada pelo card
   * `activeStudents` da visão do gestor. Hoje: `THIRTY_DAYS_MS` em
   * area-gestor.ts (30 * 86400000 ms = 30 dias). Doc §2.1 (A1).
   */
  activeRecentlyWindowDays: number

  /**
   * Janela de "visita atual" (em minutos): qualquer stamp de atividade do
   * próprio aluno dentro dessa janela é tratado como "a visita de agora" e
   * ignorado ao calcular a penúltima visita exibida na célula "Você". Hoje:
   * `CURRENT_VISIT_WINDOW_MS` em student-home-indicators.ts (3_600_000 ms =
   * 60 min). Doc §2.1 (A2) — ATENÇÃO, ACOPLAMENTO: este valor precisa ficar
   * sincronizado com `LAST_SEEN_TTL_MS` (`apps/web/src/lib/last-seen.ts`), a
   * janela de throttle do bump de `users.last_seen_at`. Se este campo virar
   * configurável de fato, ou os dois se movem juntos, ou este passa a ser
   * DERIVADO do TTL de last-seen em vez de duplicá-lo — nunca configurável
   * isoladamente (doc, Risco A2).
   */
  currentVisitWindowMinutes: number

  /**
   * Critério de população ativa ("Turma") — quais sinais contam um usuário
   * como já tendo tocado a plataforma. Hoje: `activeStudentIds` em
   * `loadOrgReference` (area-gestor.ts), sinais fixos [session, reflection,
   * last_seen_at]. Doc §2.2 (B1) — RISCO ALTO: recomenda-se, se exposto no
   * painel futuro, um "piso" não removível (session e reflection sempre
   * contam) e só `last_seen_at` como toggle opcional.
   *
   * NOTA (B2 / F6, doc §2.2 e §2.6): a exclusão de `users.status` deste
   * critério é um INVARIANTE de código, não um campo de configuração — uma
   * conta suspensa/administrativa nunca deve ser removida da população só
   * por isso. Não modelado como campo aqui de propósito, e não deve ser
   * exposto num painel em nenhuma fase.
   */
  activeStudentCriteria: {
    signals: ActivitySignal[]
  }

  /**
   * Pesos da fórmula de engajamento. Hoje: `engagementOf` em
   * student-home-indicators.ts (`interactions*2 + reflections*1`). Doc §2.4
   * (D1) — ACOPLAMENTO OBRIGATÓRIO com `computeEngagementMax` (D2): os DOIS
   * pesos precisam ser os MESMOS usados para calcular o teto "N" da fração
   * "X de N" exibida na tabela, senão a identidade "número = 2×interações +
   * reflexões" deixa de bater. Nunca configurável como dois controles soltos.
   */
  engagementWeights: {
    interactionWeight: number
    reflectionWeight: number
  }

  /**
   * Copy por indicador × tom, exibida no chip "Como estou". Hoje:
   * `LEITURA_COPY` em comparison-insights-table.tsx. Doc §2.5 (E1) — risco
   * médio: carrega um contrato de tom (nunca punitivo quando atrás) calibrado
   * por 4 stories consecutivas; se exposto a edição livre, recomenda-se
   * alguma validação leve de tom, não edição sem guardrail.
   */
  toneCopy: Record<RitmoIndicatorKey, { win: string; tie: string; behind: string }>

  /**
   * Frase especial da linha "Engajamento" quando o aluno é o #1 real da
   * turma (rank confirmado no backend, nunca aproximado). Hoje:
   * `TOP_ENGAGEMENT_COPY` em comparison-insights-table.tsx. Doc §2.5 (E2).
   */
  topEngagementCopy: string

  /**
   * Label do botão acionável ao lado do chip "Como estou", por indicador.
   * Hoje: `ACTION_LABEL` em comparison-insights-table.tsx. Doc §2.5 (E3) —
   * ATENÇÃO: o tamanho de fonte do botão (`ACTION_LABEL_SIZE`, doc §2.6 F1) é
   * DERIVADO da contagem de caracteres deste texto contra uma largura fixa de
   * botão; um texto customizado mais longo sem recalcular o tamanho estoura o
   * botão. F1 não é um campo de configuração — é sempre recalculado a partir
   * deste valor, nunca exposto separadamente.
   */
  actionLabels: Record<RitmoIndicatorKey, string>

  /**
   * Rótulos visíveis na coluna "Indicador" da tabela. Hoje: labels inline em
   * `buildRows` (comparison-insights-table.tsx). Doc §2.5 (E5).
   */
  indicatorLabels: Record<RitmoIndicatorKey, string>

  // NOTA — itens do inventário da Régua DELIBERADAMENTE fora deste config:
  //  - C2 (hierarquia de precedência de summaryToneOf) e C3 (regra de empate
  //    no topo, isTopEngagementRank): políticas/regras de honestidade, não
  //    valores soltos — doc §2.3, recomenda NUNCA expor.
  //  - E4 (templates de abertura de `buildRitmoSummary`, ritmo-summary.ts):
  //    doc §2.5 já registrava que é o texto "mais vivo" da sessão em que o
  //    doc foi escrito; na prática, a SH-2.5 evoluiu essas aberturas para uma
  //    lógica de branches condicionais (rank real > tom geral > engajamento
  //    isolado > neutro), não mais 5 templates simples — não é um "copy por
  //    tom" limpo o suficiente para modelar como campo agora. Deixado de fora
  //    até essa lógica estabilizar; ver doc §2.5 (E4) e §5 item 3.
  //  - F1-F4 (doc §2.6): tamanho de fonte derivado, ícone/cores de design
  //    system, paginação de infra, formatação de "há N dias" — explicitamente
  //    fora de escopo, nenhum é um parâmetro pedagógico configurável.
}

/**
 * Valores atuais hardcoded no código de produção (mesmos números/critérios
 * de hoje — nenhum comportamento real muda ao existir esta constante, ela só
 * os nomeia/agrupa, documentando o que seria a "Fase 1: objeto de config
 * central, ainda hardcoded" do plano da Régua, sem executar essa fase).
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  toneTolerancePct: 0.05,

  recencyBandsDays: {
    recentDays: 7,
    staleDays: 30,
  },

  activeRecentlyWindowDays: 30,

  currentVisitWindowMinutes: 60,

  activeStudentCriteria: {
    signals: ["session", "reflection", "last_seen_at"],
  },

  engagementWeights: {
    interactionWeight: 2,
    reflectionWeight: 1,
  },

  toneCopy: {
    lastAccess: {
      win: "estudando acima da média",
      tie: "no ritmo da turma",
      behind: "vamos retomar os estudos?",
    },
    progress: {
      win: "ritmo acima da média",
      tie: "no ritmo da turma",
      behind: "1 sessão te recoloca no ritmo",
    },
    sessions: {
      win: "acima da média",
      tie: "no ritmo da turma",
      behind: "que tal mais uma hoje?",
    },
    reflections: {
      win: "acima da média",
      tie: "no ritmo da turma",
      behind: "suas reflexões contam, registre uma",
    },
    engagement: {
      win: "acima da média",
      tie: "no ritmo da turma",
      behind: "vamos engajar mais?",
    },
  },

  topEngagementCopy: "1º da turma – Parabéns!",

  actionLabels: {
    lastAccess: "Retomar os estudos",
    progress: "Continuar sessão",
    sessions: "Fazer uma interação",
    reflections: "Registrar uma reflexão",
    engagement: "Continuar agora",
  },

  indicatorLabels: {
    lastAccess: "Última sessão de estudo",
    progress: "Progresso - conclusão",
    sessions: "Interações realizadas",
    reflections: "Reflexões realizadas",
    engagement: "Engajamento",
  },
}
