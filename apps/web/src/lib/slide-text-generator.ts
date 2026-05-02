import OpenAI from "openai"
import { createServiceClient } from "@/lib/supabase/service"

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const BATCH_SIZE = 3
const SYSTEM_PROMPT = `Você é um professor universitário brasileiro especialista em criar conteúdo pedagógico.
Ao receber a imagem de um slide de apresentação, gere um texto explicativo em pt-BR que:
1. Explique os conceitos apresentados no slide de forma clara e didática
2. Adicione contexto e exemplos quando relevante
3. Mantenha o tom profissional mas acessível
4. Use formatação Markdown (negrito, listas, etc.) quando apropriado
5. NÃO descreva visualmente o slide — foque no CONTEÚDO pedagógico
6. Limite-se a 300-500 palavras por slide`

interface SlideRow {
  id: string
  image_url: string
  metadata: Record<string, unknown>
  order: number
}

/**
 * Generate text for a single slide using GPT-4o vision.
 */
async function generateTextForSlide(slide: SlideRow): Promise<string> {
  const isPdf = slide.metadata?.type === "pdf"

  // For PDF slides, we can't send the image directly — send a description request
  if (isPdf) {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: slide.image_url,
                detail: "high",
              },
            },
            {
              type: "text",
              text: `Analise este slide (slide ${slide.order + 1}) e gere o texto pedagógico explicativo.`,
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    })
    return response.choices[0]?.message?.content ?? ""
  }

  // For image-based slides
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: slide.image_url,
              detail: "high",
            },
          },
          {
            type: "text",
            text: `Analise este slide (slide ${slide.order + 1}) e gere o texto pedagógico explicativo.`,
          },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
  })

  return response.choices[0]?.message?.content ?? ""
}

/**
 * Process slides in batches, generating text for each and updating the DB.
 */
export async function generateTextsForChapterSlides(chapterId: string): Promise<{
  processed: number
  errors: number
}> {
  const service = createServiceClient()

  // Fetch all slides for this chapter that need text
  const { data: slides, error } = await service
    .from("chapter_slides")
    .select("id, image_url, metadata, order")
    .eq("chapter_id", chapterId)
    .in("text_status", ["pending", "generating"])
    .order("order", { ascending: true })

  if (error || !slides) return { processed: 0, errors: 1 }

  // Mark all as generating
  await service
    .from("chapter_slides")
    .update({ text_status: "generating" })
    .eq("chapter_id", chapterId)
    .in("text_status", ["pending"])

  let processed = 0
  let errors = 0

  // Process in batches
  for (let i = 0; i < slides.length; i += BATCH_SIZE) {
    const batch = slides.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map((slide) => generateTextForSlide(slide as SlideRow)),
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const slide = batch[j]

      if (result.status === "fulfilled" && result.value) {
        await service
          .from("chapter_slides")
          .update({
            text_content: result.value,
            text_status: "review",
          })
          .eq("id", slide.id)
        processed++
      } else {
        await service
          .from("chapter_slides")
          .update({ text_status: "pending" })
          .eq("id", slide.id)
        errors++
      }
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < slides.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return { processed, errors }
}
