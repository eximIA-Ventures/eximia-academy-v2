// ---------------------------------------------------------------------------
// §9 — "O que mudou": no máximo 3 sinais, e só os relevantes.
// ---------------------------------------------------------------------------
// A spec diz "não mostrar pequenas variações irrelevantes" e não fixa o número.
// O limiar aqui é DUPLO (relativo E absoluto) porque base pequena é a norma
// nesta plataforma: medido em produção, o maior cliente real deu "−21% de
// sessões", que são QUATRO sessões. Percentual sozinho, em base pequena, é
// gerador de alarme falso — e alarme falso gasta exatamente a atenção que esta
// tela existe para economizar.
//
// DUAS ESCOLHAS DE ORDENAÇÃO que não são cosméticas:
//
//   • Ordena por PESSOAS afetadas, não por magnitude percentual. A §37 diz que
//     o arco da tela é Estado → Prioridade → Ação, e ação se toma sobre gente.
//     "Sessões −40%" perde para "3 pessoas pararam".
//
//   • Há RESERVA DE SLOT para um sinal não negativo. Sem ela o bloco converge
//     para três linhas ruins toda semana (na base real: 24 perdas contra 3
//     retomadas), e "O que mudou" vira boletim de más notícias — a leitura de
//     vigilância que a §2 Regra 2 proíbe.
// ---------------------------------------------------------------------------

import { SEM_ACESSO_DAYS } from "@/lib/student-triage"
import type { BaseCalculo } from "./base"
import { diasUtcEntre } from "./dia-utc"
import { type FalhasPorFonte, primeiraFalha } from "./fonte"
import {
  MUDANCAS_MAX,
  RELEVANCIA_ABS_PESSOAS,
  RELEVANCIA_ABS_RETOMADA,
  RELEVANCIA_ABS_SESSOES,
  RELEVANCIA_BASE_MIN,
  RELEVANCIA_REL,
} from "./parametros"
import { VAZIO_SEM_ESCOPO, VAZIO_TENDENCIA } from "./textos"
import type { BlocoMudancas, ComEstado, ItemMudanca } from "./tipos"

const FONTES_DAS_MUDANCAS = ["roster", "sessoes", "reflexoes"] as const

interface Candidato {
  item: Omit<ItemMudanca, "ordem">
  pessoas: number
  magnitudeRelativa: number
  ordemDoTipo: number
  positivo: boolean
}

/**
 * Quem estava com estado classificável no corte anterior, estava ativo lá, e
 * deixou de estar agora.
 *
 * A cláusula "tinha carimbo antes do corte" não é detalhe: sem ela, uma coorte
 * que acabou de ser matriculada aparece inteira como "perdeu ritmo". Medido no
 * tenant de demonstração, eram 51 pessoas nessa condição.
 */
function perderamRitmo(base: BaseCalculo): number {
  const corte = base.janelas.atualInicio
  let total = 0
  for (const id of base.roster) {
    const carimbos = base.carimbosPorAluno.get(id) ?? []
    const anteriores = carimbos.filter((t) => t < corte)
    if (anteriores.length === 0) continue // sem estado classificável antes
    const estavaAtivo = diasUtcEntre(Math.max(...anteriores), corte) <= SEM_ACESSO_DAYS
    if (!estavaAtivo) continue
    const dias = base.diasSemAtividadePorAluno.get(id) ?? null
    if (dias !== null && dias > SEM_ACESSO_DAYS) total++
  }
  return total
}

export function montarMudancas(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
): ComEstado<BlocoMudancas> {
  const moldura = { titulo: "O que mudou", linkRodape: "Ver detalhes" }

  const falha = primeiraFalha(falhas, FONTES_DAS_MUDANCAS)
  if (falha) {
    return {
      ...moldura,
      itens: [],
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.roster.size === 0) {
    return {
      ...moldura,
      itens: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  const candidatos: Candidato[] = []

  // --- tipo 1: variação de sessões ---------------------------------------
  const atual = base.sessoesNoPeriodo
  const anterior = base.sessoesNoPeriodoAnterior
  if (anterior >= RELEVANCIA_BASE_MIN) {
    const diferenca = atual - anterior
    const relativo = diferenca / anterior
    if (Math.abs(relativo) >= RELEVANCIA_REL && Math.abs(diferenca) >= RELEVANCIA_ABS_SESSOES) {
      const pct = Math.abs(Math.round(relativo * 100))
      const caiu = diferenca < 0
      candidatos.push({
        item: {
          id: "sessoes",
          texto: `Sessões ${caiu ? "caíram" : "subiram"} ${pct}% em relação ao período anterior.`,
          marcadorTom: caiu ? "red" : "green",
          marcadorGlifo: caiu ? "arrow-down" : "arrow-up",
        },
        // Proxy honesto de "quantas pessoas isso representa": a variação de
        // pessoas ativas, nunca a de sessões (uma pessoa faz N sessões).
        pessoas: Math.abs(base.ativosNoPeriodo.size - base.ativosNoPeriodoAnterior.size),
        magnitudeRelativa: Math.abs(relativo),
        ordemDoTipo: 2,
        positivo: !caiu,
      })
    }
  }

  // --- tipo 2: pessoas que perderam ritmo --------------------------------
  const perderam = perderamRitmo(base)
  if (perderam >= RELEVANCIA_ABS_PESSOAS) {
    candidatos.push({
      item: {
        id: "perderam-ritmo",
        texto: `${perderam} ${perderam === 1 ? "pessoa perdeu" : "pessoas perderam"} ritmo em relação ao período anterior.`,
        marcadorTom: "amber",
        marcadorGlifo: "alert-triangle",
      },
      pessoas: perderam,
      magnitudeRelativa: base.roster.size > 0 ? perderam / base.roster.size : 0,
      ordemDoTipo: 1,
      positivo: false,
    })
  }

  // --- tipo 3: pessoas que retomaram --------------------------------------
  const retomaram = [...base.estadoPorAluno.values()].filter((e) => e === "retomando").length
  if (retomaram >= RELEVANCIA_ABS_RETOMADA) {
    const ativos = base.ativosNoPeriodo.size
    // O denominador vai no texto DE PROPÓSITO. "5 pessoas retomaram" num
    // período em que só 5 estiveram ativas comunica vitalidade que não existe;
    // o bloco mentiria por omissão.
    candidatos.push({
      item: {
        id: "retomaram",
        texto: `${retomaram} de ${ativos} ${ativos === 1 ? "pessoa ativa retomou" : "pessoas ativas retomaram"} a jornada após uma pausa.`,
        marcadorTom: "green",
        marcadorGlifo: "check",
      },
      pessoas: retomaram,
      magnitudeRelativa: ativos > 0 ? retomaram / ativos : 0,
      ordemDoTipo: 3,
      positivo: true,
    })
  }

  if (candidatos.length === 0) {
    return {
      ...moldura,
      itens: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_TENDENCIA,
      motivoVazio: "sem-periodo-anterior",
    }
  }

  const ordenados = [...candidatos].sort(
    (a, b) =>
      b.pessoas - a.pessoas ||
      b.magnitudeRelativa - a.magnitudeRelativa ||
      a.ordemDoTipo - b.ordemDoTipo,
  )

  const escolhidos = ordenados.slice(0, MUDANCAS_MAX)
  // Reserva de slot: se sobrou um sinal positivo de fora, ele toma o último
  // lugar mesmo tendo perdido na ordenação.
  if (!escolhidos.some((c) => c.positivo)) {
    const positivo = ordenados.find((c) => c.positivo)
    if (positivo && escolhidos.length === MUDANCAS_MAX) escolhidos[MUDANCAS_MAX - 1] = positivo
    else if (positivo) escolhidos.push(positivo)
  }

  return {
    ...moldura,
    itens: escolhidos.map((c, i) => ({ ...c.item, ordem: i + 1 })),
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
