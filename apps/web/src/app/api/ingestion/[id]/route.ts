import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: ingestionId } = await context.params

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

    const serviceClient = createServiceClient()

    // Fetch ingestion
    const { data: ingestion } = await serviceClient
      .from("content_ingestions")
      .select("id, status, source_url, tenant_id")
      .eq("id", ingestionId)
      .eq("tenant_id", profile.tenant_id)
      .single()

    if (!ingestion) {
      return NextResponse.json({ error: "Ingestao não encontrada." }, { status: 404 })
    }

    if (ingestion.status === "approved") {
      return NextResponse.json(
        { error: "Nao e possivel deletar uma ingestao já aprovada." },
        { status: 400 },
      )
    }

    // Delete file from storage if exists
    if (ingestion.source_url?.includes("/chapter-assets/")) {
      const pathMatch = ingestion.source_url.split("/chapter-assets/")[1]
      if (pathMatch) {
        await serviceClient.storage.from("chapter-assets").remove([decodeURIComponent(pathMatch)])
      }
    }

    // Delete record
    await serviceClient.from("content_ingestions").delete().eq("id", ingestionId)

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("Ingestion delete error:", err)
    return NextResponse.json({ error: "Erro interno ao deletar." }, { status: 500 })
  }
}
