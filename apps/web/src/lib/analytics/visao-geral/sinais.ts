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

import {
  FATO_ESTADO,
  FATO_RITMO_PROPRIO,
  type Fato,
  fatosDaTabelaDeAtencao,
  registrarFatos,
  todosJaDitos,
} from "../_comum/fatos"
import { contagem, pluralDe } from "../_comum/texto"
import { montarAtencao } from "./atencao"
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
import { VAZIO_SEM_ESCOPO, VAZIO_SEM_HISTORICO, VAZIO_SINAIS } from "./textos"
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
  /**
   * D-5 · o que esta frase AFIRMA. É a moeda da supressão de redundância entre
   * cards (`_comum/fatos.ts`): a frase só cala se TODOS os fatos dela já
   * estiverem ditos em outro lugar da mesma tela.
   */
  fatos: readonly Fato[]
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
        // ÚNICO fato: o estado. Não há ritmo próprio de quem nunca começou —
        // e é por isso que esta é a frase que a tabela de atenção absorve.
        fatos: [{ sujeito: id, chave: `${FATO_ESTADO}:nao-iniciou` }],
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
        fatos: [
          { sujeito: id, chave: `${FATO_ESTADO}:retomando` },
          // O ritmo habitual DELA não é publicado por nenhum outro card.
          { sujeito: id, chave: FATO_RITMO_PROPRIO },
        ],
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
      // A tabela de atenção diz o estado e os dias; ela NÃO diz que 97 dias são
      // 14× o hábito desta pessoa. É o fato novo que segura a frase em cena.
      fatos: [
        { sujeito: id, chave: `${FATO_ESTADO}:${estado ?? "desconhecido"}` },
        { sujeito: id, chave: FATO_RITMO_PROPRIO },
      ],
    })
  }

  // ═══ D-5 · supressão de redundância ENTRE CARDS ═════════════════════════
  // Pergunta ao bloco vizinho o que ele já disse, em vez de reproduzir aqui o
  // critério de seleção dele. Detalhe do mecanismo e do trade-off (montar o
  // bloco de atenção uma segunda vez) em `_comum/fatos.ts`.
  const jaDitos = registrarFatos(
    fatosDaTabelaDeAtencao(montarAtencao(base, falhas), base.estadoPorAluno),
  )
  const visiveis = candidatos.filter((c) => !todosJaDitos(c.fatos, jaDitos))
  const suprimidos = candidatos.length - visiveis.length

  /**
   * §32 com silêncio EXPLICADO — e agora com três silêncios diferentes.
   *
   * "Nenhum sinal" pode significar (a) time estável, (b) recorte sem hábito
   * mensurável, ou (c) tudo que havia a dizer já está na tabela acima. As três
   * mandam o gestor fazer coisas diferentes, e a terceira nasceu com a
   * supressão: sem esta frase, o card ficaria mudo logo depois de calar por
   * boa razão, e mudez lê-se como "não há nada acontecendo".
   */
  if (visiveis.length === 0) {
    const soSobrouRepeticao = suprimidos > 0
    const motivo =
      !soSobrouRepeticao && comBaseline === 0 ? "sem-historico-suficiente" : "sem-sinais"
    return {
      ...moldura,
      itens: [],
      estado: "vazio",
      textoVazio: motivo === "sem-historico-suficiente" ? VAZIO_SEM_HISTORICO : VAZIO_SINAIS,
      erro: null,
      textoComplementar:
        suprimidos > 0
          ? `${contagem(suprimidos, "pessoa deste recorte já aparece", "pessoas deste recorte já aparecem")} na lista acima; o bloco não repete o que a tabela já diz.`
          : textoDeCobertura(comBaseline, base.roster.size),
      motivoVazio: motivo,
    }
  }

  const porRazao = [...visiveis].sort(
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
    // SILÊNCIO PARCIAL também é silêncio (mesmo desenho de §18, na aba
    // vizinha): quando o bloco fala MENOS do que caberia, o espaço que sobra
    // lê-se como "não há mais nada" — e pode ser, ao contrário, que boa parte
    // do recorte não tenha hábito mensurável. Com o bloco cheio o complemento
    // some: aí o corte é do teto, não da base, e a frase enganaria.
    textoComplementar:
      cronologicos.length < SINAIS_MAX && comBaseline < base.roster.size
        ? textoDeCobertura(comBaseline, base.roster.size)
        : null,
    motivoVazio: null,
  }
}

/**
 * O DENOMINADOR da verificação, renderizado (I-2).
 *
 * Instrumento que declara sobre quantos comparou é o antídoto direto ao padrão
 * dos instrumentos mentirosos desta casa. Com 6 pessoas, saber que só 3 tinham
 * base comparável muda a confiança do gestor em tudo que está acima.
 *
 * ═══ A CONCORDÂNCIA TEM DOIS EIXOS, E CONFUNDI-LOS FOI DEFEITO DUAS VEZES ═══
 * O SUBSTANTIVO concorda com o TOTAL ("de 1 pessoa" / "de 6 pessoas") — é o
 * conjunto de onde se conta. O VERBO concorda com o NUMERADOR ("1 ... tem" /
 * "3 ... têm") — é o sujeito da oração.
 *
 * A versão original amarrava os dois ao total e emitia "1 de 6 pessoas têm".
 * A primeira correção amarrou os dois ao numerador e passou a emitir "0 de 1
 * pessoas têm" — o detector de D-4 pegou isso na mesma rodada, num recorte de
 * uma pessoa. Trocar um plural fixo por outro plural fixo não é correção.
 */
function textoDeCobertura(comBaseline: number, total: number): string {
  const substantivo = pluralDe(total, "pessoa", "pessoas")
  const verbo = comBaseline <= 1 ? "tem" : "têm"
  return `${comBaseline} de ${total} ${substantivo} ${verbo} histórico suficiente para comparação com o próprio ritmo.`
}
