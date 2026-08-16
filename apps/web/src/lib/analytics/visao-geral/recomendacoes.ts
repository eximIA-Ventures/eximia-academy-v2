// ---------------------------------------------------------------------------
// §11 + §29 — "O que fazer agora": as 4 regras determinísticas, corte em 3.
// ---------------------------------------------------------------------------
// A §29 diz que IA generativa não é obrigatória no MVP. Aqui ela é ativamente
// CONTRAINDICADA, e o motivo é concreto: o `ActionInsightCard` que já existe
// (`analytics-ui.tsx`) tem um CTA que faz `POST /api/analytics/insights` e
// SUBSTITUI todas as recomendações determinísticas por texto de modelo. Numa
// tela medida por fixture determinística isso quebra a verificação, e num card
// sujeito a I-7 coloca texto não-auditado em cena. O que se reusa dele é o
// IDIOM (função pura sobre agregados já calculados, como `generateUsageInsights`),
// não o componente: a forma do dado nem cabe — faltam prioridade, contexto,
// CTA e alvos, que são justamente o que a §11 torna obrigatório.
//
// ORDENAÇÃO: prioridade de AÇÃO (A=1, C=1, B=2, D=3), empate resolvido pela
// ordem FIXA das regras. Nunca por magnitude — ordenar por magnitude
// reintroduziria o ranking que I-8 proíbe, por outra porta.
// ---------------------------------------------------------------------------

import { SEM_ACESSO_DAYS } from "@/lib/student-triage"
import type { BaseCalculo } from "./base"
import { chaveDiaUtc } from "./dia-utc"
import { type FalhasPorFonte, primeiraFalha } from "./fonte"
import {
  CONCENTRACAO_MODULO_PCT,
  MS_SEMANA,
  QUEDA_ATIVOS_PCT,
  RECOMENDACOES_MAX,
  REGULARIDADE_MIN_DIAS_NA_SEMANA,
  RITMO_CONSISTENTE_SEMANAS,
} from "./parametros"
import { VAZIO_GARGALOS, VAZIO_SEM_ESCOPO } from "./textos"
import type { BlocoRecomendacoes, ComEstado, Recomendacao } from "./tipos"

const FONTES_DAS_RECOMENDACOES = [
  "roster",
  "sessoes",
  "reflexoes",
  "matriculas",
  "cursos",
  "capitulos",
] as const

interface Candidata extends Recomendacao {
  ordemDaRegra: number
}

/** §29 regra A — concentração de pessoas não-sustentando no mesmo módulo. */
function regraConcentracao(base: BaseCalculo): Candidata | null {
  const total = base.roster.size
  if (total === 0) return null

  const porModulo = new Map<string, string[]>()
  for (const [alunoId, capituloId] of base.moduloCorrentePorAluno) {
    if (base.estadoPorAluno.get(alunoId) === "sustentando") continue
    porModulo.set(capituloId, [...(porModulo.get(capituloId) ?? []), alunoId])
  }

  let melhorId: string | null = null
  let melhorAlvos: string[] = []
  for (const [capituloId, alvos] of porModulo) {
    if (alvos.length > melhorAlvos.length) {
      melhorId = capituloId
      melhorAlvos = alvos
    }
  }
  if (melhorId === null || melhorAlvos.length / total <= CONCENTRACAO_MODULO_PCT) return null

  const titulo = base.tituloPorCapitulo.get(melhorId) ?? "este módulo"
  return {
    prioridade: 1,
    badgeTom: "red",
    titulo: `Apoiar ${melhorAlvos.length} ${melhorAlvos.length === 1 ? "pessoa parada" : "pessoas paradas"} em "${titulo}"`,
    contexto: "Há concentração de pessoas neste módulo. Considere realizar uma sessão de apoio.",
    ctaRotulo: "Ver pessoas",
    ctaIcone: "users",
    alunosAlvo: [...melhorAlvos].sort(),
    ctaEscreve: false,
    ordemDaRegra: 1,
  }
}

/** §29 regra B — queda de PESSOAS ativas (não de sessões) acima de 15%. */
function regraQuedaDeAtivos(base: BaseCalculo): Candidata | null {
  const anterior = base.ativosNoPeriodoAnterior.size
  // Sem período anterior a regra NÃO dispara: o bloco irmão "O que mudou" já
  // cobre esse caso com o texto de §32. Inventar aqui seria inventar duas vezes.
  if (anterior === 0) return null
  const atual = base.ativosNoPeriodo.size
  const variacao = (atual - anterior) / anterior
  if (variacao >= -QUEDA_ATIVOS_PCT) return null

  const alvos = [...base.ativosNoPeriodoAnterior].filter((id) => !base.ativosNoPeriodo.has(id))
  return {
    prioridade: 2,
    badgeTom: "amber",
    titulo: `Verificar ${alvos.length} ${alvos.length === 1 ? "pessoa que deixou" : "pessoas que deixaram"} de acessar`,
    contexto: "A ativação caiu significativamente. Verifique os grupos que deixaram de acessar.",
    ctaRotulo: "Ver pessoas",
    ctaIcone: "users",
    alunosAlvo: alvos.sort(),
    ctaEscreve: false,
    ordemDaRegra: 2,
  }
}

/**
 * §29 regra C — "estava no ritmo e não acessa há 14+ dias".
 *
 * Nenhuma consulta nova: a triagem canônica devolve `sem_acesso` quando, e só
 * quando, a pessoa não concluiu, NÃO está atrasada, NÃO é não-iniciada e sumiu
 * há mais de 14 dias. Traduzido: em dia no cronograma quando parou, e sumida.
 * É a regra C ao pé da letra, com outro nome.
 */
function regraReativar(base: BaseCalculo): Candidata | null {
  const alvos = [...base.triagemPorAluno.entries()]
    .filter(([, t]) => t === "sem_acesso")
    .map(([id]) => id)
    .sort()
  if (alvos.length === 0) return null

  return {
    prioridade: 1,
    badgeTom: "red",
    titulo: `Reativar ${alvos.length} ${alvos.length === 1 ? "pessoa sem acesso" : "pessoas sem acesso"} há mais de ${SEM_ACESSO_DAYS} dias`,
    // A fixture diz "4 delas estavam no ritmo antes de parar". Com o dado real,
    // TODAS estão — é a definição do bucket. Escrever "4 de 6" exigiria um
    // histórico de pace que o banco não guarda.
    contexto: "Todas estavam em dia no cronograma quando pararam.",
    ctaRotulo: "Ver pessoas",
    ctaIcone: "users",
    alunosAlvo: alvos,
    ctaEscreve: false,
    ordemDaRegra: 3,
  }
}

/** §29 regra D — ritmo mantido por 3 semanas consecutivas. */
function regraReconhecer(base: BaseCalculo): Candidata | null {
  const alvos: string[] = []
  for (const id of base.roster) {
    if (base.estadoPorAluno.get(id) !== "sustentando") continue
    if (manteveRitmo(base.carimbosPorAluno.get(id) ?? [], base.agoraMs)) alvos.push(id)
  }
  if (alvos.length === 0) return null

  return {
    prioridade: 3,
    badgeTom: "green",
    titulo: `Reconhecer ${alvos.length} ${alvos.length === 1 ? "pessoa" : "pessoas"} com ritmo consistente`,
    contexto: `Mantiveram o plano por ${RITMO_CONSISTENTE_SEMANAS} semanas.`,
    ctaRotulo: "Reconhecer",
    ctaIcone: "award",
    alunosAlvo: alvos.sort(),
    // Escreve em banco: fica inerte enquanto o gate estiver desligado.
    ctaEscreve: true,
    ordemDaRegra: 4,
  }
}

/**
 * 3 semanas consecutivas com atividade em ≥2 dias distintos.
 *
 * A semana deriva da CHAVE DE DIA UTC (I-6), nunca de `startOfISOWeek` do
 * date-fns — que é local-timezone e é importado por
 * `api/analytics/manager/route.ts`. Esse é o precedente a NÃO copiar: com ele,
 * uma sessão das 21h de Brasília cai numa semana no servidor e noutra no
 * cliente, e o reconhecimento passa a depender de quem renderizou.
 */
function manteveRitmo(carimbos: readonly number[], agoraMs: number): boolean {
  for (let w = 0; w < RITMO_CONSISTENTE_SEMANAS; w++) {
    const ate = agoraMs - w * MS_SEMANA
    const de = ate - MS_SEMANA
    const dias = new Set<string>()
    for (const t of carimbos) {
      if (t >= de && t < ate) dias.add(chaveDiaUtc(t))
    }
    if (dias.size < REGULARIDADE_MIN_DIAS_NA_SEMANA) return false
  }
  return true
}

export function montarRecomendacoes(
  base: BaseCalculo,
  falhas: FalhasPorFonte,
): ComEstado<BlocoRecomendacoes> {
  const moldura = { titulo: "O que fazer agora", tituloIcone: "sparkles" }

  const falha = primeiraFalha(falhas, FONTES_DAS_RECOMENDACOES)
  if (falha) {
    return {
      ...moldura,
      recomendacoes: [],
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.roster.size === 0) {
    return {
      ...moldura,
      recomendacoes: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  const candidatas = [
    regraConcentracao(base),
    regraQuedaDeAtivos(base),
    regraReativar(base),
    regraReconhecer(base),
  ].filter((c): c is Candidata => c !== null)

  if (candidatas.length === 0) {
    return {
      ...moldura,
      recomendacoes: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_GARGALOS,
      motivoVazio: "sem-gargalos",
    }
  }

  const recomendacoes = candidatas
    .sort((a, b) => a.prioridade - b.prioridade || a.ordemDaRegra - b.ordemDaRegra)
    .slice(0, RECOMENDACOES_MAX)
    .map(({ ordemDaRegra: _ordem, ...rec }) => rec)

  return {
    ...moldura,
    recomendacoes,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
