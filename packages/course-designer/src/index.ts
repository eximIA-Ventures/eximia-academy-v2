// @eximia/course-designer — WS2: Course Creator Module

// Shared Schemas & Types (Story 20.1)
export * from "./schemas"

// Framework Registry (Story 20.2)
export {
  getFrameworkConfig,
  listFrameworks,
  selectFramework,
  type FrameworkSelectionInput,
} from "./framework-registry"

// Analyzer Agent (Story 20.4)
export { runAnalyzer } from "./analyzer"

// Architect Agent (Story 20.5)
export { runArchitect } from "./architect"

// Interaction Mapper (Story 20.5 / 20.7)
export { mapBloomToInteraction, mapInteractions } from "./interaction-mapper"

// Calculator Agent (Story 20.6)
export { runCalculator } from "./calculator"

// Neuroscience Rules (Story 20.7)
export {
  evaluateNeuroscienceRules,
  type NeuroscienceResult,
  type NeuroscienceRuleResult,
} from "./neuroscience-rules"

// Validator Agent (Story 20.7)
export { runValidator } from "./validator"

// Generator Agent (Story 20.7)
export { runGenerator } from "./generator"
