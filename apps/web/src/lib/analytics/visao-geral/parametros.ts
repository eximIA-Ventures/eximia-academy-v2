// ---------------------------------------------------------------------------
// Visão geral (Analytics do gestor) — TODOS os limiares num lugar só.
// ---------------------------------------------------------------------------
// Fonte dos números: SPEC-FUNCIONAL.md §8/§9/§13/§29 e o levantamento medido
// contra o banco de produção (2026-08-15). Um número que governa uma decisão de
// tela e mora solto no meio de uma função é um número que ninguém reafina; por
// isso os dez parâmetros novos ficam aqui, ao lado do que já existe.
//
// O QUE NÃO ESTÁ AQUI, DE PROPÓSITO: `SEM_ACESSO_DAYS` (14 dias). Ele já é
// canônico em `@/lib/student-triage` e ESPELHA `engagement-helpers.ts`.
// Redeclarar aqui criaria uma terceira cópia do mesmo limiar — que é exatamente
// o defeito que o cabeçalho do student-triage.ts avisa para não cometer.
// ---------------------------------------------------------------------------

export const MS_DIA = 86_400_000
export const MS_SEMANA = 7 * MS_DIA

// --- §8.2 Regularidade -----------------------------------------------------
/** "atividade em ≥2 dias distintos por semana" (§8.2, literal). */
export const REGULARIDADE_MIN_DIAS_NA_SEMANA = 2

// --- §9 "O que mudou": relevância de um sinal ------------------------------
// Um sinal só entra se passar no critério RELATIVO **e** no ABSOLUTO. Base
// pequena é a norma nesta plataforma (o maior cliente real tem 51 pessoas e 321
// sessões): −21% que são 4 sessões é alarme falso, e alarme falso gasta a
// atenção que a tela existe para economizar.
/** 15% — o MESMO limiar que a §29 regra B usa para "ativos caíram". */
export const RELEVANCIA_REL = 0.15
/** ~uma pessoa-semana de estudo. Abaixo disso a variação cabe num fim de semana. */
export const RELEVANCIA_ABS_SESSOES = 5
/** 1 pessoa é anedota, 2 é coincidência; com 3 há um grupo para acionar. */
export const RELEVANCIA_ABS_PESSOAS = 3
/** Assimetria deliberada: reconhecer custa menos que alarmar (§2 Regra 2). */
export const RELEVANCIA_ABS_RETOMADA = 2
/** Sem base mínima no período anterior, publica-se a contagem e não o percentual. */
export const RELEVANCIA_BASE_MIN = 10
/** §9: "Máximo 3 sinais". */
export const MUDANCAS_MAX = 3

// --- §13 "Sinais fora do padrão": baseline intrapessoal --------------------
// A unidade de observação é o intervalo entre DIAS DISTINTOS de atividade, não
// entre sessões: seis sessões numa tarde são um estudo só, não cinco intervalos.
/** ≥3 intervalos ⇔ ≥4 dias distintos. Com 2 intervalos a mediana é a média. */
export const BASELINE_MIN_INTERVALOS = 3
/** 4 dias concentrados numa semana dariam mediana 1-2 e disparariam por fim de semana. */
export const BASELINE_MIN_JANELA_DIAS = 21
/** Ausência > K × mediana. Em distribuição assimétrica, 2× mediana ≈ p85-p90 da própria pessoa. */
export const BASELINE_K = 2
/** Piso: quem estuda todo dia (mediana 1) não vira sinal por faltar sexta e sábado. */
export const BASELINE_PISO_DIAS = 7
/** Teto: 6 meses sumido é evasão consumada (bloco §10), não desvio do próprio padrão. */
export const BASELINE_TETO_DIAS = 180
/** §13: "Máximo 3 sinais inicialmente". */
export const SINAIS_MAX = 3

// --- §11 / §29 Recomendações ----------------------------------------------
/** §29 regra A: ">20% da equipe parada no mesmo módulo". */
export const CONCENTRACAO_MODULO_PCT = 0.2
/** §29 regra B: "ativos caírem >15% vs período anterior". */
export const QUEDA_ATIVOS_PCT = 0.15
/** §29 regra D: "ritmo por 3 períodos consecutivos" — 3 semanas. */
export const RITMO_CONSISTENTE_SEMANAS = 3
/** §11: "Máximo 3 recomendações". */
export const RECOMENDACOES_MAX = 3

// --- §10 Lista prioritária -------------------------------------------------
/** A lista é uma fila de triagem, não um pódio (I-8). O corte só limita altura. */
export const LINHAS_PRIORITARIAS_MAX = 4

// --- §12 Resposta aos acionamentos ----------------------------------------
/** §12: "nova sessão de aprendizagem em até 7 dias após o acionamento". */
export const JANELA_RETORNO_DIAS = 7

// --- Leitura ---------------------------------------------------------------
/** PostgREST corta em ~1000 linhas por request (FORM-08). */
export const TAMANHO_PAGINA = 1000
/** Guarda de FinOps contra laço infinito de paginação. */
export const MAX_PAGINAS = 50
/** `.in()` vai na query string: escopo grande estoura a URL. */
export const TAMANHO_LOTE_IDS = 200
