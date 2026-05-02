import { generateOpenApiSpec } from "@/lib/openapi/generator"
import { NextResponse } from "next/server"

export async function GET() {
  const spec = generateOpenApiSpec()

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  })
}
