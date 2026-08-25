// ---------------------------------------------------------------------------
// Autogestão da minha Jornada — TODOS os limiares num lugar só.
// ---------------------------------------------------------------------------
// Fonte dos números: `ESPECIFICACAO.md` (referência) e `CONTRATO-DE-DADOS.md`
// (Fase 1.5 do /gauntlet-2, a régua funcional). Onde a especificação não numera
// um limiar (ex.: a banda de tolerância do widget de ritmo), o valor é decisão
// registrada aqui, não um número solto dentro de uma função — para a próxima
// calibragem ter ONDE mexer.
//
// Dias UTC (I-6 do analytics do gestor) são reaproveitados de
// `../visao-geral/dia-utc`: contar dia local do processo faria a mesma pessoa
// regularidade diferente no servidor e no cliente, e o autogestão herda esse
// invariante do gestor por ser o MESMO banco, os mesmos carimbos.
// ---------------------------------------------------------------------------

export const MS_DIA = 86_400_000
export const MS_SEMANA = 7 * MS_DIA

// --- §6 Estados principais do aprendiz --------------------------------------
/** "pelo menos 14 dias sem atividade" (spec §6, Parado / Retomando; contrato 2.6). */
export const PARADO_DIAS = 14
/** "3 semanas consecutivas" (spec §6 Sustentando; §32 regra D). */
export const SUSTENTANDO_SEMANAS = 3
/**
 * Janela em que uma pausa ≥`PARADO_DIAS` que já terminou ainda é lida como
 * "Retomando" (em vez de já ter virado "Sustentando" de novo). Decisão do dono:
 * a spec define O QUE é retomada, não POR QUANTO TEMPO ela continua sendo
 * anunciada como retomada — sem isto, o rótulo nunca se desliga.
 */
export const RETOMADA_JANELA_DIAS = 14

// --- §8.1 Ritmo --------------------------------------------------------------
/**
 * Banda de tolerância (pontos percentuais) ao redor do planejado para "No
 * ritmo". Decisão do dono — a spec lista os 4 estados (Adiantado/No ritmo/
 * Abaixo do ritmo/Retomando) mas não numera a fronteira entre eles.
 */
export const RITMO_TOLERANCIA_PP = 5

// --- §8.2 / §17 Regularidade -------------------------------------------------
// dias distintos ÷ semanas do período. Sem limiar adicional: o contrato 1.2 é
// explícito que váRIAS sessões no MESMO dia contam 1, nunca mais.
/**
 * "≥2 dias distintos" — o mesmo limiar que o analytics do gestor usa para
 * "regular" (`visao-geral/parametros.ts`, `REGULARIDADE_MIN_DIAS_NA_SEMANA`).
 * Usado aqui só para classificar uma SEMANA como regular no bloco §18.
 */
export const DIAS_ATIVOS_SEMANA_REGULAR = 2

// --- §10 / §11 / §18 Blocos com corte de 3 ----------------------------------
/** §10: "Máximo 3 sinais". */
export const MUDANCAS_MAX = 3
/** §11: "Máximo 3 pontos". */
export const ATENCAO_MAX = 3
/** §18: "Máximo 3 insights". */
export const FAVORECE_MAX = 3
/** §14: "Máximo 3 sinais simples". */
export const SINAIS_MOMENTO_MAX = 3

// --- Amostra mínima para insight de associação ------------------------------
/**
 * Abaixo disto, uma latência/associação é anedota de UMA ocorrência, não um
 * padrão (contrato 1.22: "com 1 só ocorrência, esperar supressão por n
 * insuficiente").
 */
export const INSIGHT_MIN_OCORRENCIAS = 2
/**
 * Sessões mínimas para declarar um horário/dia da semana preferido (contrato
 * 1.20/1.21). Evita que 2 sessões num fim de tarde virem "seu horário".
 */
export const HORARIO_MIN_SESSOES = 4
/**
 * Fração mínima de sessões concentradas numa faixa/dia para o sinal nascer.
 * Distribuição plana (contrato 1.21: "distribuição plana, esperar supressão")
 * não deve produzir uma afirmação de preferência.
 */
export const CONCENTRACAO_MIN_FRACAO = 0.6
/**
 * Semanas mínimas com o padrão observado para "O que favorece meu ritmo" (§18)
 * sair do estado de anedota. Mesmo raciocínio do `BASELINE_MIN_INTERVALOS` do
 * analytics do gestor: 1-2 semanas não sustentam "nas semanas em que".
 */
export const FAVORECE_MIN_SEMANAS = 3

// --- §17 Frequência média — piso de janela para a palavra "média" -----------
/**
 * Abaixo disto (a janela de 7 dias, o menor valor do filtro), rotular a
 * frequência como "média" seria enganoso: uma única semana não tem uma
 * segunda observação para comparar. Decisão do dono, achado da revisão
 * adversarial (Annie Duke, 2026-08-21): com `periodoDias < 8`, o rótulo vira
 * uma contagem simples ("N dias ativos nesta semana"), nunca "Nx por semana"
 * — o próximo valor válido do filtro (`_contexto.ts` / `recorte.ts`,
 * `PERIODOS_VALIDOS`) já é 30, então este piso não deixa nenhum valor
 * intermediário do enum passar como "média" por engano.
 */
export const FREQUENCIA_MEDIA_MIN_PERIODO_DIAS = 8

// --- §16 Série semanal -------------------------------------------------------
/** Semanas mínimas na série para falar em tendência (§32: "pouco histórico"). */
export const SERIE_SEMANAS_MIN = 2
/** Teto de semanas exibidas no gráfico — mesmo teto do gestor (`padroes-tendencias`). */
export const SERIE_SEMANAS_MAX = 12

// --- §25 Onde perco ritmo ("pausas ≥7 dias" — spec §14/§25) -----------------
/** "mais de 7 dias sem estudar" (spec §14, §25). */
export const PAUSA_LONGA_DIAS = 7
/** Ocorrências mínimas para "onde costumo perder ritmo" (contrato 3.7: "1 só, esperar supressão"). */
export const PERDA_DE_RITMO_MIN_OCORRENCIAS = 2

// --- §26 Histórico recente ----------------------------------------------------
/** §26: "últimos 3 módulos relevantes". */
export const HISTORICO_MODULOS_MAX = 3

// --- §25 "iniciar módulos novos" ----------------------------------------------
/**
 * Dias após `first_viewed_at` de um módulo dentro dos quais uma pausa longa
 * ainda conta como "perdi ritmo ao COMEÇAR o módulo" (contrato 3.7). Acima
 * disto, a pausa aconteceu no MEIO do módulo, não no início dele.
 */
export const JANELA_INICIO_MODULO_DIAS = 3

// --- §12 Meu próximo movimento -------------------------------------------------
/**
 * Sessão incompleta precisa ficar aberta por ao menos este tanto para virar
 * "sessão parada" (§12.1 prioridade 1). Sem piso, toda sessão em progresso no
 * MESMO dia (o normal de qualquer estudo) seria lida como parada.
 */
export const SESSAO_PARADA_MIN_DIAS = 1

// --- Leitura -------------------------------------------------------------------
/** PostgREST corta em ~1000 linhas por request (mesmo limite do gestor). */
export const TAMANHO_PAGINA = 1000

// --- Fuso horário do tenant ----------------------------------------------------
/**
 * Offset padrão (minutos, relativo a UTC) quando o tenant NÃO configurou o
 * próprio fuso em `tenants.settings.timezone_offset_minutes` — Brasília,
 * UTC−3 FIXO desde a extinção do horário de verão brasileiro em 2019
 * (Decreto nº 9.772/2019, sem DST daí em diante).
 *
 * Decisão do dono, 2026-08-24: antes desta constante, `fonte-supabase.ts`
 * devolvia `fusoHorarioMinutosOffset: null` incondicionalmente — todo carimbo
 * de sessão era lido em UTC, e uma sessão às 21h em Ribeirão Preto aparecia à
 * meia-noite nos sinais de horário (contrato 1.20/1.21) e no mapa de calor,
 * sem nenhum teste acusando (hora deslocada continua sendo hora válida). Como
 * nenhum tenant hoje configura o próprio fuso, Brasília nomeada aqui é o
 * default HONESTO — nunca um número solto dentro da função que o usa.
 *
 * A resolução com precedência (config do tenant > este default) vive em
 * `fonte-supabase.ts` (`resolverFusoHorarioMinutos`) — a PONTA para a tela de
 * Admin, ainda não construída, está documentada lá.
 */
export const TENANT_FUSO_HORARIO_PADRAO_MINUTOS = -180

// --- Mapa de calor de atividade (aluno OU time — mesma grade, dois escopos) ---
/**
 * Faixas de 2h no dia: decisão do dono. 12 faixas fecham as 24h
 * (`MAPA_DE_CALOR_HORAS_POR_FAIXA * MAPA_DE_CALOR_FAIXAS === 24`).
 */
export const MAPA_DE_CALOR_HORAS_POR_FAIXA = 2
export const MAPA_DE_CALOR_FAIXAS = 24 / MAPA_DE_CALOR_HORAS_POR_FAIXA

/** Teto de semanas do calendário semana×dia — 90 dias ÷ 7, arredondado pra cima. */
export const MAPA_DE_CALOR_SEMANAS_MAX = 13

/**
 * Atividades mínimas (união do contrato 1.2 — `sessions.created_at` ∪
 * `slide_reflections.created_at` ∪ `chapter_view_progress.last_viewed_at`,
 * a mesma que `carimbosDeAtividade` já usa) antes do mapa de calor sair do
 * estado SEM LASTRO. Decisão do dono: "com 4% de células preenchidas o mapa
 * individual vira poeira".
 *
 * O piso é escolhido pela AMOSTRA BRUTA, não pela densidade de células
 * preenchidas depois de montada a grade: um aluno com rotina genuinamente
 * concentrada (sempre terça às 20h) pode preencher poucas células com muita
 * confiança, e um piso por densidade puniria justamente o sinal mais forte
 * que a grade pode mostrar — a métrica errada para "isto é poeira?".
 *
 * Referência de escala: `HORARIO_MIN_SESSOES` (4) já é o piso deste módulo
 * para declarar UMA faixa preferida numa divisão de 5 baldes (1 dimensão).
 * A grade aqui tem 7×12 = 84 células (2 dimensões), ~17× mais fina — não
 * escalamos linear (a grade não exige amostra POR célula, só amostra total
 * suficiente para um padrão real emergir do ruído de sessões avulsas), mas
 * um piso 5× maior (20) é o menor múltiplo redondo que garante margem para
 * pelo menos uma célula real acumular `INSIGHT_MIN_OCORRENCIAS` (2, o piso
 * que este módulo já usa para não confundir padrão com anedota de 1
 * ocorrência) mesmo descontado o ruído esperado de sessões fora da rotina.
 */
export const MAPA_DE_CALOR_MIN_ATIVIDADES = 20
