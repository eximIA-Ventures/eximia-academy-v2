// Creator (Story 2.3)
export { generateQuestions } from "./creator"
export { CREATOR_SYSTEM_PROMPT } from "./prompts/creator"
export {
  creatorInputSchema,
  creatorOutputSchema,
  type CreatorInput,
  type CreatorOutput,
  type GeneratedQuestion,
} from "./schemas/creator"

// Socratic Pipeline (Story 3.2)
export { orchestrateSocraticDialogue } from "./orchestrator"
export { runAnalyst } from "./analyst"

// Prompts
export { SOCRATES_SYSTEM_PROMPT } from "./prompts/socrates"
export { EDITOR_SYSTEM_PROMPT } from "./prompts/editor"
export { TESTER_SYSTEM_PROMPT } from "./prompts/tester"
export { ANALYST_SYSTEM_PROMPT } from "./prompts/analyst"

// Schemas
export {
  socratesInputSchema,
  socratesOutputSchema,
  type SocratesInput,
  type SocratesOutput,
} from "./schemas/socrates"
export {
  editorInputSchema,
  editorOutputSchema,
  type EditorInput,
  type EditorOutput,
} from "./schemas/editor"
export {
  testerInputSchema,
  testerOutputSchema,
  type TesterInput,
  type TesterOutput,
} from "./schemas/tester"
export {
  analystInputSchema,
  analystOutputSchema,
  type AnalystInput,
  type AnalystOutput,
} from "./schemas/analyst"

// Organizer (Epic 13)
export { organizeContent } from "./organizer"
export { ORGANIZER_SYSTEM_PROMPT } from "./prompts/organizer"
export {
  organizerInputSchema,
  organizerOutputSchema,
  type OrganizerInput,
  type OrganizerOutput,
  type OrganizedChapter,
} from "./schemas/organizer"

// Utilities (refactored from orchestrator — Epic 10)
export { withTimeout, isRetryableError, delay, getBackoffDelay } from "./utils"

// Content Normalization
export { normalizeChapterMarkdown } from "./normalize-markdown"

// Telemetry (Sentry abstraction — graceful degradation)
export { captureException, startSpan } from "./telemetry"

// Profiler (Epic 10)
export { runProfiler, buildProfilerPrompt } from "./profiler"
export { PROFILER_SYSTEM_PROMPT } from "./prompts/profiler"
export {
  profilerInputSchema,
  profilerOutputSchema,
  type ProfilerInput,
  type ProfilerOutput,
} from "./schemas/profiler"

// Types & Config
export {
  type AgentPipelineConfig,
  type PipelineStep,
  type PipelineResult,
  type AnalysisResult,
  type OrchestratorInput,
  type InteractionType,
  type InteractionConfig,
  type InteractionInput,
  type ClosingReason,
  type ClosingFlags,
  DEFAULT_PIPELINE_CONFIG,
  DEFAULT_INTERACTION_CONFIG,
} from "./types"

// Closing Logic (Epic 17 — Story 17.4)
export {
  evaluateClosing,
  getDefaultMaxInteractions,
  buildClosingPromptSection,
} from "./closing"

// Enricher (Epic 15)
export { generateSearchQueries, evaluateSources, incorporateSources } from "./enricher"
export {
  ENRICHER_QUERY_PROMPT,
  ENRICHER_EVAL_PROMPT,
  ENRICHER_INCORPORATE_PROMPT,
} from "./prompts/enricher"
export {
  enricherSearchQueriesSchema,
  enricherEvaluationSchema,
  enricherIncorporateSchema,
  type EnricherSearchQueries,
  type EnricherEvaluation,
  type EnricherIncorporateOutput,
} from "./schemas/enricher"

// Detector (Epic 17 — Shadow Pipeline)
export { DETECTOR_SYSTEM_PROMPT } from "./prompts/detector"
export {
  detectorOutputSchema,
  type DetectorOutput,
} from "./schemas/detector"

// Perfilador (Epic 17 — Shadow Pipeline)
export {
  PERFILADOR_SYSTEM_PROMPT,
  buildPerfiladorPrompt,
  type PerfiladorPromptContext,
} from "./prompts/perfilador"
export {
  perfiladorOutputSchema,
  type PerfiladorOutput,
} from "./schemas/perfilador"

// Shadow Pipeline (Epic 17 — Story 17.3)
export {
  runDetector,
  runPerfilador,
  shouldRunPerfilador,
  mergeProfileData,
  buildAnalyticsUpdate,
  executeShadowPipeline,
  DEFAULT_SHADOW_CONFIG,
  type ShadowInput,
  type ShadowPipelineConfig,
  type ShadowPersistence,
  type ShadowResult,
  type ExistingLearnerProfile,
} from "./shadow-pipeline"

// Profile Context (Epic 17 — Story 17.6)
export {
  sanitizeProfileForPrompt,
  buildLearnerProfileContext,
} from "./profile-context"

// Model Router (Epic 16 — Story 16.3)
export {
  getModelSpec,
  getModel,
  getModelWithFallback,
  MODEL_PRICING,
  type ModelProvider,
  type AgentRole,
  type TenantPlan,
  type ModelSpec,
  type RoutingContext,
} from "./model-router"

// Errors
export {
  AgentTimeoutError,
  AgentInvalidOutputError,
  PipelineMaxRetriesError,
  ModelRouterError,
} from "./errors"

// Course Designer Orchestrator (Epic 21 — Story 21.2)
export {
  designCourse,
  DesignOrchestratorAbortError,
  DesignOrchestratorTimeoutError,
  type DesignCourseOptions,
  type DesignCourseResult,
  type PhaseProgress,
  type PhaseResults,
  type PhaseStatus,
} from "./course-designer"

// Content Analyzer (Epic 21 — Story 21.5)
export {
  analyzeContent,
  contentAnalysisResultSchema,
  type ContentAnalysisResult,
  type TopicExtracted,
} from "./course-designer"

// Apply Blueprint (Epic 23 — Story 23.2)
export {
  applyBlueprint,
  type ApplyBlueprintInput,
  type ApplyBlueprintResult,
  type BlueprintModule,
  type GeneratedChapter,
  type BlueprintGeneratedQuestion,
} from "./course-designer"

// Auditor (Epic 23 — Story 23.1)
export {
  auditCourse,
  auditResultSchema,
  type AuditResult,
  type CourseForAudit,
} from "./course-designer"
