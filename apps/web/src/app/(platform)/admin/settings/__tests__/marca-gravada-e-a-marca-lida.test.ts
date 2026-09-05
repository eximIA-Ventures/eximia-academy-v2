import type { TenantConfig } from "@eximia/shared"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NEUTRO } from "../../../../../../tenant.config"
import { montarConfigDoTenant } from "../../../../../lib/tenant/marca"

// =============================================================================
// O EDITOR DE MARCA TINHA VIRADO WRITE-ONLY.
//
// `20260906001000` fez o backfill de `tenants.brand` UMA vez, e
// `montarConfigDoTenant` passou a ler a marca EXCLUSIVAMENTE de `brand` — nunca
// mais de `branding`, nunca de `whitelabel_config.favicon_url`, nunca de
// `custom_texts.app_name`. As duas actions que a tela dispara, porém, gravavam
// só as colunas ANTIGAS. Cenário concreto: o admin sobe um logo novo, troca a
// cor primária, salva; a tela diz "salvo", a linha muda no banco, e o app
// continua pintando o logo e a cor congelados no valor do backfill, para sempre.
//
// Por isso o teste não para no UPDATE: ele pega o `brand` que a action gravou e
// o alimenta em `montarConfigDoTenant`, o MESMO leitor que o app usa por
// requisição. É o laço inteiro — gravar, ler, ver — e é a única forma de o
// defeito não voltar em silêncio.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

interface Escrita {
  table: string
  data: Record<string, unknown>
}

let escritas: Escrita[] = []
let linhaAtual: Record<string, unknown> = {}

function makeClient() {
  return {
    from: vi.fn((table: string) => {
      // biome-ignore lint/suspicious/noExplicitAny: mock builder de teste
      const builder: any = {}
      let updateData: Record<string, unknown> | null = null

      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.update = vi.fn((data: Record<string, unknown>) => {
        updateData = data
        return builder
      })
      builder.single = vi.fn(() => Promise.resolve({ data: linhaAtual, error: null }))
      // biome-ignore lint/suspicious/noThenProperty: thenable emula o builder do supabase
      builder.then = (onFulfilled: (v: { data: unknown; error: null }) => unknown) => {
        if (updateData) escritas.push({ table, data: updateData })
        return Promise.resolve({ data: [{ id: "tenant-7" }], error: null }).then(onFulfilled)
      }
      return builder
    }),
  }
}

const client = makeClient()

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => client) }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => client) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/audit", () => ({ logAdminAction: vi.fn(async () => {}) }))

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => ({
      user: { id: "adm-1" },
      profile: { role: "admin", tenant_id: "tenant-7" },
      roles: ["admin"],
      supabase: client,
    })),
    getDbClient: vi.fn(async () => client),
  }
})

const { saveTenantSettings } = await import("@/app/(platform)/admin/settings/actions")
const { saveWhitelabelConfig } = await import("@/app/(platform)/admin/settings/whitelabel-actions")

/* -------------------------------- Fixtures -------------------------------- */

/** O `brand` do backfill: a marca que o app pinta HOJE, antes de qualquer edição. */
const BRAND_DO_BACKFILL = {
  name: "Cory Alimentos",
  slug: "cory-alimentos",
  logo: "https://cdn.exemplo/logo-antigo.png",
  favicon: "https://cdn.exemplo/favicon-antigo.ico",
  primaryColor: "#111111",
  accentColor: "#222222",
  partnerName: "Parceiro X",
}

/** O leitor REAL, o mesmo que roda por requisição em `lib/tenant.ts`. */
function marcaQueOAppPinta(brand: unknown): TenantConfig {
  return montarConfigDoTenant(
    {
      id: "tenant-7",
      slug: "cory-alimentos",
      name: "Cory Alimentos",
      brand,
      modules: [],
      settings: {},
      whitelabel_config: {},
    },
    NEUTRO,
  )
}

function brandGravada(): unknown {
  const escrita = escritas.find((e) => e.table === "tenants" && "brand" in e.data)
  return escrita?.data.brand
}

beforeEach(() => {
  vi.clearAllMocks()
  escritas = []
  linhaAtual = {
    branding: { logo_url: "https://cdn.exemplo/logo-antigo.png", primary_color: "#111111" },
    settings: {},
    brand: { ...BRAND_DO_BACKFILL },
    whitelabel_enabled: true,
  }
})

/* --------------------------------- Testes --------------------------------- */

describe("saveTenantSettings espelha a identidade visual em `tenants.brand`", () => {
  it("logo e cores novas passam a ser as que o app pinta", async () => {
    const r = await saveTenantSettings({
      name: "Cory Agronegócios",
      branding: {
        logo_url: "https://cdn.exemplo/logo-novo.png",
        primary_color: "#aabbcc",
        secondary_color: "#ddeeff",
      },
    })

    expect(r).toEqual({ success: true })

    const config = marcaQueOAppPinta(brandGravada())
    expect(config.brand.logo).toBe("https://cdn.exemplo/logo-novo.png")
    expect(config.brand.primaryColor).toBe("#aabbcc")
    expect(config.brand.accentColor).toBe("#ddeeff")
    expect(config.brand.name).toBe("Cory Agronegócios")
  })

  it("`branding` continua sendo gravada — o formulário ainda é semeado por ela", async () => {
    await saveTenantSettings({
      branding: { logo_url: "https://cdn.exemplo/logo-novo.png" },
    })
    const escrita = escritas.find((e) => e.table === "tenants")
    expect((escrita?.data.branding as Record<string, unknown>).logo_url).toBe(
      "https://cdn.exemplo/logo-novo.png",
    )
  })

  it("a mescla é RASA: campos que esta tela não edita sobrevivem", async () => {
    await saveTenantSettings({ branding: { primary_color: "#aabbcc" } })
    const brand = brandGravada() as Record<string, unknown>
    expect(brand.favicon).toBe("https://cdn.exemplo/favicon-antigo.ico")
    expect(brand.partnerName).toBe("Parceiro X")
    expect(brand.slug).toBe("cory-alimentos")
  })

  it('logo esvaziado APAGA a chave e devolve o fallback do NEUTRO, não `<img src="">`', async () => {
    await saveTenantSettings({ branding: { logo_url: "" } })
    const brand = brandGravada() as Record<string, unknown>
    expect("logo" in brand).toBe(false)
    expect(marcaQueOAppPinta(brand).brand.logo).toBe(NEUTRO.brand.logo)
  })

  it("payload sem `branding` nem `name` não toca `brand`", async () => {
    await saveTenantSettings({ settings: { ai_model: "gpt-4o" } })
    expect(brandGravada()).toBeUndefined()
  })
})

describe("saveWhitelabelConfig espelha favicon e nome de exibição em `tenants.brand`", () => {
  it("o favicon novo e o `app_name` passam a ser os que o app usa", async () => {
    const r = await saveWhitelabelConfig({
      custom_texts: { app_name: "Cory Academy" },
      favicon_url: "https://cdn.exemplo/favicon-novo.ico",
    })

    expect(r).toEqual({ success: true })

    const config = marcaQueOAppPinta(brandGravada())
    expect(config.brand.favicon).toBe("https://cdn.exemplo/favicon-novo.ico")
    expect(config.brand.name).toBe("Cory Academy")
    // Logo e cores são de OUTRA tela — esta não pode apagá-los.
    expect(config.brand.logo).toBe("https://cdn.exemplo/logo-antigo.png")
    expect(config.brand.primaryColor).toBe("#111111")
  })

  it("o reset (`{}`) devolve o nome para `tenants.name` e some com o favicon customizado", async () => {
    await saveWhitelabelConfig({})
    const brand = brandGravada() as Record<string, unknown>
    expect("favicon" in brand).toBe(false)
    expect("name" in brand).toBe(false)

    const config = marcaQueOAppPinta(brand)
    expect(config.brand.name).toBe("Cory Alimentos")
    expect(config.brand.favicon).toBe(NEUTRO.brand.favicon)
  })

  it("`custom_css` NUNCA entra em `brand` (D4)", async () => {
    await saveWhitelabelConfig({
      custom_texts: { app_name: "Cory Academy" },
      favicon_url: "https://cdn.exemplo/favicon-novo.ico",
      custom_css: "body{display:none}",
    })
    const brand = brandGravada() as Record<string, unknown>
    expect(Object.keys(brand)).not.toContain("custom_css")
    expect(Object.keys(brand)).not.toContain("customCSS")
  })
})
