import type { ProfileCheckUnavailableBody } from "@/lib/api-role-guard"
import type { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// =============================================================================
// TERCEIRO ESTADO: "não deu para verificar" (auditoria, rodada FIX-B6)
// =============================================================================
// Terceira cópia do mesmo defeito, no helper de super admin. O `error` do
// `.single()` era descartado, e a única rota que depende deste guard
// (`api/admin/switch-tenant`) traduzia `profile: null` em 403 — inclusive quando
// a leitura tinha FALHADO.
//
// O contrato é o de `lib/api-role-guard.ts`, mesmo corpo e mesmo header do 503
// (tipo importado de lá, não recopiado).
//
// UMA ASSIMETRIA DELIBERADA, e o motivo dela: em `switch-tenant` o desfecho SEM
// SESSÃO é 403 "Permissão negada", não 401. Isso é um segundo defeito (deveria
// ser 401), e ele fica PRESERVADO aqui de propósito — corrigir contrato de
// resposta de carona num fix de tratamento de erro esconderia a mudança dentro
// da correção. Está registrado no relatório e travado por teste, não corrigido.
// Mesma decisão que `api/integrations/keys` tomou na frente irmã.
// =============================================================================

/** Mesma constante de `lib/api-role-guard.ts`: zero linhas NÃO é indisponibilidade. */
const ZERO_LINHAS = "PGRST116"

type ClienteServidor = Awaited<ReturnType<typeof createClient>>
type UsuarioAutenticado = NonNullable<
  Awaited<ReturnType<ClienteServidor["auth"]["getUser"]>>["data"]["user"]
>

interface PerfilDeSuperAdmin {
  id: string
  role: string
}

/**
 * Exatamente um dos dois lados vem preenchido. O chamador faz
 * `if (recusa) return recusa` e segue com `profile` já estreitado.
 */
export type ResultadoDoGuardDeSuperAdmin =
  | { user: UsuarioAutenticado; profile: PerfilDeSuperAdmin; recusa: null }
  | { user: UsuarioAutenticado | null; profile: null; recusa: NextResponse }

/** 403 para sem-sessão E para papel insuficiente — o colapso preservado (ver topo). */
const recusaDePermissao = () => NextResponse.json({ error: "Permissão negada" }, { status: 403 })

/**
 * Shared super_admin auth check for API routes.
 * Returns user + profile if authenticated and super_admin, `recusa` otherwise.
 */
export async function requireSuperAdmin(
  supabase: ClienteServidor,
): Promise<ResultadoDoGuardDeSuperAdmin> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, recusa: recusaDePermissao() }

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single()

  // Uma leitura que não aconteceu não autoriza ninguém a dizer "permissão negada".
  if (error && error.code !== ZERO_LINHAS) {
    console.error(`[super-admin-auth] leitura de perfil indisponivel para ${user.id}:`, error)
    const body: ProfileCheckUnavailableBody = { error: "profile_check_unavailable" }
    return {
      user,
      profile: null,
      recusa: NextResponse.json(body, { status: 503, headers: { "Retry-After": "5" } }),
    }
  }

  if (!profile || profile.role !== "super_admin") {
    return { user, profile: null, recusa: recusaDePermissao() }
  }

  return { user, profile, recusa: null }
}
