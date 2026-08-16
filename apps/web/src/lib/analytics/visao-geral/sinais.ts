// ---------------------------------------------------------------------------
// §13 — "Sinais fora do padrão": comparação da pessoa com ELA MESMA.
// ---------------------------------------------------------------------------
// A base de comparação ser INTRAPESSOAL é o que estruturalmente impede este
// bloco de virar ranking (I-8): sem eixo entre pessoas não existe "melhor" nem
// "pior", existe "diferente do próprio hábito". Os outros quatro cuidados são
// reforço: a razão `ausência ÷ baseline` seleciona os 3 e NUNCA é renderizada
// (não há score visível, logo não há escala de comparação entre as linhas); os
// escolhidos são reordenados CRONOLOGICAMENTE antes de sair (a ordem que o
// gestor vê não é a ordem de gravidade); há reserva de slot para um sinal não
// negativo; e o vocabulário vem do conjunto da §2, sem "crítico"/"pior"/"risco
// alto".
//
// ESTATÍSTICA: mediana dos intervalos entre DIAS DISTINTOS, não média.
// Medido em produção: no tenant Cory a média dos intervalos é 13,7 dias e a
// mediana 7,5, com máximo de 114 — a distribuição é fortemente assimétrica à
// direita (intervalo tem piso de 1 dia e teto nenhum). A média ABSORVE
// exatamente o comportamento que queremos detectar: quem some por 60 dias infla
// a própria média e nunca dispara. A mediana é imune a isso.
//
// A unidade é o dia, não a sessão: seis sessões numa tarde são um estudo só,
// não cinco intervalos de zero hora.
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { diasDistintosOrdenados, diasUtcEntre } from "./dia-utc"
import { type FalhasPorFonte, primeiraFalha } from "./fonte"
import {
  BASELINE_K,
  BASELINE_MIN_INTERVALOS,
  BASELINE_MIN_JANELA_DIAS,
  BASELINE_PISO_DIAS,
  BASELINE_TETO_DIAS,
  MS_DIA,
  SINAIS_MAX,
} from "./parametros"
import { VAZIO_SEM_ESCOPO, VAZIO_SINAIS } from "./textos"
import type { BlocoSinais, ComEstado, SinalForaDoPadrao } from "./tipos"

const FONTES_DOS_SINAIS = ["roster", "sessoes", "reflexoes"] as const

/**
 * Mediana por interpolação linear sobre uma lista JÁ ORDENADA.
 *
 * [AUTO-DECISION] implementada aqui em vez de reusar `percentileSorted` de
 * `area-gestor.ts` (onde é privada ao módulo). Exportá-la de lá seria uma
 * mudança de uma palavra num arquivo compartilhado enquanto outro agente
 * trabalha na mesma árvore; para uma primitiva de seis linhas, o custo de
 * coordenação supera o de duplicar. Se um terceiro consumidor aparecer, a
 * decisão certa passa a ser extrair as duas para um módulo de estatística.
 */
export function medianaOrdenada(ordenados: readonly number[]): number | null {
  if (ordenados.length === 0) return null
  const posicao = (ordenados.length - 1) / 2
  const abaixo = Math.floor(posicao)
  const acima = Math.ceil(posicao)
  const a = ordenados[abaixo] ?? 0
  const b = ordenados[acima] ?? 0
  return a + (b - a) * (posicao - abaixo)
}

export interface PerfilDeRitmo {
  alunoId: string
  baselineDias: number
  ausenciaDias: number
  intervalos: number
}

/**
 * Perfil de hábito da pessoa. `null` quando não há histórico suficiente — que é
 * uma resposta legítima e FREQUENTE: medido em produção, dois terços do roster
 * do maior cliente real não têm hábito mensurável.
 */
export function perfilDeRitmo(carimbos: readonly number[], agoraMs: number): PerfilDeRitmo | null {
  const limite = agoraMs - BASELINE_TETO_DIAS * MS_DIA
  const dias = diasDistintosOrdenados(carimbos.filter((t) => t >= limite))
  if (dias.length < BASELINE_MIN_INTERVALOS + 1) return null

  const emMs = dias.map((d) => Date.parse(`${d}T00:00:00.000Z`))
  const primeiro = emMs[0] ?? agoraMs
  const ultimo = emMs[emMs.length - 1] ?? agoraMs
  if (diasUtcEntre(primeiro, ultimo) < BASELINE_MIN_JANELA_DIAS) return null

  const intervalos: number[] = []
  for (let i = 1; i < emMs.length; i++) {
    intervalos.push(diasUtcEntre(emMs[i - 1] ?? 0, emMs[i] ?? 0))
  }
  intervalos.sort((a, b) => a - b)
  const baseline = medianaOrdenada(intervalos)
  if (baseline === null) return null

  return {
    alunoId: "",
    // `max(baseline, 1)` protege a razão contra mediana 0/0,5 (impossível com o
    // dedupe de dia, mas custa nada e evita divisão degenerada).
    baselineDias: Math.max(baseline, 1),
    ausenciaDias: diasUtcEntre(ultimo, agoraMs),
    intervalos: intervalos.length,
  }
}

interface CandidatoSinal {
  sinal: Omit<SinalForaDoPadrao, "id">
  /** Só ORDENA a seleção. Nunca é renderizado — se aparecesse, seria um score. */
  razao: number
  /** Para a reordenação cronológica final. */
  ultimaAtividadeMs: number
  naoNegativo: boolean
}

export function montarSinais(base: BaseCalculo, falhas: FalhasPorFonte): ComEstado<BlocoSinais> {
  const moldura = { titulo: "Sinais fora do padrão", linkRodape: "Ver todos os sinais" }

  const falha = primeiraFalha(falhas, FONTES_DOS_SINAIS)
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

  const candidatos: CandidatoSinal[] = []
  let comBaseline = 0

  for (const id of base.roster) {
    const primeiroNome = (base.nomePorAluno.get(id) ?? "").split(/\s+/)[0] ?? ""
    const carimbos = base.carimbosPorAluno.get(id) ?? []
    const estado = base.estadoPorAluno.get(id)
    const ultima = base.ultimaAtividadeMsPorAluno.get(id) ?? 0

    // Nunca iniciou: a §13 lista este caso entre os exemplos, embora ele não
    // tenha baseline (não há "padrão próprio" de quem nunca começou).
    if (estado === "nao-iniciou") {
      candidatos.push({
        sinal: {
          alunoId: id,
          primeiroNome,
          texto: `${primeiroNome} ainda não iniciou a jornada.`,
          icone: "alert-circle",
          iconeTom: "amber",
        },
        razao: 1,
        ultimaAtividadeMs: 0,
        naoNegativo: false,
      })
      continue
    }

    const perfil = perfilDeRitmo(carimbos, base.agoraMs)
    if (perfil === null) continue
    comBaseline++

    // Sinal NÃO NEGATIVO: voltou depois de uma pausa bem maior que a própria.
    // Sem ele, o bloco só pode conter ausência, e um bloco que só contém
    // ausência é um bloco de denúncia.
    if (estado === "retomando") {
      candidatos.push({
        sinal: {
          alunoId: id,
          primeiroNome,
          texto: `${primeiroNome} voltou a estudar depois de uma pausa. Seu padrão habitual era a cada ${Math.round(perfil.baselineDias)} dias.`,
          icone: "undo-2",
          iconeTom: "green",
        },
        razao: 1,
        ultimaAtividadeMs: ultima,
        naoNegativo: true,
      })
      continue
    }

    const fora =
      perfil.ausenciaDias > BASELINE_K * perfil.baselineDias &&
      perfil.ausenciaDias >= BASELINE_PISO_DIAS &&
      perfil.ausenciaDias <= BASELINE_TETO_DIAS
    if (!fora) continue

    candidatos.push({
      sinal: {
        alunoId: id,
        primeiroNome,
        texto: `${primeiroNome} está há ${perfil.ausenciaDias} dias sem acessar. Seu padrão habitual era a cada ${Math.round(perfil.baselineDias)} dias.`,
        icone: "alert-triangle",
        iconeTom: "red",
      },
      razao: perfil.ausenciaDias / perfil.baselineDias,
      ultimaAtividadeMs: ultima,
      naoNegativo: false,
    })
  }

  if (candidatos.length === 0) {
    return {
      ...moldura,
      itens: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SINAIS,
      // Silêncio explicado ≠ silêncio: o gestor precisa saber que a ausência de
      // sinal vem de falta de histórico, não de time saudável.
      textoComplementar: `${comBaseline} de ${base.roster.size} ${base.roster.size === 1 ? "pessoa tem" : "pessoas têm"} histórico suficiente para comparação com o próprio ritmo.`,
      motivoVazio: comBaseline === 0 ? "sem-historico-suficiente" : "sem-sinais",
    }
  }

  const porRazao = [...candidatos].sort(
    (a, b) => b.razao - a.razao || a.sinal.alunoId.localeCompare(b.sinal.alunoId),
  )
  const escolhidos = porRazao.slice(0, SINAIS_MAX)
  if (!escolhidos.some((c) => c.naoNegativo)) {
    const positivo = porRazao.find((c) => c.naoNegativo)
    if (positivo && escolhidos.length === SINAIS_MAX) escolhidos[SINAIS_MAX - 1] = positivo
    else if (positivo) escolhidos.push(positivo)
  }

  // Reordenação CRONOLÓGICA: a ordem exibida não é a ordem de gravidade (I-8).
  const cronologicos = [...escolhidos].sort(
    (a, b) =>
      a.ultimaAtividadeMs - b.ultimaAtividadeMs || a.sinal.alunoId.localeCompare(b.sinal.alunoId),
  )

  return {
    ...moldura,
    itens: cronologicos.map((c, i) => ({ id: `S${i + 1}`, ...c.sinal })),
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
