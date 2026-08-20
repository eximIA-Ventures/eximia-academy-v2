// ---------------------------------------------------------------------------
// Contrato compartilhado dos testes do Mapa da jornada (F-01..F-35).
//
// NÃO é um arquivo de teste (vitest só coleta `*.test.ts`). É a régua: resolve
// a camada de dados, constrói a fixture canônica e exporta os detectores.
//
// A FIXTURE TEM DOIS CURSOS DE TAMANHOS DIFERENTES, E ISSO NÃO É CAPRICHO.
// F-22 ("Chegaram") é constante dentro de um curso — a implementação correta e
// a implementação preguiçosa (`() => 40`) produzem o MESMO output em qualquer
// fixture de curso único, e nenhum teste de variância consegue separá-las. A
// única entrada que move o número é a existência de um segundo curso com outra
// população. Sem ele, F-22 seria satisfeito por uma constante.
//
// A fixture também é DELIBERADAMENTE não-degenerada: quatro estados de pessoa
// ocupados, dois módulos de gargalo com contagens DIFERENTES, e uma pessoa no
// gargalo do módulo âncora que NÃO é travada (é o achado A-3 encarnado: gargalo
// e travados são populações distintas no mesmo módulo).
//
// Regra de imutabilidade (`loop-engineering.md` §4): este material é rubrica do
// gauntlet. Quem implementa a camada NÃO reescreve o que o mede.
// ---------------------------------------------------------------------------

// ===========================================================================
// 1 — Resolução da camada de dados
// ===========================================================================

/**
 * Import DEFERIDO. Se `../index.ts` não existir, o erro aparece como falha de
 * teste com mensagem explícita, e NÃO como crash de transform do vite. Falhar
 * aqui é o comportamento CORRETO enquanto a camada não existir — criar stub
 * para ficar verde é exatamente o defeito que estes testes combatem.
 */
export async function carregarModuloMapa(): Promise<Record<string, unknown>> {
  try {
    return (await import("../index")) as unknown as Record<string, unknown>
  } catch (causa) {
    const detalhe = causa instanceof Error ? causa.message : String(causa)
    throw new Error(
      [
        "CONTRATO NÃO CUMPRIDO: apps/web/src/lib/analytics/mapa-jornada/index.ts não pôde ser importado.",
        "Este teste DEVE falhar enquanto a camada de dados não existir.",
        "NÃO crie stub para fazer passar — teste que passa antes da implementação é o defeito.",
        `Causa: ${detalhe}`,
      ].join(" "),
    )
  }
}

export function resolverExport<T = unknown>(
  mod: Record<string, unknown>,
  papel: string,
  nomesAceitos: readonly string[],
): T {
  for (const nome of nomesAceitos) {
    const valor = mod[nome]
    if (typeof valor === "function") return valor as T
  }
  const disponiveis = Object.keys(mod).join(", ") || "(nenhum)"
  throw new Error(
    `CONTRATO NÃO CUMPRIDO: nenhum export para "${papel}". ` +
      `Aceitos: ${nomesAceitos.join(" | ")}. Encontrados em ../index: ${disponiveis}.`,
  )
}

export const NOMES_ENTRADA_MAPA = [
  "computeMapaJornada",
  "montarMapaJornada",
  "carregarMapaJornada",
  "mapaJornada",
] as const

export const NOMES_CHAVE_DIA = ["chaveDiaUtc", "utcDayKey", "diaUtc"] as const

// ===========================================================================
// 2 — Forma da entrada sintética (espelha `entrada.ts`, sem importar dele)
// ===========================================================================

export interface AlunoBrutoMapa {
  id: string
  nome: string
}
export interface CursoBrutoMapa {
  id: string
  titulo: string
  deadlineDays: number | null
}
export interface CapituloBrutoMapa {
  id: string
  cursoId: string
  titulo: string
  ordem: number
  status?: string
}
export interface SlideBrutoMapa {
  id: string
  capituloId: string
  ordem: number
}
export interface MatriculaBrutaMapa {
  alunoId: string
  cursoId: string
  status: "active" | "completed" | "cancelled"
  criadaEmISO: string
}
export interface PercorridoBrutoMapa {
  alunoId: string
  capituloId: string
  maxSlideIndex: number
  slidesTotalNaPassagem: number
  chegouAoFimISO?: string | null
  ultimaVistaISO?: string | null
}
export interface SessaoBrutaMapa {
  alunoId: string
  capituloId: string | null
  status?: string
  criadaEmISO: string
  atualizadaEmISO?: string | null
}
export interface ReflexaoBrutaMapa {
  alunoId: string
  slideId: string | null
  criadaEmISO: string
  atualizadaEmISO?: string | null
}

export interface EntradaMapaJornada {
  agoraISO: string
  periodoDias: number
  escopo: readonly string[]
  alunos: readonly AlunoBrutoMapa[]
  cursos: readonly CursoBrutoMapa[]
  capitulos: readonly CapituloBrutoMapa[]
  slides: readonly SlideBrutoMapa[]
  matriculas: readonly MatriculaBrutaMapa[]
  percorrido?: readonly PercorridoBrutoMapa[]
  sessoes?: readonly SessaoBrutaMapa[]
  reflexoes?: readonly ReflexaoBrutaMapa[]
  tenantId?: string
}

// ===========================================================================
// 3 — Saída, reduzida ao que os testes afirmam
// ===========================================================================

export interface SaidaMapa {
  estado: string
  erro: unknown
  contexto: { periodoDias: number; totalAlunos: number }
  mapa: {
    estado: string
    totalAlunos: number
    totalAlunosLabel: string
    colunas: ReadonlyArray<{ id: string; numero: number; titulo: string; cursoId: string }>
    linhas: ReadonlyArray<{
      alunoId: string
      nome: string
      avatarTone: string
      estado: string
      celulas: readonly string[]
    }>
    filtros: ReadonlyArray<{ id: string; rotulo: string; total: number }>
    exibidas: number
    resto: number
    rotuloResto: string | null
    legenda: ReadonlyArray<{ estado: string; rotulo: string }>
    textoRodape: string
    textoVazio: string | null
    motivoVazio: string | null
  }
  gargalos: {
    estado: string
    textoVazio: string | null
    motivoVazio: string | null
    linhas: ReadonlyArray<{
      moduloId: string
      /**
       * F-10 · posição na lista (1..5), o numeral do badge. Declarado aqui
       * porque este tipo é uma CÓPIA estrutural da saída: campo novo que não
       * seja repetido aqui simplesmente não existe para os testes de contrato,
       * que é o mesmo modo de falha já registrado em `insights` mais abaixo.
       */
      ordem: number
      /** Posição do MÓDULO na grade. Alimenta o insight F-28. */
      numero: number
      titulo: string
      pessoas: number
      pct: number
      proporcao: number
    }>
    linkRodape: string | null
  }
  distribuicao: {
    estado: string
    tiles: ReadonlyArray<{ id: string; rotulo: string; valor: number; pct: number }>
  }
  travados: {
    estado: string
    presente: boolean
    moduloTitulo: string
    linhas: ReadonlyArray<{
      alunoId: string
      nome: string
      paradoHaDias: number | null
      paradoHaLabel: string
      ultimaAtividadeLabel: string
    }>
    ctaTotal: number
    textoVazio: string | null
    motivoVazio: string | null
  }
  funil: {
    estado: string
    linhas: ReadonlyArray<{
      moduloId: string
      numero: number
      chegaram: number
      iniciaram: number
      concluiram: number
      conversaoPct: number | null
      conversaoLabel: string
    }>
    notaRegua: string
    linkRodape: string | null
  }
  insights: {
    estado: string
    itens: ReadonlyArray<{ id: string; texto: string }>
    acao: { texto: string; ctaRotulo: string; ctaEscreve: boolean; moduloId: string } | null
    // F-31 afirma os dois no cenário de vazio (`sem-base` com o literal da §32).
    // Estavam ASSERTADOS no teste e ausentes desta forma: o teste passava em
    // runtime e o `tsc` reprovava — a asserção certa com o tipo incompleto.
    textoVazio: string | null
    motivoVazio: string | null
  }
  faixaRodape: string
  notaPeriodo: string
}

export async function calcular(entrada: EntradaMapaJornada): Promise<SaidaMapa> {
  const mod = await carregarModuloMapa()
  const fn = resolverExport<(e: EntradaMapaJornada) => unknown>(
    mod,
    "entrada principal do Mapa da jornada",
    NOMES_ENTRADA_MAPA,
  )
  return (await Promise.resolve(fn(entrada))) as SaidaMapa
}

// ===========================================================================
// 4 — Relógio e a fixture canônica
// ===========================================================================

export const AGORA_ISO = "2026-08-17T12:00:00.000Z"
export const AGORA_MS = Date.parse(AGORA_ISO)
export const DIA_MS = 86_400_000

export const diasAtras = (n: number, horaUtc = 10): string => {
  const base = new Date(AGORA_MS - n * DIA_MS)
  base.setUTCHours(horaUtc, 0, 0, 0)
  return base.toISOString()
}

/** Ordem lexicográfica dos ids importa: F-02 desempata por `course_id` ASC. */
export const CURSO_A = "C1-solucao-de-problemas"
export const CURSO_B = "C2-seguranca"

export const TITULOS_A = [
  "Introdução à Análise e Solução de Problemas",
  "Definir o Problema",
  "Identificar o Problema",
  "Análise de Causa",
  "Ações Corretivas",
  "Executar as Ações Corretivas",
  "Monitoramento dos Resultados",
] as const

export const TITULOS_B = ["Riscos do dia a dia", "Equipamentos", "Plano de resposta"] as const

export const CAPS_A = TITULOS_A.map((_, i) => `${CURSO_A}-cap${i + 1}`)
export const CAPS_B = TITULOS_B.map((_, i) => `${CURSO_B}-cap${i + 1}`)

/** O módulo âncora do gargalo na fixture: `Executar as Ações Corretivas` (nº 6). */
export const CAP_ANCORA = CAPS_A[5] as string

const SLIDES_POR_CAP_A = 4
const SLIDES_POR_CAP_B = 2

function slidesDe(capitulos: readonly string[], quantos: number): SlideBrutoMapa[] {
  const out: SlideBrutoMapa[] = []
  for (const capituloId of capitulos) {
    for (let i = 0; i < quantos; i++) {
      out.push({ id: `${capituloId}-s${i}`, capituloId, ordem: i })
    }
  }
  return out
}

const CAPITULOS: CapituloBrutoMapa[] = [
  ...CAPS_A.map((id, i) => ({
    id,
    cursoId: CURSO_A,
    titulo: TITULOS_A[i] as string,
    ordem: i,
    status: "published",
  })),
  ...CAPS_B.map((id, i) => ({
    id,
    cursoId: CURSO_B,
    titulo: TITULOS_B[i] as string,
    ordem: i,
    status: "published",
  })),
]

const SLIDES: SlideBrutoMapa[] = [
  ...slidesDe(CAPS_A, SLIDES_POR_CAP_A),
  ...slidesDe(CAPS_B, SLIDES_POR_CAP_B),
]

const ALUNOS: AlunoBrutoMapa[] = [
  { id: "P01", nome: "Artur Barcelos" },
  { id: "P02", nome: "Cintia Santana" },
  { id: "P03", nome: "Neusa Jorge" },
  // Nome escolhido para cair nas 8 primeiras linhas em ordem alfabética: P04 é
  // o portador da variância de F-33 (entra e sai de "retomando" conforme a
  // janela), e a asserção precisa alcançá-lo na AMOSTRA exibida.
  { id: "P04", nome: "Bento Ramires" },
  { id: "P05", nome: "Caio Pinheiro" },
  { id: "P06", nome: "Ribeiro Preto" },
  { id: "P07", nome: "Mariana Alves" },
  { id: "P08", nome: "Lucas Ferreira" },
  { id: "P09", nome: "Zilda Nunes" },
  { id: "P10", nome: "Yara Bastos" },
  { id: "Q1", nome: "Helena Prado" },
  { id: "Q2", nome: "Ivan Toledo" },
  { id: "Q3", nome: "Joana Mendes" },
  { id: "Q4", nome: "Kleber Assis" },
]

/** Linha de percorrido COMPLETO (chegou ao fim) do capítulo. */
function completo(
  alunoId: string,
  capituloId: string,
  total: number,
  quandoISO: string,
): PercorridoBrutoMapa {
  return {
    alunoId,
    capituloId,
    maxSlideIndex: total - 1,
    slidesTotalNaPassagem: total,
    chegouAoFimISO: quandoISO,
    ultimaVistaISO: quandoISO,
  }
}

/**
 * Fixture canônica. Estados ocupados, e por quê:
 *
 *  | pessoa      | curso | posição                         | estado         |
 *  |:---|:---|:---|:---|
 *  | P01, P02    | A     | 7 módulos concluídos            | concluído      |
 *  | P03         | A     | gargalo do nº 6, atividade recente e contínua | perdendo ritmo |
 *  | P04         | A + B | evidência no nº 6 há 93 dias, atividade em B há 40 | parado |
 *  | P05, P06    | A     | evidência no nº 6 há 90 / 92 dias | parado        |
 *  | P07, P08    | A     | em andamento no nº 4, ativo     | sustentando    |
 *  | P09, P10    | A     | nenhuma evidência               | não iniciou    |
 *  | Q1          | B     | 3 módulos concluídos            | concluído      |
 *  | Q2, Q3      | B     | evidência no nº 2 há 30 / 35 dias | parado       |
 *  | Q4          | B     | nenhuma evidência               | não iniciou    |
 *
 * Consequências que os testes afirmam:
 *  • gargalo do nº 6 = 4 pessoas (P03..P06); do B-nº2 = 2 (Q2,Q3) → duas
 *    contagens DIFERENTES, sem as quais F-08 passaria por vacuidade;
 *  • travados no nº 6 = 3 (P04..P06), porque P03 tem atividade recente → o
 *    insight (F-29) e o gargalo (F-08) divergem de propósito (achado A-3);
 *  • "Chegaram" = 10 no curso A e 5 no curso B → a única entrada capaz de
 *    mover a coluna constante de F-22;
 *  • P04 tem `Parado há` = 93 e `Última atividade` = 40 dias, dois números
 *    diferentes na mesma linha (F-19 vs F-20).
 */
export function entradaBase(): EntradaMapaJornada {
  const percorrido: PercorridoBrutoMapa[] = []
  const sessoes: SessaoBrutaMapa[] = []

  // P01 e P02 — concluíram o curso A inteiro.
  for (const alunoId of ["P01", "P02"]) {
    for (const capituloId of CAPS_A) {
      percorrido.push(completo(alunoId, capituloId, SLIDES_POR_CAP_A, diasAtras(5)))
    }
  }

  // P03 — gargalo do módulo 6 com atividade recente e CONTÍNUA (sem lacuna de
  // 14 dias cujo retorno caia na janela: senão viraria "retomando").
  for (const dias of [20, 13, 6, 1]) {
    sessoes.push({ alunoId: "P03", capituloId: CAP_ANCORA, criadaEmISO: diasAtras(dias) })
  }

  // P04 — evidência no módulo 6 há 93 dias, e atividade no curso B há 40 dias.
  // O piso cumulativo é POR CURSO, então a atividade em B não eleva o curso A.
  sessoes.push({ alunoId: "P04", capituloId: CAP_ANCORA, criadaEmISO: diasAtras(93) })
  sessoes.push({ alunoId: "P04", capituloId: CAPS_B[0] as string, criadaEmISO: diasAtras(40) })

  sessoes.push({ alunoId: "P05", capituloId: CAP_ANCORA, criadaEmISO: diasAtras(90) })
  sessoes.push({ alunoId: "P06", capituloId: CAP_ANCORA, criadaEmISO: diasAtras(92) })

  // P07 e P08 — em andamento no módulo 4, ativos.
  for (const alunoId of ["P07", "P08"]) {
    sessoes.push({ alunoId, capituloId: CAPS_A[3] as string, criadaEmISO: diasAtras(2) })
  }

  // Q1 — concluiu o curso B inteiro.
  for (const capituloId of CAPS_B) {
    percorrido.push(completo("Q1", capituloId, SLIDES_POR_CAP_B, diasAtras(4)))
  }

  sessoes.push({ alunoId: "Q2", capituloId: CAPS_B[1] as string, criadaEmISO: diasAtras(30) })
  sessoes.push({ alunoId: "Q3", capituloId: CAPS_B[1] as string, criadaEmISO: diasAtras(35) })

  // Matrículas. `criadaEmISO` distante + `deadlineDays` curto é o que faz
  // `expectedPct` superar o progresso e a pessoa contar como atrasada.
  // P07 e P08 entraram há pouco: `expectedPct` fica baixo, o progresso deles o
  // supera, e por isso NÃO são atrasados — é assim que a fixture ocupa o estado
  // "sustentando" em vez de deixar o filtro em zero (F-07 seria degenerado).
  const RECENTES = new Set(["P07", "P08"])
  const matriculas: MatriculaBrutaMapa[] = [
    ...["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10"].map((alunoId) => ({
      alunoId,
      cursoId: CURSO_A,
      status: "active" as const,
      criadaEmISO: diasAtras(RECENTES.has(alunoId) ? 30 : 300),
    })),
    ...["P04", "Q1", "Q2", "Q3", "Q4"].map((alunoId) => ({
      alunoId,
      cursoId: CURSO_B,
      status: "active" as const,
      criadaEmISO: diasAtras(300),
    })),
  ]

  return {
    agoraISO: AGORA_ISO,
    periodoDias: 30,
    escopo: ALUNOS.map((a) => a.id),
    alunos: ALUNOS,
    cursos: [
      { id: CURSO_A, titulo: "Análise e Solução de Problemas", deadlineDays: 365 },
      { id: CURSO_B, titulo: "Segurança do Trabalho", deadlineDays: 365 },
    ],
    capitulos: CAPITULOS,
    slides: SLIDES,
    matriculas,
    percorrido,
    sessoes,
    reflexoes: [],
  }
}

/** Só o curso A. Usado onde o contrato afirma "com um curso só". */
export function entradaUmCurso(): EntradaMapaJornada {
  const e = entradaBase()
  const doCursoA = new Set(e.matriculas.filter((m) => m.cursoId === CURSO_A).map((m) => m.alunoId))
  const capsB = new Set<string>(CAPS_B)
  return {
    ...e,
    escopo: [...doCursoA],
    alunos: e.alunos.filter((a) => doCursoA.has(a.id)),
    cursos: e.cursos.filter((c) => c.id === CURSO_A),
    capitulos: e.capitulos.filter((c) => c.cursoId === CURSO_A),
    slides: e.slides.filter((s) => !capsB.has(s.capituloId)),
    matriculas: e.matriculas.filter((m) => m.cursoId === CURSO_A),
    percorrido: (e.percorrido ?? []).filter((p) => !capsB.has(p.capituloId)),
    sessoes: (e.sessoes ?? []).filter((s) => s.capituloId === null || !capsB.has(s.capituloId)),
  }
}

// ===========================================================================
// 5 — Mutadores (a metade de VARIÂNCIA de cada contrato)
// ===========================================================================

/** Recorta o escopo para as `n` primeiras pessoas, sem mexer em mais nada. */
export function recortarPara(e: EntradaMapaJornada, n: number): EntradaMapaJornada {
  return apenas(e, e.escopo.slice(0, n))
}

/** Recorta o escopo para exatamente estas pessoas. */
export function apenas(e: EntradaMapaJornada, ids: readonly string[]): EntradaMapaJornada {
  const mantidos = new Set(ids)
  return {
    ...e,
    escopo: [...mantidos],
    alunos: e.alunos.filter((a) => mantidos.has(a.id)),
    matriculas: e.matriculas.filter((m) => mantidos.has(m.alunoId)),
    percorrido: (e.percorrido ?? []).filter((p) => mantidos.has(p.alunoId)),
    sessoes: (e.sessoes ?? []).filter((s) => mantidos.has(s.alunoId)),
    reflexoes: (e.reflexoes ?? []).filter((r) => mantidos.has(r.alunoId)),
  }
}

/** Duplica o roster com carimbos idênticos: dobra o denominador de F-09/F-16. */
export function clonarPopulacao(e: EntradaMapaJornada, sufixo = "-b"): EntradaMapaJornada {
  const novo = (id: string) => `${id}${sufixo}`
  return {
    ...e,
    escopo: [...e.escopo, ...e.escopo.map(novo)],
    alunos: [...e.alunos, ...e.alunos.map((a) => ({ ...a, id: novo(a.id) }))],
    matriculas: [...e.matriculas, ...e.matriculas.map((m) => ({ ...m, alunoId: novo(m.alunoId) }))],
    percorrido: [
      ...(e.percorrido ?? []),
      ...(e.percorrido ?? []).map((p) => ({ ...p, alunoId: novo(p.alunoId) })),
    ],
    sessoes: [
      ...(e.sessoes ?? []),
      ...(e.sessoes ?? []).map((s) => ({ ...s, alunoId: novo(s.alunoId) })),
    ],
    reflexoes: [
      ...(e.reflexoes ?? []),
      ...(e.reflexoes ?? []).map((r) => ({ ...r, alunoId: novo(r.alunoId) })),
    ],
  }
}

/** Dá atividade de hoje a uma pessoa num módulo: tira-a de "parado". */
export function darAtividadeHoje(
  e: EntradaMapaJornada,
  alunoId: string,
  capituloId: string,
): EntradaMapaJornada {
  return {
    ...e,
    sessoes: [...(e.sessoes ?? []), { alunoId, capituloId, criadaEmISO: diasAtras(0) }],
  }
}

/** Acrescenta uma pessoa ao roster e a matricula num curso. */
export function acrescentarPessoa(
  e: EntradaMapaJornada,
  alunoId: string,
  nome: string,
  cursoId: string,
): EntradaMapaJornada {
  return {
    ...e,
    escopo: [...e.escopo, alunoId],
    alunos: [...e.alunos, { id: alunoId, nome }],
    matriculas: [
      ...e.matriculas,
      { alunoId, cursoId, status: "active", criadaEmISO: diasAtras(300) },
    ],
  }
}

/** Remove toda evidência de uma pessoa: a linha inteira vira cinza. */
export function zerarPessoa(e: EntradaMapaJornada, alunoId: string): EntradaMapaJornada {
  return {
    ...e,
    percorrido: (e.percorrido ?? []).filter((p) => p.alunoId !== alunoId),
    sessoes: (e.sessoes ?? []).filter((s) => s.alunoId !== alunoId),
    reflexoes: (e.reflexoes ?? []).filter((r) => r.alunoId !== alunoId),
  }
}

/** Troca a ordem de dois capítulos do curso A. */
export function trocarOrdem(e: EntradaMapaJornada, capA: string, capB: string): EntradaMapaJornada {
  const ordemA = e.capitulos.find((c) => c.id === capA)?.ordem ?? 0
  const ordemB = e.capitulos.find((c) => c.id === capB)?.ordem ?? 0
  return {
    ...e,
    capitulos: e.capitulos.map((c) =>
      c.id === capA ? { ...c, ordem: ordemB } : c.id === capB ? { ...c, ordem: ordemA } : c,
    ),
  }
}

/** Despublica um capítulo: a coluna some e as seguintes renumeram. */
export function despublicar(e: EntradaMapaJornada, capituloId: string): EntradaMapaJornada {
  return {
    ...e,
    capitulos: e.capitulos.map((c) => (c.id === capituloId ? { ...c, status: "draft" } : c)),
  }
}

/** Embaralha determinísticamente a ordem de CHEGADA das linhas de capítulo. */
export function embaralharCapitulos(e: EntradaMapaJornada): EntradaMapaJornada {
  return { ...e, capitulos: [...e.capitulos].reverse() }
}

// ===========================================================================
// 6 — Travessia genérica e DETECTORES
// ===========================================================================

export interface NoVisitado {
  caminho: string
  chave: string
  valor: unknown
}

export function percorrer(raiz: unknown, visitar: (no: NoVisitado) => void): void {
  const vistos = new WeakSet<object>()
  const andar = (valor: unknown, caminho: string, chave: string): void => {
    if (valor === null || typeof valor !== "object") {
      visitar({ caminho, chave, valor })
      return
    }
    if (vistos.has(valor as object)) return
    vistos.add(valor as object)
    visitar({ caminho, chave, valor })
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => andar(item, `${caminho}[${i}]`, chave))
      return
    }
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      andar(v, caminho ? `${caminho}.${k}` : k, k)
    }
  }
  andar(raiz, "", "")
}

export function coletarStrings(raiz: unknown): Array<{ caminho: string; texto: string }> {
  const out: Array<{ caminho: string; texto: string }> = []
  percorrer(raiz, ({ caminho, valor }) => {
    if (typeof valor === "string") out.push({ caminho, texto: valor })
  })
  return out
}

export function coletarChaves(raiz: unknown): Array<{ caminho: string; chave: string }> {
  const out: Array<{ caminho: string; chave: string }> = []
  percorrer(raiz, ({ caminho, chave }) => {
    if (chave) out.push({ caminho, chave })
  })
  return out
}

export interface Violacao {
  caminho: string
  detalhe: string
}

/** F-34b · vocabulário de cobrança proibido pela §2 Regra 2 e §22. */
export const TERMOS_PUNITIVOS = [
  "cobrar",
  "cobrança",
  "penalizar",
  "penalidade",
  "advertir",
  "advertência",
  "punir",
  "pior",
  "melhor aluno",
  "melhores alunos",
  "ranking",
  "pódio",
  "nota do aluno",
  "desempenho individual",
] as const

export function detectarVocabularioPunitivo(raiz: unknown): Violacao[] {
  const out: Violacao[] = []
  for (const { caminho, texto } of coletarStrings(raiz)) {
    const baixo = texto.toLowerCase()
    for (const termo of TERMOS_PUNITIVOS) {
      if (baixo.includes(termo)) {
        out.push({ caminho, detalhe: `termo punitivo "${termo}": ${texto}` })
      }
    }
  }
  return out
}

/** F-34a · chave de POSIÇÃO. `numero` de módulo não entra: é percurso, não pódio. */
export const PADRAO_CHAVE_POSICAO =
  /^(posicao|posição|rank|ranking|colocacao|colocação|classificacao|classificação|pontuacao|pontuação|score|nota)$/i

export function detectarPosicaoEmListaDePessoas(pessoas: readonly unknown[]): Violacao[] {
  const out: Violacao[] = []
  pessoas.forEach((item, i) => {
    if (!item || typeof item !== "object") return
    for (const chave of Object.keys(item as Record<string, unknown>)) {
      if (PADRAO_CHAVE_POSICAO.test(chave)) {
        out.push({ caminho: `[${i}]`, detalhe: `chave de posição em pessoa: ${chave}` })
      }
    }
  })
  return out
}

/** I-3 · numeral solto: string que é só um número (com ou sem %). */
export function contemNumeralSolto(raiz: unknown): Array<{ caminho: string; texto: string }> {
  return coletarStrings(raiz).filter(({ texto }) => /^\s*-?\d+(?:[.,]\d+)?\s*%?\s*$/.test(texto))
}

/**
 * Remove comentários antes de qualquer varredura estática (F-32).
 *
 * Não é higiene: sem isso o detector de I-4 acusa a PRÓPRIA prosa que explica
 * por que o padrão é proibido. Um detector que reprova quem documenta a regra
 * ensina a apagar a documentação para ficar verde.
 */
export function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .split("\n")
    .map((linha) => linha.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n")
}

export const DIR_CAMADA_DADOS = "apps/web/src/lib/analytics/mapa-jornada"
