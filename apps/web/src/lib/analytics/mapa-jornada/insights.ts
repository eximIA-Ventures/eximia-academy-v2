// ---------------------------------------------------------------------------
// §28 — Insights do mapa e a Ação recomendada. F-27 a F-31.
// ---------------------------------------------------------------------------
// ACHADO A-3, E É AQUI QUE ELE MORDE. O PNG é internamente inconsistente entre
// §24 ("Executar as Ações Corretivas · 16 (40%)") e §28 ("20% travam no mesmo
// ponto (módulo 6)"). 16/40 = 40%, não 20%. Não é erro de conta: são DUAS
// POPULAÇÕES no mesmo módulo — o gargalo (parados **ou** atrasados, F-08) e os
// travados (§25, só quem está sem atividade há mais de 14 dias, F-14).
// F-29 usa a população de TRAVADOS, e o teste `f-29` registra isso no código
// para ninguém "consertar" de volta.
//
// §2 REGRA 2 É LEI NA AÇÃO RECOMENDADA, e é a lição 5 da tela anterior: a ação
// é COLETIVA e de APOIO (organizar sessão sobre o módulo), nunca "cobrar as 16
// pessoas". O alvo é o MÓDULO, não as pessoas. Na Visão geral, a recomendação
// mandava cobrar quem já tinha CONCLUÍDO o curso — número errado é ruim, ação
// errada sobre pessoa real é pior.
// ---------------------------------------------------------------------------

import { estaSemAtividade } from "./base"
import type { BaseMapa } from "./base"
import type { ParticaoDistribuicao } from "./distribuicao"
import type { ChaveFonteMapa, FalhasPorFonteMapa } from "./fonte"
import { primeiraFalhaMapa } from "./fonte"
import { INSIGHTS_MAX } from "./parametros"
import {
  CTA_RECOMENDACOES,
  ERRO_LEITURA,
  TITULO_ACAO,
  TITULO_INSIGHTS,
  VAZIO_NINGUEM_INICIOU,
  VAZIO_SEM_ESCOPO,
} from "./textos"
import type { TileDistribuicao } from "./tipos"
import type { AcaoRecomendada, BlocoInsights, ItemInsight, LinhaGargalo } from "./tipos"

export const CHAVES_INSIGHTS: readonly ChaveFonteMapa[] = [
  "roster",
  "matriculas",
  "capitulos",
  "slides",
  "percorrido",
  "sessoes",
  "reflexoes",
]

export interface EntradaInsights {
  base: BaseMapa
  particao: ParticaoDistribuicao
  /**
   * F-27/F-28 · os tiles JÁ montados de §25, não a partição crua.
   *
   * Vermelho medido em 2026-08-18 (`f-28`, caso "zero gargalos"): o tile dizia
   * `72%` e a frase dizia `71%` sobre a MESMA população, porque o tile fecha a
   * soma em 100 (o maior balde absorve o resto, `distribuicao.ts`) e a frase
   * recalculava com `Math.round` cru. Dois blocos da mesma tela discordando
   * sobre o mesmo número é exatamente o defeito que F-27 nomeia — e ele nasce
   * de haver DOIS caminhos para o mesmo percentual. Agora há um: o insight LÊ
   * o tile. A identidade deixa de ser coincidência aritmética e vira estrutura.
   */
  tiles: readonly TileDistribuicao[]
  /** Lista COMPLETA de F-10. Os dois primeiros alimentam F-28. */
  ordenados: readonly LinhaGargalo[]
  /** Âncora de F-17. `null` quando F-21 não disparou. */
  ancora: LinhaGargalo | null
  pessoasPorModulo: ReadonlyMap<string, readonly string[]>
}

export function montarInsights(e: EntradaInsights, falhas: FalhasPorFonteMapa): BlocoInsights {
  const { base, particao, ordenados, ancora, pessoasPorModulo, tiles } = e
  const falha = primeiraFalhaMapa(falhas, CHAVES_INSIGHTS)
  const esqueleto = { titulo: TITULO_INSIGHTS } as const

  const vazio = (
    estado: "erro" | "vazio",
    texto: string,
    motivo: BlocoInsights["motivoVazio"],
  ): BlocoInsights => ({
    ...esqueleto,
    estado,
    erro: estado === "erro" ? falha : null,
    textoVazio: texto,
    motivoVazio: motivo,
    itens: [],
    acao: null,
  })

  if (falha) return vazio("erro", ERRO_LEITURA, null)

  const total = base.roster.length
  if (total === 0) return vazio("vazio", VAZIO_SEM_ESCOPO, "sem-escopo")

  const itens: ItemInsight[] = []

  /**
   * O percentual É o do tile, lido dele. `null` só é possível se o bloco de
   * §25 não tiver saído em `ok` — e aí o insight é OMITIDO, nunca preenchido
   * com um número recalculado por um segundo caminho (F-31: insight sem fonte
   * é omitido, não substituído).
   */
  const pctDoTile = (id: TileDistribuicao["id"]): number | null =>
    tiles.find((t) => t.id === id)?.pct ?? null

  // F-27 · o MESMO percentual do card `Concluídos` (F-12), por identidade.
  const pctConcluiu = pctDoTile("concluidos")
  if (pctConcluiu !== null) {
    itens.push({
      id: "concluiu",
      texto: `${pctConcluiu}% da equipe já concluiu a jornada.`,
      icone: "trending-up",
      iconeTom: "green",
    })
  }

  // F-28 · o MESMO percentual do card `Em andamento` (F-13). Os módulos citados
  // são os dois primeiros de F-10, em ordem de módulo ASC.
  const pctAndamento = pctDoTile("em-andamento")
  const doisPrimeiros = ordenados
    .slice(0, 2)
    .map((g) => g.numero)
    .sort((a, b) => a - b)
  const reforco =
    doisPrimeiros.length >= 2
      ? ` Mantenha o ritmo e ofereça reforços nos módulos ${doisPrimeiros[0]} a ${doisPrimeiros[1]}.`
      : doisPrimeiros.length === 1
        ? ` Mantenha o ritmo e ofereça reforço no módulo ${doisPrimeiros[0]}.`
        : ""
  if (pctAndamento !== null) {
    itens.push({
      id: "em-andamento",
      texto: `${pctAndamento}% estão em andamento.${reforco}`,
      icone: "alert-circle",
      iconeTom: "amber",
    })
  }

  // F-29 · a população de TRAVADOS restrita ao módulo âncora. NÃO o numerador
  // do gargalo (que inclui atrasados-mas-ativos). Achado A-3.
  if (ancora !== null) {
    const noAncora = new Set(pessoasPorModulo.get(ancora.moduloId) ?? [])
    const travadosNoAncora = particao.travados.filter((id) => noAncora.has(id)).length
    const pctTravados = Math.round((travadosNoAncora / total) * 100)
    itens.push({
      id: "gargalo",
      texto: `${pctTravados}% travam no mesmo ponto (módulo ${ancora.numero}). É o maior gargalo da jornada.`,
      icone: "alert-triangle",
      iconeTom: "red",
    })
  }

  // F-30 · a ação aponta para o MÓDULO. Vocabulário de apoio, nunca de
  // cobrança. Emitida sob a MESMA condição de F-21 (há âncora ⇒ há
  // concentração real). `ctaEscreve: false` — "Ver recomendações" é navegação.
  const acao: AcaoRecomendada | null =
    ancora === null
      ? null
      : {
          titulo: TITULO_ACAO,
          texto: `Organize um lembrete ou sessão ao vivo sobre o módulo ${ancora.numero} para destravar o avanço.`,
          ctaRotulo: CTA_RECOMENDACOES,
          ctaIcone: "lightbulb",
          ctaEscreve: false,
          moduloId: ancora.moduloId,
        }

  // Ninguém iniciou: os percentuais existiriam, mas afirmariam posição sobre
  // uma jornada que não começou. O bloco sai vazio, com texto.
  const alguemIniciou = particao.naoIniciados.length < total
  if (!alguemIniciou) return vazio("vazio", VAZIO_NINGUEM_INICIOU, "sem-base")

  return {
    ...esqueleto,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
    // §28 diz "máximo 3", nunca "exatamente 3": insight sem fonte é OMITIDO,
    // não substituído por texto genérico.
    itens: itens.slice(0, INSIGHTS_MAX),
    acao,
  }
}

/** Reexport de conveniência: quem monta a partição decide travado/ativo. */
export { estaSemAtividade }
