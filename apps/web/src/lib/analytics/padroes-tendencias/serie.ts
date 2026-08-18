// ---------------------------------------------------------------------------
// §17 — "Evolução do ritmo". Duas séries, e só duas.
// ---------------------------------------------------------------------------
// A pergunta que este bloco responde (§34) é "há mais pessoas estudando ou
// apenas mais sessões?". Ela só tem resposta se as duas séries dividirem o
// mesmo universo e contarem coisas DIFERENTES:
//
//   • "Alunos ativos" deduplica por PESSOA na semana — cinco sessões de alguém
//     numa terça valem 1;
//   • "Sessões realizadas" conta LINHAS de `sessions` criadas na semana — as
//     mesmas cinco valem 5, e só `created_at` entra (contar `updated_at`
//     contaria a mesma sessão em duas semanas, e a série passaria a superar a
//     realidade justamente para quem mais estuda).
//
// ESTADO VAZIO NÃO RENDERIZA EIXO. Gráfico vazio é o formato preferido da
// mentira: parece dado e é ausência. Com menos de duas semanas com atividade, o
// bloco devolve `pontos: []` e `eixoY: null`, e a UI mostra o texto da §32.
// ---------------------------------------------------------------------------

import type { FalhasPorFonte } from "../visao-geral/fonte"
import type { BasePadroes } from "./base"
import { FONTES_DA_SERIE, primeiraFalha } from "./fonte"
import { SERIE_SEMANAS_COM_ATIVIDADE_MIN } from "./parametros"
import { eixoY } from "./semanas"
import {
  ACAO_SERIE,
  SUBTITULO_SERIE,
  TITULO_SERIE,
  VAZIO_SEM_ESCOPO,
  VAZIO_TENDENCIA,
} from "./textos"
import type { Acao, BlocoSerie, ComEstado, EntradaLegenda, PontoSerie } from "./tipos"

const ACAO: Acao = { id: "serie", rotulo: ACAO_SERIE, ctaEscreve: false }

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
    eixoY: eixoY(pico),
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
