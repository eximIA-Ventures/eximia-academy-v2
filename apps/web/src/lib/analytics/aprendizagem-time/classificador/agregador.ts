import {
  MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA,
  MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA,
} from "./limiares"
import type {
  CapabilityCriterio,
  CategoriaEvidencia,
  EstadoMaturidade,
  EvidenciaClassificada,
} from "./tipos"

// ---------------------------------------------------------------------------
// O agregador é PURO — nenhuma chamada de rede, nenhuma leitura de banco.
// Recebe as evidências já classificadas de um aluno×capacidade e decide o
// novo estado de maturidade, aplicando a regra de triangulação §30 (A+B ou
// A+C) e gerando o `rationale` explicável no formato do exemplo §40.
//
// Isto é deliberado: a explicabilidade do AGREGADO é sempre gerada em
// código, determinística e testável — nunca pedida ao LLM. Só a classificação
// por EVIDÊNCIA INDIVIDUAL (motor.ts) passa pelo modelo.
// ---------------------------------------------------------------------------

export interface AvaliacaoAgregada {
  novoEstado: EstadoMaturidade
  categoriasPresentes: CategoriaEvidencia[]
  triangulacaoOk: boolean
  criteriosAtendidos: string[]
  evidenciasConsideradas: string[]
  rationale: string
}

// Plural EXPLÍCITO, não sufixo "+s" — português tem plural irregular
// ("reflexão" → "reflexões", não "reflexãos") e um sufixo ingênuo produz
// texto errado bem debaixo do nariz de quem só olhar o `describe` do teste.
const ROTULO_FONTE: Record<string, { singular: string; plural: string }> = {
  reflection: { singular: "reflexão", plural: "reflexões" },
  quiz: { singular: "quiz", plural: "quizzes" },
  scenario: { singular: "cenário", plural: "cenários" },
  assignment: { singular: "atividade", plural: "atividades" },
  socratic_session: { singular: "sessão socrática", plural: "sessões socráticas" },
  real_evidence: { singular: "evidência real", plural: "evidências reais" },
  manager_validation: { singular: "validação do gestor", plural: "validações do gestor" },
}

export function avaliarMaturidade(
  evidencias: readonly EvidenciaClassificada[],
  criterios: readonly CapabilityCriterio[],
): AvaliacaoAgregada {
  // §6.1: só entram na conta evidências com compreensão avaliada — uma linha
  // com `comprehension: null` (classificação nunca rodou ou falhou sem
  // fallback) não conta como sinal, positivo nem negativo.
  const avaliaveis = evidencias.filter((e) => e.comprehension !== null)

  if (avaliaveis.length === 0) {
    return {
      novoEstado: "not_evidenced",
      categoriasPresentes: [],
      triangulacaoOk: false,
      criteriosAtendidos: [],
      evidenciasConsideradas: [],
      rationale: "Nenhuma evidência avaliável ainda para esta capacidade.",
    }
  }

  const porCategoria = new Map<CategoriaEvidencia, EvidenciaClassificada[]>()
  for (const ev of avaliaveis) {
    const lista = porCategoria.get(ev.evidenceCategory) ?? []
    lista.push(ev)
    porCategoria.set(ev.evidenceCategory, lista)
  }
  const categoriasPresentes = [...porCategoria.keys()]

  const temA =
    (porCategoria.get("cognitive")?.length ?? 0) >= MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA
  const temB =
    (porCategoria.get("application")?.length ?? 0) >= MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA
  const temC =
    (porCategoria.get("real_context")?.length ?? 0) >= MIN_EVIDENCIAS_POR_CATEGORIA_DEMONSTRADA

  // §30 regra MVP: A+B ou A+C. A sozinho, por mais evidência que acumule,
  // nunca basta — é o F-01 que trava esta regra em teste.
  const triangulacaoOk = temA && (temB || temC)

  const criteriosAtendidos = [...new Set(avaliaveis.flatMap((e) => e.criteriaMet))]

  const algumaAplicacao = avaliaveis.some(
    (e) =>
      e.applicationLevel === "simulated" ||
      e.applicationLevel === "contextualized" ||
      e.applicationLevel === "applied_real",
  )
  const algumaCompreensao = avaliaveis.some(
    (e) => e.comprehension === "evidenced" || e.comprehension === "partial",
  )

  let novoEstado: EstadoMaturidade
  if (triangulacaoOk) {
    novoEstado = "demonstrated"
  } else if (avaliaveis.length >= MIN_EVIDENCIAS_DESENVOLVIMENTO_COGNITIVA && algumaAplicacao) {
    novoEstado = "developing"
  } else if (algumaCompreensao) {
    novoEstado = "emerging"
  } else {
    novoEstado = "not_evidenced"
  }

  return {
    novoEstado,
    categoriasPresentes,
    triangulacaoOk,
    criteriosAtendidos,
    evidenciasConsideradas: avaliaveis.map((e) => e.id),
    rationale: montarRationale(
      novoEstado,
      avaliaveis,
      categoriasPresentes,
      criteriosAtendidos,
      criterios,
    ),
  }
}

/**
 * Gera o texto de explicabilidade no formato do exemplo §40: "Foram
 * consideradas N evidências: X reflexões, Y cenários e Z atividades. Há
 * [leitura de compreensão] e aplicação [leitura], mas ainda falta evidência
 * em [categoria faltante]." — sempre determinístico, nunca vindo do LLM.
 */
function montarRationale(
  estado: EstadoMaturidade,
  avaliaveis: readonly EvidenciaClassificada[],
  categoriasPresentes: readonly CategoriaEvidencia[],
  criteriosAtendidos: readonly string[],
  criterios: readonly CapabilityCriterio[],
): string {
  const contagemPorFonte = new Map<string, number>()
  for (const e of avaliaveis) {
    contagemPorFonte.set(e.sourceType, (contagemPorFonte.get(e.sourceType) ?? 0) + 1)
  }
  const partesFonte = [...contagemPorFonte.entries()].map(([fonte, n]) => {
    const rotulo = ROTULO_FONTE[fonte]
    const nome = rotulo ? (n > 1 ? rotulo.plural : rotulo.singular) : fonte
    return `${n} ${nome}`
  })
  const listaFontes = formatarLista(partesFonte)

  const compreensaoConsistente = avaliaveis.filter((e) => e.comprehension === "evidenced").length
  const compreensaoParcial = avaliaveis.filter((e) => e.comprehension === "partial").length
  const leituraCompreensao =
    compreensaoConsistente >= compreensaoParcial && compreensaoConsistente > 0
      ? "compreensão consistente"
      : compreensaoParcial > 0
        ? "compreensão parcial"
        : "compreensão ainda não evidenciada"

  const aplicacaoReal = avaliaveis.some((e) => e.applicationLevel === "applied_real")
  const aplicacaoContextualizada = avaliaveis.some((e) => e.applicationLevel === "contextualized")
  const aplicacaoSimulada = avaliaveis.some((e) => e.applicationLevel === "simulated")
  const leituraAplicacao = aplicacaoReal
    ? "aplicação em contexto real"
    : aplicacaoContextualizada
      ? "aplicação contextualizada"
      : aplicacaoSimulada
        ? "aplicação simulada"
        : "aplicação ainda não evidenciada"

  const categoriasFaltantes = (["cognitive", "application", "real_context"] as const).filter(
    (c) => !categoriasPresentes.includes(c),
  )
  // Fragmento que completa "Ainda falta evidência ___" — cada um já concorda
  // com essa abertura, sem repetir a palavra "evidência".
  const fragmentoCategoria: Record<CategoriaEvidencia, string> = {
    cognitive: "cognitiva",
    application: "de aplicação",
    real_context: "em contexto real",
  }
  const faltaTexto =
    categoriasFaltantes.length > 0
      ? ` Ainda falta evidência ${formatarLista(categoriasFaltantes.map((c) => fragmentoCategoria[c]))}.`
      : ""

  const criteriosTexto =
    criteriosAtendidos.length > 0
      ? ` Critérios atendidos: ${criteriosAtendidos.join(", ")} de ${criterios.length} previstos.`
      : ""

  return `Foram consideradas ${avaliaveis.length} evidências: ${listaFontes}. Há ${leituraCompreensao} e ${leituraAplicacao}.${faltaTexto}${criteriosTexto}`.trim()
}

function formatarLista(itens: readonly string[]): string {
  if (itens.length === 0) return ""
  if (itens.length === 1) return itens[0]
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`
}
