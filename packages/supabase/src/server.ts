import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { requiredEnv } from "./env"
import type { Database } from "./types"

export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(
    requiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: object }>) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // O método `setAll` é chamado de Server Components
            // Pode ser ignorado se você tem middleware atualizando a sessão
          }
        },
      },
    },
  )
}

export async function createServiceRoleClient() {
  return createSupabaseServerClient<Database>(
    requiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  )
}
