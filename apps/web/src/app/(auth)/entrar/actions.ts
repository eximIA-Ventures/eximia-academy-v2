"use server"

import { createClient } from "@/lib/supabase/server"

export async function signIn(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Mensagem amigável — não expor detalhes internos
    return { error: "E-mail ou senha incorretos. Tente novamente." }
  }

  return {}
}
