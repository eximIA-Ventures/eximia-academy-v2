import { resolveInitialTab } from "@/components/admin/settings-tabs-wrapper"
import { describe, expect, it } from "vitest"

// =============================================================================
// `resolveInitialTab` é a decisão PURA da tela de Configurações do tenant: qual
// aba o querystring `?tab=` pede. O componente agora RE-SINCRONIZA o estado
// quando essa decisão muda entre renders (antes o valor só alimentava o
// inicializador do useState, então navegar de `/admin/settings` para
// `/admin/settings?tab=auth` — que não remonta o client component — era no-op).
// =============================================================================

describe("resolveInitialTab — qual aba o ?tab= pede", () => {
  it("'auth' abre a aba Autenticação/SSO", () => {
    expect(resolveInitialTab("auth", false)).toBe("auth")
    expect(resolveInitialTab("auth", true)).toBe("auth")
  })

  it("'whitelabel' só vale quando o whitelabel está habilitado", () => {
    expect(resolveInitialTab("whitelabel", true)).toBe("whitelabel")
    // Sem o módulo, a aba nem existe: cai no default em vez de abrir um vazio.
    expect(resolveInitialTab("whitelabel", false)).toBe("general")
  })

  it("ausente ou inválido cai em 'general' (retrocompatível por construção)", () => {
    expect(resolveInitialTab(undefined, true)).toBe("general")
    expect(resolveInitialTab("", true)).toBe("general")
    expect(resolveInitialTab("general", true)).toBe("general")
    expect(resolveInitialTab("nao-existe", true)).toBe("general")
    expect(resolveInitialTab("AUTH", true)).toBe("general")
  })
})
