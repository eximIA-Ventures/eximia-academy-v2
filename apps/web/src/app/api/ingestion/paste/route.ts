import { ingestionLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

const pasteSchema = z.object({
  text: z
    .string()
    .min(200, "Conteúdo muito curto. Minimo de 200 caracteres.")
    .max(200000, "Conteúdo muito longo. Maximo de 200.000 caracteres."),
  title: z.string().max(200).optional(),
  course_id: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  try {
    // Auth guard
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Role guard
    const { data: profile } = await supabase
      .from("users")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
    }

    // Rate limiting
    if (ingestionLimiter) {
      const { success } = await ingestionLimiter.limit(user.id)
      if (!success) {
        return NextResponse.json(
          { error: "Muitas solicitacoes. Aguarde alguns minutos." },
          { status: 429 },
        )
      }
    }

    // Parse and validate body
    const body = await request.json()
    const parsed = pasteSchema.safeParse(body)

    if (!parsed.success) {
      const message = parsed.error.errors[0].message
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { text, title, course_id } = parsed.data
    const serviceClient = createServiceClient()
    const tenantId = profile.tenant_id

    // Create ingestion record with status='processing' (no extraction needed)
    const { data: ingestion, error: insertError } = await serviceClient
      .from("content_ingestions")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        source_type: "paste",
        raw_text: text,
        source_size_bytes: Buffer.byteLength(text, "utf-8"),
        status: "processing",
        ...(course_id ? { course_id } : {}),
        processing_metadata: {
          title: title || "Texto colado",
          extracted_chars: text.length,
          extracted_at: new Date().toISOString(),
          ...(course_id ? { course_id } : {}),
        },
      })
      .select("id")
      .single()

    if (insertError || !ingestion) {
      console.error("Error creating paste ingestion:", insertError)
      return NextResponse.json({ error: "Erro ao registrar conteúdo." }, { status: 500 })
    }

    return NextResponse.json({
      ingestionId: ingestion.id,
      status: "processing",
      extractedChars: text.length,
    })
  } catch (err) {
    console.error("Ingestion paste error:", err)
    return NextResponse.json({ error: "Erro interno ao processar texto." }, { status: 500 })
  }
}
