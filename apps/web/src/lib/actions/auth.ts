"use server"

import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return tenantRedirect("/login")
}
