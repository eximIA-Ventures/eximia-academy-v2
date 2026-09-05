import { CONTRACTABLE_MODULE_IDS, RESERVED_SLUGS, createTenantSchema } from "@eximia/shared"
import { describe, expect, it } from "vitest"

// ===========================================================================
// `createTenantSchema` — o contrato do corpo do cadastro.
//
// Ele vive em `packages/shared` porque a tela e a rota precisam concordar sobre
// o que é uma empresa válida; o teste vive aqui, junto da rota que o consome,
// porque é aqui que a divergência dói.
// ===========================================================================

function corpo(sobrescreve: Record<string, unknown> = {}) {
  return {
    name: "Cory Alimentos",
    slug: "cory-alimentos",
    plan: "standard",
    brand: { primaryColor: "#2a6ab0", accentColor: "#C4A882" },
    admin: { email: "maria@cory.com.br", fullName: "Maria Silva" },
    ...sobrescreve,
  }
}

describe("createTenantSchema — módulos", () => {
  it("soma os 3 core aos módulos contratados, na ordem canônica", () => {
    const parsed = createTenantSchema.parse(corpo({ modules: ["units", "biblioteca"] }))

    expect(parsed.modules).toEqual(["academy", "biblioteca", "analytics", "admin", "units"])
  })

  it("inclui os core mesmo quando nenhum módulo é contratado", () => {
    const parsed = createTenantSchema.parse(corpo())

    expect(parsed.modules).toEqual(["academy", "analytics", "admin"])
  })

  it("não repete um core que veio explicitamente no corpo", () => {
    const parsed = createTenantSchema.parse(corpo({ modules: ["admin", "admin", "community"] }))

    expect(parsed.modules).toEqual(["academy", "analytics", "admin", "community"])
  })

  it("recusa um módulo que não existe no registro", () => {
    const resultado = createTenantSchema.safeParse(corpo({ modules: ["modulo-inventado"] }))

    expect(resultado.success).toBe(false)
  })

  it("expõe exatamente os 6 módulos contratáveis (os 3 core ficam de fora)", () => {
    expect(CONTRACTABLE_MODULE_IDS).toHaveLength(6)
    expect(CONTRACTABLE_MODULE_IDS).not.toContain("academy")
    expect(CONTRACTABLE_MODULE_IDS).not.toContain("analytics")
    expect(CONTRACTABLE_MODULE_IDS).not.toContain("admin")
  })
})

describe("createTenantSchema — slug", () => {
  it.each(RESERVED_SLUGS)("recusa o slug reservado %s", (reservado) => {
    const resultado = createTenantSchema.safeParse(corpo({ slug: reservado }))

    expect(resultado.success).toBe(false)
  })

  it("aceita um slug comum", () => {
    expect(createTenantSchema.safeParse(corpo({ slug: "harven-finance" })).success).toBe(true)
  })
})

describe("createTenantSchema — domínio próprio e primeiro admin", () => {
  it("recusa domínio com esquema ou porta", () => {
    expect(createTenantSchema.safeParse(corpo({ customHost: "https://a.com.br" })).success).toBe(
      false,
    )
    expect(createTenantSchema.safeParse(corpo({ customHost: "a.com.br:3000" })).success).toBe(false)
  })

  it("recusa domínio sem ponto (um rótulo solto não é endereço)", () => {
    expect(createTenantSchema.safeParse(corpo({ customHost: "academy" })).success).toBe(false)
  })

  it("aceita um domínio próprio válido", () => {
    const parsed = createTenantSchema.parse(corpo({ customHost: "argos.eximiaacademy.com.br" }))

    expect(parsed.customHost).toBe("argos.eximiaacademy.com.br")
  })

  it("assume o plano standard quando ele não vem no corpo (D6)", () => {
    const { plan: _semPlano, ...semPlano } = corpo()

    expect(createTenantSchema.parse(semPlano).plan).toBe("standard")
  })

  it("traduz o corpo legado com initial_manager para admin", () => {
    const { admin: _trocado, ...semAdmin } = corpo()

    const parsed = createTenantSchema.parse({
      ...semAdmin,
      initial_manager: { email: "maria@cory.com.br", full_name: "Maria Silva", role: "admin" },
    })

    expect(parsed.admin).toEqual({ email: "maria@cory.com.br", fullName: "Maria Silva" })
  })

  it("recusa cor de marca que não é hexadecimal", () => {
    const resultado = createTenantSchema.safeParse(
      corpo({ brand: { primaryColor: "azul", accentColor: "#C4A882" } }),
    )

    expect(resultado.success).toBe(false)
  })
})
