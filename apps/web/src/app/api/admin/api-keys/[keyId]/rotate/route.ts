import { generateApiKey, hashApiKey, requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/* ---------------------------------- POST ---------------------------------- */

export async function POST(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { keyId } = await params
  const serviceClient = createServiceClient()

  // Verify ownership
  const { data: existing } = await serviceClient
    .from("api_keys")
    .select("id")
    .eq("id", keyId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (!existing) return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 })

  // Generate new key
  const { rawKey, prefix } = generateApiKey()
  const keyHash = await hashApiKey(rawKey)

  const { data, error } = await serviceClient
    .from("api_keys")
    .update({
      key_prefix: prefix,
      key_hash: keyHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", keyId)
    .eq("tenant_id", profile.tenant_id)
    .select("id, name, key_prefix, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { ...data, raw_key: rawKey } })
}
