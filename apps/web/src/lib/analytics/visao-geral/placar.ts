// ---------------------------------------------------------------------------
// §8 — Placar da jornada: os 5 indicadores e a variação em pontos percentuais.
// ---------------------------------------------------------------------------
// Os cinco números e os DOIS lados de cada delta saem da MESMA `BaseCalculo`.
// Não existe segunda consulta para o período anterior, e é isso que faz I-5
// valer por construção: o denominador entra uma vez e as duas janelas derivam
// de uma só duração.
//
// TRÊS DECISÕES QUE MUDAM O NÚMERO, e ficam escritas aqui porque quem ler o
// código depois vai querer saber por que não é o óbvio:
//
//   1. "Ativo" é ATIVIDADE no período, não "sessão criada no período". A §8.1
//      diz "sessão iniciada", mas a sessão socrática é REUSADA e cada turno de
//      chat mexe só em `updated_at` (caso Rinaldo, documentado em
//      `last-activity.ts`). A leitura literal marca como ausente quem estudou
//      hoje numa sessão aberta há 40 dias. Medido no tenant Cory: literal dá 2
//      pessoas (4%), atividade dá 4 (9%) — dois números para a mesma pergunta.
//
//   2. "No ritmo" tem denominador PRÓPRIO: quem tem matrícula ativa em curso
//      COM prazo. Metade dos cursos em produção não tem `deadline_days`. Jogar
//      esse pessoal no denominador conta "indecidível" como "atrasado"; jogá-lo
//      no numerador infla o indicador em ~37 pontos. Só a base explícita não
//      mente, e por isso o card carrega `baseDenominador`.
//
//   3. "No ritmo" NÃO TEM DELTA, e isso não é omissão. `enrollments.progress`
//      é JSONB mutável sem histórico, não há snapshot, e "recomeçar curso"
//      (`courses/actions.ts`) ZERA o progresso e apaga tentativas — o passado é
//      reescrito, não só indisponível. Qualquer seta aqui seria fabricada. Sai
//      `deltaPp: null` com o texto da §32 no lugar.
//
// TRÊS RÓTULOS QUE ESCONDIAM A PRÓPRIA RÉGUA (corrigidos em 2026-08-17, com a
// tela do dono aberta). Nenhum dos três era erro de cálculo — os números estavam
// certos e ilegíveis, que na prática é a mesma coisa:
//
//   a. "Sem acesso" divide por `iniciados` (§8.5: "não incluir quem nunca
//      iniciou"), enquanto o card ao lado publica a base do recorte inteiro.
//      Com 6 no recorte e 5 iniciados, o gestor divide 1 por 6, dá 17%, lê 20%
//      e conclui que a tela tem bug. Passa a `mostrarAbsoluto`, como "Ativos no
//      período" já fazia: o denominador vira parte do valor, não folclore.
//   b. "No ritmo" e "Sem acesso" NÃO VARIAM com o filtro de período — medido
//      idêntico em 7, 30 e 90 dias. É legítimo (são estados de HOJE, não fluxos
//      da janela), mas eles ficam embaixo de um controle que não os governa, e
//      número que ignora o filtro ao lado lê-se como defeito. Vai para
//      `notaRodape`, renderizada.
//   c. "Regularidade 0%" é verdade medida (no tenant inteiro, 51 pessoas,
//      existem 3 semanas-pessoa com 2+ dias distintos, e ninguém tem duas
//      delas) e é indistinguível de defeito enquanto a régua não estiver
//      escrita. Passa a publicar a base (`mostrarAbsoluto`) e o critério
//      (`notaRodape`).
//
// A nota é TEXTO RENDERIZADO, nunca `title` (I-2). Régua que só existe no hover
// é régua que ninguém encontra — o mesmo motivo pelo qual a §12 exige a ressalva
// de causalidade visível.
//
// O QUE O DELTA MEDE, E O QUE O NÍVEL MEDE (escrito em 2026-08-19, depois de o
// conflito subir ao dono como "o denominador se move quando só o passado muda"):
//
//   • O DELTA nunca mede crescimento de matrícula. `montarMetrica` divide os
//     dois lados pelo MESMO `e.base` — existe um `percentual(_, e.base)` para o
//     atual e outro para o anterior, e nenhum caminho de código recalcula a base
//     por janela. Espelhar o comportamento da janela atual na anterior dá delta
//     ZERO em todas as métricas, medido em 7d, 30d e 90d
//     (`__tests__/i-5-comparacao-mesmo-universo.test.ts`). É I-5 valendo por
//     construção, não por disciplina.
//
//   • O NÍVEL, esse SIM se move quando alguém novo inicia a jornada, e sem
//     ninguém ter parado: "2 de 5 · 40%" vira "2 de 6 · 33%". Não é defeito, é
//     a §8.2 e a §8.5 mandando dividir por "quem já iniciou" — quem começou há
//     40 dias e sumiu ENTRA nesse denominador com razão, porque hoje ele é uma
//     das pessoas que iniciaram e estão paradas. Trocar essa base exigiria
//     mudar a §8, que é do dono. O `mostrarAbsoluto` existe exatamente para esse
//     movimento ser legível: o gestor vê o denominador mudar de 5 para 6 em vez
//     de ver só a taxa cair de 40% para 33% sem explicação.
// ---------------------------------------------------------------------------

import { SEM_ACESSO_DAYS } from "@/lib/student-triage"
import { type BaseCalculo, ehRegular } from "./base"
import { type FalhasPorFonte, primeiraFalha } from "./fonte"
import { REGULARIDADE_MIN_DIAS_NA_SEMANA } from "./parametros"
import { TRAVESSAO, VAZIO_NINGUEM_INICIOU, VAZIO_SEM_ESCOPO, VAZIO_SEM_PRAZO } from "./textos"
import type { BlocoPlacar, ComEstado, MetricaPlacar, MotivoAusencia, Tom } from "./tipos"

const FONTES_DO_PLACAR = [
  "roster",
  "sessoes",
  "reflexoes",
  "matriculas",
  "cursos",
  "participacao",
] as const

function percentual(numerador: number, denominador: number): number | null {
  return denominador > 0 ? Math.round((numerador / denominador) * 100) : null
}

interface EntradaMetrica {
  id: string
  rotulo: string
  icone: string
  iconeTom: Tom
  numeradorAtual: number
  /** null quando a comparação não é computável (não quando ela deu zero). */
  numeradorAnterior: number | null
  base: number
  /** true só para "Sem acesso": subir é ruim. A COR vem daqui (C-17). */
  tomInvertido: boolean
  /** Quando `true`, o valor principal traz "N de M · P%". */
  mostrarAbsoluto: boolean
  motivoSemDelta: MotivoAusencia
  textoSemBase: string
}

function montarMetrica(e: EntradaMetrica): MetricaPlacar {
  const atual = percentual(e.numeradorAtual, e.base)

  // Sem base não existe percentual. `0%` aqui seria uma afirmação sobre a
  // equipe a partir de um denominador que não existe (I-3).
  if (atual === null) {
    return {
      id: e.id,
      rotulo: e.rotulo,
      icone: e.icone,
      iconeTom: e.iconeTom,
      valorPrincipal: TRAVESSAO,
      valorAbsoluto: null,
      numerador: 0,
      baseDenominador: 0,
      deltaPp: null,
      deltaDirecao: null,
      deltaTom: null,
      deltaLabel: null,
      deltaAusenteMotivo: "sem-base",
      semBase: true,
      textoVazio: e.textoSemBase,
    }
  }

  const anterior = e.numeradorAnterior === null ? null : percentual(e.numeradorAnterior, e.base)

  // FIXTURE §4.1: o delta é `exibido − exibido_anterior`, sobre os INTEIROS já
  // arredondados. Arredondar uma vez de cada lado mantém a aritmética da tela
  // reconciliável por quem lê; arredondar a diferença, não.
  const delta = anterior === null ? null : atual - anterior
  const absoluto = `${e.numeradorAtual} de ${e.base}`

  return {
    id: e.id,
    rotulo: e.rotulo,
    icone: e.icone,
    iconeTom: e.iconeTom,
    valorPrincipal: e.mostrarAbsoluto ? `${absoluto} · ${atual}%` : `${atual}%`,
    valorAbsoluto: e.mostrarAbsoluto ? absoluto : null,
    numerador: e.numeradorAtual,
    baseDenominador: e.base,
    deltaPp: delta === null ? null : Math.abs(delta),
    deltaDirecao: delta === null || delta === 0 ? null : delta > 0 ? "up" : "down",
    deltaTom:
      delta === null || delta === 0 ? null : delta > 0 !== e.tomInvertido ? "positivo" : "negativo",
    deltaLabel:
      delta === null
        ? null
        : delta === 0
          ? "0 pp"
          : `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)} pp`,
    deltaAusenteMotivo: delta === null ? e.motivoSemDelta : null,
    semBase: false,
    textoVazio: null,
  }
}

/**
 * A régua dos indicadores cujo rótulo sozinho a esconde (itens b e c do
 * cabeçalho). Derivada do PARÂMETRO, nunca de um "2" digitado à mão: se alguém
 * reafinar `REGULARIDADE_MIN_DIAS_NA_SEMANA`, a frase acompanha, e não fica uma
 * tela dizendo 2 enquanto o cálculo usa 3.
 *
 * "na maioria das semanas" não é enfeite: `ehRegular` exige o mínimo de dias em
 * pelo menos metade das semanas cheias da janela, e omitir isso deixaria a nota
 * mais frouxa que o código que ela descreve.
 */
export const NOTA_REGUAS_PLACAR = `Regularidade: ${REGULARIDADE_MIN_DIAS_NA_SEMANA} dias distintos na mesma semana, na maioria das semanas. No ritmo e Sem acesso são a situação de hoje, não do período.`

export function montarPlacar(base: BaseCalculo, falhas: FalhasPorFonte): ComEstado<BlocoPlacar> {
  const moldura = { titulo: "Placar da jornada", subtitulo: null }

  const falha = primeiraFalha(falhas, FONTES_DO_PLACAR)
  if (falha) {
    return {
      ...moldura,
      metricas: [],
      notaRodape: null,
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }

  if (base.roster.size === 0) {
    return {
      ...moldura,
      metricas: [],
      notaRodape: null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  const totalRoster = base.roster.size
  const totalIniciados = base.iniciados.length

  // §8.3: numerador = avaliáveis − atrasados − concluídos. Quem terminou não
  // está "no ritmo", está fora da corrida.
  const noRitmo = [...base.avaliaveis].filter(
    (id) => !base.atrasados.has(id) && !base.concluidos.has(id),
  ).length

  // §8.5 retrospectiva: "sem acesso em T" reconstruído só com carimbos
  // ANTERIORES a T, para um bump posterior não vazar para dentro do passado.
  //
  // VIÉS CONHECIDO E ACEITO: `updated_at` é mutável e guarda só o último bump,
  // então a reconstrução SUBESTIMA a atividade passada e superestima "sem
  // acesso" no período anterior — o delta fica enviesado na direção de mostrar
  // melhora. Usar `created_at` (imutável) só do lado anterior corrigiria o
  // viés e criaria coisa pior: MÉTODO DIFERENTE nos dois lados, violação direta
  // de I-5. Método idêntico com viés documentado é o menos ruim dos dois.
  //
  // SEGUNDA FACE DO MESMO VIÉS (levantada em 2026-08-19, deixada como está de
  // propósito): `base.iniciados` é o conjunto de HOJE, e é ele que roda nos dois
  // lados. Então quem começou há 10 dias é contado, na retrospectiva de t−30,
  // como "iniciou e não acessa" — porque naquela data não tinha carimbo nenhum.
  // Isso infla o lado anterior e enviesa o delta na direção de mostrar melhora.
  // Corrigir exigiria reconstruir "quem já tinha iniciado em t−30", ou seja, um
  // universo por janela: a violação literal de I-5, e o defeito que a tela
  // inteira existe para não repetir. Fica o viés, escrito.
  const semAcessoEm = (referenciaMs: number): number =>
    base.iniciados.filter((id) => {
      if (base.concluidos.has(id)) return false
      const anteriores = (base.carimbosPorAluno.get(id) ?? []).filter((t) => t < referenciaMs)
      if (anteriores.length === 0) return true
      const dias = Math.floor((referenciaMs - Math.max(...anteriores)) / 86_400_000)
      // ESTRITAMENTE maior: é o que `student-triage.ts:73` faz e o que a
      // fixture reconcilia. A §8.5 diz "≥14" e está frouxa; mudar move quem
      // está exatamente em 14 dias entre dois blocos da tela.
      return dias > SEM_ACESSO_DAYS
    }).length

  const metricas: MetricaPlacar[] = [
    montarMetrica({
      id: "ativos",
      rotulo: "Ativos no período",
      icone: "users",
      iconeTom: "green",
      numeradorAtual: base.ativosNoPeriodo.size,
      numeradorAnterior: base.ativosNoPeriodoAnterior.size,
      base: totalRoster,
      tomInvertido: false,
      mostrarAbsoluto: true,
      motivoSemDelta: "sem-periodo-anterior",
      textoSemBase: VAZIO_SEM_ESCOPO,
    }),
    montarMetrica({
      id: "regularidade",
      rotulo: "Regularidade",
      icone: "calendar-check",
      iconeTom: "amber",
      numeradorAtual: base.regularesNoPeriodo.size,
      // Mesmo conjunto `iniciados` nos dois lados; só o fim da janela muda.
      numeradorAnterior: base.iniciados.filter((id) => ehRegularNaJanelaAnterior(base, id)).length,
      base: totalIniciados,
      tomInvertido: false,
      // A base é `iniciados`, não o recorte: "0%" sem o "de N" ao lado é o
      // número mais fácil de confundir com defeito nesta tela (item c).
      mostrarAbsoluto: true,
      motivoSemDelta: "sem-periodo-anterior",
      textoSemBase: VAZIO_NINGUEM_INICIOU,
    }),
    montarMetrica({
      id: "no-ritmo",
      rotulo: "No ritmo",
      icone: "trending-up",
      iconeTom: "green",
      numeradorAtual: noRitmo,
      numeradorAnterior: null, // ver decisão 3 no cabeçalho
      base: base.avaliaveis.size,
      tomInvertido: false,
      mostrarAbsoluto: false,
      motivoSemDelta: "sem-historico-comparavel",
      textoSemBase: VAZIO_SEM_PRAZO,
    }),
    montarMetrica({
      id: "participacao",
      rotulo: "Participação",
      icone: "hand",
      iconeTom: "blue",
      numeradorAtual: base.participaramNoPeriodo.size,
      numeradorAnterior: base.participaramNoAnterior.size,
      base: totalRoster,
      tomInvertido: false,
      mostrarAbsoluto: false,
      motivoSemDelta: "sem-periodo-anterior",
      textoSemBase: VAZIO_SEM_ESCOPO,
    }),
    montarMetrica({
      id: "sem-acesso",
      rotulo: "Sem acesso",
      icone: "user-x",
      iconeTom: "red",
      numeradorAtual: semAcessoEm(base.agoraMs),
      numeradorAnterior: semAcessoEm(base.janelas.atualInicio),
      base: totalIniciados,
      tomInvertido: true,
      // §8.5 exclui quem nunca iniciou, então este denominador NÃO é o do card
      // ao lado. Publicá-lo é o que impede o gestor de dividir pelo número
      // errado e concluir que a tela está quebrada (item a).
      mostrarAbsoluto: true,
      motivoSemDelta: "sem-periodo-anterior",
      textoSemBase: VAZIO_NINGUEM_INICIOU,
    }),
  ]

  return {
    ...moldura,
    metricas,
    notaRodape: NOTA_REGUAS_PLACAR,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}

/**
 * Regularidade avaliada no FIM da janela anterior, com os MESMOS carimbos e a
 * MESMA função. O que muda entre os dois lados é um argumento, não o método —
 * é assim que I-5 se sustenta sem depender de disciplina de quem edita depois.
 */
function ehRegularNaJanelaAnterior(base: BaseCalculo, id: string): boolean {
  return ehRegular(
    base.carimbosPorAluno.get(id) ?? [],
    base.janelas.atualInicio,
    base.janelas.duracaoMs,
  )
}
