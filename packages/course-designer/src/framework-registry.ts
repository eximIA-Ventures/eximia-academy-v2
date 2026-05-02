import type { FrameworkConfig, FrameworkId } from "./schemas/shared"

// --- bloom_interaction_map (Architecture §9.1 — shared across all v1 frameworks) ---

const BLOOM_INTERACTION_MAP: FrameworkConfig["bloom_interaction_map"] = {
  remembering: { interaction: "quiz", turns: 8, depth_range: [1, 2] },
  understanding: { interaction: "quiz", turns: 8, depth_range: [2, 3] },
  applying: { interaction: "socratic_dialogue", turns: 20, depth_range: [3, 4] },
  analyzing: { interaction: "socratic_dialogue", turns: 20, depth_range: [4, 5] },
  evaluating: { interaction: "scenario", turns: 12, depth_range: [5, 6] },
  creating: { interaction: "assignment", turns: 15, depth_range: [6, 7] },
}

// --- ELC+ 2026 (Architecture §4.2) ---

const ELC_PLUS_CONFIG: FrameworkConfig = {
  id: "elc_plus",
  name: "ELC+ 2026 (Experiential Learning Cycle Extended)",
  type: "learning_cycle",
  stages: [
    {
      id: "immerse",
      name: "Immerse (Sentir)",
      description: "Aluno VIVE o problema antes de saber a teoria",
      time_percentage: 18,
      default_interaction: "scenario",
      purpose: "Experiência concreta com decisão forçada",
    },
    {
      id: "reflect",
      name: "Reflect (Observar)",
      description: "Reflexão guiada sobre o que acabou de viver",
      time_percentage: 12,
      default_interaction: "socratic_dialogue",
      purpose: "Meta-cognição sobre a experiência",
    },
    {
      id: "conceptualize",
      name: "Conceptualize (Pensar)",
      description: "Framework teórico e conceitos",
      time_percentage: 18,
      default_interaction: "quiz",
      purpose: "Verificar compreensão da teoria",
    },
    {
      id: "experiment",
      name: "Experiment (Fazer)",
      description: "Reaplicar COM framework",
      time_percentage: 18,
      default_interaction: "socratic_dialogue",
      purpose: "Prática guiada com novo conhecimento",
    },
    {
      id: "calibrate",
      name: "Calibrate (Validar)",
      description: "Feedback e meta-avaliação",
      time_percentage: 12,
      default_interaction: "socratic_dialogue",
      purpose: "Comparar antes/depois, ajustar",
    },
    {
      id: "integrate",
      name: "Integrate (Internalizar)",
      description: "Transferência para mundo real",
      time_percentage: 22,
      default_interaction: "assignment",
      purpose: "Entregável concreto + compromisso",
    },
  ],
  sequencing: {
    model: "spiral",
    levels: [
      { id: "fundamentos", name: "Fundamentos", position: "early", modules_range: "1-2" },
      { id: "variacao", name: "Variação", position: "mid", modules_range: "3-4" },
      { id: "conflito_humano", name: "Conflito Humano", position: "mid", modules_range: "5-6" },
      { id: "mundo_real", name: "Mundo Real", position: "late", modules_range: "7-8" },
      { id: "sintese", name: "Síntese", position: "late", modules_range: "9-10" },
    ],
    progression_rule: "bloom_ascending",
  },
  bloom_interaction_map: BLOOM_INTERACTION_MAP,
  positional_adjustments: [
    {
      position: "early",
      condition: "bloom >= analyzing",
      action: "keep socratic_dialogue",
      rationale: "Cedo demais para scenario em fundamentos",
    },
    {
      position: "mid",
      condition: "spiral == conflito_humano && bloom == applying",
      action: "upgrade to scenario",
      rationale: "Trade-offs humanos exigem cenário",
    },
    {
      position: "late",
      condition: "spiral == mundo_real && bloom <= analyzing",
      action: "upgrade to scenario",
      rationale: "Contexto real exige cenário prático",
    },
    {
      position: "late",
      condition: "spiral == sintese",
      action: "force assignment",
      rationale: "Entregável final obrigatório na síntese",
    },
  ],
  quality_criteria: [
    {
      id: "all_stages",
      name: "Todos os 6 estágios presentes",
      weight: 30,
      validation_rule: "every module has all 6 stages",
      failure_message: "Módulo sem todos os 6 estágios ELC+",
    },
    {
      id: "time_balance",
      name: "Distribuição de tempo ±5%",
      weight: 20,
      validation_rule: "stage time_percentage within ±5% of target",
      failure_message: "Distribuição de tempo desbalanceada",
    },
    {
      id: "bloom_progression",
      name: "Progressão Bloom ascendente",
      weight: 25,
      validation_rule: "bloom levels increase across modules",
      failure_message: "Progressão Bloom não é ascendente",
    },
    {
      id: "objective_alignment",
      name: "Objetivo ↔ Avaliação 1:1",
      weight: 15,
      validation_rule: "each objective has matching assessment",
      failure_message: "Objetivo sem avaliação correspondente",
    },
    {
      id: "spiral_coherence",
      name: "Coerência spiral curriculum",
      weight: 10,
      validation_rule: "spiral levels progress sequentially",
      failure_message: "Níveis spiral fora de sequência",
    },
  ],
  assessment_dimensions: [
    {
      name: "Knowledge Application",
      weight: 30,
      levels: [
        { score: 0, label: "novice", description: "Cannot apply knowledge independently" },
        { score: 1, label: "developing", description: "Applies with significant guidance" },
        {
          score: 2,
          label: "proficient",
          description: "Applies independently in familiar contexts",
        },
        { score: 3, label: "expert", description: "Applies and adapts to novel contexts" },
      ],
    },
    {
      name: "Experiential Depth",
      weight: 25,
      levels: [
        { score: 0, label: "surface", description: "Superficial engagement with experience" },
        { score: 1, label: "adequate", description: "Engages but stays at descriptive level" },
        { score: 2, label: "deep", description: "Connects experience to theory and practice" },
        {
          score: 3,
          label: "transformative",
          description: "Experience changes perspective and behavior",
        },
      ],
    },
    {
      name: "Reflection Quality",
      weight: 20,
      levels: [
        { score: 0, label: "superficial", description: "No meaningful reflection" },
        { score: 1, label: "descriptive", description: "Describes what happened without analysis" },
        { score: 2, label: "analytical", description: "Analyzes causes, patterns, implications" },
        {
          score: 3,
          label: "transformative",
          description: "Generates new understanding and action plans",
        },
      ],
    },
    {
      name: "Integration Transfer",
      weight: 25,
      levels: [
        { score: 0, label: "minimal", description: "No transfer to real context" },
        { score: 1, label: "partial", description: "Some transfer with support" },
        {
          score: 2,
          label: "substantial",
          description: "Transfers independently to familiar contexts",
        },
        {
          score: 3,
          label: "complete",
          description: "Transfers and adapts to novel real-world contexts",
        },
      ],
    },
  ],
}

// --- Kolb 4-Stage (Architecture §4.3) ---

const KOLB_4_CONFIG: FrameworkConfig = {
  id: "kolb_4",
  name: "Kolb 4-Stage (Experiential Learning Cycle)",
  type: "learning_cycle",
  stages: [
    {
      id: "experience",
      name: "Concrete Experience (Sentir)",
      description: "Vivência concreta — aluno experimenta antes de teorizar",
      time_percentage: 25,
      default_interaction: "scenario",
      purpose: "Vivência concreta",
    },
    {
      id: "reflect",
      name: "Reflective Observation (Observar)",
      description: "Observação reflexiva — analisar o que vivenciou",
      time_percentage: 25,
      default_interaction: "socratic_dialogue",
      purpose: "Reflexão guiada",
    },
    {
      id: "conceptualize",
      name: "Abstract Conceptualization (Pensar)",
      description: "Conceituação abstrata — conectar experiência à teoria",
      time_percentage: 25,
      default_interaction: "quiz",
      purpose: "Conceituação abstrata",
    },
    {
      id: "experiment",
      name: "Active Experimentation (Fazer)",
      description: "Experimentação ativa — aplicar em novo contexto",
      time_percentage: 25,
      default_interaction: "assignment",
      purpose: "Experimentação ativa",
    },
  ],
  sequencing: {
    model: "linear",
    progression_rule: "bloom_ascending",
  },
  bloom_interaction_map: BLOOM_INTERACTION_MAP,
  positional_adjustments: [],
  quality_criteria: [
    {
      id: "all_stages",
      name: "Todos os 4 estágios presentes",
      weight: 35,
      validation_rule: "every module has all 4 stages",
      failure_message: "Módulo sem todos os 4 estágios Kolb",
    },
    {
      id: "time_balance",
      name: "Distribuição equilibrada (25% cada ±10%)",
      weight: 20,
      validation_rule: "stage time_percentage within ±10% of 25%",
      failure_message: "Distribuição de tempo desbalanceada",
    },
    {
      id: "bloom_progression",
      name: "Progressão Bloom ascendente",
      weight: 25,
      validation_rule: "bloom levels increase across modules",
      failure_message: "Progressão Bloom não é ascendente",
    },
    {
      id: "objective_alignment",
      name: "Objetivo ↔ Avaliação 1:1",
      weight: 20,
      validation_rule: "each objective has matching assessment",
      failure_message: "Objetivo sem avaliação correspondente",
    },
  ],
  assessment_dimensions: [
    {
      name: "Concrete Experience",
      weight: 25,
      levels: [
        { score: 0, label: "passive", description: "No active engagement with experience" },
        { score: 1, label: "observing", description: "Participates but stays peripheral" },
        { score: 2, label: "engaged", description: "Actively participates and reflects" },
        { score: 3, label: "immersed", description: "Fully immersed, generates insights" },
      ],
    },
    {
      name: "Reflective Observation",
      weight: 25,
      levels: [
        { score: 0, label: "absent", description: "No reflection on experience" },
        { score: 1, label: "descriptive", description: "Describes without analyzing" },
        { score: 2, label: "analytical", description: "Identifies patterns and meaning" },
        { score: 3, label: "integrative", description: "Connects to prior knowledge and theory" },
      ],
    },
    {
      name: "Abstract Conceptualization",
      weight: 25,
      levels: [
        { score: 0, label: "fragmented", description: "Cannot articulate concepts" },
        { score: 1, label: "basic", description: "Identifies key concepts" },
        { score: 2, label: "structured", description: "Builds mental models and frameworks" },
        { score: 3, label: "generalized", description: "Creates transferable abstractions" },
      ],
    },
    {
      name: "Active Experimentation",
      weight: 25,
      levels: [
        { score: 0, label: "inactive", description: "Does not attempt application" },
        { score: 1, label: "imitative", description: "Applies by copying examples" },
        { score: 2, label: "adaptive", description: "Adapts and applies to new contexts" },
        { score: 3, label: "innovative", description: "Creates novel applications" },
      ],
    },
  ],
}

// --- PBL Hmelo-Silver (Architecture §4.4) ---

const PBL_HMELO_CONFIG: FrameworkConfig = {
  id: "pbl_hmelo",
  name: "Problem-Based Learning (Hmelo-Silver 4-Phase)",
  type: "learning_cycle",
  stages: [
    {
      id: "problem_presentation",
      name: "Problem Presentation (Problema)",
      description: "Problema complexo, ill-structured, autêntico",
      time_percentage: 15,
      default_interaction: "scenario",
      purpose: "Engajar com problema real ANTES de instrução",
    },
    {
      id: "group_collaboration",
      name: "Group Collaboration (Investigação)",
      description: "Identificar o que sabe, o que precisa aprender, gerar hipóteses",
      time_percentage: 25,
      default_interaction: "socratic_dialogue",
      purpose: "Ativação de prior knowledge, elaboração, hipóteses",
    },
    {
      id: "self_directed_learning",
      name: "Self-Directed Learning (Pesquisa)",
      description: "Pesquisa independente dos learning issues",
      time_percentage: 35,
      default_interaction: "assignment",
      purpose: "Aluno busca conhecimento autonomamente",
    },
    {
      id: "application_reflection",
      name: "Application & Reflection (Aplicação)",
      description: "Aplicar conhecimento ao problema, refletir",
      time_percentage: 25,
      default_interaction: "socratic_dialogue",
      purpose: "Testar hipóteses, resolver, meta-cognição",
    },
  ],
  sequencing: {
    model: "problem_complexity",
    levels: [
      {
        id: "simple_structured",
        name: "Problemas Semi-Estruturados",
        position: "early",
        modules_range: "1-2",
      },
      {
        id: "moderate_complex",
        name: "Problemas Moderados",
        position: "mid",
        modules_range: "3-5",
      },
      {
        id: "ill_structured",
        name: "Problemas Ill-Structured",
        position: "late",
        modules_range: "6+",
      },
    ],
    progression_rule: "complexity_ascending",
  },
  bloom_interaction_map: BLOOM_INTERACTION_MAP,
  positional_adjustments: [],
  quality_criteria: [
    {
      id: "problem_is_REAL",
      name: "Problemas são REAL (Realistic, Engaging, Aligned, Leads to SDL)",
      weight: 30,
      validation_rule: "each problem passes REAL framework check",
      failure_message: "Problema não atende framework REAL",
    },
    {
      id: "five_pbl_goals",
      name: "5 Goals PBL cobertos",
      weight: 25,
      validation_rule:
        "flexible knowledge, effective problem solving, SDL, effective collaboration, intrinsic motivation",
      failure_message: "Nem todos os 5 goals PBL estão cobertos",
    },
    {
      id: "sdl_explicit",
      name: "Fase SDL explícita em todo módulo",
      weight: 20,
      validation_rule: "every module has self_directed_learning stage",
      failure_message: "Módulo sem fase de aprendizagem autodirigida",
    },
    {
      id: "bloom_progression",
      name: "Progressão de complexidade",
      weight: 15,
      validation_rule: "problem complexity increases across modules",
      failure_message: "Complexidade dos problemas não progride",
    },
    {
      id: "reflection_present",
      name: "Reflexão metacognitiva em todo módulo",
      weight: 10,
      validation_rule: "every module has reflection component",
      failure_message: "Módulo sem reflexão metacognitiva",
    },
  ],
  assessment_dimensions: [
    {
      name: "Problem-Solving Process",
      weight: 30,
      levels: [
        { score: 0, label: "unstructured", description: "No systematic approach to problem" },
        { score: 1, label: "emerging", description: "Identifies some aspects of the problem" },
        {
          score: 2,
          label: "systematic",
          description: "Applies structured problem-solving process",
        },
        {
          score: 3,
          label: "expert",
          description: "Navigates ill-structured problems with metacognition",
        },
      ],
    },
    {
      name: "Self-Directed Learning",
      weight: 25,
      levels: [
        { score: 0, label: "dependent", description: "Requires constant guidance" },
        { score: 1, label: "guided", description: "Identifies learning needs with support" },
        { score: 2, label: "autonomous", description: "Plans and executes learning independently" },
        {
          score: 3,
          label: "self-regulated",
          description: "Monitors and adjusts learning strategy",
        },
      ],
    },
    {
      name: "Collaborative Skills",
      weight: 20,
      levels: [
        { score: 0, label: "isolated", description: "Does not engage with group" },
        { score: 1, label: "participatory", description: "Contributes when prompted" },
        { score: 2, label: "collaborative", description: "Actively shares and builds on ideas" },
        {
          score: 3,
          label: "facilitative",
          description: "Facilitates group learning and synthesis",
        },
      ],
    },
    {
      name: "Knowledge Integration",
      weight: 25,
      levels: [
        { score: 0, label: "fragmented", description: "Knowledge remains disconnected" },
        { score: 1, label: "connected", description: "Links some concepts to problem" },
        {
          score: 2,
          label: "integrated",
          description: "Synthesizes knowledge from multiple sources",
        },
        {
          score: 3,
          label: "transferable",
          description: "Applies integrated knowledge to new problems",
        },
      ],
    },
  ],
  special_requirements: {
    group_size: { min: 5, max: 8 },
    sdl_interval: "3-5 days between sessions",
    facilitator_role: "coach",
    problem_design_framework: "REAL",
    whiteboard_tool: true,
  },
}

// --- Registry ---

const FRAMEWORK_REGISTRY: Record<FrameworkId, FrameworkConfig> = {
  elc_plus: ELC_PLUS_CONFIG,
  kolb_4: KOLB_4_CONFIG,
  pbl_hmelo: PBL_HMELO_CONFIG,
}

/**
 * Get a complete FrameworkConfig by id.
 * Throws if id is unknown.
 */
export function getFrameworkConfig(id: FrameworkId): FrameworkConfig {
  const config = FRAMEWORK_REGISTRY[id]
  if (!config) {
    throw new Error(
      `Unknown framework id: "${id}". Available: ${Object.keys(FRAMEWORK_REGISTRY).join(", ")}`,
    )
  }
  return config
}

/**
 * List all available frameworks (id, name, description).
 */
export function listFrameworks(): Array<{ id: FrameworkId; name: string; description: string }> {
  return [
    {
      id: "elc_plus",
      name: ELC_PLUS_CONFIG.name,
      description: "6 estágios experienciais com calibração e spiral curriculum. Máxima retenção.",
    },
    {
      id: "kolb_4",
      name: KOLB_4_CONFIG.name,
      description: "4 estágios clássicos. Simples, equilibrado, ideal para cursos curtos.",
    },
    {
      id: "pbl_hmelo",
      name: PBL_HMELO_CONFIG.name,
      description: "4 fases problem-first com SDL. Ideal para resolução de problemas complexos.",
    },
  ]
}

// --- Framework Selector (Architecture §4.6) ---

export interface FrameworkSelectionInput {
  instructor_preferred_framework?: FrameworkId
  behavior_change: string
  total_duration_hours: number
  experience_level: "iniciante" | "intermediario" | "avancado" | "especialista"
}

/**
 * Decision tree to select the best framework based on course characteristics.
 * Priority: instructor preference > behavior-based > duration-based > default.
 */
export function selectFramework(characteristics: FrameworkSelectionInput): FrameworkConfig {
  // P1: Instructor always has priority
  if (characteristics.instructor_preferred_framework) {
    return getFrameworkConfig(characteristics.instructor_preferred_framework)
  }

  // P2: Problem-solving behavior → PBL
  const bc = characteristics.behavior_change.toLowerCase()
  if (
    bc.includes("resolver problemas") ||
    bc.includes("tomar decisões") ||
    bc.includes("tomar decisoes")
  ) {
    return getFrameworkConfig("pbl_hmelo")
  }

  // P3: Short course + non-beginner → Kolb
  if (
    characteristics.total_duration_hours <= 10 &&
    characteristics.experience_level !== "iniciante"
  ) {
    return getFrameworkConfig("kolb_4")
  }

  // Default: ELC+
  return getFrameworkConfig("elc_plus")
}
