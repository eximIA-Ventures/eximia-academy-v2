import { type SupabaseClient, createClient as createSupabaseClient } from "@supabase/supabase-js"

// biome-ignore lint: singleton pattern for service client
let serviceClient: SupabaseClient<any, "public", any> | null = null

export function createServiceClient() {
  if (serviceClient) return serviceClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase service credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
  }

  serviceClient = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return serviceClient
}
