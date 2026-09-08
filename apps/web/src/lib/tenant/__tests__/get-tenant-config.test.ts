import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// `getTenantConfig()` DE PONTA A PONTA (com o banco stubado).
//
// Três perguntas que só se respondem AQUI, e não em `marca.test.ts` (que
// testa a mescla pura):
//
//   1. o cabeçalho `x-tenant-id` que o middleware escreveu é mesmo a fonte?
//   2. host neutro serve env/NEUTRO — e NÃO a última empresa lida?
//   3. o `super_admin` veste a marca do tenant ATIVO (`x-sa-active-tenant`),
//      e quem NÃO é super_admin não troca de marca por escrever um cookie?
//
// A (3) é a que importa de verdade: `x-sa-active-tenant` é um palpite de UI,
// gravável por qualquer visitante. Sem a confirmação do chapéu, um cookie
// bastaria para vestir a marca de outra empresa.
// ===========================================================================

const TENANTS: Record<string, Record<string, unknown>> = {
  "id-cory": {
    id: "id-cory",
    slug: "cory-alimentos",
    name: "Cory Alimentos",
    brand: { name: "Argos Consultoria", logo: "/logos/argos.png", primaryColor: "#1E3A5F" },
    modules: ["units"],
    settings: {},
    whitelabel_config: { custom_css: "body{display:none}", support_email: "s@argos.com" },
  },
  "id-harven": {
    id: "id-harven",
    slug: "harven-finance",
    name: "Harven Finance",
    brand: { name: "Harven", logo: "/logos/harven.png" },
    modules: [],
    settings: {},
    whitelabel_config: null,
  },
}

let cabecalhos: Record<string, string> = {}
let cookiesDoTeste: Record<string, string> = {}
let chapeus: string[] = []
const colunasPedidas: string[] = []

vi.mock("next/headers", () => ({
  headers: async () => new Headers(cabecalhos),
  cookies: async () => ({
    get: (nome: string) =>
      cookiesDoTeste[nome] ? { name: nome, value: cookiesDoTeste[nome] } : undefined,
  }),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (_tabela: string) => ({
      select: (colunas: string) => {
        colunasPedidas.push(colunas)
        return {
          eq: (_coluna: string, valor: string) => ({
            maybeSingle: async () => ({ data: TENANTS[valor] ?? null, error: null }),
          }),
        }
      },
    }),
  }),
}))

vi.mock("@/lib/auth", () => ({
  getAuthProfile: async () => ({ roles: chapeus, profile: { role: chapeus[0] ?? "student" } }),
}))

const { getTenantConfig, getTenantContext } = await import("../../tenant")

beforeEach(() => {
  cabecalhos = {}
  cookiesDoTeste = {}
  chapeus = []
  colunasPedidas.length = 0
  vi.unstubAllEnvs()
  for (const k of ["NEXT_PUBLIC_TENANT_SLUG", "NEXT_PUBLIC_TENANT_NAME", "NEXT_PUBLIC_TENANT_LOGO"])
    vi.stubEnv(k, "")
})

describe("getTenantContext — o que o middleware escreveu", () => {
  it("lê `x-tenant-id`/`x-tenant-slug`/`x-tenant-origem`", async () => {
    cabecalhos = {
      "x-tenant-id": "id-cory",
      "x-tenant-slug": "cory-alimentos",
      "x-tenant-origem": "dominio-proprio",
      "x-forwarded-host": "Argos.EximiaAcademy.com.br:443",
    }
    expect(await getTenantContext()).toEqual({
      tenantId: "id-cory",
      slug: "cory-alimentos",
      isNeutro: false,
      host: "argos.eximiaacademy.com.br",
      origem: "dominio-proprio",
      // A INSTALAÇÃO que está servindo (`PLATFORM_SLUG`), não o tenant: sem
      // env nenhuma, a instância é a eximIA. Ela NÃO viaja em cabeçalho — é
      // do processo — e nunca autoriza nada.
      instancia: { slug: "eximia", brandName: "eximIA Academy" },
    })
  })

  it("slug neutro sem id é neutro de verdade (`tenantId` null)", async () => {
    cabecalhos = { "x-tenant-slug": "__neutro__", host: "desconhecido.com" }
    const ctx = await getTenantContext()
    expect(ctx.tenantId).toBeNull()
    expect(ctx.isNeutro).toBe(true)
  })
})

describe("getTenantConfig — banco > env > NEUTRO", () => {
  it("com tenant no header, a marca vem do banco", async () => {
    cabecalhos = { "x-tenant-id": "id-cory", "x-tenant-slug": "cory-alimentos" }
    const cfg = await getTenantConfig()
    expect(cfg.brand.name).toBe("Argos Consultoria")
    expect(cfg.brand.slug).toBe("cory-alimentos")
    expect(cfg.modules).toEqual(["units"])
  })

  it("`custom_css` do banco NUNCA chega à config (D4)", async () => {
    cabecalhos = { "x-tenant-id": "id-cory", "x-tenant-slug": "cory-alimentos" }
    const cfg = await getTenantConfig()
    expect(cfg.settings?.customCSS).toBeUndefined()
    expect(JSON.stringify(cfg)).not.toContain("display:none")
    // E a coluna nem é pedida ao banco.
    expect(colunasPedidas.join(" ")).not.toContain("custom_css")
  })

  it("host neutro serve o ENV legado, não a última empresa lida", async () => {
    // Primeiro uma empresa real, para haver "última empresa" a vazar.
    cabecalhos = { "x-tenant-id": "id-cory", "x-tenant-slug": "cory-alimentos" }
    expect((await getTenantConfig()).brand.name).toBe("Argos Consultoria")

    // O `SLUG` acompanha o `NAME` porque é ele que LIGA o modo legado: sem
    // cliente único declarado não há camada de env, e a base é a instância.
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "cliente-legado")
    vi.stubEnv("NEXT_PUBLIC_TENANT_NAME", "Cliente Legado")
    cabecalhos = { "x-tenant-slug": "__neutro__" }
    const cfg = await getTenantConfig()
    expect(cfg.brand.name).toBe("Cliente Legado")
    // A MARCA é a do serviço legado; o CONTEXTO segue neutro (`tenantId`
    // null), que é o que impede qualquer consulta de apontar para a empresa.
    expect(cfg.brand.slug).toBe("cliente-legado")
    expect((await getTenantContext()).tenantId).toBeNull()
  })

  it("host neutro e sem env: NEUTRO puro", async () => {
    cabecalhos = { "x-tenant-slug": "__neutro__" }
    const cfg = await getTenantConfig()
    expect(cfg.brand.name).toBe("eximIA Academy")
    expect(cfg.brand.slug).toBe("__neutro__")
  })

  it("tenant que sumiu do banco entre uma requisição e outra cai no env/NEUTRO", async () => {
    cabecalhos = { "x-tenant-id": "id-que-nao-existe", "x-tenant-slug": "fantasma" }
    expect((await getTenantConfig()).brand.name).toBe("eximIA Academy")
  })
})

describe("super_admin veste a marca do tenant ATIVO (D3)", () => {
  it("com o chapéu, o cookie `x-sa-active-tenant` troca a marca", async () => {
    cabecalhos = { "x-tenant-id": "id-cory", "x-tenant-slug": "cory-alimentos" }
    cookiesDoTeste = { "x-sa-active-tenant": "id-harven" }
    chapeus = ["super_admin"]
    expect((await getTenantConfig()).brand.name).toBe("Harven")
  })

  it("SEM o chapéu, o mesmo cookie não troca nada — cai na marca do HOST", async () => {
    // O cookie é palpite de UI e qualquer visitante o escreve. Se ele bastasse,
    // um aluno da Cory veria a tela vestida de Harven.
    cabecalhos = { "x-tenant-id": "id-cory", "x-tenant-slug": "cory-alimentos" }
    cookiesDoTeste = { "x-sa-active-tenant": "id-harven" }
    chapeus = ["admin"]
    expect((await getTenantConfig()).brand.name).toBe("Argos Consultoria")
  })

  it("sem cookie, o chapéu não é sequer consultado — a marca é a do host", async () => {
    cabecalhos = { "x-tenant-id": "id-harven", "x-tenant-slug": "harven-finance" }
    chapeus = ["super_admin"]
    expect((await getTenantConfig()).brand.name).toBe("Harven")
  })
})
