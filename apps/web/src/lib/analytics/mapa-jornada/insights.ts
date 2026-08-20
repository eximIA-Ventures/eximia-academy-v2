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

import { comBase, pluralDe } from "../_comum/texto"
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
  VAZIO_INSIGHTS,
  VAZIO_NINGUEM_INICIOU,
  VAZIO_SEM_ESCOPO,
} from "./textos"
import type {
  AcaoRecomendada,
  BlocoInsights,
  ItemInsight,
  LinhaGargalo,
  TileDistribuicao,
} from "./tipos"

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
   * RECEBIDO E NÃO LIDO desde 2026-08-19, de propósito.
   *
   * Histórico: F-27 e F-28 liam o `pct` daqui para que a frase e o tile NUNCA
   * divergissem (vermelho medido em 2026-08-18: tile `72%`, frase `71%`, porque
   * o tile fecha a soma em 100 e a frase recalculava com `Math.round` cru).
   * A identidade resolvia a divergência — e institucionalizava a REPETIÇÃO: o
   * primeiro item de um card chamado "Insights do mapa" era, por contrato
   * escrito em comentário, o número do tile ao lado. Redundância documentada é
   * agravante, não isenção: ela vira compromisso arquitetural que o próximo
   * mantenedor defende. Os dois itens morreram; o campo continua no contrato
   * porque quem monta a tela (`montagem.ts`) ainda o passa.
   */
  tiles: readonly TileDistribuicao[]
  /** RECEBIDO E NÃO LIDO: alimentava o reforço de F-28, que repetia §24. */
  ordenados: readonly LinhaGargalo[]
  /** Âncora de F-17. `null` quando F-21 não disparou. */
  ancora: LinhaGargalo | null
  pessoasPorModulo: ReadonlyMap<string, readonly string[]>
}

export function montarInsights(e: EntradaInsights, falhas: FalhasPorFonteMapa): BlocoInsights {
  const { base, particao, ancora, pessoasPorModulo } = e
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
  const tituloDoModulo = (moduloId: string): string =>
    base.tituloPorCapitulo.get(moduloId) ?? "este módulo"

  // ═══════════════════════════════════════════════════════════════════════
  // ORDEM DECLARADA (D-6). Não é a ordem em que o código deu `push`: é
  // 1) o que TRAVA a jornada, 2) COMO agir sobre quem está em movimento.
  // O gargalo vem primeiro porque é a única linha desta aba que aponta um
  // ponto físico do currículo; a dispersão vem depois porque só faz sentido
  // depois de saber onde o caldo engrossou.
  // ═══════════════════════════════════════════════════════════════════════

  // ─── 1 · F-29 · a população de TRAVADOS restrita ao módulo âncora ────────
  // NÃO o numerador do gargalo (que inclui atrasados-mas-ativos). Achado A-3.
  // Os dois lados ABSOLUTOS, e o módulo pelo TÍTULO: nenhum gestor sabe o que
  // é "módulo 6", ele sabe o que é "Executar Ações Corretivas". O percentual
  // saiu porque, com 6 pessoas, "21%" é uma pessoa — e porque o tile ao lado
  // já publica percentual sobre a mesma partição (D-1).
  //
  // ═══ E A INTERSEÇÃO PODE SER VAZIA — F-29b ══════════════════════════════
  // O achado A-3 tem uma ponta que ninguém tinha olhado. A ÂNCORA é escolhida
  // sobre a população do GARGALO (parados **ou** atrasados, em `travados.ts`);
  // a frase conta a de TRAVADOS. Quando a concentração do módulo é feita só de
  // gente atrasada-MAS-ATIVA, há âncora e não há um único travado nela — e o
  // card emitia, medido: "0 de 3 pessoas travam no mesmo ponto: "Executar as
  // Ações Corretivas". É o maior gargalo da jornada." Zero pessoas, e a frase
  // ainda assim concluindo que ali é o maior gargalo.
  //
  // Emitir "0 de N" é pior que calar: é uma afirmação sobre um problema que não
  // existe, no card de maior destaque da aba. A guarda é o numerador, não a
  // âncora — a `acao` abaixo continua saindo, e deve: a concentração de
  // atrasados no módulo é real, e "organize uma sessão sobre X" segue sendo a
  // ação certa mesmo quando ninguém ainda sumiu por 14 dias.
  if (ancora !== null) {
    const noAncora = new Set(pessoasPorModulo.get(ancora.moduloId) ?? [])
    const travadosNoAncora = particao.travados.filter((id) => noAncora.has(id)).length
    if (travadosNoAncora > 0)
      itens.push({
        id: "gargalo",
        texto: `${comBase(travadosNoAncora, total)} ${pluralDe(travadosNoAncora, "pessoa trava", "pessoas travam")} no mesmo ponto: "${tituloDoModulo(ancora.moduloId)}". É o maior gargalo da jornada.`,
        icone: "alert-triangle",
        iconeTom: "red",
      })
  }

  // ─── 2 · quem está em movimento está JUNTO ou ESPALHADO? ────────────────
  // Substitui F-28, que era o percentual do tile `Em andamento` mais um
  // reforço apontando os dois primeiros módulos de F-10 — ou seja, o tile ao
  // lado mais o card de gargalos logo acima, sem nada próprio.
  //
  // Este fato não está em NENHUM outro lugar da tela e muda a ação: se as
  // pessoas em andamento estão todas no mesmo módulo, uma sessão alcança
  // todas de uma vez; espalhadas, sessão é desperdício e mensagem individual
  // rende mais. Sai de `moduloCorrentePorAluno`, já em memória.
  const modulosEmCurso = new Set<string>()
  for (const alunoId of particao.emAndamento) {
    const moduloId = base.moduloCorrentePorAluno.get(alunoId)
    if (moduloId !== undefined) modulosEmCurso.add(moduloId)
  }
  const emAndamento = particao.emAndamento.length
  if (emAndamento > 0 && modulosEmCurso.size > 0) {
    const unico = [...modulosEmCurso][0] as string
    itens.push({
      id: "em-andamento",
      texto:
        modulosEmCurso.size === 1
          ? `${comBase(emAndamento, total)} ${pluralDe(emAndamento, "pessoa está", "pessoas estão")} em andamento, ${pluralDe(emAndamento, "no módulo", "todas no mesmo módulo")} "${tituloDoModulo(unico)}".`
          : `${comBase(emAndamento, total)} ${pluralDe(emAndamento, "pessoa está", "pessoas estão")} em andamento, distribuídas por ${modulosEmCurso.size} módulos diferentes.`,
      icone: "alert-circle",
      iconeTom: "amber",
    })
  }

  // F-30 · a ação aponta para o MÓDULO, agora pelo título. Vocabulário de
  // apoio, nunca de cobrança. Emitida sob a MESMA condição de F-21 (há âncora
  // ⇒ há concentração real). `ctaEscreve: false` — "Ver recomendações" navega.
  //
  // ═══ DIVERGÊNCIA REGISTRADA (doutrina do texto, 2026-08-19) ═════════════
  // A lente apontou que esta é a ÚNICA ação da aba e que ela é estruturalmente
  // inalcançável na base para a qual a aba foi construída: a âncora exige
  // `pessoas >= 0.2 × total` (1,2 pessoas num tenant de 6) e o único módulo com
  // gente parada tem 1. O limiar percentual precisaria virar contagem absoluta
  // calibrada para equipe pequena. NÃO foi feito aqui, e não por discordância:
  // a âncora é decidida em `travados.ts`, fora da superfície desta frente, e
  // duplicar o critério aqui criaria o segundo caminho para o mesmo conceito —
  // a família de defeito que esta camada combate em todo lugar. Fica como
  // pendência nomeada, não como omissão.
  const acao: AcaoRecomendada | null =
    ancora === null
      ? null
      : {
          titulo: TITULO_ACAO,
          texto: `Organize um lembrete ou sessão ao vivo sobre "${tituloDoModulo(ancora.moduloId)}" para destravar o avanço.`,
          ctaRotulo: CTA_RECOMENDACOES,
          ctaIcone: "lightbulb",
          ctaEscreve: false,
          moduloId: ancora.moduloId,
        }

  // Ninguém iniciou: os percentuais existiriam, mas afirmariam posição sobre
  // uma jornada que não começou. O bloco sai vazio, com texto.
  const alguemIniciou = particao.naoIniciados.length < total
  if (!alguemIniciou) return vazio("vazio", VAZIO_NINGUEM_INICIOU, "sem-base")

  // D-6 · zero item não sai como `ok` mudo. Ver `VAZIO_INSIGHTS`.
  if (itens.length === 0) return vazio("vazio", VAZIO_INSIGHTS, "sem-gargalos")

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
