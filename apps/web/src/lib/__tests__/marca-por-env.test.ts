import type { TenantConfig } from "@eximia/shared"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  NEUTRO,
  RESERVED_SLUGS,
  configDoAmbiente,
  dominioBase,
  ehSlugReservado,
  instanciaDaPlataforma,
  marcaDaInstancia,
  slugDaInstancia,
  slugDoAmbiente,
} from "../../../tenant.config"
import { type LinhaDeTenant, montarConfigDoTenant } from "../tenant/marca"

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
//
// E ELE GANHOU UMA TERCEIRA. Entre o NEUTRO e o cliente entrou a INSTÂNCIA: a
// mesma imagem roda como "eximIA Academy" e como "Argos Academy" em serviços
// separados do EasyPanel, cada um com seu Supabase e seu domínio base. A Argos
// não é cliente — é operadora de uma instalação, com super_admin próprio. A
// marca da PORTA DE ENTRADA (o `app.{base}`, a empresa sem marca própria, o
// e-mail, o favicon) passou a vir das `PLATFORM_*`, e a pilha inteira é:
//
//   banco > env legado (só com `NEXT_PUBLIC_TENANT_SLUG`) > instância > NEUTRO
//
// Sem nenhuma `PLATFORM_*`, a instância É o NEUTRO byte a byte — a propriedade
// que mantém o serviço eximIA idêntico ao que ele era antes desta rodada.
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

/** As 13 variáveis da instância. Zerar TODAS define "instância de fábrica". */
const CHAVES_DA_INSTANCIA = [
  "PLATFORM_SLUG",
  "PLATFORM_BRAND_NAME",
  "PLATFORM_BRAND_LOGO",
  "PLATFORM_BRAND_LOGO_LIGHT",
  "PLATFORM_BRAND_FAVICON",
  "PLATFORM_BRAND_PRIMARY_COLOR",
  "PLATFORM_BRAND_ACCENT_COLOR",
  "PLATFORM_BRAND_PARTNER_NAME",
  "PLATFORM_BRAND_PARTNER_LOGO",
  "PLATFORM_FOOTER_TEXT",
  "PLATFORM_SUPPORT_EMAIL",
  "PLATFORM_MODULES",
] as const

/** Zera TUDO (legado + instância) e aplica só o que o caso declara. */
function comAmbiente(env: Record<string, string>) {
  for (const k of CHAVES) vi.stubEnv(k, "")
  for (const k of CHAVES_DA_INSTANCIA) vi.stubEnv(k, "")
  vi.stubEnv("NEXT_PUBLIC_APP_BASE_DOMAIN", "")
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
}

function comEnv(env: Record<string, string>) {
  comAmbiente(env)
  return configDoAmbiente()
}

/** A marca da INSTÂNCIA sozinha, sem a camada do cliente por cima. */
function comInstancia(env: Record<string, string>) {
  comAmbiente(env)
  return marcaDaInstancia()
}

/** A instalação da Argos, como ela viverá no serviço dela no EasyPanel. */
const INSTANCIA_ARGOS = {
  PLATFORM_SLUG: "argos",
  PLATFORM_BRAND_NAME: "Argos Academy",
  PLATFORM_BRAND_LOGO: "/brand/argos/logo.png",
  PLATFORM_BRAND_FAVICON: "/brand/argos/favicon.ico",
  PLATFORM_BRAND_PRIMARY_COLOR: "#1E3A5F",
  PLATFORM_BRAND_PARTNER_NAME: "Argos",
  PLATFORM_BRAND_PARTNER_LOGO: "/brand/argos/parceiro.png",
  PLATFORM_SUPPORT_EMAIL: "suporte@argos.com.br",
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
    // O `SLUG` acompanha porque é ele que LIGA o modo legado (ver abaixo).
    const config = comEnv({
      NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos",
      NEXT_PUBLIC_TENANT_LOGO: "/logos/x.png",
    })
    expect(config.brand.logoLight).toBe("/logos/x.png")
  })

  it("string vazia é ausência (o EasyPanel grava '' em campo em branco)", () => {
    const config = comEnv({ NEXT_PUBLIC_TENANT_NAME: "   ", NEXT_PUBLIC_TENANT_SLUG: "" })
    expect(config.brand.name).toBe("eximIA Academy")
    expect(config.brand.slug).toBe("__neutro__")
  })

  it("cor inválida cai no neutro em vez de emitir CSS quebrado", () => {
    const config = comEnv({
      NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos",
      NEXT_PUBLIC_TENANT_PRIMARY_COLOR: "azul",
    })
    expect(config.brand.primaryColor).toBe("#2a6ab0")
  })

  it("módulo desconhecido é descartado; se sobrar nada, cai no neutro", () => {
    const slug = { NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos" }
    expect(comEnv({ ...slug, NEXT_PUBLIC_TENANT_MODULES: "units,invencao" }).modules).toEqual([
      "units",
    ])
    expect(comEnv({ ...slug, NEXT_PUBLIC_TENANT_MODULES: "invencao" }).modules).toEqual(
      NEUTRO.modules,
    )
  })

  it("SEM `NEXT_PUBLIC_TENANT_SLUG` o modo legado nem liga — o resíduo não repinta nada", () => {
    // O caso real: alguém clona o serviço da Cory para criar o da Argos e
    // esquece `NEXT_PUBLIC_TENANT_NAME` no painel. Se o parser lesse os
    // campos soltos, esse resíduo sobreporia a marca da INSTÂNCIA inteira —
    // em silêncio, para todos os hosts, inclusive a porta de entrada.
    const config = comEnv({ ...INSTANCIA_ARGOS, NEXT_PUBLIC_TENANT_NAME: "Cory Alimentos" })
    expect(config.brand.name).toBe("Argos Academy")
    expect(config.brand.slug).toBe("__neutro__")
  })
})

describe("a env é lida em RUNTIME, não congelada no artefato", () => {
  it("trocar a variável muda a resposta SEM recarregar o módulo", () => {
    // Esta é a propriedade que permitiu tirar os 16 ARG/ENV de marca do
    // Dockerfile: enquanto o valor era inlinado em build, trocar a marca do
    // serviço legado exigia rebuild. Se alguém voltar a resolver a config numa
    // constante de módulo, este caso fica vermelho.
    const slug = { NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos" }
    expect(comEnv({ ...slug, NEXT_PUBLIC_TENANT_NAME: "Primeira" }).brand.name).toBe("Primeira")
    expect(comEnv({ ...slug, NEXT_PUBLIC_TENANT_NAME: "Segunda" }).brand.name).toBe("Segunda")
  })

  it("a marca da INSTÂNCIA também é lida a cada chamada", () => {
    expect(comInstancia({ PLATFORM_BRAND_NAME: "Primeira" }).brand.name).toBe("Primeira")
    expect(comInstancia({ PLATFORM_BRAND_NAME: "Segunda" }).brand.name).toBe("Segunda")
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

// ===========================================================================
// A INSTÂNCIA (`PLATFORM_*`): eximIA Academy e Argos Academy na MESMA imagem.
// ===========================================================================

describe("marcaDaInstancia — sem `PLATFORM_*`, a instância É o NEUTRO", () => {
  it("byte a byte, e não só nos campos que alguém lembrou de conferir", () => {
    // `toEqual` contra o objeto INTEIRO de propósito: uma asserção campo a
    // campo passaria mesmo se a instância inventasse uma chave nova (um
    // `partnerName` vazio, um `features` fantasma) no serviço eximIA, que é o
    // serviço que já está em produção.
    expect(comInstancia({})).toEqual(NEUTRO)
  })

  it("nem parceiro, nem rodapé, nem suporte aparecem de graça", () => {
    const config = comInstancia({})
    expect(config.brand.partnerName).toBeUndefined()
    expect(config.brand.partnerLogo).toBeUndefined()
    expect(config.settings?.footerText).toBeUndefined()
    expect(config.settings?.supportEmail).toBeUndefined()
  })

  it("`PLATFORM_SLUG` ausente é `eximia` — o default da instalação original", () => {
    expect(slugDaInstancia()).toBe("eximia")
    expect(comInstancia({}).brand.name).toBe("eximIA Academy")
    expect(instanciaDaPlataforma()).toEqual({ slug: "eximia", brandName: "eximIA Academy" })
  })
})

describe("marcaDaInstancia — a Argos sobrepõe o NEUTRO campo a campo", () => {
  it("cada campo declarado vence, e só ele", () => {
    const config = comInstancia(INSTANCIA_ARGOS)
    expect(config.brand.name).toBe("Argos Academy")
    expect(config.brand.logo).toBe("/brand/argos/logo.png")
    expect(config.brand.favicon).toBe("/brand/argos/favicon.ico")
    expect(config.brand.primaryColor).toBe("#1E3A5F")
    expect(config.brand.partnerName).toBe("Argos")
    expect(config.settings?.supportEmail).toBe("suporte@argos.com.br")
  })

  it("o que a Argos NÃO declarou continua eximIA (a cor de destaque não vem junto)", () => {
    const config = comInstancia(INSTANCIA_ARGOS)
    expect(config.brand.accentColor).toBe("#C4A882")
    expect(config.modules).toEqual(NEUTRO.modules)
    expect(config.settings?.maxInteractionsPerSession).toBe(10)
  })

  it("`logoLight` ausente cai no logo DA INSTÂNCIA, nunca no da eximIA", () => {
    // Sem isto, o tema claro (o que quase todo mundo vê) serviria o logo
    // eximIA dentro de um serviço Argos: marca partida ao meio, sem erro.
    expect(comInstancia(INSTANCIA_ARGOS).brand.logoLight).toBe("/brand/argos/logo.png")
  })

  it("o slug do neutro continua `__neutro__` mesmo numa instância chamada `argos` (D5)", () => {
    // `PLATFORM_SLUG` identifica o SERVIÇO. Se ele vazasse para `brand.slug`,
    // "argos" viraria um slug procurável em `tenants` — e a resolução neutra
    // voltaria a poder cair numa empresa real, que é o que a D5 fechou.
    const config = comInstancia(INSTANCIA_ARGOS)
    expect(config.brand.slug).toBe("__neutro__")
    expect(slugDaInstancia()).toBe("argos")
    expect(instanciaDaPlataforma()).toEqual({ slug: "argos", brandName: "Argos Academy" })
  })

  it("cor inválida cai no default em vez de emitir CSS quebrado", () => {
    expect(comInstancia({ PLATFORM_BRAND_PRIMARY_COLOR: "azul" }).brand.primaryColor).toBe(
      "#2a6ab0",
    )
    expect(comInstancia({ PLATFORM_BRAND_ACCENT_COLOR: "#12345" }).brand.accentColor).toBe(
      "#C4A882",
    )
  })

  it("string vazia é ausência aqui também (o EasyPanel grava '' em campo em branco)", () => {
    const config = comInstancia({ PLATFORM_BRAND_NAME: "   ", PLATFORM_SLUG: "" })
    expect(config.brand.name).toBe("eximIA Academy")
    expect(slugDaInstancia()).toBe("eximia")
  })

  it("`PLATFORM_SLUG` que não é um rótulo simples cai no default, sem lançar", () => {
    // Ele entra em comparação (`instancia.slug === "argos"`) e em log; uma
    // frase inteira ali é erro de preenchimento, não uma instância nova.
    comAmbiente({ PLATFORM_SLUG: "Argos Academy Brasil!" })
    expect(slugDaInstancia()).toBe("eximia")
    comAmbiente({ PLATFORM_SLUG: "ARGOS" })
    expect(slugDaInstancia()).toBe("argos")
  })

  it("`PLATFORM_MODULES` usa o MESMO parser de CSV do modo legado", () => {
    expect(comInstancia({ PLATFORM_MODULES: "units,invencao" }).modules).toEqual(["units"])
    expect(comInstancia({ PLATFORM_MODULES: "invencao" }).modules).toEqual(NEUTRO.modules)
    expect(comInstancia({ PLATFORM_MODULES: " biblioteca , units " }).modules).toEqual([
      "biblioteca",
      "units",
    ])
  })

  it("`customCSS` não existe na instância — ele é `dangerouslySetInnerHTML`", () => {
    expect(comInstancia(INSTANCIA_ARGOS).settings?.customCSS).toBeUndefined()
  })
})

describe("a pilha: banco > env legado > instância > NEUTRO", () => {
  it("o env legado vence a instância NO CAMPO QUE DECLARA, e só nele", () => {
    const config = comEnv({ ...INSTANCIA_ARGOS, ...MARCA_DO_CLIENTE })
    // Declarados pelo cliente: o cliente vence.
    expect(config.brand.name).toBe("Argos Consultoria")
    expect(config.brand.slug).toBe("cory-alimentos")
    expect(config.modules).toEqual(["biblioteca", "units"])
    // NÃO declarados pelo cliente: a instância, não o NEUTRO.
    expect(config.brand.favicon).toBe("/brand/argos/favicon.ico")
    expect(config.brand.partnerName).toBe("Argos")
  })

  it("o banco vence a instância, e a empresa sem marca própria HERDA a instância", () => {
    // O caso que motivou a camada: a Argos cadastra "Cory" no painel dela e
    // não sobe logo nenhum. A tela tem que ficar "Cory Academy by Argos", com
    // as cores da Argos — e não com o azul da eximIA.
    const base = comEnv(INSTANCIA_ARGOS)
    const linha: LinhaDeTenant = {
      id: "id-cory",
      slug: "cory",
      name: "Cory Academy",
      brand: { name: "Cory Academy" },
      modules: [],
      settings: null,
      whitelabel_config: null,
    }
    const config = montarConfigDoTenant(linha, base)
    expect(config.brand.name).toBe("Cory Academy")
    expect(config.brand.slug).toBe("cory")
    expect(config.brand.partnerName).toBe("Argos")
    expect(config.brand.partnerLogo).toBe("/brand/argos/parceiro.png")
    expect(config.brand.logo).toBe("/brand/argos/logo.png")
    expect(config.brand.primaryColor).toBe("#1E3A5F")
    expect(config.settings?.supportEmail).toBe("suporte@argos.com.br")
  })

  it("a empresa QUE TEM marca própria não herda nada da instância", () => {
    const base = comEnv(INSTANCIA_ARGOS)
    const config = montarConfigDoTenant(
      {
        id: "id-harven",
        slug: "harven-finance",
        name: "Harven Finance",
        brand: { name: "Harven", logo: "/logos/harven.png", primaryColor: "#0A0A0A" },
        modules: ["units"],
        settings: null,
        whitelabel_config: null,
      },
      base,
    )
    expect(config.brand.name).toBe("Harven")
    expect(config.brand.logo).toBe("/logos/harven.png")
    expect(config.brand.primaryColor).toBe("#0A0A0A")
    expect(config.modules).toEqual(["units"])
  })
})
