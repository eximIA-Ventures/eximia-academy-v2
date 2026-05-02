import { http, HttpResponse } from "msw"
import analystFixture from "../fixtures/analyst-response.json"
import creatorFixture from "../fixtures/creator-response.json"
import editorFixture from "../fixtures/editor-response.json"
import socratesFixture from "../fixtures/socrates-response.json"
import testerFixture from "../fixtures/tester-response.json"

export const anthropicHandlers = [
  http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    const body = (await request.json()) as { system?: string }
    const system = body.system ?? ""

    if (system.includes("Socrates") || system.includes("orientador")) {
      return HttpResponse.json(socratesFixture)
    }
    if (system.includes("Editor") || system.includes("editor")) {
      return HttpResponse.json(editorFixture)
    }
    if (system.includes("Tester") || system.includes("validacao")) {
      return HttpResponse.json(testerFixture)
    }
    if (system.includes("Analyst") || system.includes("analise")) {
      return HttpResponse.json(analystFixture)
    }
    // Default: creator (question generation)
    return HttpResponse.json(creatorFixture)
  }),
]
