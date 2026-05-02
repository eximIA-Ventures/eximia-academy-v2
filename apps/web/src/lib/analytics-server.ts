import { PostHog } from "posthog-node"

let posthogServer: PostHog | null = null

function getPostHogServer() {
  if (!posthogServer && process.env.POSTHOG_API_KEY) {
    posthogServer = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    })
  }
  return posthogServer
}

export const analyticsServer = {
  questionGenerated: (userId: string, chapterId: string, questionCount: number) => {
    const server = getPostHogServer()
    if (!server) {
      console.warn("[analytics] PostHog server not initialized — question_generated event dropped")
      return
    }
    server.capture({
      distinctId: userId,
      event: "question_generated",
      properties: { chapter_id: chapterId, question_count: questionCount },
    })
  },

  pipelineCompleted: (
    userId: string,
    props: {
      total_input_tokens: number
      total_output_tokens: number
      model: string
      retry_count: number
      estimated_cost_usd: number
    },
  ) => {
    const server = getPostHogServer()
    if (!server) {
      console.warn("[analytics] PostHog server not initialized — pipeline_completed event dropped")
      return
    }
    server.capture({
      distinctId: userId,
      event: "pipeline_completed",
      properties: props,
    })
  },
}
