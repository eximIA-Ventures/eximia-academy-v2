const SEMANTIC_MODEL = "gpt-4o-mini"
import type { SessionAnalyticsJsonb } from "@/types/analytics"
import {
  ENGAGEMENT_LEVELS,
  JUNG_LAYERS,
  METANOIA_LEVELS,
  RODA_STAGES,
  type SemanticAnalysisResult,
} from "@/types/semantic-analysis"
import { openai } from "@ai-sdk/openai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateObject } from "ai"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Zod schema for Claude's structured output
// ---------------------------------------------------------------------------

const semanticClassificationSchema = z.object({
  roda: z.object({
    stage: z.number().int().min(1).max(8),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()).max(3),
  }),
  cma: z.object({
    corpo: z.number().int().min(0).max(100),
    mente: z.number().int().min(0).max(100),
    alma: z.number().int().min(0).max(100),
    dominant: z.enum(["corpo", "mente", "alma"]),
  }),
  metanoia: z.object({
    level: z.number().int().min(0).max(4),
    signals: z.array(z.string()).max(3),
  }),
  jung: z.object({
    layer: z.enum(["persona", "ego", "shadow", "self"]),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()).max(3),
  }),
  engagement: z.object({
    level: z.number().int().min(1).max(4),
  }),
  summary: z.string().max(300),
})

type ClassificationOutput = z.infer<typeof semanticClassificationSchema>

// ---------------------------------------------------------------------------
// Student context types
// ---------------------------------------------------------------------------

interface SessionData {
  id: string
  analytics: SessionAnalyticsJsonb | null
  createdAt: string
  turnNumber: number
  status: string
}

interface MessageData {
  content: string
  sessionId: string
}

interface ConsciousnessData {
  phase: string
  challengeText: string | null
  selfRating: number | null
  learningGoal: string | null
  commitment: string | null
  ratingChange: number | null
}

interface ReflectionData {
  response: string
  wordCount: number
}

interface LearnerProfileData {
  kolbDominantStyle: string | null
  kolbGraspingAxis: number | null
  kolbTransformingAxis: number | null
  engagementStyle: string | null
  reasoningStyle: string | null
  strengths: string[]
  growthAreas: string[]
  avgDepthAchieved: number | null
}

interface StudentContext {
  studentId: string
  sessions: SessionData[]
  messages: MessageData[]
  consciousness: ConsciousnessData[]
  reflections: ReflectionData[]
  profile: LearnerProfileData | null
}

// ---------------------------------------------------------------------------
// Heuristic pre-classification result
// ---------------------------------------------------------------------------

interface HeuristicResult {
  kolbStyle: string | null
  kolbGrasping: number | null
  kolbTransforming: number | null
  engagementLevel: 1 | 2 | 3 | 4
  engagementAiProbability: number
}

// ---------------------------------------------------------------------------
// Final merged classification
// ---------------------------------------------------------------------------

export interface MergedClassification {
  rodaStage: number
  rodaConfidence: number
  rodaEvidence: string[]
  cmaCorpo: number
  cmaMente: number
  cmaAlma: number
  cmaDominant: "corpo" | "mente" | "alma"
  metanoiaLevel: number
  metanoiaSignals: string[]
  kolbStyle: string | null
  kolbGrasping: number | null
  kolbTransforming: number | null
  jungLayer: "persona" | "ego" | "shadow" | "self"
  jungConfidence: number
  jungEvidence: string[]
  engagementLevel: number
  engagementAiProbability: number
  summary: string
  sessionsAnalyzed: number
  responsesAnalyzed: number
  classificationModel: string
  classificationTokensUsed: number
}

// ---------------------------------------------------------------------------
// 1. Build student context from multiple tables
// ---------------------------------------------------------------------------

export async function buildStudentContext(
  db: SupabaseClient,
  studentId: string,
  courseId: string | null,
  tenantId: string,
): Promise<StudentContext> {
  // Fetch completed sessions (last 3, most recent first)
  let sessionsQuery = db
    .from("sessions")
    .select("id, analytics, created_at, turn_number, status")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(3)

  if (courseId) {
    const { data: chapters } = await db
      .from("chapters")
      .select("id")
      .eq("course_id", courseId)
      .eq("tenant_id", tenantId)
    if (chapters && chapters.length > 0) {
      sessionsQuery = sessionsQuery.in(
        "chapter_id",
        chapters.map((c) => c.id),
      )
    }
  }

  const { data: sessions } = await sessionsQuery

  const sessionRows: SessionData[] = (sessions ?? []).map((s) => ({
    id: s.id,
    analytics: s.analytics as SessionAnalyticsJsonb | null,
    createdAt: s.created_at,
    turnNumber: s.turn_number ?? 0,
    status: s.status ?? "unknown",
  }))

  const sessionIds = sessionRows.map((s) => s.id)

  // Fetch student messages (role=user only, max 10 total across sessions)
  let messages: MessageData[] = []
  if (sessionIds.length > 0) {
    const { data: msgRows } = await db
      .from("messages")
      .select("content, session_id")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(10)

    messages = (msgRows ?? []).map((m) => ({
      content: m.content ?? "",
      sessionId: m.session_id,
    }))
  }

  // Fetch consciousness responses for this student+course
  let consciousnessQuery = db
    .from("consciousness_responses")
    .select("phase, challenge_text, self_rating, learning_goal, commitment, rating_change")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(4)

  if (courseId) {
    consciousnessQuery = consciousnessQuery.eq("course_id", courseId)
  }

  const { data: consciousnessRows } = await consciousnessQuery

  const consciousness: ConsciousnessData[] = (consciousnessRows ?? []).map((c) => ({
    phase: c.phase,
    challengeText: c.challenge_text,
    selfRating: c.self_rating,
    learningGoal: c.learning_goal,
    commitment: c.commitment,
    ratingChange: c.rating_change,
  }))

  // Fetch slide reflections (from sessions in scope)
  let reflections: ReflectionData[] = []
  if (sessionIds.length > 0) {
    const { data: reflRows } = await db
      .from("slide_reflections")
      .select("response, word_count")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5)

    reflections = (reflRows ?? []).map((r) => ({
      response: r.response ?? "",
      wordCount: r.word_count ?? 0,
    }))
  }

  // Fetch learner profile
  const profileQuery = db
    .from("learner_profiles")
    .select(
      "kolb_dominant_style, kolb_grasping_axis, kolb_transforming_axis, engagement_style, reasoning_style, strengths, growth_areas, avg_depth_achieved",
    )
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const { data: profileRow } = await profileQuery

  const profile: LearnerProfileData | null = profileRow
    ? {
        kolbDominantStyle: profileRow.kolb_dominant_style,
        kolbGraspingAxis: profileRow.kolb_grasping_axis
          ? Number(profileRow.kolb_grasping_axis)
          : null,
        kolbTransformingAxis: profileRow.kolb_transforming_axis
          ? Number(profileRow.kolb_transforming_axis)
          : null,
        engagementStyle: profileRow.engagement_style,
        reasoningStyle: profileRow.reasoning_style,
        strengths: profileRow.strengths ?? [],
        growthAreas: profileRow.growth_areas ?? [],
        avgDepthAchieved: profileRow.avg_depth_achieved
          ? Number(profileRow.avg_depth_achieved)
          : null,
      }
    : null

  return {
    studentId,
    sessions: sessionRows,
    messages,
    consciousness,
    reflections,
    profile,
  }
}

// ---------------------------------------------------------------------------
// 2. Heuristic pre-classification (Kolb + Engagement from numeric data)
// ---------------------------------------------------------------------------

export function classifyWithHeuristics(ctx: StudentContext): HeuristicResult {
  // Kolb: reuse existing classification from learner profile
  const kolbStyle = ctx.profile?.kolbDominantStyle ?? null
  const kolbGrasping = ctx.profile?.kolbGraspingAxis ?? null
  const kolbTransforming = ctx.profile?.kolbTransformingAxis ?? null

  // Engagement: compute from numeric thresholds
  const analyticsData = ctx.sessions
    .map((s) => s.analytics)
    .filter((a): a is SessionAnalyticsJsonb => a !== null && typeof a === "object")

  // Average emotional density across sessions
  const densities = analyticsData.flatMap((a) => a.emotional_density_progression ?? [])
  const avgDensity =
    densities.length > 0 ? densities.reduce((a, b) => a + b, 0) / densities.length : 0

  // Count breakthroughs
  const totalBreakthroughs = analyticsData.reduce(
    (sum, a) => sum + (a.breakthrough_moments ?? 0),
    0,
  )

  // Max depth reached
  const maxDepth = Math.max(0, ...analyticsData.map((a) => a.depth_reached ?? 0))

  // Total turn count
  const totalTurns = ctx.sessions.reduce((sum, s) => sum + s.turnNumber, 0)

  // Abandoned sessions (status !== completed with low turns)
  const abandonedCount = ctx.sessions.filter(
    (s) => s.status !== "completed" && s.turnNumber <= 3,
  ).length

  // AI detection probability (average across sessions)
  const aiProbs = analyticsData.map((a) => a.ai_detection?.probability ?? 0).filter((p) => p > 0)
  const avgAiProb = aiProbs.length > 0 ? aiProbs.reduce((a, b) => a + b, 0) / aiProbs.length : 0

  // Engagement level classification
  let engagementLevel: 1 | 2 | 3 | 4 = 1
  if (avgDensity > 0.7 && totalBreakthroughs >= 2 && maxDepth >= 6) {
    engagementLevel = 4 // Transformado
  } else if (avgDensity > 0.4 && maxDepth >= 4) {
    engagementLevel = 3 // Envolvido
  } else if (avgDensity > 0.15 && totalTurns > 3 && abandonedCount === 0) {
    engagementLevel = 2 // Participativo
  } else {
    engagementLevel = 1 // Indiferente
  }

  return {
    kolbStyle,
    kolbGrasping,
    kolbTransforming,
    engagementLevel,
    engagementAiProbability: Math.round(avgAiProb * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// 3. Claude AI classification (Roda, CMA, Metanoia, Jung)
// ---------------------------------------------------------------------------

const CLASSIFICATION_SYSTEM_PROMPT = `Voce e um especialista em pedagogia transformativa e psicologia do aprendizado. Sua tarefa e classificar um aluno em 4 dimensoes qualitativas baseado nos dados de suas interacoes educacionais.

## DIMENSAO 1: Roda do Aprendizado (Tranjan)
A Roda do Aprendizado de Augusto Tranjan tem 8 estagios ciclicos que mapeiam a jornada do aprendizado:

1. **Despertar** — O aluno percebe que nao sabe algo. Sinais: primeiras respostas curtas, uso de frases como "nunca pensei nisso", presenca de respostas iniciais de consciencia (pre-assessment).
2. **Questionar** — O aluno comeca a formular perguntas. Sinais: mensagens com interrogacoes, pedidos de esclarecimento, curiosidade ativa.
3. **Pesquisar** — O aluno busca informacao e referencia conhecimento externo. Sinais: nivel de abstracao elevado (>5), mencao a conceitos teoricos, uso de vocabulario tecnico.
4. **Experimentar** — O aluno aplica conceitos a cenarios. Sinais: profundidade >=3, exemplos praticos nas respostas, tentativas de aplicacao.
5. **Refletir** — O aluno desenvolve reflexoes substantivas. Sinais: reflexoes em slides com >30 palavras, respostas elaboradas conectando teoria e pratica.
6. **Integrar** — O aluno conecta multiplos conceitos. Sinais: breakthroughs detectados, profundidade >=5, conexoes entre temas diferentes.
7. **Compartilhar** — O aluno ensina ou articula para outros. Sinais: padroes cognitivos de "ensinar", respostas que reformulam conceitos de forma didatica.
8. **Transformar** — O aluno demonstra mudanca real. Sinais: resposta de consciencia (pos) com mudanca positiva no rating, comprometimento articulado.

## DIMENSAO 2: CMA — Corpo, Mente, Alma (Tranjan)
Tres dimensoes da experiencia de aprendizagem. Classifique a distribuicao percentual (somando 100):

- **Corpo (Operacional):** Foco em aspectos praticos e tecnicos. Sinais: linguagem concreta, perguntas "como fazer", respostas com passos e procedimentos, alta certeza.
- **Mente (Estrategico):** Foco em analise e estrategia. Sinais: abstracao alta (>6), comparacoes, raciocinio sistematico, uso de frameworks e modelos.
- **Alma (Proposito):** Foco em significado e valores. Sinais: valores revelados, densidade emocional >0.6, presenca de texto de comprometimento, reflexoes sobre proposito.

## DIMENSAO 3: Metanoia (Tranjan)
Niveis de transformacao de consciencia. Classifique 0-4:

- **0 - Resistencia:** Defesas ativas, profundidade <=2, sem breakthroughs. O aluno resiste ao processo.
- **1 - Abertura:** Profundidade >=3, comecando a explorar. O aluno se abre ao novo.
- **2 - Compreensao:** Profundidade >=4, integrando conceitos. O aluno compreende em nivel mais profundo.
- **3 - Integracao:** Breakthrough detectado, estilo Kolb evoluindo. O aluno integra o aprendizado.
- **4 - Transformacao:** Delta positivo na resposta de consciencia, multiplos breakthroughs. Mudanca real ocorreu.

## DIMENSAO 4: Profundidade Psiquica (Jung)
Camadas da psique segundo Jung, mapeadas pela qualidade das respostas:

- **Persona:** Auto-apresentacao superficial. Sinais: respostas formulaicas, baixa densidade emocional (<0.2), padroes de IA detectados.
- **Ego:** Auto-reflexao consciente. Sinais: engajamento genuino, densidade emocional 0.2-0.5, opinioes pessoais expressas.
- **Sombra:** Confronto com verdades desconfortaveis. Sinais: mecanismos de defesa ativos MAS profundidade ainda progredindo, loops cognitivos presentes.
- **Self:** Sabedoria integrada. Sinais: breakthroughs, profundidade >=6, valores revelados combinados com alta densidade emocional.

## INSTRUCOES
- Analise TODOS os dados fornecidos antes de classificar.
- Forneça evidencias concretas (citacoes ou observacoes) para cada dimensao.
- Quando dados sao insuficientes, classifique conservadoramente (estagios/niveis mais baixos) com confianca baixa.
- O resumo deve ser em portugues, 1-3 frases, sintetizando a jornada do aluno.
- NAO invente dados. Se nao ha evidencia, diga "dados insuficientes" na evidencia.`

function buildClassificationPrompt(ctx: StudentContext): string {
  const parts: string[] = []

  parts.push("# DADOS DO ALUNO\n")

  // Session analytics summaries
  if (ctx.sessions.length > 0) {
    parts.push("## Sessoes de Aprendizado")
    for (const session of ctx.sessions) {
      const a = session.analytics
      if (!a) {
        parts.push(`- Sessao (${session.createdAt}): sem dados de analytics`)
        continue
      }
      const details = [
        `profundidade: ${a.depth_reached ?? "N/A"}`,
        `breakthroughs: ${a.breakthrough_moments ?? 0}`,
        `padroes cognitivos: ${(a.cognitive_patterns ?? []).join(", ") || "nenhum"}`,
        `mecanismos defesa: ${(a.defense_mechanisms ?? []).join(", ") || "nenhum"}`,
        `valores revelados: ${(a.values_revealed ?? []).join(", ") || "nenhum"}`,
        `densidade emocional media: ${
          a.emotional_density_progression && a.emotional_density_progression.length > 0
            ? (
                a.emotional_density_progression.reduce((x, y) => x + y, 0) /
                a.emotional_density_progression.length
              ).toFixed(2)
            : "N/A"
        }`,
        `deteccao IA: ${a.ai_detection?.verdict ?? "N/A"} (prob: ${a.ai_detection?.probability ?? "N/A"})`,
        `status: ${session.status}`,
        `turnos: ${session.turnNumber}`,
      ]
      parts.push(`- Sessao (${session.createdAt}): ${details.join("; ")}`)
    }
    parts.push("")
  } else {
    parts.push("## Sessoes: Nenhuma sessao encontrada.\n")
  }

  // Student messages
  if (ctx.messages.length > 0) {
    parts.push("## Respostas do Aluno (mais recentes)")
    for (const msg of ctx.messages.slice(0, 10)) {
      // Truncate very long messages to ~300 chars
      const content = msg.content.length > 300 ? `${msg.content.slice(0, 300)}...` : msg.content
      parts.push(`> ${content}`)
    }
    parts.push("")
  }

  // Consciousness responses
  if (ctx.consciousness.length > 0) {
    parts.push("## Respostas de Consciencia")
    for (const c of ctx.consciousness) {
      const details = [
        `fase: ${c.phase}`,
        c.challengeText ? `texto: "${c.challengeText.slice(0, 200)}"` : null,
        c.selfRating !== null ? `autoavaliacao: ${c.selfRating}` : null,
        c.learningGoal ? `objetivo: "${c.learningGoal.slice(0, 150)}"` : null,
        c.commitment ? `comprometimento: "${c.commitment.slice(0, 150)}"` : null,
        c.ratingChange !== null
          ? `mudanca rating: ${c.ratingChange > 0 ? "+" : ""}${c.ratingChange}`
          : null,
      ].filter(Boolean)
      parts.push(`- ${details.join("; ")}`)
    }
    parts.push("")
  }

  // Slide reflections
  if (ctx.reflections.length > 0) {
    parts.push("## Reflexoes em Slides")
    for (const r of ctx.reflections) {
      const text = r.response.length > 200 ? `${r.response.slice(0, 200)}...` : r.response
      parts.push(`- (${r.wordCount} palavras): "${text}"`)
    }
    parts.push("")
  }

  // Learner profile snapshot
  if (ctx.profile) {
    parts.push("## Perfil do Aprendiz")
    const profileDetails = [
      ctx.profile.engagementStyle ? `estilo engajamento: ${ctx.profile.engagementStyle}` : null,
      ctx.profile.reasoningStyle ? `estilo raciocinio: ${ctx.profile.reasoningStyle}` : null,
      ctx.profile.avgDepthAchieved ? `profundidade media: ${ctx.profile.avgDepthAchieved}` : null,
      ctx.profile.strengths.length > 0
        ? `pontos fortes: ${ctx.profile.strengths.join(", ")}`
        : null,
      ctx.profile.growthAreas.length > 0
        ? `areas de crescimento: ${ctx.profile.growthAreas.join(", ")}`
        : null,
    ].filter(Boolean)
    parts.push(profileDetails.join("\n"))
    parts.push("")
  }

  parts.push(
    "Classifique este aluno nas 4 dimensoes (Roda, CMA, Metanoia, Jung) e gere um resumo em portugues.",
  )

  return parts.join("\n")
}

function heuristicFallback(ctx: StudentContext): ClassificationOutput {
  // Roda: map from depth_reached
  const maxDepth = Math.max(...ctx.sessions.map((s) => s.analytics?.depth_reached ?? 0), 0)
  const rodaStage = Math.min(Math.max(Math.ceil(maxDepth * 8 / 7), 1), 8) as 1|2|3|4|5|6|7|8

  // CMA: from values_revealed (alma), abstraction (mente), rest (corpo)
  const hasValues = ctx.sessions.some((s) => (s.analytics?.values_revealed ?? []).length > 0)
  const avgAbstraction = ctx.sessions.length > 0
    ? ctx.sessions.reduce((sum, s) => sum + (s.analytics?.abstraction_level ?? 0), 0) / ctx.sessions.length
    : 0
  const alma = hasValues ? 35 : 15
  const mente = avgAbstraction > 5 ? 40 : 25
  const corpo = 100 - alma - mente
  const dominant = alma >= mente && alma >= corpo ? "alma" as const : mente >= corpo ? "mente" as const : "corpo" as const

  // Metanoia: from breakthroughs + depth
  const breakthroughs = ctx.sessions.reduce((sum, s) => sum + (s.analytics?.breakthrough_moments ?? 0), 0)
  const metanoiaLevel = (breakthroughs >= 2 ? 4 : breakthroughs >= 1 ? 3 : maxDepth >= 4 ? 2 : maxDepth >= 2 ? 1 : 0) as 0|1|2|3|4

  // Jung: from defense_mechanisms + depth
  const hasDefenses = ctx.sessions.some((s) => (s.analytics?.defense_mechanisms ?? []).length > 0)
  const jungLayer = breakthroughs >= 1 ? "self" as const : hasDefenses ? "shadow" as const : maxDepth >= 3 ? "ego" as const : "persona" as const

  // Engagement: from emotional_density
  const avgDensity = ctx.sessions.length > 0
    ? ctx.sessions.reduce((sum, s) => sum + (s.analytics?.emotional_density_progression?.slice(-1)[0] ?? 0), 0) / ctx.sessions.length
    : 0
  const engLevel = (avgDensity > 0.7 ? 4 : avgDensity > 0.4 ? 3 : avgDensity > 0.15 ? 2 : 1) as 1|2|3|4

  return {
    roda: { stage: rodaStage, confidence: 0.6, evidence: ["Classificacao heuristica baseada em depth_reached e breakthroughs"] },
    cma: { corpo, mente, alma, dominant },
    metanoia: { level: metanoiaLevel, signals: breakthroughs > 0 ? ["Breakthrough detectado"] : ["Baseado em profundidade de sessao"] },
    jung: { layer: jungLayer, confidence: 0.5, evidence: ["Classificacao heuristica baseada em defense_mechanisms e depth"] },
    engagement: { level: engLevel },
    summary: `Analise heuristica: Roda estagio ${rodaStage}, Metanoia nivel ${metanoiaLevel}, profundidade ${jungLayer}. ${ctx.sessions.length} sessoes analisadas.`,
  }
}

export async function classifyWithClaude(ctx: StudentContext): Promise<{
  result: ClassificationOutput
  tokensUsed: number
}> {
  // Try AI classification, fallback to heuristics if API fails
  try {
    const prompt = buildClassificationPrompt(ctx)

    console.log(`[semantic] Calling OpenAI for student, messages=${ctx.messages.length}, sessions=${ctx.sessions.length}`)

    const { object, usage } = await generateObject({
      model: openai(SEMANTIC_MODEL),
      system: CLASSIFICATION_SYSTEM_PROMPT,
      prompt,
      schema: semanticClassificationSchema,
      maxRetries: 1,
    })

    console.log(`[semantic] OpenAI responded, tokens=${(usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)}`)

    // Normalize CMA percentages to sum to 100
    const cmaTotal = object.cma.corpo + object.cma.mente + object.cma.alma
    if (cmaTotal > 0 && cmaTotal !== 100) {
      const factor = 100 / cmaTotal
      object.cma.corpo = Math.round(object.cma.corpo * factor)
      object.cma.mente = Math.round(object.cma.mente * factor)
      object.cma.alma = 100 - object.cma.corpo - object.cma.mente
    }

    const tokensUsed = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)

    return { result: object, tokensUsed }
  } catch (error) {
    console.warn(`[semantic] AI classification failed, using heuristic fallback:`, (error as Error).message?.substring(0, 100))
    return { result: heuristicFallback(ctx), tokensUsed: 0 }
  }
}

// ---------------------------------------------------------------------------
// 4. Merge heuristic + AI classifications
// ---------------------------------------------------------------------------

export function mergeClassifications(
  heuristic: HeuristicResult,
  aiResult: ClassificationOutput,
  ctx: StudentContext,
): MergedClassification {
  return {
    // From AI: Roda
    rodaStage: aiResult.roda.stage,
    rodaConfidence: Math.round(aiResult.roda.confidence * 100) / 100,
    rodaEvidence: aiResult.roda.evidence,

    // From AI: CMA
    cmaCorpo: aiResult.cma.corpo,
    cmaMente: aiResult.cma.mente,
    cmaAlma: aiResult.cma.alma,
    cmaDominant: aiResult.cma.dominant,

    // From AI: Metanoia
    metanoiaLevel: aiResult.metanoia.level,
    metanoiaSignals: aiResult.metanoia.signals,

    // From Heuristic: Kolb (already computed by shadow pipeline)
    kolbStyle: heuristic.kolbStyle,
    kolbGrasping: heuristic.kolbGrasping,
    kolbTransforming: heuristic.kolbTransforming,

    // From AI: Jung
    jungLayer: aiResult.jung.layer,
    jungConfidence: Math.round(aiResult.jung.confidence * 100) / 100,
    jungEvidence: aiResult.jung.evidence,

    // Merged: Engagement (heuristic level, but AI can override if it disagrees significantly)
    engagementLevel: heuristic.engagementLevel,
    engagementAiProbability: heuristic.engagementAiProbability,

    // AI summary
    summary: aiResult.summary,

    // Metadata
    sessionsAnalyzed: ctx.sessions.length,
    responsesAnalyzed: ctx.messages.length,
    classificationModel: SEMANTIC_MODEL,
    classificationTokensUsed: 0, // will be set by caller
  }
}

// ---------------------------------------------------------------------------
// 5. Full classification pipeline for one student
// ---------------------------------------------------------------------------

export async function classifyStudent(
  db: SupabaseClient,
  studentId: string,
  courseId: string | null,
  tenantId: string,
): Promise<MergedClassification> {
  // Step 1: Gather all student data
  const ctx = await buildStudentContext(db, studentId, courseId, tenantId)

  // Step 2: Pre-classify with heuristics (Kolb + Engagement)
  const heuristic = classifyWithHeuristics(ctx)

  // Step 3: If student has no meaningful data, return conservative defaults
  if (ctx.sessions.length === 0 && ctx.messages.length === 0 && ctx.consciousness.length === 0) {
    return {
      rodaStage: 1,
      rodaConfidence: 0,
      rodaEvidence: ["Dados insuficientes para classificacao"],
      cmaCorpo: 33,
      cmaMente: 34,
      cmaAlma: 33,
      cmaDominant: "mente",
      metanoiaLevel: 0,
      metanoiaSignals: ["Sem interacoes registradas"],
      kolbStyle: heuristic.kolbStyle,
      kolbGrasping: heuristic.kolbGrasping,
      kolbTransforming: heuristic.kolbTransforming,
      jungLayer: "persona",
      jungConfidence: 0,
      jungEvidence: ["Dados insuficientes para classificacao"],
      engagementLevel: 1,
      engagementAiProbability: 0,
      summary: "Aluno sem interacoes suficientes para analise semantica.",
      sessionsAnalyzed: 0,
      responsesAnalyzed: 0,
      classificationModel: SEMANTIC_MODEL,
      classificationTokensUsed: 0,
    }
  }

  // Step 4: Classify with Claude (Roda, CMA, Metanoia, Jung)
  const { result: aiResult, tokensUsed } = await classifyWithClaude(ctx)

  // Step 5: Merge heuristic + AI results
  const merged = mergeClassifications(heuristic, aiResult, ctx)
  merged.classificationTokensUsed = tokensUsed

  return merged
}

// ---------------------------------------------------------------------------
// 6. Helper to map DB row to SemanticAnalysisResult (for API response)
// ---------------------------------------------------------------------------

export function rowToSemanticResult(
  row: Record<string, unknown>,
  studentName: string,
  courseTitle: string,
): SemanticAnalysisResult {
  const rodaStage = (row.roda_stage as number) || 1
  const metanoiaLevel = (row.metanoia_level as number) || 0
  const engagementLevel = (row.engagement_level as number) || 1

  return {
    studentId: row.student_id as string,
    studentName,
    courseId: row.course_id as string,
    courseTitle,

    roda: {
      stage: Math.min(8, Math.max(1, rodaStage)) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
      stageName: RODA_STAGES[rodaStage] ?? "Desconhecido",
      confidence: Number(row.roda_confidence ?? 0),
      evidence: (row.roda_evidence as string[]) ?? [],
    },
    cma: {
      corpo: row.cma_corpo as number,
      mente: row.cma_mente as number,
      alma: row.cma_alma as number,
      dominant: row.cma_dominant as "corpo" | "mente" | "alma",
    },
    metanoia: {
      level: Math.min(4, Math.max(0, metanoiaLevel)) as 0 | 1 | 2 | 3 | 4,
      levelName: METANOIA_LEVELS[metanoiaLevel] ?? "Desconhecido",
      signals: (row.metanoia_signals as string[]) ?? [],
    },
    kolb: {
      style: (row.kolb_style as string) ?? null,
      graspingAxis: row.kolb_grasping ? Number(row.kolb_grasping) : null,
      transformingAxis: row.kolb_transforming ? Number(row.kolb_transforming) : null,
    },
    jung: {
      layer: row.jung_layer as "persona" | "ego" | "shadow" | "self",
      layerName: JUNG_LAYERS[row.jung_layer as string] ?? "Desconhecido",
      confidence: Number(row.jung_confidence ?? 0),
      evidence: (row.jung_evidence as string[]) ?? [],
    },
    engagement: {
      level: Math.min(4, Math.max(1, engagementLevel)) as 1 | 2 | 3 | 4,
      levelName: ENGAGEMENT_LEVELS[engagementLevel] ?? "Desconhecido",
      aiDetectionProbability: Number(row.engagement_ai_probability ?? 0),
    },

    summary: (row.summary as string) ?? "",
    sessionsAnalyzed: (row.sessions_analyzed as number) ?? 0,
    responsesAnalyzed: (row.responses_analyzed as number) ?? 0,
    analyzedAt: (row.analyzed_at as string) ?? new Date().toISOString(),
  }
}
