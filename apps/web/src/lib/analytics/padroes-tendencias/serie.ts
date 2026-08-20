// ---------------------------------------------------------------------------
// §17 — "Evolução do ritmo". Duas séries, e só duas.
// ---------------------------------------------------------------------------
// A pergunta que este bloco responde (§34) é "há mais pessoas estudando ou
// apenas mais sessões?". Ela só tem resposta se as duas séries dividirem o
// mesmo universo e contarem coisas DIFERENTES. O universo é um só — ATIVIDADE
// DE SESSÃO NA SEMANA (`created_at` e `updated_at`, porque a sessão socrática é
// reusada e cada turno de chat mexe só no segundo) — e o que muda é a dedupe:
//
//   • "Alunos ativos" deduplica por PESSOA — cinco sessões de alguém numa terça
//     valem 1;
//   • "Sessões realizadas" deduplica por SESSÃO — as mesmas cinco valem 5, e uma
//     sessão criada na terça e retomada na quinta continua valendo 1 naquela
//     semana.
//
// Dessa simetria sai a desigualdade que a tela publica sem dizer e que agora é
// ESTRUTURAL: `ativos ≤ sessoes` em toda semana, porque ninguém entra na
// contagem de pessoas sem uma sessão que também entrou na de sessões. Até
// 2026-08-20 as duas liam universos diferentes (`ativos` os dois carimbos,
// `sessoes` só a criação) e `ativos > sessoes` era alcançável — ver F-46 e o
// bloco de universo declarado em `base.ts`.
//
// ESTADO VAZIO NÃO RENDERIZA EIXO. Gráfico vazio é o formato preferido da
// mentira: parece dado e é ausência. Com menos de duas semanas com atividade, o
// bloco devolve `pontos: []` e `eixoY: null`, e a UI mostra o texto da §32.
// ---------------------------------------------------------------------------

import type { FalhasPorFonte } from "../visao-geral/fonte"
import type { BasePadroes } from "./base"
import { FONTES_DA_SERIE, primeiraFalha } from "./fonte"
import { EIXO_Y_DIVISOES_MAX, EIXO_Y_REDONDOS, SERIE_SEMANAS_COM_ATIVIDADE_MIN } from "./parametros"
import { eixoY } from "./semanas"
import {
  ACAO_SERIE,
  SUBTITULO_SERIE,
  TITULO_SERIE,
  VAZIO_SEM_ESCOPO,
  VAZIO_TENDENCIA,
} from "./textos"
import type { Acao, BlocoSerie, ComEstado, EixoY, EntradaLegenda, PontoSerie } from "./tipos"

const ACAO: Acao = { id: "serie", rotulo: ACAO_SERIE, ctaEscreve: false }

// ===========================================================================
// O DOMÍNIO DO EIXO Y — a regra, declarada
// ===========================================================================
/**
 * `dominioDaSerie(pico, totalRecorte)` — o teto do eixo desta série.
 *
 * O DEFEITO QUE ISTO CORRIGE. A regra anterior era só `eixoY(pico)`: passo
 * redondo ≥ ceil(pico/5), topo = passo × 5. O menor passo da escada é 1, logo o
 * MENOR TOPO POSSÍVEL era 5 — um piso que ninguém escolheu, que é subproduto da
 * multiplicação. Com o tenant real (6 pessoas, pico 1) a tela desenhava 0–5 para
 * um dado que vai de 0 a 1, e o "5" não significava nada: não é o universo, não
 * é o pico, não é meta. Número mágico solto é isto.
 *
 * A REGRA, em duas frases:
 *
 *   1. ENQUANTO O PICO CABE NO RECORTE, o teto é o TAMANHO DO RECORTE. A série
 *      conta pessoas, e o universo de pessoas é o denominador já congelado de
 *      toda esta tela (`ContextoPadroes.totalRecorte`). Com 6 no topo, a barra
 *      de altura 1 lê-se "1 de 6" em vez de "1 de sabe-se lá o quê", e o eixo
 *      NÃO se move entre períodos — dois gráficos do mesmo recorte são
 *      comparáveis a olho, que é o que um eixo colado no dado destrói (nele,
 *      cair de 5 para 4 e cair de 500 para 400 desenham a mesma figura).
 *
 *   2. QUANDO O PICO ULTRAPASSA O RECORTE, o pico manda, pela régua já
 *      contratada em F-14 (`eixoY`, 5 divisões, escada redonda). Sessões podem
 *      passar do número de pessoas — a mesma pessoa estuda duas vezes — e cortar
 *      dado nunca é opção. O teto do universo deixa de ser régua exatamente no
 *      ponto em que a série o excede.
 *
 * O CUSTO, assumido de olhos abertos: com pico 1 e recorte 6, cinco sextos da
 * área ficam vazios. Essa área vazia agora SIGNIFICA (são as 5 pessoas que não
 * apareceram na semana), e a barra ancorada no zero continua legível — era a
 * linha interpolada de antes que virava um rabisco raso perto da base.
 *
 * A VARIÂNCIA desta função está no RECORTE (e no pico que o excede), não no pico
 * abaixo dele: pedir que o eixo se mexa quando o dado oscila DENTRO do universo
 * seria pedir de volta o eixo instável. `f-14b-dominio-da-serie.test.ts` sacode
 * as duas causas certas e prova que o efeito se move.
 */
export function dominioDaSerie(pico: number, totalRecorte: number): EixoY {
  if (pico > totalRecorte) return eixoY(pico)
  return eixoAncorado(totalRecorte)
}

/**
 * Teto = o recorte arredondado para cima pela MESMA escada redonda, com no
 * máximo `EIXO_Y_DIVISOES_MAX` divisões — e passo inteiro, sempre: o eixo conta
 * gente, e meia pessoa não existe.
 */
function eixoAncorado(recorte: number): EixoY {
  const teto = Math.max(1, Math.ceil(recorte))
  const ultimo = EIXO_Y_REDONDOS[EIXO_Y_REDONDOS.length - 1] ?? 1
  const passo = EIXO_Y_REDONDOS.find((r) => Math.ceil(teto / r) <= EIXO_Y_DIVISOES_MAX) ?? ultimo
  const divisoes = Math.max(1, Math.ceil(teto / passo))
  const ticks: number[] = []
  for (let i = 0; i <= divisoes; i++) ticks.push(passo * i)
  return { passo, topo: passo * divisoes, ticks }
}

/** Ordem e cor são contrato: verde = pessoas, laranja = sessões (§31). */
const LEGENDA: readonly EntradaLegenda[] = [
  { id: "ativos", rotulo: "Alunos ativos", tom: "green" },
  { id: "sessoes", rotulo: "Sessões realizadas", tom: "amber" },
]

export function montarSerie(base: BasePadroes, falhas: FalhasPorFonte): ComEstado<BlocoSerie> {
  const cabeca = {
    titulo: TITULO_SERIE,
    subtitulo: SUBTITULO_SERIE,
    periodicidade: "semanal" as const,
    // MVP tem UMA periodicidade. A UI renderiza estado, não um menu que abre e
    // não oferece nada: controle que promete escolha inexistente é defeito de
    // contrato, não de estilo.
    opcoes: ["semanal"] as const,
    legenda: LEGENDA,
    acao: ACAO,
  }

  const falha = primeiraFalha(falhas, FONTES_DA_SERIE)
  if (falha) {
    return {
      ...cabeca,
      pontos: [],
      eixoY: null,
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.visao.roster.size === 0) {
    return {
      ...cabeca,
      pontos: [],
      eixoY: null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }
  if (base.semanasComAtividade < SERIE_SEMANAS_COM_ATIVIDADE_MIN) {
    return {
      ...cabeca,
      pontos: [],
      eixoY: null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_TENDENCIA,
      motivoVazio: "sem-historico-suficiente",
    }
  }

  const pontos: PontoSerie[] = base.semanas.map((s, i) => ({
    indice: s.indice,
    rotulo: s.rotulo,
    inicioISO: new Date(s.inicioMs).toISOString(),
    fimISO: new Date(s.fimMs).toISOString(),
    // Semana sem ninguém é ponto 0 LEGÍTIMO: a série é contínua e o zero ali é
    // informação, não ausência. A ausência é o estado vazio acima.
    ativos: base.ativosPorSemana[i] ?? 0,
    sessoes: base.sessoesPorSemana[i] ?? 0,
  }))

  const pico = Math.max(0, ...pontos.map((p) => Math.max(p.ativos, p.sessoes)))

  return {
    ...cabeca,
    pontos,
    // O recorte é o teto natural da série de PESSOAS, e é ele que entra aqui —
    // não um limiar desta camada. Ler `roster.size` no mesmo lugar que
    // `montagem.ts` lê para `contexto.totalRecorte` é o que garante que o topo
    // do eixo e o denominador publicado na tela sejam o MESMO número.
    eixoY: dominioDaSerie(pico, base.visao.roster.size),
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
