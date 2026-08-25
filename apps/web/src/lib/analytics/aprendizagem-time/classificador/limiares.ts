// ---------------------------------------------------------------------------
// Limiares numéricos nomeados — nunca soltos no meio da lógica.
//
// Dois grupos, com proveniência diferente e marcada:
//
//   1. LITERAIS DA SPEC (§7) — números que o texto da especificação funcional
//      declara explicitamente. Não são decisão de engenharia.
//
//   2. DECISÃO DE ENGENHARIA (§30) — a spec diz "consistência mínima definida
//      pelos critérios da capacidade" sem dar um número. A regra MVP (A+B ou
//      A+C) é literal; o QUANTO de cada categoria é preciso para contar como
//      "presente" é uma lacuna que a spec deixa deliberadamente em aberto.
//      Os valores abaixo são MINHA proposta, grounded no texto, mas precisam
//      de validação do dono do produto antes de virar régua definitiva —
//      documentado aqui, não escondido no meio do agregador.
// ---------------------------------------------------------------------------

// --- Grupo 1: literais da spec §7 -------------------------------------------

/** §7 "Indicadores coletivos": só exibir percentual com pelo menos 3 aprendizes elegíveis. */
export const AMOSTRA_MIN_APRENDIZES = 3

/** §7 "Indicadores coletivos": só exibir percentual com pelo menos 5 evidências avaliáveis. */
export const AMOSTRA_MIN_EVIDENCIAS = 5

/** §7 "Tendências": só declarar tendência com pelo menos 2 períodos comparáveis. */
export const TENDENCIA_MIN_PERIODOS = 2

// --- Grupo 2: decisão de engenharia, preenchendo lacuna da spec §30 --------

/**
 * Quantas evidências de uma categoria (B ou C) bastam para essa categoria
 * "contar" na triangulação que leva a `demonstrated`. Abaixo disso, uma única
 * evidência isolada de aplicação não é suficiente prova.
 */
export const MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA = 2

/** Quantas evidências cognitivas (A) bastam para a categoria A "contar". */
export const MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA = 2

/** Volume mínimo de evidência avaliável para considerar `emerging` em vez de `not_evidenced`. */
export const MIN_EVIDENCIAS_EMERGENTE = 1
