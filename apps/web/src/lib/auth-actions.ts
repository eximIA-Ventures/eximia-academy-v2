"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Clear the cached role cookie so a stale role never lingers after logout.
  const cookieStore = await cookies()
  cookieStore.delete("x-user-role")
  redirect("/login")
}
