export class AgentTimeoutError extends Error {
  readonly agentName: string

  constructor(agentName: string) {
    super(`Agent "${agentName}" exceeded timeout limit`)
    this.name = "AgentTimeoutError"
    this.agentName = agentName
  }
}

export class AgentInvalidOutputError extends Error {
  readonly agentName: string
  readonly validationErrors: unknown

  constructor(agentName: string, validationErrors: unknown) {
    super(`Agent "${agentName}" returned invalid output`)
    this.name = "AgentInvalidOutputError"
    this.agentName = agentName
    this.validationErrors = validationErrors
  }
}

export class PipelineMaxRetriesError extends Error {
  readonly retryCount: number
  readonly bestResponse: string

  constructor(retryCount: number, bestResponse: string) {
    super(`Pipeline exceeded max retries (${retryCount})`)
    this.name = "PipelineMaxRetriesError"
    this.retryCount = retryCount
    this.bestResponse = bestResponse
  }
}

export class ModelRouterError extends Error {
  readonly agentRole: string
  readonly tenantPlan: string
  readonly checkedKeys: string[]

  constructor(agentRole: string, tenantPlan: string, checkedKeys: string[]) {
    super(
      `No API key available for agent "${agentRole}" (plan: ${tenantPlan}). Checked: ${checkedKeys.join(", ")}`,
    )
    this.name = "ModelRouterError"
    this.agentRole = agentRole
    this.tenantPlan = tenantPlan
    this.checkedKeys = checkedKeys
  }
}
