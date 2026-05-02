import { http, HttpResponse } from "msw"
import { analystFixture } from "./fixtures/analyst"
import {
  courseAnalyzerFixture,
  courseArchitectFixture,
  courseCalculatorFixture,
  courseGeneratorFixture,
  courseValidatorFixture,
} from "./fixtures/course-designer"
import { creatorFixture } from "./fixtures/creator"
import { editorFixture } from "./fixtures/editor"
import { socratesFixture } from "./fixtures/socrates"
import { testerFixture } from "./fixtures/tester"

function detectAgent(system: string): Record<string, unknown> {
  // Use unique prompt identifiers to avoid cross-matching
  // (e.g. Editor prompt contains "orientador_response" which would match Socrates)
  if (system.includes("Harven_Socrates")) return socratesFixture
  if (system.includes("Harven_Editor")) return editorFixture
  if (system.includes("Harven_Tester")) return testerFixture
  if (system.includes("Harven_Analyst")) return analystFixture
  if (system.includes("Harven_Creator")) return creatorFixture
  // Fallback: Profiler and other agents
  return creatorFixture
}

function detectCourseDesignerAgent(system: string): Record<string, unknown> | null {
  if (system.includes("Harven_CourseAnalyzer"))
    return courseAnalyzerFixture as unknown as Record<string, unknown>
  if (system.includes("Harven_CourseArchitect"))
    return courseArchitectFixture as unknown as Record<string, unknown>
  if (system.includes("Harven_CourseCalculator"))
    return courseCalculatorFixture as unknown as Record<string, unknown>
  if (system.includes("Harven_CourseValidator"))
    return courseValidatorFixture as unknown as Record<string, unknown>
  if (system.includes("Harven_CourseGenerator"))
    return courseGeneratorFixture as unknown as Record<string, unknown>
  return null
}

/** Extract system prompt from OpenAI messages array */
function extractOpenAISystem(messages: Array<{ role: string; content: string }>): string {
  const systemMsg = messages.find((m) => m.role === "system")
  return typeof systemMsg?.content === "string" ? systemMsg.content : ""
}

export const handlers = [
  // Anthropic API handler (WS1 Socratic dialogue pipeline)
  http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    const body = (await request.json()) as {
      system?: string | Array<{ text: string }>
      tools?: Array<{ name: string }>
      output_format?: { type: string }
    }

    // System prompt can be a string or array of content blocks
    let system = ""
    if (typeof body.system === "string") {
      system = body.system
    } else if (Array.isArray(body.system)) {
      system = body.system.map((b) => b.text).join(" ")
    }

    const fixture = detectAgent(system)

    // Anthropic provider v3+ with claude-sonnet-4-5 uses native structured output
    // (output_format) instead of the json tool. In that mode, the response must be
    // a text content block with the JSON string, not a tool_use block.
    const usesNativeStructuredOutput = body.output_format?.type === "json_schema"

    if (usesNativeStructuredOutput) {
      return HttpResponse.json({
        id: "msg_mock_e2e",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4-5-20250514",
        content: [
          {
            type: "text",
            text: JSON.stringify(fixture),
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 200 },
      })
    }

    // Fallback: older models use tool-calling mode with a "json" tool
    const toolName = body.tools?.[0]?.name ?? "json"

    return HttpResponse.json({
      id: "msg_mock_e2e",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-5-20250514",
      content: [
        {
          type: "tool_use",
          id: "toolu_mock_e2e",
          name: toolName,
          input: fixture,
        },
      ],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 200 },
    })
  }),

  // OpenAI API handler (WS2 Course Designer pipeline)
  http.post("https://api.openai.com/v1/chat/completions", async ({ request }) => {
    const body = (await request.json()) as {
      messages: Array<{ role: string; content: string }>
      tools?: Array<{ function: { name: string } }>
      response_format?: { type: string }
    }

    const system = extractOpenAISystem(body.messages)
    const fixture = detectCourseDesignerAgent(system)

    // If not a course-designer agent, return a generic response
    const data = fixture ?? (courseAnalyzerFixture as unknown as Record<string, unknown>)

    // OpenAI structured output via response_format or tool_choice
    const usesStructuredOutput = body.response_format?.type === "json_schema"

    if (usesStructuredOutput) {
      return HttpResponse.json({
        id: "chatcmpl-mock-e2e",
        object: "chat.completion",
        model: "gpt-4.1",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify(data),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      })
    }

    // Tool calling mode (generateObject default for @ai-sdk/openai)
    const toolName = body.tools?.[0]?.function?.name ?? "json"

    return HttpResponse.json({
      id: "chatcmpl-mock-e2e",
      object: "chat.completion",
      model: "gpt-4.1",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_mock_e2e",
                type: "function",
                function: {
                  name: toolName,
                  arguments: JSON.stringify(data),
                },
              },
            ],
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    })
  }),
]
