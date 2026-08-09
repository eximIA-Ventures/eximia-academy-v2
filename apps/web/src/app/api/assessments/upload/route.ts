import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"

const VALID_TYPES = ["disc", "big_five", "kolb", "enneagram", "multiple_intelligences", "career_anchors"]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// Allowlist of MIME types accepted by GPT-4o vision
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]

// Schemas to validate the JSON returned by the AI per assessment type
const RESULT_SCHEMAS: Record<string, z.ZodType> = {
  disc: z.object({
    d: z.number().min(0).max(100),
    i: z.number().min(0).max(100),
    s: z.number().min(0).max(100),
    c: z.number().min(0).max(100),
    dominantType: z.enum(["D", "I", "S", "C"]),
    secondaryType: z.enum(["D", "I", "S", "C"]),
  }),
  big_five: z.object({
    openness: z.number().min(0).max(100),
    conscientiousness: z.number().min(0).max(100),
    extraversion: z.number().min(0).max(100),
    agreeableness: z.number().min(0).max(100),
    neuroticism: z.number().min(0).max(100),
  }),
  kolb: z.object({
    ce: z.number(),
    ro: z.number(),
    ac: z.number(),
    ae: z.number(),
    style: z.enum(["Divergente", "Assimilador", "Convergente", "Acomodador"]),
    graspingAxis: z.number(),
    transformingAxis: z.number(),
    confidence: z.number().min(0).max(100),
  }),
  enneagram: z.object({
    type: z.number().int().min(1).max(9),
    wing: z.number().int().min(1).max(9),
    scores: z.array(z.number()).length(9),
  }),
  multiple_intelligences: z.object({
    linguistic: z.number().min(1).max(5),
    logical: z.number().min(1).max(5),
    spatial: z.number().min(1).max(5),
    musical: z.number().min(1).max(5),
    bodily: z.number().min(1).max(5),
    interpersonal: z.number().min(1).max(5),
    intrapersonal: z.number().min(1).max(5),
    naturalist: z.number().min(1).max(5),
  }),
  career_anchors: z.object({
    technical: z.number().min(1).max(6),
    management: z.number().min(1).max(6),
    autonomy: z.number().min(1).max(6),
    security: z.number().min(1).max(6),
    entrepreneurship: z.number().min(1).max(6),
    service: z.number().min(1).max(6),
    challenge: z.number().min(1).max(6),
    lifestyle: z.number().min(1).max(6),
  }),
}

const EXTRACTION_PROMPTS: Record<string, string> = {
  disc: `Extract DISC assessment scores from this image/document. Return JSON: {"d": number 0-100, "i": number 0-100, "s": number 0-100, "c": number 0-100, "dominantType": "D"|"I"|"S"|"C", "secondaryType": "D"|"I"|"S"|"C"}. Only return the JSON, nothing else.`,
  big_five: `Extract Big Five personality scores from this image/document. Return JSON: {"openness": number 0-100, "conscientiousness": number 0-100, "extraversion": number 0-100, "agreeableness": number 0-100, "neuroticism": number 0-100}. Only return the JSON, nothing else.`,
  kolb: `Extract Kolb Learning Style scores from this image/document. Return JSON: {"ce": number, "ro": number, "ac": number, "ae": number, "style": "Divergente"|"Assimilador"|"Convergente"|"Acomodador", "graspingAxis": number, "transformingAxis": number, "confidence": number 0-100}. Only return the JSON, nothing else.`,
  enneagram: `Extract Enneagram assessment results from this image/document. Return JSON: {"type": number 1-9, "wing": number 1-9, "scores": [number, number, number, number, number, number, number, number, number]}. The scores array has 9 values (types 1-9). Only return the JSON, nothing else.`,
  multiple_intelligences: `Extract Multiple Intelligences scores from this image/document. Return JSON: {"linguistic": number 1-5, "logical": number 1-5, "spatial": number 1-5, "musical": number 1-5, "bodily": number 1-5, "interpersonal": number 1-5, "intrapersonal": number 1-5, "naturalist": number 1-5}. Only return the JSON, nothing else.`,
  career_anchors: `Extract Career Anchors scores from this image/document. Return JSON: {"technical": number 1-6, "management": number 1-6, "autonomy": number 1-6, "security": number 1-6, "entrepreneurship": number 1-6, "service": number 1-6, "challenge": number 1-6, "lifestyle": number 1-6}. Only return the JSON, nothing else.`,
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Guard: user must belong to a tenant (own-profile assessment upload)
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()
  if (!profile?.tenant_id)
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const assessmentType = formData.get("assessment_type") as string | null

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  if (!assessmentType || !VALID_TYPES.includes(assessmentType))
    return NextResponse.json({ error: "Tipo de avaliação inválido" }, { status: 400 })
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "Arquivo excede 10MB" }, { status: 400 })
  if (!ALLOWED_MIME_TYPES.includes(file.type))
    return NextResponse.json({ error: "Formato de arquivo não suportado" }, { status: 400 })

  try {
    // Convert file to base64
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const mimeType = file.type

    // Use GPT-4o vision to extract scores
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: EXTRACTION_PROMPTS[assessmentType],
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0,
    })

    const rawContent = response.choices[0]?.message?.content ?? ""

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Não foi possível extrair os dados do documento" }, { status: 422 })
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: "Não foi possível extrair os dados do documento" }, { status: 422 })
    }

    // Validate the AI output against the schema for this assessment type
    const validation = RESULT_SCHEMAS[assessmentType].safeParse(parsedJson)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Os dados extraídos do documento são inválidos ou incompletos" },
        { status: 422 },
      )
    }
    const result = validation.data

    // Save to profile
    const service = createServiceClient()
    await service.rpc("jsonb_profile_merge", {
      p_user_id: user.id,
      p_set_key: assessmentType,
      p_set_value: JSON.stringify(result),
      p_remove_key: `${assessmentType}_progress`,
    })

    // Save to assessment_history
    await service.from("assessment_history").insert({
      user_id: user.id,
      tenant_id: profile.tenant_id,
      assessment_type: assessmentType,
      result: result as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    console.error("[assessment-upload]", message)

    if (message.includes("apiKey")) {
      return NextResponse.json({ error: "Chave OpenAI não configurada. Configure OPENAI_API_KEY." }, { status: 500 })
    }

    return NextResponse.json({ error: `Erro ao processar: ${message}` }, { status: 500 })
  }
}
