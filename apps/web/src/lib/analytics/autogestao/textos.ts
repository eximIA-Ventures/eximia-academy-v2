// ---------------------------------------------------------------------------
// Textos literais da Autogestão — §9, §31 (estados vazios) e rótulos fixos.
// ---------------------------------------------------------------------------
// Regra dura desta tela (spec §2 Regra 2): NUNCA linguagem de julgamento —
// proibido ranking, nota de performance, "bom aluno"/"mau aluno", comparação
// competitiva, mensagem punitiva. E a regra transversal §18: NUNCA afirmar
// causalidade — "nas semanas em que", "observamos que", "há associação",
// jamais "isso causa" ou "você aprende melhor porque". Todo texto GERADO
// (não literal da spec) que descreve um padrão passa por este vocabulário, não
// por concatenação livre em `montagem.ts` — é a mesma defesa estrutural que o
// analytics do gestor aplica em `_comum/texto.ts`.
// ---------------------------------------------------------------------------

import type { MotivoAusencia } from "./tipos"

// --- §9 Mensagem-síntese (Tela 1) -------------------------------------------

/** §9 — literal, "Situação positiva". */
export const SINTESE_NO_RITMO =
  "Você está acompanhando seu plano. Continue mantendo a consistência."

/**
 * NÃO está na §9 — proposto. A spec lista só 3 exemplos (positiva/desaceleração/
 * retomada) para os 4 estados do widget de ritmo (§8.1: Adiantado/No ritmo/
 * Abaixo do ritmo/Retomando). O contrato 1.8 exige as "4 mensagens distintas",
 * então "Adiantado" precisa da própria frase — reaproveitar a de "No ritmo"
 * apagaria a distinção que o próprio widget de ritmo declara existir.
 */
export const SINTESE_ADIANTADO =
  "Você está adiantado em relação ao seu plano. Continue no seu ritmo."

/** §9 — literal, "Desaceleração". */
export const SINTESE_ABAIXO_DO_RITMO =
  "Seu ritmo caiu nesta semana, mas ainda há tempo para recuperar o combinado."

/** §9 — literal, "Retomada". */
export const SINTESE_RETOMANDO =
  "Você retomou sua jornada. O próximo passo é transformar essa retomada em regularidade."

// --- §8/§9/§12/§14 "Sem plano" é ESTADO PRÓPRIO, não degradação -----------------
// Achado convergente do painel (Norman/Kolb/Bush/Duke, 2026-08-22): para 98%
// dos alunos (5 planos ativos para 302 matrículas), a tela antes afirmava
// conformidade a um plano que nunca existiu ("No ritmo", "Você está
// acompanhando seu plano..."). Estes literais substituem essa afirmação pelo
// convite honesto a criar a referência — nunca um número inventado, nunca
// silêncio sobre a ausência.

/** NÃO está na spec — proposto (§8.1, estado "sem plano"). Nem verde nem
 * alarme: sem plano não há contra o que medir o ritmo. */
export const ROTULO_RITMO_SEM_PLANO = "Sem referência"

/** NÃO está na spec — proposto (§9, estado "sem plano"). Substitui a afirmação
 * de conformidade a um plano inexistente pelo convite a definir a referência. */
export const SINTESE_SEM_PLANO =
  "Você ainda não tem uma referência de plano definida. Defini-la é o seu próximo passo."

/** NÃO está na spec — proposto (§12, estado "sem plano"). Substitui a
 * referência a "voltar ao ritmo do seu plano" (que não existe) pelo convite a
 * criá-lo. */
export const TITULO_PROXIMO_MOVIMENTO_SEM_PLANO = "Defina seu plano de estudos"
export const TEXTO_PROXIMO_MOVIMENTO_SEM_PLANO =
  "Um plano de estudos vira sua referência de ritmo e progresso."

/** NÃO está na spec — proposto (§14, estado "sem plano"). Os "Sinais do meu
 * momento" são o único bloco que computa sem plano (comportamento puro); este
 * convite os transforma em matéria-prima do plano, não em consolo de rodapé. */
export const CONVITE_SINAIS_PARA_PLANO = "Use esses sinais para montar seu ritmo."
export const CTA_MONTAR_MEU_PLANO = "Montar meu plano"

/** NÃO está na spec — proposto. "Falta prova" (SEM LASTRO) ganha saída: um
 * link que resolve, ao lado do motivo real (nunca substitui o motivo). */
export const CTA_DEFINIR_AGORA = "Definir agora"

// --- §31 Estados vazios -------------------------------------------------------

/** §31 — literal, "Sem plano individual". */
export const VAZIO_SEM_PLANO =
  "Você ainda não definiu seu plano. Crie uma referência para acompanhar seu próprio ritmo."
export const CTA_CRIAR_PLANO = "Criar meu plano"

/** §31 — literal, "Pouco histórico". */
export const VAZIO_POUCO_HISTORICO =
  "Ainda precisamos de mais algumas semanas de atividade para identificar seus padrões."

/** §31 — literal, "Nenhuma interrupção". */
export const VAZIO_NENHUMA_INTERRUPCAO =
  "Nenhuma interrupção relevante foi identificada neste período."

/** §31 — "Jornada concluída": os dois CTAs literais que substituem o próximo movimento. */
export const CTA_FECHAR_JORNADA = "Fechar minha jornada"
export const CTA_REVISAR_EVOLUCAO = "Revisar minha evolução"

/** NÃO está na spec — proposto, mesma convenção do analytics do gestor. */
export const VAZIO_SEM_JORNADA_INICIADA =
  "Você ainda não começou sua jornada. Assim que iniciar, seus indicadores aparecem aqui."

/** NÃO está na spec — proposto (Tela 2, quando a série não tem NENHUM ponto ativo). */
export const VAZIO_SEM_SINAIS_DO_MOMENTO = "Ainda não há sinais suficientes sobre o seu momento."

/** NÃO está na spec — proposto (Tela 1, §11). */
export const VAZIO_SEM_ATENCAO = "Nada precisa da sua atenção agora."

/** NÃO está na spec — proposto (§13, quando o plano nunca foi ajustado). */
export const VAZIO_SEM_AJUSTE = "Você ainda não fez nenhum ajuste no seu plano."

/** NÃO está na spec — proposto (Tela 1, §10). */
export const VAZIO_SEM_MUDANCAS = "Nada mudou de relevante desde o período anterior."

/** NÃO está na spec — proposto (Tela 2, §18). */
export const VAZIO_SEM_FAVORECE =
  "Ainda não há padrão suficiente para apontar o que favorece seu ritmo."

/** O que a tela diz quando a consulta falha — NUNCA um numeral no bloco. */
export const ERRO_LEITURA = "Não foi possível carregar este bloco agora."

export function textoDoMotivo(motivo: MotivoAusencia): string {
  switch (motivo) {
    case "sem-plano":
      return VAZIO_SEM_PLANO
    case "sem-jornada-iniciada":
      return VAZIO_SEM_JORNADA_INICIADA
    case "sem-ajuste":
      return VAZIO_SEM_AJUSTE
    case "sem-periodo-anterior":
    case "sem-historico-comparavel":
      return VAZIO_POUCO_HISTORICO
    case "sem-sessao-aberta":
    case "sem-atencao":
      return VAZIO_SEM_ATENCAO
    case "sem-mudancas":
      return VAZIO_SEM_MUDANCAS
    case "sem-sinais":
      return VAZIO_SEM_SINAIS_DO_MOMENTO
    case "sem-historico-suficiente":
      return VAZIO_POUCO_HISTORICO
    case "sem-interrupcao":
      return VAZIO_NENHUMA_INTERRUPCAO
    case "jornada-concluida":
      return CTA_REVISAR_EVOLUCAO
    case "falha-de-leitura":
      return ERRO_LEITURA
  }
}

// --- §13 Resposta aos meus últimos ajustes ------------------------------------

/** §13 — literal, obrigatório, renderizado (nunca tooltip). */
export const DISCLAIMER_CAUSALIDADE =
  "Resultado observado após seu ajuste. Não representa relação causal comprovada."

// --- §2 / §32 Ações de agência -------------------------------------------------

export const CTA_RETOMAR_MEU_PLANO = "Retomar meu plano"
export const CTA_AJUSTAR_MEU_PLANO = "Ajustar meu plano"
export const CTA_RETOMAR_AGORA = "Retomar agora"
export const CTA_VER_REFLEXOES = "Ver reflexões"
export const CTA_PLANEJAR_SEMANA = "Planejar semana"
export const CTA_RETOMAR_SESSAO = "Retomar sessão"
export const CTA_CONTINUAR_MODULO = "Continuar módulo"
export const CTA_VER_CONTEUDO = "Ver conteúdo"
export const CTA_VER_MEU_PLANO = "Ver meu plano"
export const CTA_AJUSTAR_PRAZO = "Ajustar prazo"
export const CTA_FAZER_NOVO_AJUSTE = "Fazer novo ajuste"

// --- Rótulos fixos ---------------------------------------------------------

/** Travessão U+2014. Nunca "0 dias", nunca string vazia. */
export const TRAVESSAO = "—"

/** "hoje" / "1 dia atrás" / "N dias atrás" / "—". Ausência é o travessão, jamais "0 dias atrás". */
export function rotuloUltimaAtividade(dias: number | null): string {
  if (dias === null) return TRAVESSAO
  if (dias <= 0) return "hoje"
  if (dias === 1) return "1 dia atrás"
  return `${dias} dias atrás`
}

/** Vocabulário de apoio (§2 Regra 2), nunca de cobrança. */
export const ROTULO_RITMO: Record<string, string> = {
  adiantado: "Adiantado",
  "no-ritmo": "No ritmo",
  "abaixo-do-ritmo": "Abaixo do ritmo",
  retomando: "Retomando",
}

export const ROTULO_TENDENCIA: Record<string, string> = {
  sustentando: "Sustentando",
  desacelerando: "Desacelerando",
  retomando: "Retomando",
  "sem-padrao-suficiente": "Sem padrão suficiente",
}

export const ROTULO_STATUS_MODULO: Record<string, string> = {
  concluido: "Concluído",
  "em-andamento": "Em andamento",
  "nao-iniciado": "Não iniciado",
}

// --- Motivos de SEM LASTRO (usados por `montagem.ts` em `semLastro(...)`) ----

export const MOTIVO_SEM_META_FREQUENCIA =
  "não existe meta de frequência semanal definida no seu plano"
export const MOTIVO_SEM_META_REFLEXOES = "não existe meta de reflexões definida no seu plano"
export const MOTIVO_PLANO_AUSENTE = "você ainda não tem um plano individual"
export const MOTIVO_PLANO_SEM_DURACAO = "os módulos do seu plano ainda não têm duração definida"

/** Mapa de calor de atividade — abaixo de `MAPA_DE_CALOR_MIN_ATIVIDADES`. */
export const MOTIVO_MAPA_DE_CALOR_POUCA_ATIVIDADE =
  "você ainda tem poucos registros de atividade para revelar um padrão de dias e horários"

// --- Vocabulário sem julgamento e sem causalidade (§2 e §18) ------------------

/** A PALAVRA que concorda com `n`. Nunca a contagem sozinha. */
export function pluralDe(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

/** "1 sessão" · "3 sessões". */
export function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${pluralDe(n, singular, plural)}`
}

/** Prefixos autorizados para prosa de associação — nunca causal (§18). */
export function fraseAssociacao(
  prefixo: "nas-semanas" | "observamos" | "ha-associacao",
  corpo: string,
): string {
  switch (prefixo) {
    case "nas-semanas":
      return `Nas semanas em que ${corpo}`
    case "observamos":
      return `Observamos que ${corpo}`
    case "ha-associacao":
      return `Há associação entre ${corpo}`
  }
}
