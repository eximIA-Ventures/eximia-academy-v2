import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi"

import { registry } from "./registry"

let cachedSpec: unknown = null

export function generateOpenApiSpec(): unknown {
  if (cachedSpec) return cachedSpec

  const generator = new OpenApiGeneratorV31(registry.definitions)

  cachedSpec = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "exímIA Academy Public API",
      version: "1.0.0",
      description:
        "Public REST API for integrating with exímIA Academy. Requires an API key for authentication.",
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        description: "API Server",
      },
    ],
    security: [{ BearerAuth: [] }],
  })

  return cachedSpec
}
