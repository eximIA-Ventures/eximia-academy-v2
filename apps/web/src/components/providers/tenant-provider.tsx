"use client"

import type { TenantConfig } from "@eximia/shared"
import { createContext, useContext } from "react"

// ===========================================================================
// A EMPRESA DESTA REQUISIÇÃO, DO LADO DO CLIENTE.
//
// Este provider existia e NUNCA era montado — carregava um `TenantData` no
// formato cru das colunas antigas (`branding`, `whitelabel_config`), que já
// não é o formato que o app usa. Agora ele carrega exatamente o que
// `getTenantConfig()` resolveu no servidor, mais a identidade resolvida por
// host, e é montado nos shells.
//
// POR QUE ELE PRECISA EXISTIR AGORA. Enquanto a marca era env de BUILD, um
// componente `"use client"` podia simplesmente importar `tenant.config.ts`: o
// Next inlinava os valores no bundle. A marca virou dado de requisição, e dado
// de requisição não existe no bundle — tem que DESCER do Server Component. É
// esse o caminho, e é por isso que `workspace-picker.tsx` passou a receber
// `brand` por prop em vez de importar `@/lib/tenant`.
//
// ISTO NÃO É PERMISSÃO. `modules` diz o que a empresa contratou (exposição de
// UI); quem pode ler o quê é a RLS, com o JWT da pessoa. Ver `AGENTS.md`.
// ===========================================================================

export interface TenantClientContext {
  /** A config já resolvida (banco -> env -> NEUTRO). */
  config: TenantConfig
  /** `null` quando o host é neutro — nunca o id de um tenant "parecido". */
  tenantId: string | null
  /** `__neutro__` quando neutro (D5). */
  slug: string
  isNeutro: boolean
}

const TenantContext = createContext<TenantClientContext | null>(null)

export function TenantProvider({
  value,
  children,
}: {
  value: TenantClientContext
  children: React.ReactNode
}) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

/** Lança fora do provider: marca ausente é bug de montagem, não estado válido. */
export function useTenant(): TenantClientContext {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error("useTenant precisa estar dentro de <TenantProvider>")
  return ctx
}

/** Para componentes que também rodam fora de um shell (previews, storybook). */
export function useTenantOpcional(): TenantClientContext | null {
  return useContext(TenantContext)
}
