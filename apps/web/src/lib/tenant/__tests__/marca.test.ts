import type { TenantConfig } from "@eximia/shared"
import { describe, expect, it } from "vitest"
import { COLUNAS_DE_MARCA, type LinhaDeTenant, montarConfigDoTenant } from "../marca"

// ===========================================================================
// BANCO -> ENV -> NEUTRO, CAMPO A CAMPO (D4).
//
// A propriedade que discrimina de verdade não é "o banco vence" — é "o banco
// vence NO CAMPO QUE ELE PREENCHE, e só nele". `tenants.brand` pode ser
// parcial por contrato (a RPC garante só `name` e `slug`), então uma mescla
// por OBJETO — `{...base, ...banco}` no nível do `brand` — apagaria o logo de
// quem foi cadastrado sem logo. É esse o caso do meio de cada bloco abaixo.
//
// E `customCSS` é a ausência DELIBERADA: ele desemboca em
// `dangerouslySetInnerHTML` e é gravável por qualquer chapéu `admin` de
// cliente. Nenhum caminho daqui pode produzi-lo.
// ===========================================================================

/** A "base": o que `configDoAmbiente()` devolveria (env sobre NEUTRO). */
const BASE: TenantConfig = {
  brand: {
    name: "eximIA Academy",
    slug: "__neutro__",
    logo: "/brand/logo.png",
    logoLight: "/brand/logo-color.png",
    favicon: "/brand/favicon.ico",
    primaryColor: "#2a6ab0",
    accentColor: "#C4A882",
  },
  modules: ["assessments", "biblioteca"],
  settings: { maxInteractionsPerSession: 10, sessionTimeoutHours: 24 },
}

function linha(over: Partial<LinhaDeTenant> = {}): LinhaDeTenant {
  return {
    id: "id-cory",
    slug: "cory-alimentos",
    name: "Cory Alimentos",
    brand: {},
    modules: [],
    settings: null,
    whitelabel_config: null,
    ...over,
  }
}

describe("montarConfigDoTenant — a mescla da D4", () => {
  it("sem linha (host neutro) devolve a base intacta", () => {
    expect(montarConfigDoTenant(null, BASE)).toEqual(BASE)
  })

  it("o banco vence no campo que preenche", () => {
    const cfg = montarConfigDoTenant(
      linha({
        brand: {
          name: "Argos Consultoria",
          logo: "/logos/argos.png",
          primaryColor: "#1E3A5F",
        },
      }),
      BASE,
    )
    expect(cfg.brand.name).toBe("Argos Consultoria")
    expect(cfg.brand.logo).toBe("/logos/argos.png")
    expect(cfg.brand.primaryColor).toBe("#1E3A5F")
  })

  it("brand PARCIAL não apaga o resto: o campo ausente cai na base, não em undefined", () => {
    const cfg = montarConfigDoTenant(linha({ brand: { name: "Só o nome" } }), BASE)
    expect(cfg.brand.logo).toBe("/brand/logo.png")
    expect(cfg.brand.favicon).toBe("/brand/favicon.ico")
    expect(cfg.brand.accentColor).toBe("#C4A882")
  })

  it("`brand = {}` (o default da coluna) ainda produz nome e slug utilizáveis", () => {
    const cfg = montarConfigDoTenant(linha(), BASE)
    // O nome cai em `tenants.name`, não no da base: é a empresa certa com a
    // aparência neutra, nunca "eximIA Academy" no lugar do cliente.
    expect(cfg.brand.name).toBe("Cory Alimentos")
    expect(cfg.brand.slug).toBe("cory-alimentos")
  })

  it("o slug da identidade é o da COLUNA, mesmo que o jsonb discorde", () => {
    const cfg = montarConfigDoTenant(linha({ brand: { slug: "outro-qualquer" } }), BASE)
    expect(cfg.brand.slug).toBe("cory-alimentos")
  })

  it("`logoLight` ausente cai em `logo` do BANCO, nunca no logo da base", () => {
    // O erro que isto impede: tema claro (o default que quase todo mundo vê)
    // servindo o logo da eximIA enquanto o escuro serve o do cliente.
    const cfg = montarConfigDoTenant(linha({ brand: { logo: "/logos/argos.png" } }), BASE)
    expect(cfg.brand.logoLight).toBe("/logos/argos.png")
  })

  it("cor inválida no banco cai na base em vez de emitir CSS quebrado", () => {
    const cfg = montarConfigDoTenant(
      linha({ brand: { primaryColor: "azul", accentColor: "#123" } }),
      BASE,
    )
    expect(cfg.brand.primaryColor).toBe("#2a6ab0")
    expect(cfg.brand.accentColor).toBe("#C4A882")
  })

  it("`modules` vazio é 'não declarado' e cai na base — não é 'nenhum módulo'", () => {
    expect(montarConfigDoTenant(linha({ modules: [] }), BASE).modules).toEqual(BASE.modules)
    expect(montarConfigDoTenant(linha({ modules: null }), BASE).modules).toEqual(BASE.modules)
  })

  it("`modules` preenchido vence, e token desconhecido é descartado", () => {
    const cfg = montarConfigDoTenant(linha({ modules: ["units", "nao-existe"] }), BASE)
    expect(cfg.modules).toEqual(["units"])
  })

  it("`modules` só com lixo cai na base (descartar tudo não pode virar 'sem módulos')", () => {
    expect(montarConfigDoTenant(linha({ modules: ["lixo"] }), BASE).modules).toEqual(BASE.modules)
  })

  it("settings vêm dos lugares do contrato: `settings` e `whitelabel_config`", () => {
    const cfg = montarConfigDoTenant(
      linha({
        settings: { max_interactions_per_session: 25, ai_model: "claude-4" },
        whitelabel_config: { footer_text: "© 2026 Argos", support_email: "s@argos.com" },
      }),
      BASE,
    )
    expect(cfg.settings?.maxInteractionsPerSession).toBe(25)
    expect(cfg.settings?.aiModel).toBe("claude-4")
    expect(cfg.settings?.footerText).toBe("© 2026 Argos")
    expect(cfg.settings?.supportEmail).toBe("s@argos.com")
  })

  it("`sessionTimeoutHours` NÃO existe no banco: sai da base (contrato §2.2)", () => {
    const cfg = montarConfigDoTenant(linha({ settings: { session_timeout_hours: 999 } }), {
      ...BASE,
      settings: { ...BASE.settings, sessionTimeoutHours: 8 },
    })
    expect(cfg.settings?.sessionTimeoutHours).toBe(8)
  })

  it("`features.org_tree` do banco vence o env — inclusive quando é `false`", () => {
    const baseComOrgTree: TenantConfig = { ...BASE, features: { orgTree: true } }
    const ligado = montarConfigDoTenant(linha({ settings: { features: { org_tree: true } } }), BASE)
    const desligado = montarConfigDoTenant(
      linha({ settings: { features: { org_tree: false } } }),
      baseComOrgTree,
    )
    const ausente = montarConfigDoTenant(linha({ settings: {} }), baseComOrgTree)
    expect(ligado.features?.orgTree).toBe(true)
    expect(desligado.features).toBeUndefined()
    expect(ausente.features?.orgTree).toBe(true)
  })

  it("customCSS NUNCA sai daqui, venha ele de onde vier", () => {
    const cfg = montarConfigDoTenant(
      linha({
        brand: { customCSS: "body{display:none}" },
        settings: { customCSS: "body{display:none}", custom_css: "body{display:none}" },
        whitelabel_config: { custom_css: "body{display:none}", customCSS: "x" },
      }),
      BASE,
    )
    expect(cfg.settings?.customCSS).toBeUndefined()
    expect(JSON.stringify(cfg)).not.toContain("display:none")
  })

  it("jsonb de tipo inesperado (array, string, null) nunca lança", () => {
    const cfg = montarConfigDoTenant(
      linha({ brand: [1, 2, 3], settings: "nada", whitelabel_config: null }),
      BASE,
    )
    expect(cfg.brand.name).toBe("Cory Alimentos")
    expect(cfg.settings?.maxInteractionsPerSession).toBe(10)
  })

  it("string vazia no jsonb é AUSÊNCIA, igual ao `''` que o EasyPanel grava", () => {
    const cfg = montarConfigDoTenant(linha({ brand: { name: "   ", logo: "" } }), BASE)
    expect(cfg.brand.name).toBe("Cory Alimentos")
    expect(cfg.brand.logo).toBe("/brand/logo.png")
  })

  it("o `select` não pede `branding` nem `custom_css`", () => {
    expect(COLUNAS_DE_MARCA).toBe("id, slug, name, brand, modules, settings, whitelabel_config")
    expect(COLUNAS_DE_MARCA).not.toContain("custom_css")
    expect(COLUNAS_DE_MARCA).not.toContain("branding")
  })
})
