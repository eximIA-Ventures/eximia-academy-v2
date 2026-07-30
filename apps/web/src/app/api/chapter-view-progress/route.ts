import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

/**
 * Percorrido x Elaborado — escrita da marca d'água de exposição por módulo.
 *
 * Contrato: docs/architecture/medicao-percorrido-vs-elaborado.md §3.3 e §6.
 *
 * Invariantes de segurança deste handler:
 *  - `tenant_id` é resolvido NO SERVIDOR a partir da sessão. O payload do
 *    cliente NUNCA o informa — aceitá-lo permitiria semear linhas em outra
 *    empresa.
 *  - O capítulo é validado contra o tenant da sessão pelo mesmo motivo.
 *  - NENHUM service client. É escrita do próprio aluno sobre o próprio dado;
 *    a RLS precisa valer integralmente (este repo já teve vazamento
 *    cross-tenant por escrita privilegiada sem escopo).
 *
 * Monotonicidade NÃO é responsabilidade daqui: o trigger
 * `chapter_view_progress_invariants` faz o clamp no banco, o que mantém a
 * invariante válida mesmo para requisições fora de ordem (normal, já que o
 * cliente coalesce e usa sendBeacon).
 */
const bodySchema = z.object({
  chapterId: z.string().uuid(),
  maxSlideIndex: z.number().int().min(0),
  slidesTotal: z.number().int().positive(),
  reachedLastSlide: z.boolean(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // sendBeacon envia um Blob; json() cobre os dois caminhos (fetch e beacon).
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return new Response("Invalid body", { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return new Response("Invalid request", { status: 400 })

  const { chapterId, maxSlideIndex, slidesTotal, reachedLastSlide } = parsed.data

  // Tenant da SESSÃO, nunca do payload.
  const { data: profileRows } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .limit(1)

  const tenantId = (profileRows?.[0]?.tenant_id as string | null) ?? null
  if (!tenantId) return new Response("No tenant", { status: 403 })

  // O capítulo tem de pertencer ao mesmo tenant. Sem isto, um aluno poderia
  // gravar progresso apontando para o conteúdo de outra empresa.
  const { data: chapterRows } = await supabase
    .from("chapters")
    .select("id")
    .eq("id", chapterId)
    .eq("tenant_id", tenantId)
    .limit(1)

  if (!chapterRows || chapterRows.length === 0) {
    return new Response("Forbidden", { status: 403 })
  }

  const now = new Date().toISOString()

  const { error } = await supabase.from("chapter_view_progress").upsert(
    {
      student_id: user.id,
      chapter_id: chapterId,
      tenant_id: tenantId,
      max_slide_index: maxSlideIndex,
      slides_total_at_last_view: slidesTotal,
      last_viewed_at: now,
      // Só carimba ao alcançar o fim. O trigger impede que uma escrita
      // posterior sem o campo apague o carimbo já existente.
      ...(reachedLastSlide ? { reached_last_slide_at: now } : {}),
    },
    { onConflict: "student_id,chapter_id" },
  )

  if (error) return new Response("Write failed", { status: 500 })

  return new Response(null, { status: 204 })
}
