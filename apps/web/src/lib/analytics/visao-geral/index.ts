// ---------------------------------------------------------------------------
// Visão geral (Analytics do gestor) — a porta de entrada da camada de dados.
// ---------------------------------------------------------------------------
// UMA função de alto nível. Ela lê (uma passada, todo erro tratado — I-4) e
// entrega o objeto completo da tela, na MESMA FORMA da fixture. Trocar a
// fixture por dado real é trocar a origem do objeto, não remontar a UI.
//
// O QUE ESTA CAMADA NÃO FAZ, e é decisão, não esquecimento:
//
//   • NÃO resolve escopo. Quem decide quais alunos o gestor alcança é
//     `resolveEngagementScope` (que honra os cookies `x-active-context` e
//     `x-team-view`, ou seja, o filtro Diretos/Hierarquia da §3.1) e as RPCs
//     ancoradas em `auth.uid()`. Esta camada RECEBE o universo já resolvido e
//     só o obedece. Inventar escopo aqui abriria um caminho paralelo ao gate de
//     segurança, que é como vazamento entre times acontece.
//
//   • NÃO ESCREVE NADA. Nem nudge, nem sugestão, nem snapshot. Os CTAs que
//     escreveriam (`Enviar lembrete`, `Reconhecer`) vêm marcados com
//     `ctaEscreve: true` e o gate `acoesAtivas` (default `false`) diz se estão
//     liberados. Enquanto estiver desligado, quem renderiza mantém o botão
//     inerte. O `.env.local` deste repo aponta para PRODUÇÃO.
// ---------------------------------------------------------------------------

import { lerFonteVisaoGeral } from "./fonte-supabase"
import type { ClienteLeitura } from "./fonte-supabase"
import { type ContextoDeTela, montarVisaoGeral } from "./montagem"
import type { VisaoGeralDados } from "./tipos"

export interface ParametrosVisaoGeral {
  db: ClienteLeitura
  tenantId: string
  /** Gestor dono da tela — filtro dos acionamentos da §12. */
  gestorId: string
  /**
   * Universo JÁ resolvido: `null` = tenant inteiro (admin fora do contexto de
   * time), `[]` = escopo sem ninguém (fail-closed), `[ids]` = o recorte.
   */
  escopoAlunoIds: readonly string[] | null
  /** Injetado, nunca `Date.now()` aqui dentro: os testes precisam do relógio. */
  agoraMs: number
  periodoDias: 7 | 30 | 90
  contexto: Omit<ContextoDeTela, "atualizadoEmMs"> & { atualizadoEmMs?: number }
}

/**
 * Gate de escrita da Visão geral. Default DESLIGADO, e ÚNICO.
 *
 * Nenhuma ação desta tela grava em banco enquanto isto for `false`. A variável
 * é lida uma vez e exposta para quem renderiza decidir o estado do botão — a
 * camada de dados não dispara ação alguma de qualquer forma.
 *
 * ═══ POR QUE DOIS NOMES, E POR QUE UMA FUNÇÃO SÓ ═══════════════════════════
 * Dois nomes circulam no projeto: `NEXT_PUBLIC_ACIONAMENTO_ATIVO` (pedido no
 * briefing desta rodada) e `NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS` (o que a
 * camada de dados estabeleceu). Ter um nome documentado que silenciosamente não
 * faz nada é pior que aceitar os dois.
 *
 * O que NÃO pode existir é o que existia até aqui: DUAS leituras do mesmo gate,
 * uma no painel aceitando os dois nomes e esta aceitando um só. Nessa versão,
 * ligar apenas `NEXT_PUBLIC_ACIONAMENTO_ATIVO` fazia a tela DISPARAR enquanto o
 * teste `f-44` continuava verde afirmando que o gate estava desligado — um teste
 * que mente sobre escrita em banco de cliente pagante. Agora existe uma função
 * só, e o painel chama esta. Fail-closed: só a string exata `"true"` liga.
 */
export function acoesEstaoAtivas(): boolean {
  return (
    process.env.NEXT_PUBLIC_ACIONAMENTO_ATIVO === "true" ||
    process.env.NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS === "true"
  )
}

/** Lê o banco e monta a tela inteira. Somente leitura. */
export async function carregarVisaoGeral(p: ParametrosVisaoGeral): Promise<VisaoGeralDados> {
  const fonte = await lerFonteVisaoGeral({
    db: p.db,
    tenantId: p.tenantId,
    gestorId: p.gestorId,
    escopoAlunoIds: p.escopoAlunoIds,
    agoraMs: p.agoraMs,
    periodoDias: p.periodoDias,
  })

  return montarVisaoGeral(fonte, {
    ...p.contexto,
    atualizadoEmMs: p.contexto.atualizadoEmMs ?? p.agoraMs,
  })
}

export { computeVisaoGeral, fonteDaEntrada } from "./entrada"
export type { EntradaVisaoGeral } from "./entrada"
export { lerFonteVisaoGeral } from "./fonte-supabase"
export type { ClienteLeitura, ParametrosLeitura } from "./fonte-supabase"
export { montarVisaoGeral } from "./montagem"
export type { ContextoDeTela } from "./montagem"
export { montarBase, ehRegular, projetarEstado, retomouNaJanela } from "./base"
export type { BaseCalculo } from "./base"
export { montarPlacar } from "./placar"
export { montarMudancas } from "./mudancas"
export { montarAtencao } from "./atencao"
export { montarRecomendacoes } from "./recomendacoes"
export { montarAcionamentos } from "./acionamentos"
export { montarSinais, perfilDeRitmo, medianaOrdenada } from "./sinais"
export { chaveDiaUtc, diasUtcEntre, janelasComparaveis } from "./dia-utc"
export type { FonteVisaoGeral, FalhasPorFonte } from "./fonte"
export * from "./tipos"
