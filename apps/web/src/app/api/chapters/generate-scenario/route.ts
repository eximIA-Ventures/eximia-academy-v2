import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import OpenAI from "openai"

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `Você é um designer instrucional especialista em criar cenários de aprendizagem baseados em problemas reais.

Ao receber uma descrição do problema/situação, gere um cenário completo no formato JSON:

{
  "title": "Título descritivo do cenário",
  "company": "Nome da empresa fictícia ou real",
  "context": "Contexto da situação (2-3 parágrafos)",
  "problem": "Declaração clara do problema com dados quantitativos",
  "data": ["Dado 1 relevante", "Dado 2", "Dado 3", "Dado 4", "Dado 5"],
  "steps": [
    {"id": "s1", "title": "Identificar o Problema", "icon": "search", "prompt": "Instrução para o aluno...", "hint": "Dica para guiar..."},
    {"id": "s2", "title": "Análise de Causas", "icon": "target", "prompt": "...", "hint": "..."},
    {"id": "s3", "title": "Propor Soluções", "icon": "lightbulb", "prompt": "...", "hint": "..."},
    {"id": "s4", "title": "Plano de Ação", "icon": "clipboard", "prompt": "...", "hint": "..."}
  ]
}

Regras:
- O cenário deve ser realista e imersivo
- Inclua dados quantitativos específicos (%, valores, tempos)
- As etapas devem seguir uma metodologia de resolução de problemas (AeSP, PDCA, A3)
- Os prompts devem ser claros e desafiadores
- Os hints devem guiar sem dar a resposta
- Escreva em português do Brasil
- Retorne APENAS o JSON, sem markdown`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "manager", "instructor"].includes(profile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const prompt = body.prompt as string | undefined

  if (!prompt?.trim())
    return NextResponse.json({ error: "Descrição do cenário é obrigatória" }, { status: 400 })

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    })

    const rawContent = response.choices[0]?.message?.content ?? ""
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)

    if (!jsonMatch)
      return NextResponse.json({ error: "Falha ao gerar cenário" }, { status: 422 })

    const scenario = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, scenario })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    if (msg.includes("apiKey"))
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
