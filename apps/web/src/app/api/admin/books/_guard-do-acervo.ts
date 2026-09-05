import { requireRole } from "@/lib/api-role-guard"
import type { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// requireManager — porta única da administração do acervo (`api/admin/books/**`)
// ---------------------------------------------------------------------------
// Era a MESMA função copiada byte a byte em oito arquivos de rota, e as oito
// carregavam o mesmo defeito: liam o perfil sem destructurar `error` e devolviam
// `{ user, profile: null }`, que quem chama traduzia em 403 "Forbidden". Num
// timeout de statement o administrador legítimo lia "sem permissão" — a falha se
// apresentando como veredito.
//
// Oito cópias do mesmo julgamento foi COMO o defeito se espalhou; esta é a única
// cópia que resta. A decisão em si (403 quando a leitura funcionou e a resposta é
// não, 503 + `Retry-After` quando a leitura falhou) mora em `lib/api-role-guard`,
// que é de toda a casa. Este arquivo só amarra a lista de papéis do acervo e o
// 401 de sessão ausente, que são desta família.
// ---------------------------------------------------------------------------

/**
 * Papéis aceitos pela administração do acervo. Inalterada em relação às oito
 * cópias: `manager` continua de fora, `instructor` também.
 */
export const PAPEIS_DO_ACERVO = ["admin", "super_admin"] as const

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>

/**
 * Exatamente um dos dois lados vem preenchido. Quem chama faz
 * `if (recusa) return recusa` e segue com `user` e `profile` já estreitados.
 */
export type ContextoDoAcervo =
  | { user: { id: string }; profile: { role: string; tenant_id: string }; recusa: null }
  | { user: null; profile: null; recusa: NextResponse }

export async function requireManager(supabase: ClienteSupabase): Promise<ContextoDoAcervo> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      profile: null,
      recusa: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const { profile, recusa } = await requireRole(supabase, user.id, PAPEIS_DO_ACERVO)
  if (recusa) return { user: null, profile: null, recusa }

  return { user, profile, recusa: null }
}
