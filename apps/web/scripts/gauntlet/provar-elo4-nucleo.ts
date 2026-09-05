// ===========================================================================
// Prova do elo 4 (núcleo) — Autogestão da minha Jornada.
// ===========================================================================
// Este arquivo é `.ts` (não `.mjs`) DE PROPÓSITO: é o único jeito de importar
// `fonte-supabase.ts`/`montagem.ts` (que têm imports relativos SEM extensão,
// convenção do resto do projeto, resolvida pelo bundler do Next.js) sem
// alterar um arquivo de produção só para um script de prova rodar. `.ts`
// ambíguo (sem `"type":"module"` em `apps/web/package.json`) roda em modo
// CommonJS sob `tsx`, cujo `require()` resolve extensão automaticamente —
// medido diretamente nesta sessão (um `.mts`, sempre ESM, FALHA no mesmo
// import).
//
// `provar-elo4.mjs` (o script pedido, rodável com `node` puro) é um LANÇADOR
// fino que invoca `tsx` sobre este arquivo e repassa stdio + exit code.
//
// EXTENSÃO (correção do team-lead, 2026-08-21): a versão anterior deste
// arquivo comparava a leitura só contra `calculos-elo4.mjs` — um SEGUNDO
// cálculo escrito pela mesma mão que escreveu o gabarito. Se ele divergisse
// de `montagem.ts` (a produção real), a prova continuaria verde sem que
// ninguém soubesse: estaria conferindo o gabarito contra código que não roda
// em lugar nenhum. Agora:
//
//   1. O gabarito é gerado por PRODUÇÃO (`montarVisaoGeralAutogestao` /
//      `montarPadroesAutogestao` / `montarMapaAutogestao`), aplicada a um
//      `FonteAutogestao` CONHECIDO (montado diretamente do cenário que
//      `semear.mjs` escreveu, sem ida ao banco — isso é o que faz o gabarito
//      independente da leitura que ele vai avaliar).
//   2. A prova lê pelo caminho de produção (`fonte-supabase.ts`), roda os
//      MESMOS 3 montadores sobre o dado FETCHED, e compara contra o gabarito.
//   3. `calculos-elo4.mjs` continua existindo como SEGUNDO PAR DE OLHOS: onde
//      as duas fórmulas cobrem o mesmo elemento, a divergência é IMPRESSA e
//      gravada no gabarito — nunca corrigida aqui.
//
// Uso:
//   node scripts/gauntlet/provar-elo4.mjs --agora <ISO> --gerar-gabarito
//   node scripts/gauntlet/provar-elo4.mjs --agora <ISO>
// ===========================================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type {
  FonteAutogestao,
  LinhaCapitulo,
  LinhaPlano,
  LinhaProgressoCapitulo,
  LinhaSessao,
} from "../../src/lib/analytics/autogestao/fonte"
// Sem extensão — resolvido pelo `require()` de `tsx` (ver cabeçalho). Este é
// o "caminho de produção" que o elo 4 precisa exercitar.
import { lerFonteAutogestao } from "../../src/lib/analytics/autogestao/fonte-supabase"
import {
  carimbosDeAtividade,
  contarRetomadas,
  diasAtivosOrdenados,
  maiorIntervaloDias,
  montarMapaAutogestao,
  montarPadroesAutogestao,
  montarVisaoGeralAutogestao,
  progressoRealPercent,
  sessaoEmAberto,
} from "../../src/lib/analytics/autogestao/montagem"
import type {
  MapaJornadaAutogestaoDados,
  PadroesAutogestaoDados,
  VisaoGeralAutogestaoDados,
} from "../../src/lib/analytics/autogestao/tipos"
import { diasDistintosUtc, diasUtcEntre } from "../../src/lib/analytics/visao-geral/dia-utc"
import {
  contarSessoesNaJanela as _contarSessoesNaJanelaCalculos,
  diasComAtividadeNaJanela,
  diasDesdeUltimaAtividade as diasDesdeUltimaAtividadeCalculos,
  janelasComparaveis as janelasComparaveisCalculos,
  maiorIntervalo as maiorIntervaloCalculos,
  marco as marcoCalculos,
  progressoModuloAtual as progressoModuloAtualCalculos,
  progressoReal as progressoRealCalculos,
  retomadas as retomadasCalculos,
  sessaoEmAberto as sessaoEmAbertoCalculos,
  sessoesConcluidasModulo as sessoesConcluidasModuloCalculos,
  ultimoAjusteDias as ultimoAjusteDiasCalculos,
} from "./calculos-elo4.mjs"
import { criarCliente, limparTudo, pontoNoTempo, semearCenario } from "./semear.mjs"

const AQUI = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(AQUI, "../..")
const REPO = resolve(WEB, "../..")
const GABARITO_PATH = resolve(REPO, "docs/gauntlet/autogestao-jornada/GABARITO.json")

// ===========================================================================
// Construção do `FonteAutogestao` CONHECIDO — sem ida ao banco.
// ===========================================================================

interface SessaoCrua {
  chapterId: string
  diasAtras: number
  hora: number
  status: string
}

interface CvpCrua {
  chapterId: string
  first: number
  reached: number | null
  last: number
  lastHora: number
  max: number
  total: number
}

interface PlanoCru {
  moduleDurations: readonly { chapterId: string; days: number }[]
  startDateISO: string
  finalDeadlineDateISO: string | null
  recalculatedAtISO: string
  baseline: {
    capturedAt: string
    progressPct: number
    sessionsDone: number
    reflectionsDone: number
    completedChapterIds: string[]
  }
}

function construirFonteConhecida(
  agoraISO: string,
  periodoDias: 7 | 30 | 90,
  tenantId: string,
  studentId: string,
  courseId: string,
  capitulos: readonly { id: string; order: number; title: string }[],
  sessoesRaw: readonly SessaoCrua[],
  cvpRaw: readonly CvpCrua[],
  planoRaw: PlanoCru | null,
): FonteAutogestao {
  const sessoes: LinhaSessao[] = sessoesRaw.map((s, i) => {
    const created_at = pontoNoTempo(agoraISO, s.diasAtras, s.hora)
    return {
      id: `conhecido-sessao-${i}`,
      chapter_id: s.chapterId,
      status: s.status,
      created_at,
      completed_at: s.status === "completed" ? created_at : null,
      turn_number: null,
      interactions_remaining: null,
    }
  })
  const progresso: LinhaProgressoCapitulo[] = cvpRaw.map((p) => ({
    chapter_id: p.chapterId,
    max_slide_index: p.max,
    slides_total_at_last_view: p.total,
    reached_last_slide_at: p.reached === null ? null : pontoNoTempo(agoraISO, p.reached, 18),
    first_viewed_at: pontoNoTempo(agoraISO, p.first, 8),
    last_viewed_at: pontoNoTempo(agoraISO, p.last, p.lastHora),
  }))
  const plano: LinhaPlano | null = planoRaw
    ? {
        id: "conhecido-plano",
        status: "active",
        moduleDurations: planoRaw.moduleDurations,
        startDateISO: planoRaw.startDateISO,
        finalDeadlineDateISO: planoRaw.finalDeadlineDateISO,
        recalculatedAtISO: planoRaw.recalculatedAtISO,
        baseline: planoRaw.baseline,
      }
    : null

  return {
    tenantId,
    studentId,
    courseId,
    periodoDias,
    sessoes,
    reflexoes: [],
    progresso,
    capitulos: capitulos.map((c) => ({
      id: c.id,
      order: c.order,
      title: c.title,
    })) as readonly LinhaCapitulo[],
    plano,
    fusoHorarioMinutosOffset: null,
    duracaoMediaPorSlideMinutos: null,
    falhas: { sessoes: null, reflexoes: null, progresso: null, capitulos: null, plano: null },
  }
}

// ===========================================================================
// Extração dos 33 elementos ALCANÇÁVEIS do CONTRATO-DE-DADOS.md (34 menos
// 3.5, ver nota no relatório final: `duracaoMediaPorSlideMinutos` é SEMPRE
// `null` nesta fronteira de I/O, por desenho — comparar null==null não prova
// nada sobre o caminho de leitura).
//
// Os 5 excluídos por decisão do dono (SEM LASTRO estrutural, placar de
// `CONTRATO-DE-DADOS.md`): 1.3, 1.12 (denominador), 1.13, 1.19, 2.2.
// ===========================================================================

function achar<T extends { id: string }>(itens: readonly T[], id: string): T | null {
  return itens.find((i) => i.id === id) ?? null
}

function extrairElementosProducao(
  visaoGeral: VisaoGeralAutogestaoDados,
  padroes: PadroesAutogestaoDados,
  mapa: MapaJornadaAutogestaoDados,
): Record<string, unknown> {
  const cg = visaoGeral.comoEstou.conteudo
  const raa = visaoGeral.respostaAosAjustes.conteudo
  const cont = padroes.continuidade.conteudo
  const tend = padroes.tendencia.conteudo
  const modAtual = mapa.moduloAtual.conteudo
  const marco = mapa.proximoMarco.conteudo
  const pdr = mapa.perdaDeRitmo.conteudo

  return {
    // --- Tela 1 — Visão Geral (18) -----------------------------------------
    "1.1_ritmo": cg ? { estado: cg.ritmo.estado, rotulo: cg.ritmo.rotulo } : null,
    "1.2_regularidade": cg
      ? { vezesPorSemana: cg.regularidade.vezesPorSemana, rotulo: cg.regularidade.rotulo }
      : null,
    "1.4_progresso_real": cg
      ? { percentual: cg.progresso.percentual, rotulo: cg.progresso.rotulo }
      : null,
    "1.5_progresso_planejado": cg
      ? {
          metaHoje: cg.progresso.metaHoje,
          deltaPp: cg.progresso.deltaPp,
          deltaRotulo: cg.progresso.deltaRotulo,
        }
      : null,
    "1.6_ultima_atividade": cg
      ? { dias: cg.ultimaAtividade.dias, rotulo: cg.ultimaAtividade.rotulo }
      : null,
    "1.7_proxima_sessao": cg
      ? {
          iso: cg.ultimaAtividade.proximaSessaoRecomendadaISO,
          rotulo: cg.ultimaAtividade.proximaSessaoRotulo,
        }
      : null,
    "1.8_sintese": { texto: visaoGeral.sintese.texto, tom: visaoGeral.sintese.tom },
    "1.9_mudanca_sessoes": {
      estado: visaoGeral.mudancas.estado,
      item: achar(visaoGeral.mudancas.itens, "sessoes"),
    },
    "1.10_mudanca_regularidade": {
      estado: visaoGeral.mudancas.estado,
      item: achar(visaoGeral.mudancas.itens, "regularidade"),
    },
    "1.11_mudanca_progresso": {
      estado: visaoGeral.mudancas.estado,
      item: achar(visaoGeral.mudancas.itens, "progresso"),
    },
    "1.14_sessao_aberta": {
      estado: visaoGeral.atencao.estado,
      item: achar(visaoGeral.atencao.itens, "sessao-aberta"),
    },
    "1.15_proximo_movimento": {
      tipo: visaoGeral.proximoMovimento.tipo,
      titulo: visaoGeral.proximoMovimento.titulo,
      texto: visaoGeral.proximoMovimento.texto,
    },
    "1.16_ultimo_ajuste": raa
      ? { ultimoAjusteDias: raa.ultimoAjusteDias, ultimoAjusteRotulo: raa.ultimoAjusteRotulo }
      : {
          estado: visaoGeral.respostaAosAjustes.estado,
          motivoVazio: visaoGeral.respostaAosAjustes.motivoVazio,
        },
    "1.17_frequencia_antes_depois": raa
      ? { antes: raa.frequenciaAntes, depois: raa.frequenciaDepois }
      : null,
    "1.18_progresso_delta_ajuste": raa ? raa.progressoDeltaPp : null,
    "1.20_melhor_horario": {
      estado: visaoGeral.sinaisDoMomento.estado,
      item: achar(visaoGeral.sinaisDoMomento.itens, "melhor-horario"),
    },
    "1.21_dias_da_semana": {
      estado: visaoGeral.sinaisDoMomento.estado,
      item: achar(visaoGeral.sinaisDoMomento.itens, "dias-da-semana"),
    },
    "1.22_latencia_retomada": {
      estado: visaoGeral.sinaisDoMomento.estado,
      item: achar(visaoGeral.sinaisDoMomento.itens, "latencia-retomada"),
    },

    // --- Tela 2 — Padrões e Tendências (7) ---------------------------------
    "2.1_serie_semanal": {
      estado: padroes.serie.estado,
      pontos: padroes.serie.pontos.map((p) => ({
        indice: p.indice,
        rotulo: p.rotulo,
        diasAtivos: p.diasAtivos,
      })),
    },
    "2.3_frequencia_media": cont
      ? { frequenciaMedia: cont.frequenciaMedia, rotulo: cont.frequenciaRotulo }
      : null,
    "2.4_maior_intervalo": cont ? cont.maiorIntervaloDias : null,
    "2.5_sequencia_semanas": cont ? cont.sequenciaAtualSemanas : null,
    "2.6_retomadas": cont ? cont.retomadas : null,
    "2.7_favorece": { estado: padroes.favorece.estado, itens: padroes.favorece.itens },
    "2.8_tendencia": tend
      ? { estado: tend.estado, texto: tend.texto, pontos: tend.linhaTemporal.length }
      : null,

    // --- Tela 3 — Mapa da Jornada (8, sem 3.5) -----------------------------
    "3.1_trilha": mapa.trilha.modulos.map((m) => ({
      ordem: m.ordem,
      titulo: m.titulo,
      status: m.status,
    })),
    "3.2_progresso_modulo_atual": modAtual ? modAtual.progressoPercent : null,
    "3.3_iniciado_em": modAtual
      ? { iso: modAtual.iniciadoEmISO, rotulo: modAtual.iniciadoEmRotulo }
      : null,
    "3.4_sessoes_modulo": modAtual
      ? { concluidas: modAtual.sessoesConcluidas, total: modAtual.sessoesTotal }
      : null,
    "3.6_proximo_marco": marco ? { moduloTitulo: marco.moduloTitulo, prazo: marco.prazo } : null,
    "3.7_perda_de_ritmo": {
      estado: mapa.perdaDeRitmo.estado,
      conteudo: pdr ? { texto: pdr.texto } : null,
    },
    "3.8_media_dias_pausa": pdr ? pdr.mediaDiasPausa : null,
    "3.9_historico": mapa.historico.itens.map((h) => ({
      titulo: h.titulo,
      estadoLabel: h.estadoLabel,
      progressoPercent: h.progressoPercent,
    })),
  }
}

// ===========================================================================
// Segundo par de olhos — `calculos-elo4.mjs` vs as fórmulas GRANULARES de
// produção (não o texto já montado da UI: os primitivos exportados de
// `montagem.ts`, para comparar NÚMERO com NÚMERO).
//
// ACHADO (reportar, não corrigir): `montarPadroesAutogestao` usa
// `diasAtivosOrdenados(fonte)` — a união de sessions+reflections+progresso,
// a MESMA base do contrato 1.2 — como o `dias` alimentado em
// `maiorIntervaloDias`/`contarRetomadas`/`sequenciaAtualSemanas` (2.4/2.5/2.6).
// O CONTRATO-DE-DADOS.md declara a coluna "Tabela/campo" de 2.4 e 2.6 como
// `sessions.created_at` PURO. `calculos-elo4.mjs` foi escrito seguindo essa
// coluna ao pé da letra (só sessões). A diferença é REAL sempre que
// `chapter_view_progress.last_viewed_at` cai num dia que nenhuma sessão
// tocou — que É o caso do cenário semeado.
// ===========================================================================

function compararComCalculosElo4(
  fonte: FonteAutogestao,
  agoraISO: string,
  chapterAlvoAtual: string,
  chapterModulo4: string,
) {
  const agoraMs = Date.parse(agoraISO)
  const periodoDias = fonte.periodoDias
  const janelas = janelasComparaveisCalculos(agoraISO, periodoDias)
  const { sessoes, reflexoes, progresso, capitulos } = fonte
  const planoSnake = fonte.plano
    ? {
        module_durations: fonte.plano.moduleDurations,
        start_date: fonte.plano.startDateISO,
        recalculated_at: fonte.plano.recalculatedAtISO,
      }
    : null

  // --- 1.2 / 2.3 regularidade: dias distintos na janela atual -------------
  const diasAtualCalculos = diasComAtividadeNaJanela(janelas.atualInicio, janelas.atualFim, {
    sessoes,
    reflexoes,
    progresso,
  }).size
  const diasAtualProducao = diasDistintosUtc(
    carimbosDeAtividade(fonte),
    agoraMs - periodoDias * 86_400_000,
    agoraMs,
  ).size

  // --- 1.4 progresso real --------------------------------------------------
  const progressoCalculos = progressoRealCalculos(
    progresso,
    capitulos as unknown as { id: string }[],
  ).percentual
  const progressoProducao = progressoRealPercent(progresso, capitulos)

  // --- 1.6 dias desde última atividade --------------------------------------
  const diasUltimaCalculos = diasDesdeUltimaAtividadeCalculos(agoraISO, {
    sessoes,
    reflexoes,
    progresso,
  })
  const diasAtivosProducao = diasAtivosOrdenados(fonte)
  const diasUltimaProducao =
    diasAtivosProducao.length > 0
      ? diasUtcEntre(
          Date.parse(`${diasAtivosProducao[diasAtivosProducao.length - 1]}T00:00:00.000Z`),
          agoraMs,
        )
      : null

  // --- 1.14 sessão em aberto -------------------------------------------------
  const abertaCalculos = sessaoEmAbertoCalculos(agoraISO, sessoes)
  const abertaProducao = sessaoEmAberto(sessoes, agoraMs)

  // --- 2.4 maior intervalo (sessões apenas vs. toda atividade) --------------
  const maiorIntervaloCalculosSoSessoes = maiorIntervaloCalculos(sessoes)
  const maiorIntervaloProducaoTodaAtividade = maiorIntervaloDias(diasAtivosProducao)

  // --- 2.6 retomadas (sessões apenas vs. toda atividade) --------------------
  const retomadasCalculosSoSessoes = retomadasCalculos(sessoes)
  const retomadasProducaoTodaAtividade = contarRetomadas(diasAtivosProducao)

  // --- 3.2 / 3.4 módulo atual ------------------------------------------------
  const progressoModuloCalculos = progressoModuloAtualCalculos(
    progresso.find((p) => p.chapter_id === chapterAlvoAtual) ?? null,
  )
  const modSessoesCalculos = sessoesConcluidasModuloCalculos(sessoes, chapterAlvoAtual)

  // --- 1.16 último ajuste ----------------------------------------------------
  const ultimoAjusteCalculos = ultimoAjusteDiasCalculos(agoraISO, planoSnake)

  // --- 3.6 marco (módulo 4) --------------------------------------------------
  const marcoCalculosResultado = planoSnake
    ? marcoCalculos(planoSnake, capitulos as unknown as { id: string }[], chapterModulo4)
    : { faltaProva: true, motivo: "sem-plano" }

  const pares: { elemento: string; calculos: unknown; producao: unknown; mesmaBase: boolean }[] = [
    {
      elemento: "1.2_dias_ativos_janela_atual",
      calculos: diasAtualCalculos,
      producao: diasAtualProducao,
      mesmaBase: true,
    },
    {
      elemento: "1.4_progresso_real_percentual",
      calculos: progressoCalculos,
      producao: progressoProducao,
      mesmaBase: true,
    },
    {
      elemento: "1.6_dias_desde_ultima_atividade",
      calculos: diasUltimaCalculos,
      producao: diasUltimaProducao,
      mesmaBase: true,
    },
    {
      elemento: "1.14_sessao_em_aberto_dias",
      calculos: abertaCalculos?.diasAberta ?? null,
      producao: abertaProducao?.diasAberta ?? null,
      mesmaBase: true,
    },
    {
      elemento: "1.16_ultimo_ajuste_dias",
      calculos: ultimoAjusteCalculos,
      producao: raaUltimoAjusteDias(fonte, agoraMs),
      mesmaBase: true,
    },
    {
      elemento: "2.4_maior_intervalo_dias",
      calculos: maiorIntervaloCalculosSoSessoes,
      producao: maiorIntervaloProducaoTodaAtividade,
      mesmaBase: false, // achado: bases diferentes (sessões vs. toda atividade), ver cabeçalho
    },
    {
      elemento: "2.6_retomadas",
      calculos: retomadasCalculosSoSessoes,
      producao: retomadasProducaoTodaAtividade,
      mesmaBase: false, // idem
    },
    {
      elemento: "3.2_progresso_modulo_atual_percentual",
      calculos: progressoModuloCalculos,
      producao: modAtualProducaoPercent(fonte, chapterAlvoAtual, agoraMs),
      mesmaBase: true,
    },
    {
      elemento: "3.4_sessoes_concluidas_modulo",
      calculos: modSessoesCalculos.concluidas,
      producao: modAtualProducaoConcluidas(fonte, chapterAlvoAtual, agoraMs),
      mesmaBase: true,
    },
    {
      elemento: "3.6_marco_modulo4",
      calculos: marcoCalculosResultado,
      producao: marcoProducaoModulo4(fonte, chapterModulo4, agoraMs),
      // `montarMapaAutogestao` só expõe o marco do módulo ATUAL. Neste
      // cenário o módulo 4 não é o atual para nenhum dos dois alunos —
      // então este par não é comparável (escopo diferente, não fórmula
      // diferente), e não deve contar como divergência real.
      mesmaBase: false,
    },
  ]

  return pares.map((p) => {
    const naoComparavel =
      typeof p.producao === "object" &&
      p.producao !== null &&
      "naoComparavel" in (p.producao as Record<string, unknown>)
    return {
      ...p,
      divergente: naoComparavel ? false : JSON.stringify(p.calculos) !== JSON.stringify(p.producao),
      naoComparavel,
    }
  })
}

// Helpers de apoio ao cross-check (usam os montadores reais, não reimplementam nada).
function raaUltimoAjusteDias(fonte: FonteAutogestao, agoraMs: number): number | null {
  const r = montarVisaoGeralAutogestao(fonte, new Date(agoraMs))
  return r.respostaAosAjustes.conteudo?.ultimoAjusteDias ?? null
}
function modAtualProducaoPercent(
  fonte: FonteAutogestao,
  chapterId: string,
  agoraMs: number,
): number | null {
  const r = montarMapaAutogestao(fonte, new Date(agoraMs))
  return r.moduloAtual.conteudo?.id === chapterId ? r.moduloAtual.conteudo.progressoPercent : null
}
function modAtualProducaoConcluidas(
  fonte: FonteAutogestao,
  chapterId: string,
  agoraMs: number,
): number | null {
  const r = montarMapaAutogestao(fonte, new Date(agoraMs))
  return r.moduloAtual.conteudo?.id === chapterId ? r.moduloAtual.conteudo.sessoesConcluidas : null
}
function marcoProducaoModulo4(
  fonte: FonteAutogestao,
  chapterModulo4: string,
  agoraMs: number,
): unknown {
  // `montarMapaAutogestao` só calcula o marco do módulo ATUAL, não de um
  // módulo arbitrário — diferente de `calculos-elo4.mjs`, que aceita
  // qualquer capítulo-alvo. Comparável só quando o módulo 4 É o atual.
  const r = montarMapaAutogestao(fonte, new Date(agoraMs))
  if (r.moduloAtual.conteudo?.id !== chapterModulo4) {
    return { naoComparavel: "modulo-4-nao-e-o-atual-em-producao" }
  }
  const prazo = r.proximoMarco.conteudo?.prazo
  if (!prazo) return { faltaProva: true, motivo: "sem-conteudo" }
  return "lastro" in prazo
    ? { faltaProva: true, motivo: (prazo as { motivo: string }).motivo }
    : { faltaProva: false, dataISO: (prazo as { dataISO: string }).dataISO.slice(0, 10) }
}

// ===========================================================================
// Diff genérico
// ===========================================================================

function diffObjetos(esperado: Record<string, unknown>, obtido: Record<string, unknown>) {
  const divergencias: { elemento: string; esperado: unknown; obtido: unknown }[] = []
  const chaves = new Set([...Object.keys(esperado), ...Object.keys(obtido)])
  for (const chave of chaves) {
    const a = JSON.stringify(esperado[chave])
    const b = JSON.stringify(obtido[chave])
    if (a !== b)
      divergencias.push({ elemento: chave, esperado: esperado[chave], obtido: obtido[chave] })
  }
  return divergencias
}

// ===========================================================================
// Modo --gerar-gabarito
// ===========================================================================

async function gerarGabarito(agoraISO: string) {
  const { db, url, serviceKey } = criarCliente()
  try {
    const { ids, cenario } = await semearCenario({ db, url, serviceKey, agoraISO })
    const periodoDias = cenario.periodoDias as 7 | 30 | 90

    const fonteA = construirFonteConhecida(
      agoraISO,
      periodoDias,
      cenario.tenantId,
      cenario.alunoA.studentId,
      cenario.courseId,
      cenario.capitulos,
      cenario.alunoA.sessoes,
      cenario.alunoA.cvp,
      cenario.alunoA.plano,
    )
    const fonteB = construirFonteConhecida(
      agoraISO,
      periodoDias,
      cenario.tenantId,
      cenario.alunoB.studentId,
      cenario.courseId,
      cenario.capitulos,
      cenario.alunoB.sessoes,
      cenario.alunoB.cvp,
      null,
    )

    const agora = new Date(agoraISO)
    const visaoGeralA = montarVisaoGeralAutogestao(fonteA, agora)
    const padroesA = montarPadroesAutogestao(fonteA, agora)
    const mapaA = montarMapaAutogestao(fonteA, agora)
    const visaoGeralB = montarVisaoGeralAutogestao(fonteB, agora)
    const padroesB = montarPadroesAutogestao(fonteB, agora)
    const mapaB = montarMapaAutogestao(fonteB, agora)

    const elementosA = extrairElementosProducao(visaoGeralA, padroesA, mapaA)
    const elementosB = extrairElementosProducao(visaoGeralB, padroesB, mapaB)

    const chapterModulo4 = cenario.capitulos[3].id
    const chapterAtualA = cenario.capitulos[cenario.alunoA.chapterAtualIndex].id
    const chapterAtualB = cenario.capitulos[cenario.alunoB.chapterAtualIndex].id
    const divergenciasA = compararComCalculosElo4(fonteA, agoraISO, chapterAtualA, chapterModulo4)
    const divergenciasB = compararComCalculosElo4(fonteB, agoraISO, chapterAtualB, chapterModulo4)

    const gabarito = {
      agoraISO,
      periodoDias,
      tenantId: cenario.tenantId,
      courseId: cenario.courseId,
      capituloIds: ids.capituloIds,
      alunoA: {
        studentId: ids.alunoAId,
        chapterAtualIndex: cenario.alunoA.chapterAtualIndex,
        temPlano: true,
        elementosProducao: elementosA,
        divergenciasCalculosVsProducao: divergenciasA,
      },
      alunoB: {
        studentId: ids.alunoBId,
        chapterAtualIndex: cenario.alunoB.chapterAtualIndex,
        temPlano: false,
        elementosProducao: elementosB,
        divergenciasCalculosVsProducao: divergenciasB,
      },
    }

    mkdirSync(dirname(GABARITO_PATH), { recursive: true })
    writeFileSync(GABARITO_PATH, JSON.stringify(gabarito, null, 2))
    console.log("[gerar-gabarito] gravado em:", GABARITO_PATH)
    console.log(`[gerar-gabarito] elementos por aluno: ${Object.keys(elementosA).length}`)

    const todasDivergencias = [
      ...divergenciasA.filter((d) => d.divergente).map((d) => ({ aluno: "A", ...d })),
      ...divergenciasB.filter((d) => d.divergente).map((d) => ({ aluno: "B", ...d })),
    ]
    console.log(
      `\n[gerar-gabarito] divergências calculos-elo4.mjs vs produção: ${todasDivergencias.length}`,
    )
    for (const d of todasDivergencias) {
      console.log(
        `  [aluno ${d.aluno}] ${d.elemento} (${d.mesmaBase ? "mesma base de dados" : "BASES DIFERENTES — ver nota"}): ` +
          `calculos=${JSON.stringify(d.calculos)} producao=${JSON.stringify(d.producao)}`,
      )
    }
  } finally {
    await limparTudo({ db, url, serviceKey })
  }
}

// ===========================================================================
// Modo padrão — a prova
// ===========================================================================

async function provar(agoraISO: string) {
  let gabaritoArquivo: {
    alunoA: { elementosProducao: Record<string, unknown> }
    alunoB: { elementosProducao: Record<string, unknown> }
  }
  try {
    gabaritoArquivo = JSON.parse(readFileSync(GABARITO_PATH, "utf8"))
  } catch {
    console.error(
      `Não encontrei ${GABARITO_PATH}. Rode primeiro: node scripts/gauntlet/provar-elo4.mjs --agora ${agoraISO} --gerar-gabarito`,
    )
    process.exit(1)
    return
  }

  const { db, url, serviceKey } = criarCliente()
  let houveDivergencia = false

  try {
    const { ids } = await semearCenario({ db, url, serviceKey, agoraISO })
    const periodoDias = 7 as const

    const fonteFetchedA = await lerFonteAutogestao({
      db,
      tenantId: ids.tenantId,
      studentId: ids.alunoAId,
      courseId: ids.courseId,
      periodoDias,
    })
    const fonteFetchedB = await lerFonteAutogestao({
      db,
      tenantId: ids.tenantId,
      studentId: ids.alunoBId,
      courseId: ids.courseId,
      periodoDias,
    })

    // I-4: falha de leitura é erro duro, nunca seguir com dado parcial.
    for (const [rotulo, fonte] of [
      ["A", fonteFetchedA],
      ["B", fonteFetchedB],
    ] as const) {
      for (const [chave, falha] of Object.entries(fonte.falhas)) {
        if (falha)
          throw new Error(
            `falha de leitura (${rotulo}.${chave}): ${(falha as { mensagem: string }).mensagem}`,
          )
      }
    }

    const agora = new Date(agoraISO)
    const obtidoA = extrairElementosProducao(
      montarVisaoGeralAutogestao(fonteFetchedA, agora),
      montarPadroesAutogestao(fonteFetchedA, agora),
      montarMapaAutogestao(fonteFetchedA, agora),
    )
    const obtidoB = extrairElementosProducao(
      montarVisaoGeralAutogestao(fonteFetchedB, agora),
      montarPadroesAutogestao(fonteFetchedB, agora),
      montarMapaAutogestao(fonteFetchedB, agora),
    )

    const divergenciasA = diffObjetos(gabaritoArquivo.alunoA.elementosProducao, obtidoA)
    const divergenciasB = diffObjetos(gabaritoArquivo.alunoB.elementosProducao, obtidoB)

    console.log(
      `=== ALUNO A (com plano) — ${Object.keys(obtidoA).length} elementos obtidos via montagem.ts real ===`,
    )
    console.log(JSON.stringify(obtidoA, null, 2))
    console.log(
      `=== ALUNO B (sem plano) — ${Object.keys(obtidoB).length} elementos obtidos via montagem.ts real ===`,
    )
    console.log(JSON.stringify(obtidoB, null, 2))

    if (divergenciasA.length === 0 && divergenciasB.length === 0) {
      console.log("\n[provar-elo4] PASS — todos os elementos batem com o GABARITO (produção real).")
    } else {
      console.log("\n[provar-elo4] FAIL — divergências encontradas:")
      for (const d of [
        ...divergenciasA.map((d) => ({ aluno: "A", ...d })),
        ...divergenciasB.map((d) => ({ aluno: "B", ...d })),
      ]) {
        console.log(
          `  [aluno ${d.aluno}] ${d.elemento}: esperado=${JSON.stringify(d.esperado)} obtido=${JSON.stringify(d.obtido)}`,
        )
      }
      houveDivergencia = true
    }
  } finally {
    await limparTudo({ db, url, serviceKey })
  }

  process.exit(houveDivergencia ? 1 : 0)
}

async function main() {
  const argv = process.argv.slice(2)
  const agoraIdx = argv.indexOf("--agora")
  const agoraISO = agoraIdx >= 0 ? argv[agoraIdx + 1] : null
  if (!agoraISO) {
    console.error("Uso: node provar-elo4.mjs --agora <ISO> [--gerar-gabarito]")
    process.exit(1)
    return
  }
  if (argv.includes("--gerar-gabarito")) {
    await gerarGabarito(agoraISO)
    return
  }
  await provar(agoraISO)
}

main().catch((err) => {
  console.error("\nFATAL:", err)
  process.exit(1)
})
