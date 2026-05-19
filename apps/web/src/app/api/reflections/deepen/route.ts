import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  slideId: z.string().uuid(),
  question: z.string().min(1),
  studentResponse: z.string().min(1),
  slideContext: z.string().min(1),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return new Response("Invalid request", { status: 400 })

  const { question, studentResponse, slideContext } = parsed.data

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return Response.json({ error: "AI não configurada" }, { status: 500 })

  const systemPrompt = `Você é um tutor socrático da plataforma exímIA Academy. Seu papel é aprofundar a reflexão do aluno sobre o conteúdo estudado.

CONTEXTO DO SLIDE (notas do apresentador):
${slideContext}

PERGUNTA DE REFLEXÃO ORIGINAL:
${question}

REGRAS:
- Seja provocativo mas respeitoso — desafie o aluno a pensar mais fundo
- Faça 1-2 perguntas follow-up que conectem a resposta do aluno ao conteúdo real
- Se o aluno deu uma resposta superficial, aponte gentilmente o que ficou de fora
- Se o aluno deu uma boa resposta, amplie conectando com outros conceitos do slide
- Máximo 150 palavras
- Use linguagem acessível, não acadêmica
- Termine SEMPRE com uma pergunta provocativa
- NÃO repita o que o aluno escreveu`

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: studentResponse },
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return Response.json({ error: "Erro na IA" }, { status: 502 })
    }

    const data = await res.json()
    const aiResponse = data.choices?.[0]?.message?.content ?? ""

    return Response.json({ response: aiResponse })
  } catch {
    return Response.json({ error: "Falha ao conectar com IA" }, { status: 500 })
  }
}
