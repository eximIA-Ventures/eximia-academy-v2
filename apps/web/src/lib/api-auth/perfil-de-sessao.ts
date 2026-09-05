import type { ProfileCheckUnavailableBody } from "@/lib/api-role-guard"
import { NextResponse } from "next/server"

// =============================================================================
// O MESMO JULGAMENTO, PARA QUEM LÊ O PERFIL POR `getAuthProfile` (FIX-B6)
// =============================================================================
// Terceira variante do mesmo defeito, e a mais escorregadia das três, porque aqui
// o `error` NÃO some na leitura: `getAuthProfile` (`lib/auth.ts`) devolve
// `{ user, profile, roles, error, supabase }` corretamente. Quem descarta são os
// CHAMADORES — 95 arquivos que fazem `const { user, profile } = await
// getAuthProfile()` e nunca destructuram `error`.
//
// Nas rotas de API a consequência é literal: uma leitura de perfil que falhou
// deixa `profile` nulo, o `if (!profile)` da rota dispara e o gestor legítimo lê
// 401/403 por causa de um soluço do banco.
//
// Este módulo NÃO reimplementa o julgamento: ele o aplica. O corpo e o header do
// 503 vêm do MESMO tipo de `lib/api-role-guard.ts` (importado, não recopiado), e
// `PGRST116` continua sendo 403/401, porque zero linhas não é indisponibilidade.
//
// Por que uma função e não um wrapper de `getAuthProfile`: as 22 rotas consomem
// campos diferentes (`roles`, `supabase`, `hasSubordinates`) e algumas chamam o
// helper duas vezes no mesmo arquivo. Um wrapper teria que reproduzir a forma de
// retorno inteira; esta função se encaixa em duas linhas em qualquer uma delas,
// SEM tocar no `getAuthProfile` que 129 arquivos compartilham.
// =============================================================================

/** Mesma constante de `lib/api-role-guard.ts`: zero linhas NÃO é indisponibilidade. */
const ZERO_LINHAS = "PGRST116"

/** A forma mínima do erro que `getAuthProfile` propaga do PostgREST. */
export interface ErroDeLeituraDePerfil {
  code?: string | null
  message?: string
}

/**
 * Devolve o 503 quando a leitura do perfil FALHOU, e `null` quando não há nada a
 * recusar por este motivo — inclusive no caso de zero linhas, que segue para o
 * 401/403 que a rota já tinha.
 *
 * Uso, imediatamente após o `getAuthProfile()`:
 *
 * ```ts
 * const { user, profile, error: erroDePerfil } = await getAuthProfile()
 * const indisponivel = recusaSePerfilIlegivel(erroDePerfil, "GET /api/…")
 * if (indisponivel) return indisponivel
 * ```
 *
 * @param contexto identificador legível para o log (rota ou handler).
 */
export function recusaSePerfilIlegivel(
  erro: ErroDeLeituraDePerfil | null | undefined,
  contexto: string,
): NextResponse | null {
  if (!erro || erro.code === ZERO_LINHAS) return null

  console.error(`[perfil-de-sessao] leitura de perfil indisponivel em ${contexto}:`, erro)

  const body: ProfileCheckUnavailableBody = { error: "profile_check_unavailable" }
  // `Retry-After` porque isto passa. O 401/403 irmão não tem header nenhum, e essa
  // assimetria é o sinal de que os casos são diferentes.
  return NextResponse.json(body, { status: 503, headers: { "Retry-After": "5" } })
}
