import type { SupabaseClient } from "@supabase/supabase-js"
import type { FalhaLeitura } from "../tipos"
import type { CapabilityCriterio, EvidenciaBruta } from "./tipos"

// ---------------------------------------------------------------------------
// Varredura das fontes de evidência (reflexão/quiz/cenário/atividade/sessão
// socrática) ainda não classificadas contra as capacidades ativas do tenant.
//
// LACUNA CONHECIDA E DOCUMENTADA (não escondida): o schema tem `concepts` e
// `capability_concepts` para mapear módulo→capacidade com granularidade fina,
// mas essa curadoria não foi semeada nesta entrega (exigiria conhecer o
// título real dos capítulos do curso em produção, e inventar esse mapeamento
// seria repetir o erro que a spec proíbe em §28). Sem ela, cada evidência de
// um curso é avaliada contra TODAS as capacidades ATIVAS daquele curso — é a
// opção honesta disponível: nenhuma suposição de "este módulo é sobre esta
// capacidade" é inventada. Quando `capability_concepts` for curado, trocar
// para o mapeamento fino é uma mudança only nesta função — o resto do
// pipeline (motor/agregador) não muda.
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: mesmo padrão de lib/supabase/service.ts — o service client não tipa o schema gerado aqui.
type Cliente = SupabaseClient<any, "public", any>

interface CapacidadeAtiva {
  id: string
  courseId: string
  criterios: CapabilityCriterio[]
}

// ---------------------------------------------------------------------------
// A DOUTRINA DESTE ARQUIVO (correção dos achados A-5/A-6 do laudo LOOP-1, e dos
// 6 sítios irmãos que o LOOP-0c mapeou na tabela E→VAZIO #3).
//
// Antes, TODA leitura que falhava caía num `return []`/`break` — e `[]` é byte a
// byte o mesmo valor de "esta fonte genuinamente não tem nada". O pipeline então
// reportava "nada pendente" para um tenant cujo banco não respondeu, e o `Set` de
// já-classificados voltava vazio, empurrando o acervo inteiro de volta para a
// fila do LLM.
//
// A regra agora é única e sem exceção: **`[]` significa exclusivamente "não há
// linha". Falha de leitura vira um valor (`FalhaLeitura`) que sobe até quem
// decide, e aborta a rodada.** Quem decide é `processarPendencias`, e acima dele
// a rota, que responde 500 em vez de um 200 tranquilizador.
// ---------------------------------------------------------------------------

/** Erro do PostgREST → o mesmo `FalhaLeitura` que a camada de leitura irmã já usa. */
function falhaDe(chave: string, erro: { code?: string | null; message: string }): FalhaLeitura {
  return { codigo: erro.code ?? `${chave}-erro`, mensagem: erro.message }
}

export interface PendentesLidas {
  pendentes: EvidenciaBruta[]
  /** Não-nulo = a varredura NÃO é confiável; `pendentes` está incompleto por falha, não por ausência. */
  falha: FalhaLeitura | null
}

/**
 * Busca até `limite` pares (evidência-fonte × capacidade) ainda não
 * classificados, prontos para `classificarEvidencia`. O limite é sobre PARES,
 * não sobre linhas de origem — uma única reflexão num curso com 5
 * capacidades ativas pode gerar até 5 pares.
 *
 * Devolve `falha` não-nula assim que qualquer leitura falha: uma varredura
 * parcial não pode se apresentar como completa (era o A-6).
 */
export async function buscarEvidenciasPendentes(
  db: Cliente,
  tenantId: string,
  limite: number,
): Promise<PendentesLidas> {
  const { capacidades, falha: falhaCapacidades } = await carregarCapacidadesAtivas(db, tenantId)
  if (falhaCapacidades) return { pendentes: [], falha: falhaCapacidades }
  if (capacidades.length === 0) return { pendentes: [], falha: null }

  const cursoIds = [...new Set(capacidades.map((c) => c.courseId))]
  const capacidadesPorCurso = new Map<string, CapacidadeAtiva[]>()
  for (const cap of capacidades) {
    const lista = capacidadesPorCurso.get(cap.courseId) ?? []
    lista.push(cap)
    capacidadesPorCurso.set(cap.courseId, lista)
  }

  const { data: chapterRows, error: erroChapters } = await db
    .from("chapters")
    .select("id, course_id, bloom_target")
    .in("course_id", cursoIds)
    .eq("tenant_id", tenantId)
  if (erroChapters) {
    console.error("[aprendizagem-time] leitura de chapters falhou:", erroChapters.message)
    return { pendentes: [], falha: falhaDe("chapters", erroChapters) }
  }
  const chapters = chapterRows ?? []
  const chapterIds = chapters.map((c) => c.id)
  const chapterInfo = new Map(chapters.map((c) => [c.id, c]))
  if (chapterIds.length === 0) return { pendentes: [], falha: null }

  // Já classificado: chave `source_table:source_id:capability_id`.
  // A-6: se ESTA varredura falha, o `Set` volta vazio e TODO o acervo do tenant
  // vira "pendente" — moinho de reclassificação pagando LLM de novo. Aborta.
  const { chaves: jaClassificadas, falha: falhaJa } = await carregarChavesJaClassificadas(
    db,
    tenantId,
    cursoIds,
  )
  if (falhaJa) return { pendentes: [], falha: falhaJa }

  const pendentes: EvidenciaBruta[] = []

  const falhaReflexoes = await coletarReflexoes(
    db,
    tenantId,
    chapterIds,
    chapterInfo,
    capacidadesPorCurso,
    chapters,
    jaClassificadas,
    pendentes,
  )
  if (falhaReflexoes) return { pendentes: [], falha: falhaReflexoes }

  if (pendentes.length < limite) {
    const falha = await coletarCenarios(
      db,
      tenantId,
      chapterIds,
      chapterInfo,
      capacidadesPorCurso,
      chapters,
      jaClassificadas,
      pendentes,
    )
    if (falha) return { pendentes: [], falha }
  }
  if (pendentes.length < limite) {
    const falha = await coletarAtividades(
      db,
      tenantId,
      chapterIds,
      chapterInfo,
      capacidadesPorCurso,
      chapters,
      jaClassificadas,
      pendentes,
    )
    if (falha) return { pendentes: [], falha }
  }
  if (pendentes.length < limite) {
    const falha = await coletarQuizzes(
      db,
      tenantId,
      cursoIds,
      capacidadesPorCurso,
      jaClassificadas,
      pendentes,
    )
    if (falha) return { pendentes: [], falha }
  }
  if (pendentes.length < limite) {
    const falha = await coletarSessoesSocraticas(
      db,
      tenantId,
      chapterIds,
      chapterInfo,
      capacidadesPorCurso,
      chapters,
      jaClassificadas,
      pendentes,
    )
    if (falha) return { pendentes: [], falha }
  }

  return { pendentes: pendentes.slice(0, limite), falha: null }
}

export interface CriteriosLidos {
  criterios: Map<string, CapabilityCriterio[]>
  falha: FalhaLeitura | null
}

/**
 * Mapa capability_id → critérios fixos, para o motor de classificação montar
 * o prompt. Exportado separadamente de `buscarEvidenciasPendentes` porque o
 * chamador (`index.ts`) precisa dele por evidência, não só na varredura.
 *
 * A-5: um mapa vazio por falha de leitura faria o LLM classificar sem critério
 * nenhum e `criteriaMet` sair vazio — uma classificação empobrecida que ninguém
 * consegue distinguir de "esta capacidade não tem critério cadastrado".
 */
export async function carregarCriteriosPorCapacidade(
  db: Cliente,
  tenantId: string,
): Promise<CriteriosLidos> {
  const { capacidades, falha } = await carregarCapacidadesAtivas(db, tenantId)
  const mapa = new Map<string, CapabilityCriterio[]>()
  for (const cap of capacidades) mapa.set(cap.id, cap.criterios)
  return { criterios: mapa, falha }
}

interface CapacidadesLidas {
  capacidades: CapacidadeAtiva[]
  falha: FalhaLeitura | null
}

async function carregarCapacidadesAtivas(db: Cliente, tenantId: string): Promise<CapacidadesLidas> {
  const { data: caps, error } = await db
    .from("capabilities")
    .select("id, course_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
  if (error) {
    console.error("[aprendizagem-time] leitura de capabilities falhou:", error.message)
    return { capacidades: [], falha: falhaDe("capabilities", error) }
  }
  if (!caps || caps.length === 0) return { capacidades: [], falha: null }

  const { data: criteriaRows, error: erroCriterios } = await db
    .from("capability_criteria")
    .select("id, capability_id, code, description")
    .in(
      "capability_id",
      caps.map((c) => c.id),
    )
    .eq("is_active", true)
  if (erroCriterios) {
    console.error(
      "[aprendizagem-time] leitura de capability_criteria falhou:",
      erroCriterios.message,
    )
    return { capacidades: [], falha: falhaDe("capability_criteria", erroCriterios) }
  }
  const criteriosPorCapacidade = new Map<string, CapabilityCriterio[]>()
  for (const row of criteriaRows ?? []) {
    const lista = criteriosPorCapacidade.get(row.capability_id) ?? []
    lista.push({
      id: row.id,
      capabilityId: row.capability_id,
      code: row.code,
      description: row.description,
    })
    criteriosPorCapacidade.set(row.capability_id, lista)
  }

  return {
    capacidades: caps.map((c) => ({
      id: c.id,
      courseId: c.course_id,
      criterios: criteriosPorCapacidade.get(c.id) ?? [],
    })),
    falha: null,
  }
}

interface ChavesLidas {
  chaves: Set<string>
  falha: FalhaLeitura | null
}

async function carregarChavesJaClassificadas(
  db: Cliente,
  tenantId: string,
  cursoIds: readonly string[],
): Promise<ChavesLidas> {
  const chaves = new Set<string>()
  const PAGINA = 1000
  for (let pagina = 0; pagina < 20; pagina++) {
    const de = pagina * PAGINA
    const { data, error } = await db
      .from("capability_evidence")
      .select("source_table, source_id, capability_id")
      .eq("tenant_id", tenantId)
      .in("course_id", cursoIds)
      .range(de, de + PAGINA - 1)
    if (error) {
      console.error("[aprendizagem-time] leitura de capability_evidence falhou:", error.message)
      // O `break` de antes devolvia o `Set` PARCIAL como se fosse completo — e
      // uma falha na PRIMEIRA página devolvia o `Set` vazio, isto é: "nada foi
      // classificado ainda". Era o A-6.
      return { chaves, falha: falhaDe("capability_evidence", error) }
    }
    const lote = data ?? []
    for (const row of lote) {
      chaves.add(`${row.source_table}:${row.source_id}:${row.capability_id}`)
    }
    if (lote.length < PAGINA) break
  }
  return { chaves, falha: null }
}

function bloomDoCapitulo(
  chapterInfo: Map<string, { id: string; course_id: string; bloom_target: string | null }>,
  chapterId: string | null,
): string | null {
  if (!chapterId) return null
  return chapterInfo.get(chapterId)?.bloom_target ?? null
}

function contarPalavras(texto: string): number {
  const t = texto.trim()
  return t.length === 0 ? 0 : t.split(/\s+/).length
}

// --- Reflexões (slide_reflections → cognitive) ------------------------------
async function coletarReflexoes(
  db: Cliente,
  tenantId: string,
  chapterIds: readonly string[],
  chapterInfo: Map<string, { id: string; course_id: string; bloom_target: string | null }>,
  capacidadesPorCurso: Map<string, CapacidadeAtiva[]>,
  chapters: readonly { id: string; course_id: string }[],
  jaClassificadas: Set<string>,
  saida: EvidenciaBruta[],
): Promise<FalhaLeitura | null> {
  const { data: slides, error: erroSlides } = await db
    .from("chapter_slides")
    .select("id, chapter_id")
    .in("chapter_id", chapterIds)
  // Antes: `if (erroSlides || !slides || slides.length === 0) return` — erro e
  // "genuinamente vazio" saíam pelo MESMO return mudo, sem sequer um log.
  if (erroSlides) {
    console.error("[aprendizagem-time] leitura de chapter_slides falhou:", erroSlides.message)
    return falhaDe("chapter_slides", erroSlides)
  }
  if (!slides || slides.length === 0) return null
  const slideToChapter = new Map(slides.map((s) => [s.id, s.chapter_id]))

  const { data: reflections, error } = await db
    .from("slide_reflections")
    .select("id, student_id, slide_id, response, created_at")
    .eq("tenant_id", tenantId)
    .in(
      "slide_id",
      slides.map((s) => s.id),
    )
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) {
    console.error("[aprendizagem-time] leitura de slide_reflections falhou:", error.message)
    return falhaDe("slide_reflections", error)
  }

  for (const r of reflections ?? []) {
    const chapterId = slideToChapter.get(r.slide_id)
    const chapter = chapters.find((c) => c.id === chapterId)
    if (!chapter) continue
    const capacidades = capacidadesPorCurso.get(chapter.course_id) ?? []
    for (const cap of capacidades) {
      const chave = `slide_reflections:${r.id}:${cap.id}`
      if (jaClassificadas.has(chave)) continue
      saida.push({
        studentId: r.student_id,
        courseId: chapter.course_id,
        tenantId,
        conceptId: null,
        capabilityId: cap.id,
        evidenceCategory: "cognitive",
        sourceType: "reflection",
        sourceTable: "slide_reflections",
        sourceId: r.id,
        occurredAt: r.created_at,
        textoBruto: r.response ?? "",
        sinais: {
          depthReached: null,
          bloomTarget: bloomDoCapitulo(chapterInfo, chapterId ?? null),
          quizScorePct: null,
          overallScore: null,
          wordCount: contarPalavras(r.response ?? ""),
        },
      })
    }
  }
  return null
}

// --- Cenários (scenario_attempts → application) -----------------------------
async function coletarCenarios(
  db: Cliente,
  tenantId: string,
  chapterIds: readonly string[],
  chapterInfo: Map<string, { id: string; course_id: string; bloom_target: string | null }>,
  capacidadesPorCurso: Map<string, CapacidadeAtiva[]>,
  chapters: readonly { id: string; course_id: string }[],
  jaClassificadas: Set<string>,
  saida: EvidenciaBruta[],
): Promise<FalhaLeitura | null> {
  const { data: rows, error } = await db
    .from("scenario_attempts")
    .select("id, student_id, chapter_id, step_responses, overall_score, completed_at, created_at")
    .eq("tenant_id", tenantId)
    .in("chapter_id", chapterIds)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) {
    console.error("[aprendizagem-time] leitura de scenario_attempts falhou:", error.message)
    return falhaDe("scenario_attempts", error)
  }

  for (const r of rows ?? []) {
    const chapter = chapters.find((c) => c.id === r.chapter_id)
    if (!chapter) continue
    const capacidades = capacidadesPorCurso.get(chapter.course_id) ?? []
    const texto = extrairTextoDeRespostas(r.step_responses)
    for (const cap of capacidades) {
      const chave = `scenario_attempts:${r.id}:${cap.id}`
      if (jaClassificadas.has(chave)) continue
      saida.push({
        studentId: r.student_id,
        courseId: chapter.course_id,
        tenantId,
        conceptId: null,
        capabilityId: cap.id,
        evidenceCategory: "application",
        sourceType: "scenario",
        sourceTable: "scenario_attempts",
        sourceId: r.id,
        occurredAt: r.completed_at ?? r.created_at,
        textoBruto: texto,
        sinais: {
          depthReached: null,
          bloomTarget: bloomDoCapitulo(chapterInfo, r.chapter_id),
          quizScorePct: null,
          overallScore: r.overall_score !== null ? Number(r.overall_score) : null,
          wordCount: texto ? contarPalavras(texto) : null,
        },
      })
    }
  }
  return null
}

// --- Atividades (assignment_submissions → application) ----------------------
async function coletarAtividades(
  db: Cliente,
  tenantId: string,
  chapterIds: readonly string[],
  chapterInfo: Map<string, { id: string; course_id: string; bloom_target: string | null }>,
  capacidadesPorCurso: Map<string, CapacidadeAtiva[]>,
  chapters: readonly { id: string; course_id: string }[],
  jaClassificadas: Set<string>,
  saida: EvidenciaBruta[],
): Promise<FalhaLeitura | null> {
  const { data: rows, error } = await db
    .from("assignment_submissions")
    .select(
      "id, student_id, chapter_id, content, overall_score, submitted_at, evaluated_at, status",
    )
    .eq("tenant_id", tenantId)
    .in("chapter_id", chapterIds)
    .in("status", ["submitted", "evaluated"])
    .order("submitted_at", { ascending: false })
    .limit(200)
  if (error) {
    console.error("[aprendizagem-time] leitura de assignment_submissions falhou:", error.message)
    return falhaDe("assignment_submissions", error)
  }

  for (const r of rows ?? []) {
    const chapter = chapters.find((c) => c.id === r.chapter_id)
    if (!chapter) continue
    const capacidades = capacidadesPorCurso.get(chapter.course_id) ?? []
    for (const cap of capacidades) {
      const chave = `assignment_submissions:${r.id}:${cap.id}`
      if (jaClassificadas.has(chave)) continue
      saida.push({
        studentId: r.student_id,
        courseId: chapter.course_id,
        tenantId,
        conceptId: null,
        capabilityId: cap.id,
        evidenceCategory: "application",
        sourceType: "assignment",
        sourceTable: "assignment_submissions",
        sourceId: r.id,
        occurredAt: r.evaluated_at ?? r.submitted_at ?? new Date().toISOString(),
        textoBruto: r.content ?? "",
        sinais: {
          depthReached: null,
          bloomTarget: bloomDoCapitulo(chapterInfo, r.chapter_id),
          quizScorePct: null,
          overallScore: r.overall_score !== null ? Number(r.overall_score) : null,
          wordCount: contarPalavras(r.content ?? ""),
        },
      })
    }
  }
  return null
}

// --- Quizzes (quiz_attempts → cognitive) ------------------------------------
async function coletarQuizzes(
  db: Cliente,
  tenantId: string,
  cursoIds: readonly string[],
  capacidadesPorCurso: Map<string, CapacidadeAtiva[]>,
  jaClassificadas: Set<string>,
  saida: EvidenciaBruta[],
): Promise<FalhaLeitura | null> {
  const { data: sessoes, error: erroSessoes } = await db
    .from("quiz_sessions")
    .select("id, course_id")
    .in("course_id", cursoIds)
  // Segundo dos dois sítios que nem log tinham (o outro era `chapter_slides`).
  if (erroSessoes) {
    console.error("[aprendizagem-time] leitura de quiz_sessions falhou:", erroSessoes.message)
    return falhaDe("quiz_sessions", erroSessoes)
  }
  if (!sessoes || sessoes.length === 0) return null
  const sessionToCourse = new Map(sessoes.map((s) => [s.id, s.course_id]))

  const { data: rows, error } = await db
    .from("quiz_attempts")
    .select(
      "id, student_id, quiz_session_id, total_questions, correct_answers, completed_at, created_at, status",
    )
    .eq("tenant_id", tenantId)
    .in(
      "quiz_session_id",
      sessoes.map((s) => s.id),
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) {
    console.error("[aprendizagem-time] leitura de quiz_attempts falhou:", error.message)
    return falhaDe("quiz_attempts", error)
  }

  for (const r of rows ?? []) {
    const courseId = sessionToCourse.get(r.quiz_session_id)
    if (!courseId) continue
    const capacidades = capacidadesPorCurso.get(courseId) ?? []
    const pct = r.total_questions > 0 ? r.correct_answers / r.total_questions : null
    for (const cap of capacidades) {
      const chave = `quiz_attempts:${r.id}:${cap.id}`
      if (jaClassificadas.has(chave)) continue
      saida.push({
        studentId: r.student_id,
        courseId,
        tenantId,
        conceptId: null,
        capabilityId: cap.id,
        evidenceCategory: "cognitive",
        sourceType: "quiz",
        sourceTable: "quiz_attempts",
        sourceId: r.id,
        occurredAt: r.completed_at ?? r.created_at,
        // Quiz de múltipla escolha não tem texto livre — classificação é
        // sempre heurística aqui (motor.ts cai para heurística sem textoBruto).
        textoBruto: null,
        sinais: {
          depthReached: null,
          bloomTarget: null,
          quizScorePct: pct,
          overallScore: null,
          wordCount: null,
        },
      })
    }
  }
  return null
}

// --- Sessões socráticas (sessions.analytics.depth_reached → cognitive) -----
async function coletarSessoesSocraticas(
  db: Cliente,
  tenantId: string,
  chapterIds: readonly string[],
  chapterInfo: Map<string, { id: string; course_id: string; bloom_target: string | null }>,
  capacidadesPorCurso: Map<string, CapacidadeAtiva[]>,
  chapters: readonly { id: string; course_id: string }[],
  jaClassificadas: Set<string>,
  saida: EvidenciaBruta[],
): Promise<FalhaLeitura | null> {
  const { data: rows, error } = await db
    .from("sessions")
    .select("id, student_id, chapter_id, analytics, status, completed_at, created_at")
    .eq("tenant_id", tenantId)
    .in("chapter_id", chapterIds)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) {
    console.error("[aprendizagem-time] leitura de sessions falhou:", error.message)
    return falhaDe("sessions", error)
  }

  for (const r of rows ?? []) {
    const chapter = chapters.find((c) => c.id === r.chapter_id)
    if (!chapter) continue
    const analytics = (r.analytics ?? {}) as { depth_reached?: number }
    if (typeof analytics.depth_reached !== "number") continue
    const capacidades = capacidadesPorCurso.get(chapter.course_id) ?? []
    for (const cap of capacidades) {
      const chave = `sessions:${r.id}:${cap.id}`
      if (jaClassificadas.has(chave)) continue
      saida.push({
        studentId: r.student_id,
        courseId: chapter.course_id,
        tenantId,
        conceptId: null,
        capabilityId: cap.id,
        evidenceCategory: "cognitive",
        sourceType: "socratic_session",
        sourceTable: "sessions",
        sourceId: r.id,
        occurredAt: r.completed_at ?? r.created_at,
        // O diálogo em si vive em `messages`; para o MVP usamos o sinal já
        // calculado (depth_reached) em vez de reabrir o texto do diálogo —
        // menos superfície de exposição de conteúdo privado (§38).
        textoBruto: null,
        sinais: {
          depthReached: analytics.depth_reached,
          bloomTarget: bloomDoCapitulo(chapterInfo, r.chapter_id),
          quizScorePct: null,
          overallScore: null,
          wordCount: null,
        },
      })
    }
  }
  return null
}

function extrairTextoDeRespostas(stepResponses: unknown): string | null {
  if (!Array.isArray(stepResponses)) return null
  const textos = stepResponses
    .map((step) => {
      if (step && typeof step === "object" && "response" in step) {
        const v = (step as { response?: unknown }).response
        return typeof v === "string" ? v : null
      }
      return null
    })
    .filter((t): t is string => Boolean(t))
  return textos.length > 0 ? textos.join("\n") : null
}
