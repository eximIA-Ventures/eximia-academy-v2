import type { TenantConfig } from "@eximia/shared"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  NEUTRO,
  RESERVED_SLUGS,
  configDoAmbiente,
  dominioBase,
  ehSlugReservado,
  slugDoAmbiente,
} from "../../../tenant.config"

// ===========================================================================
// O FALLBACK NEUTRO — O QUE SOBRA DA MARCA POR ENV DE BUILD.
//
// ESTE ARQUIVO MUDOU DE PERGUNTA. Ele provava que a marca do cliente vinha de
// variável de BUILD e que cada campo saía da variável certa. Aquilo deixou de
// ser a arquitetura: a marca vem do BANCO, resolvida por HOST a cada
// requisição (D2/D4), e `tenant.config.ts` ficou com três coisas — o NEUTRO,
// o parser de env (modo LEGADO, D2 passo 3) e a lista de slugs reservados.
//
// A pergunta agora é a de baixo da pilha: **quando nada resolve, o que se
// serve?** Duas propriedades sustentam tudo o que está acima:
//
//   1. o NEUTRO é a AUSÊNCIA de cliente, e o slug dele (`__neutro__`) não pode
//      casar com nenhuma linha real de `tenants`. Enquanto era `demo`, casava:
//      `supabase/seed.sql` cria um tenant REAL com esse slug, e "host
//      desconhecido" acabava servindo a marca de uma empresa existente (D5);
//   2. o parser de env é lido em RUNTIME, não congelado no artefato — é isso
//      que permite o serviço legado seguir de pé sem rebuild.
// ===========================================================================

/** As 15 variáveis que o modo legado lê. Zerar TODAS define "sem cliente". */
const CHAVES = [
  "NEXT_PUBLIC_TENANT_SLUG",
  "NEXT_PUBLIC_TENANT_NAME",
  "NEXT_PUBLIC_TENANT_LOGO",
  "NEXT_PUBLIC_TENANT_LOGO_LIGHT",
  "NEXT_PUBLIC_TENANT_FAVICON",
  "NEXT_PUBLIC_TENANT_PRIMARY_COLOR",
  "NEXT_PUBLIC_TENANT_ACCENT_COLOR",
  "NEXT_PUBLIC_TENANT_MODULES",
  "NEXT_PUBLIC_TENANT_PARTNER_NAME",
  "NEXT_PUBLIC_TENANT_PARTNER_LOGO",
  "NEXT_PUBLIC_TENANT_FOOTER_TEXT",
  "NEXT_PUBLIC_TENANT_SUPPORT_EMAIL",
  "NEXT_PUBLIC_TENANT_ORG_TREE",
  "NEXT_PUBLIC_TENANT_MAX_INTERACTIONS",
  "NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS",
] as const

function comEnv(env: Record<string, string>) {
  for (const k of CHAVES) vi.stubEnv(k, "")
  vi.stubEnv("NEXT_PUBLIC_APP_BASE_DOMAIN", "")
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  return configDoAmbiente()
}

/** A marca real do cliente Cory Alimentos, como ela vive hoje no EasyPanel. */
const MARCA_DO_CLIENTE = {
  NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos",
  NEXT_PUBLIC_TENANT_NAME: "Argos Consultoria",
  NEXT_PUBLIC_TENANT_LOGO: "/logos/argos-academy-color.png",
  NEXT_PUBLIC_TENANT_PRIMARY_COLOR: "#1E3A5F",
  NEXT_PUBLIC_TENANT_MODULES: "biblioteca,units",
  NEXT_PUBLIC_TENANT_SUPPORT_EMAIL: "suporte@eximiaventures.com.br",
}

/** Só os campos que a config PRODUZ — o universo em que a marca pode vazar. */
function textoProduzido(config: TenantConfig): string {
  return JSON.stringify({ brand: config.brand, settings: config.settings ?? {} })
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe("o NEUTRO é a ausência de cliente, não a eximIA como cliente", () => {
  it("o slug neutro é `__neutro__` e NÃO pode casar com um tenant real (D5)", () => {
    // Enquanto foi `demo`, casava: `supabase/seed.sql` cria um tenant real com
    // esse slug. "Host desconhecido" resolvia numa empresa existente.
    expect(NEUTRO.brand.slug).toBe("__neutro__")
    expect(ehSlugReservado("__neutro__")).toBe(true)
    expect(ehSlugReservado("demo")).toBe(true)
    expect(ehSlugReservado("neutro")).toBe(true)
  })

  it("a lista de reservados é a mesma que `provisionar_tenant` valida", () => {
    expect([...RESERVED_SLUGS]).toEqual([
      "www",
      "app",
      "api",
      "admin",
      "central",
      "academy",
      "demo",
      "neutro",
      "__neutro__",
    ])
  })

  it("um slug comum de empresa NÃO é reservado (o controle positivo da lista)", () => {
    expect(ehSlugReservado("cory-alimentos")).toBe(false)
    expect(ehSlugReservado("harven-finance")).toBe(false)
  })
})

describe("sem env nenhuma: a config é o NEUTRO, byte a byte", () => {
  it("marca neutra completa", () => {
    const config = comEnv({})
    expect(config.brand).toMatchObject({
      name: "eximIA Academy",
      slug: "__neutro__",
      logo: "/brand/logo.png",
      logoLight: "/brand/logo-color.png",
      favicon: "/brand/favicon.ico",
      primaryColor: "#2a6ab0",
      accentColor: "#C4A882",
    })
    expect(config.modules).toEqual([
      "assessments",
      "biblioteca",
      "community",
      "course-designer",
      "units",
      "integrations",
    ])
    expect(config.settings).toMatchObject({
      maxInteractionsPerSession: 10,
      sessionTimeoutHours: 24,
    })
  })

  it("nenhum campo de parceiro, rodapé ou suporte vaza no neutro", () => {
    const config = comEnv({})
    expect(config.brand.partnerName).toBeUndefined()
    expect(config.brand.partnerLogo).toBeUndefined()
    expect(config.settings?.footerText).toBeUndefined()
    expect(config.settings?.supportEmail).toBeUndefined()
    expect(config.features).toBeUndefined()
  })

  it("zero menção a cliente nos campos que a config produz", () => {
    const produzido = textoProduzido(comEnv({}))
    // Palavra inteira, e só no que a config produz: "Argos" é substring de
    // "Cargos" e já aparece no /brandbook num build legitimamente neutro.
    expect(produzido).not.toMatch(/\bArgos\b/)
    expect(produzido).not.toContain("cory-alimentos")
  })

  it("`customCSS` não existe nem no neutro nem com env — ele é `dangerouslySetInnerHTML`", () => {
    expect(comEnv({}).settings?.customCSS).toBeUndefined()
    expect(comEnv(MARCA_DO_CLIENTE).settings?.customCSS).toBeUndefined()
  })
})

describe("modo LEGADO: as env do serviço de um cliente único (D2, passo 3)", () => {
  it("a marca do cliente sobrepõe o neutro campo a campo", () => {
    const config = comEnv(MARCA_DO_CLIENTE)
    expect(config.brand.name).toBe("Argos Consultoria")
    expect(config.brand.slug).toBe("cory-alimentos")
    expect(config.brand.primaryColor).toBe("#1E3A5F")
    expect(config.modules).toEqual(["biblioteca", "units"])
    expect(config.settings?.supportEmail).toBe("suporte@eximiaventures.com.br")
  })

  it("a MESMA asserção de ausência do neutro agora REPROVA (controle positivo)", () => {
    const produzido = textoProduzido(comEnv(MARCA_DO_CLIENTE))
    // Se este bloco passasse nos DOIS estados, a prova de ausência seria vazia.
    expect(produzido).toMatch(/\bArgos\b/)
    expect(produzido).toContain("cory-alimentos")
  })

  it("o que a env não define continua neutro (o favicon não vem de graça)", () => {
    const config = comEnv(MARCA_DO_CLIENTE)
    expect(config.brand.favicon).toBe("/brand/favicon.ico")
    expect(config.brand.accentColor).toBe("#C4A882")
  })

  it("`logoLight` ausente cai em `logo`, nunca no logo neutro", () => {
    // O erro que isto impede: tema claro (o default que quase todo mundo vê)
    // servindo o logo da eximIA enquanto o escuro serve o do cliente.
    expect(comEnv({ NEXT_PUBLIC_TENANT_LOGO: "/logos/x.png" }).brand.logoLight).toBe("/logos/x.png")
  })

  it("string vazia é ausência (o EasyPanel grava '' em campo em branco)", () => {
    const config = comEnv({ NEXT_PUBLIC_TENANT_NAME: "   ", NEXT_PUBLIC_TENANT_SLUG: "" })
    expect(config.brand.name).toBe("eximIA Academy")
    expect(config.brand.slug).toBe("__neutro__")
  })

  it("cor inválida cai no neutro em vez de emitir CSS quebrado", () => {
    const config = comEnv({ NEXT_PUBLIC_TENANT_PRIMARY_COLOR: "azul" })
    expect(config.brand.primaryColor).toBe("#2a6ab0")
  })

  it("módulo desconhecido é descartado; se sobrar nada, cai no neutro", () => {
    expect(comEnv({ NEXT_PUBLIC_TENANT_MODULES: "units,invencao" }).modules).toEqual(["units"])
    expect(comEnv({ NEXT_PUBLIC_TENANT_MODULES: "invencao" }).modules).toEqual(NEUTRO.modules)
  })
})

describe("a env é lida em RUNTIME, não congelada no artefato", () => {
  it("trocar a variável muda a resposta SEM recarregar o módulo", () => {
    // Esta é a propriedade que permitiu tirar os 16 ARG/ENV de marca do
    // Dockerfile: enquanto o valor era inlinado em build, trocar a marca do
    // serviço legado exigia rebuild. Se alguém voltar a resolver a config numa
    // constante de módulo, este caso fica vermelho.
    expect(comEnv({ NEXT_PUBLIC_TENANT_NAME: "Primeira" }).brand.name).toBe("Primeira")
    expect(comEnv({ NEXT_PUBLIC_TENANT_NAME: "Segunda" }).brand.name).toBe("Segunda")
  })

  it("`slugDoAmbiente` e `dominioBase` leem o processo, e normalizam o domínio", () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_SLUG", "cory-alimentos")
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_DOMAIN", "Academy.EximiaVentures.com.BR")
    expect(slugDoAmbiente()).toBe("cory-alimentos")
    expect(dominioBase()).toBe("academy.eximiaventures.com.br")
  })

  it("sem `NEXT_PUBLIC_APP_BASE_DOMAIN` o passo 2 da D2 fica indisponível, sem lançar", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_BASE_DOMAIN", "")
    expect(dominioBase()).toBeUndefined()
  })
})
