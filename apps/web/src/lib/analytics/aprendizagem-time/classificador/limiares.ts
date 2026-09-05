// ---------------------------------------------------------------------------
// Limiares numéricos nomeados — nunca soltos no meio da lógica.
//
// DECISÃO DE ENGENHARIA (§30) — a spec diz "consistência mínima definida pelos
// critérios da capacidade" sem dar um número. A regra MVP (A+B ou A+C) é
// literal; o QUANTO de cada categoria é preciso para contar como "presente" é
// uma lacuna que a spec deixa deliberadamente em aberto. Os valores abaixo são
// proposta de engenharia, grounded no texto, mas precisam de validação do dono
// do produto antes de virar régua definitiva — documentado aqui, não escondido
// no meio do agregador.
//
// O QUE SAIU DAQUI, E POR QUÊ (2026-08-28). Este arquivo carregava um segundo
// grupo com `AMOSTRA_MIN_APRENDIZES`, `AMOSTRA_MIN_EVIDENCIAS` e
// `TENDENCIA_MIN_PERIODOS` — cópias literais dos mesmos nomes e valores que já
// vivem em `../base.ts`, onde são de fato consumidos (`amostraSuficiente`,
// `tendenciaDisponivel`, `onde-trava.ts`). As daqui não tinham consumidor
// nenhum. Junto com elas saiu `MIN_EVIDENCIAS_EMERGENTE`, também sem consumidor.
//
// O risco não era hoje: era o próximo engenheiro editar a cópia morta para mexer
// no piso da §7, ver a suíte inteira verde, e concluir que mudou a régua. Piso
// de amostra tem UMA casa, e ela é `base.ts`.
// ---------------------------------------------------------------------------

/**
 * Quantas evidências de uma categoria (B ou C) bastam para essa categoria
 * "contar" na triangulação que leva a `demonstrated`. Abaixo disso, uma única
 * evidência isolada de aplicação não é suficiente prova.
 */
export const MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA = 2

/** Quantas evidências cognitivas (A) bastam para a categoria A "contar". */
export const MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA = 2
