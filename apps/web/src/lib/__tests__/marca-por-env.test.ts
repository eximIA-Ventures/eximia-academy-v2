import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// TESTE DE MUTAÇÃO DA MARCA POR ENV DE BUILD
//
// O QUE ESTE TESTE PROVA, E O QUE ELE **NÃO** PROVA
// -------------------------------------------------
// PROVA: a RESOLUÇÃO de `apps/web/tenant.config.ts` — sem env, marca neutra;
// com env, marca do cliente; e cada campo vem da variável certa.
// NÃO PROVA: o *inline* do Next no bundle do navegador. Aqui
// `process.env.X` é lookup em tempo de execução; no bundle o Next SUBSTITUI a
// expressão em build. São mecanismos diferentes. A propriedade que faz o
// inline funcionar — acesso LITERAL, nunca `process.env[chave]` — é coberta
// pelo último bloco, que lê o código-fonte. A prova de ponta a ponta é o
// `next build` real, fora daqui.
//
// POR QUE NÃO SE MEDE ISTO COM `grep -c "Argos" == 0`
// ---------------------------------------------------
// Duas razões, ambas medidas neste repo:
//  1. "Argos" JÁ APARECE 12 vezes em `src/app/brandbook/` num build NEUTRO
//     (título, rodapé, seção de identidade). Um gate de ausência global
//     reprovaria o build neutro, que é o correto.
//  2. "Argos" é substring de "Cargos", palavra comum na UI de admin: num
//     fixture com `Cargos/cargos/Argos`, `grep -ic argos` conta 3 e só 1 é
//     real.
// Por isso a asserção é sobre os VALORES QUE A CONFIG PRODUZ, não sobre a
// presença da palavra em lugar nenhum.
// ===========================================================================

const CAMINHO_CONFIG = "../../../tenant.config"

/** As 15 variáveis que a marca lê. Zerar TODAS é o que define "build neutro". */
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

async function carregarConfigCom(env: Record<string, string>) {
  vi.resetModules()
  for (const k of CHAVES) vi.stubEnv(k, "")
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  const mod = await import(CAMINHO_CONFIG)
  return mod.default
}

/** A marca real do cliente Cory Alimentos, como vive hoje em `deploy/cory`. */
const MARCA_DO_CLIENTE = {
  NEXT_PUBLIC_TENANT_SLUG: "cory-alimentos",
  NEXT_PUBLIC_TENANT_NAME: "Argos Consultoria",
  NEXT_PUBLIC_TENANT_LOGO: "/logos/argos-academy-color.png",
  NEXT_PUBLIC_TENANT_LOGO_LIGHT: "/logos/argos-academy-color.png",
  NEXT_PUBLIC_TENANT_PRIMARY_COLOR: "#1E3A5F",
  NEXT_PUBLIC_TENANT_ACCENT_COLOR: "#C4A882",
  NEXT_PUBLIC_TENANT_MODULES: "biblioteca,units",
  NEXT_PUBLIC_TENANT_PARTNER_NAME: "exímIA Ventures",
  NEXT_PUBLIC_TENANT_PARTNER_LOGO: "/logos/eximia-horizontal-academy.svg",
  NEXT_PUBLIC_TENANT_FOOTER_TEXT: "© 2026 Argos Consultoria · Powered by exímIA Academy",
  NEXT_PUBLIC_TENANT_SUPPORT_EMAIL: "suporte@eximiaventures.com.br",
}

/** Só os campos que a config PRODUZ — o universo em que a marca pode vazar. */
function textoProduzido(config: {
  brand: Record<string, unknown>
  settings?: Record<string, unknown>
}): string {
  return JSON.stringify({ brand: config.brand, settings: config.settings ?? {} })
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("marca por env de build", () => {
  describe("SEM env: build neutro", () => {
    it("produz a identidade neutra, byte a byte igual ao que `main` produzia", async () => {
      const config = await carregarConfigCom({})

      expect(config.brand).toMatchObject({
        name: "eximIA Academy",
        slug: "demo",
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

    it("não vaza NENHUM campo de parceiro nem de rodapé do cliente", async () => {
      const config = await carregarConfigCom({})
      expect(config.brand.partnerName).toBeUndefined()
      expect(config.brand.partnerLogo).toBeUndefined()
      expect(config.settings?.footerText).toBeUndefined()
      expect(config.settings?.supportEmail).toBeUndefined()
      expect(config.features).toBeUndefined()
    })

    it("zero mencao ao cliente nos campos que a config PRODUZ", async () => {
      const config = await carregarConfigCom({})
      const produzido = textoProduzido(config)

      // Palavra inteira, e só no que a config produz: "Argos" é substring de
      // "Cargos" e já existe 12x no /brandbook num build legitimamente neutro.
      expect(produzido).not.toMatch(/\bArgos\b/)
      expect(produzido).not.toContain("cory-alimentos")
      expect(produzido).not.toContain("suporte@eximiaventures.com.br")
    })
  })

  describe("COM env: a marca do cliente aparece", () => {
    it("cada campo vem da variavel correspondente", async () => {
      const config = await carregarConfigCom(MARCA_DO_CLIENTE)

      expect(config.brand.name).toBe("Argos Consultoria")
      expect(config.brand.slug).toBe("cory-alimentos")
      expect(config.brand.logo).toBe("/logos/argos-academy-color.png")
      expect(config.brand.logoLight).toBe("/logos/argos-academy-color.png")
      expect(config.brand.primaryColor).toBe("#1E3A5F")
      expect(config.brand.partnerName).toBe("exímIA Ventures")
      expect(config.settings?.supportEmail).toBe("suporte@eximiaventures.com.br")
      expect(config.modules).toEqual(["biblioteca", "units"])
    })

    it("a MESMA assercao de ausencia que passou no neutro agora REPROVA (controle positivo)", async () => {
      const config = await carregarConfigCom(MARCA_DO_CLIENTE)
      const produzido = textoProduzido(config)

      // Se este bloco passasse nos DOIS estados, o detector do teste neutro
      // seria cego e a prova de ausencia, vazia.
      expect(produzido).toMatch(/\bArgos\b/)
      expect(produzido).toContain("cory-alimentos")
      expect(produzido).toContain("suporte@eximiaventures.com.br")
    })

    it("o favicon NAO vem junto de graca: sem a variavel, continua o neutro", async () => {
      const config = await carregarConfigCom(MARCA_DO_CLIENTE)
      // `deploy/cory` tambem servia o favicon da eximIA (blob identico ao de
      // `main`). O comportamento e preservado de proposito: quem quiser trocar
      // define NEXT_PUBLIC_TENANT_FAVICON.
      expect(config.brand.favicon).toBe("/brand/favicon.ico")
    })
  })

  describe("estados intermediarios (o que discrimina de verdade)", () => {
    it("so o NOME definido troca o nome e mais NADA", async () => {
      const config = await carregarConfigCom({ NEXT_PUBLIC_TENANT_NAME: "Argos Consultoria" })
      expect(config.brand.name).toBe("Argos Consultoria")
      expect(config.brand.slug).toBe("demo")
      expect(config.brand.logo).toBe("/brand/logo.png")
    })

    it("string vazia e ausencia (o EasyPanel grava '' em campo em branco)", async () => {
      const config = await carregarConfigCom({
        NEXT_PUBLIC_TENANT_NAME: "   ",
        NEXT_PUBLIC_TENANT_SLUG: "",
      })
      expect(config.brand.name).toBe("eximIA Academy")
      expect(config.brand.slug).toBe("demo")
    })

    it("logoLight ausente cai em logo, nunca no neutro", async () => {
      const config = await carregarConfigCom({
        NEXT_PUBLIC_TENANT_SLUG: "x",
        NEXT_PUBLIC_TENANT_NAME: "X",
        NEXT_PUBLIC_TENANT_LOGO: "/logos/x.png",
      })
      // O erro que isto impede: tema claro (o default que quase todo usuario
      // ve) servindo o logo da eximIA enquanto o escuro serve o do cliente.
      expect(config.brand.logoLight).toBe("/logos/x.png")
    })

    it("cor invalida cai no neutro em vez de emitir CSS quebrado", async () => {
      const config = await carregarConfigCom({ NEXT_PUBLIC_TENANT_PRIMARY_COLOR: "azul" })
      expect(config.brand.primaryColor).toBe("#2a6ab0")
    })

    it("token de modulo desconhecido e descartado, e a lista nao fica vazia", async () => {
      const config = await carregarConfigCom({
        NEXT_PUBLIC_TENANT_MODULES: "biblioteca,inexistente",
      })
      expect(config.modules).toEqual(["biblioteca"])
    })

    it("CSV inteiramente invalido cai no conjunto neutro (e o verificador reprova)", async () => {
      const config = await carregarConfigCom({ NEXT_PUBLIC_TENANT_MODULES: "xxx,yyy" })
      expect(config.modules).toContain("biblioteca")
      expect(config.modules.length).toBeGreaterThan(2)
    })

    it("orgTree so liga com 1/true", async () => {
      expect(
        (await carregarConfigCom({ NEXT_PUBLIC_TENANT_ORG_TREE: "1" })).features?.orgTree,
      ).toBe(true)
      expect(
        (await carregarConfigCom({ NEXT_PUBLIC_TENANT_ORG_TREE: "true" })).features?.orgTree,
      ).toBe(true)
      expect(
        (await carregarConfigCom({ NEXT_PUBLIC_TENANT_ORG_TREE: "0" })).features,
      ).toBeUndefined()
      expect(
        (await carregarConfigCom({ NEXT_PUBLIC_TENANT_ORG_TREE: "sim" })).features,
      ).toBeUndefined()
    })
  })

  describe("a propriedade que faz o INLINE do Next funcionar", () => {
    // `import.meta.url` no ambiente jsdom do vitest NAO e file://, entao a
    // resolucao e por `cwd` (vitest roda em apps/web). Path errado tem que
    // FALHAR ALTO: um `readFileSync` que estoura seria confundido com defeito,
    // e pior seria um arquivo lido em silencio que nao fosse este.
    const caminhoFonte = resolve(process.cwd(), "tenant.config.ts")
    if (!existsSync(caminhoFonte)) {
      throw new Error(
        `Nao achei tenant.config.ts em ${caminhoFonte} (cwd=${process.cwd()}). Rode o vitest a partir de apps/web.`,
      )
    }
    const fonte = readFileSync(caminhoFonte, "utf8")

    // O gate mede CÓDIGO, não prosa. A primeira versão deste teste grepava o
    // arquivo inteiro e REPROVOU por achar `process.env[chave]` dentro do
    // comentário que EXPLICA por que essa forma é proibida — o detector
    // acusando a própria documentação. Apagar a explicação faria o teste
    // passar por vacuidade; tirar os comentários da MEDIÇÃO é o certo.
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

    it("a remocao de comentarios nao apagou o codigo (controle positivo do detector)", () => {
      // Sem isto, um `codigo` vazio faria TODAS as asserções de ausência
      // abaixo passarem — prova vazia com cara de prova.
      expect(codigo).toContain("process.env.NEXT_PUBLIC_TENANT_SLUG")
      expect(codigo).toContain("const config: TenantConfig")
      expect(codigo.length).toBeGreaterThan(1000)
    })

    it("acessa cada variavel de forma LITERAL, nunca por indice dinamico", () => {
      // Acesso dinamico NAO e substituido pelo Next: viraria `undefined` no
      // bundle do navegador (workspace-picker.tsx e "use client" e importa
      // @/lib/tenant). Resultado: marca partida ao meio, sem um unico erro.
      expect(codigo).not.toMatch(/process\.env\s*\[/)

      for (const chave of CHAVES) {
        expect(codigo).toContain(`process.env.${chave}`)
      }
    })

    it("a assercao de ausencia REPROVA quando o defeito e reintroduzido (controle positivo)", () => {
      const comDefeito = codigo.replace(
        "process.env.NEXT_PUBLIC_TENANT_SLUG",
        'process.env["NEXT_PUBLIC_TENANT_SLUG"]',
      )
      expect(comDefeito).not.toBe(codigo) // a mutacao ACERTOU o alvo
      expect(comDefeito).toMatch(/process\.env\s*\[/) // e o detector a pega
    })

    it("toda variavel de marca usa o prefixo NEXT_PUBLIC_ (senao nao cruza para o cliente)", () => {
      const lidas = [...codigo.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1])
      expect(lidas.length).toBeGreaterThan(0)
      for (const v of lidas) expect(v).toMatch(/^NEXT_PUBLIC_/)
    })

    it("nao lanca em escopo de modulo (quem reprova e o verificador, fora do build)", () => {
      expect(codigo).not.toMatch(/^\s*throw /m)
    })
  })
})
