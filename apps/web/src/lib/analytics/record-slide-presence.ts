import { createClient } from "@/lib/supabase/server"

/**
 * Percorrido x Progressão — registra PRESENÇA num slide a partir de uma
 * interação do aluno.
 *
 * Contrato: `docs/architecture/percorrido-progressao-conclusao.md` §2.1.
 *
 * A tese: **todo ponto de interação vive num slide, então interagir com ele
 * PROVA presença naquele slide.** Alimentar a marca d'água por aqui é o que
 * torna a invariante `progressão ≤ percorrido` IMPOSSÍVEL de violar, em vez de
 * uma regra que alguém precisa lembrar de respeitar. Não existe caminho que
 * registre interação sem registrar presença.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ REGRA MAIS IMPORTANTE DESTE MÓDULO: telemetria é SUBORDINADA.            │
 * │ Se qualquer coisa aqui falhar, a interação do aluno (a reflexão dele)    │
 * │ tem de ser salva mesmo assim. Por isso NADA lança: toda saída é `void`   │
 * │ e todo erro morre aqui dentro.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Segurança: o `tenant_id` é resolvido do BANCO a partir da sessão, nunca
 * aceito de parâmetro, e o tenant do slide precisa bater com o do usuário.
 * Usa o client com RLS, NUNCA service client — é escrita do próprio aluno
 * sobre o próprio dado.
 *
 * Monotonicidade não é reimplementada: o trigger
 * `chapter_view_progress_invariants` faz o clamp no banco. Ainda assim, o
 * upsert manda apenas o que sabe, e nunca um valor menor deliberado.
 */
export async function recordSlidePresence(slideId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Tenant da SESSÃO, do banco. Nunca de parâmetro.
    const { data: profileRows } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .limit(1)

    const tenantId = (profileRows?.[0]?.tenant_id as string | null) ?? null
    if (!tenantId) return

    // Qual capítulo e qual a ordem deste slide.
    const { data: slideRows } = await supabase
      .from("chapter_slides")
      .select("chapter_id, order, tenant_id")
      .eq("id", slideId)
      .limit(1)

    const slide = slideRows?.[0] as
      | { chapter_id: string; order: number; tenant_id: string | null }
      | undefined

    // Slide inexistente ou de OUTRA empresa: não escreve nada.
    if (!slide || slide.tenant_id !== tenantId) return

    // Denominador e último slide do capítulo, para saber se este é o fim.
    const { data: siblingRows } = await supabase
      .from("chapter_slides")
      .select("order")
      .eq("chapter_id", slide.chapter_id)

    const orders = (siblingRows ?? []).map((s) => (s as { order: number }).order)
    if (orders.length === 0) return

    const slidesTotal = orders.length
    const maxOrder = Math.max(...orders)
    const isLast = slide.order >= maxOrder

    const now = new Date().toISOString()

    await supabase.from("chapter_view_progress").upsert(
      {
        student_id: user.id,
        chapter_id: slide.chapter_id,
        tenant_id: tenantId,
        max_slide_index: slide.order,
        slides_total_at_last_view: slidesTotal,
        last_viewed_at: now,
        // A chave vai SEMPRE presente (null quando não é o fim): o PostgREST
        // recusa lote com conjuntos de chaves diferentes, e o trigger I2 faz
        // COALESCE(OLD, NEW), então null jamais apaga um carimbo existente.
        reached_last_slide_at: isLast ? now : null,
      },
      { onConflict: "student_id,chapter_id" },
    )
  } catch {
    // Silencioso por contrato. A interação do aluno nunca falha por causa disto.
  }
}

/**
 * Variante para o encerramento de INTERAÇÃO SOCRÁTICA.
 *
 * A socrática só é oferecida no ÚLTIMO slide do capítulo
 * (`presentation-viewer.tsx`: `currentIndex === slides.length - 1 &&
 * interaction?.type === "socratic"`). Concluí-la é, portanto, prova de ter
 * alcançado o fim — e por isso aqui carimba `reached_last_slide_at`.
 *
 * OBSERVAÇÃO HONESTA sobre o deep link: existe `?focus=interaction`, que abre o
 * capítulo direto no último slide. Um aluno que use esse atalho e faça a
 * socrática ganha o carimbo sem ter passado pelos slides do meio. Isso NÃO é
 * introduzido aqui: nesse fluxo a navegação já alcança o último slide e o
 * tracker de navegação já carimbaria igual. Registrado para não parecer
 * descuido — se um dia se quiser fechar esse flanco, o lugar é o deep link,
 * não este registro.
 *
 * Mesmas garantias de `recordSlidePresence`: nunca lança, resolve tenant do
 * banco, exige que o capítulo seja do mesmo tenant, e usa o client com RLS.
 */
export async function recordChapterEndPresence(chapterId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileRows } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .limit(1)

    const tenantId = (profileRows?.[0]?.tenant_id as string | null) ?? null
    if (!tenantId) return

    const { data: chapterRows } = await supabase
      .from("chapters")
      .select("id")
      .eq("id", chapterId)
      .eq("tenant_id", tenantId)
      .limit(1)

    if (!chapterRows || chapterRows.length === 0) return

    const { data: slideRows } = await supabase
      .from("chapter_slides")
      .select("order")
      .eq("chapter_id", chapterId)

    const orders = (slideRows ?? []).map((s) => (s as { order: number }).order)
    // Capítulo sem slides: não há percurso a registrar.
    if (orders.length === 0) return

    const now = new Date().toISOString()

    await supabase.from("chapter_view_progress").upsert(
      {
        student_id: user.id,
        chapter_id: chapterId,
        tenant_id: tenantId,
        max_slide_index: Math.max(...orders),
        slides_total_at_last_view: orders.length,
        last_viewed_at: now,
        reached_last_slide_at: now,
      },
      { onConflict: "student_id,chapter_id" },
    )
  } catch {
    // Silencioso por contrato.
  }
}
