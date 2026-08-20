import { MODULE_IDS, type ModuleId, type TenantConfig } from "@eximia/shared"

// ===========================================================================
// A IDENTIDADE DO CLIENTE VEM DE VARIÁVEL DE AMBIENTE DE BUILD, NÃO DO GIT.
//
// O DEFEITO QUE ISTO CORRIGE
// --------------------------
// `src/lib/tenant.ts:1` faz `import tenantConfig from "../../tenant.config"`.
// Import estático, resolvido em BUILD. Enquanto a identidade do cliente for
// literal TypeScript dentro do bundle, dar marca diferente a clientes
// diferentes exige dar CÓDIGO diferente — e a branch por cliente
// (`deploy/{client}`) é a consequência mecânica disso, não uma escolha.
//
// Pior: os arquivos de marca NÃO conflitam num merge, porque só a branch do
// cliente os toca. O git entrega a marca de um cliente para `main` EM
// SILÊNCIO. Depois de `deploy/cory` virar ancestral de `main`, um `git pull`
// de rotina passaria a APAGAR a marca por fast-forward puro, sem conflito e
// sem aviso — trocando um pedágio caro e barulhento por um silencioso.
//
// POR QUE `NEXT_PUBLIC_` E POR QUE ACESSO LITERAL (não é estilo, é o único
// jeito que funciona)
// -------------------------------------------------------------------------
// `src/app/workspace/_components/workspace-picker.tsx:1` é `"use client"` e
// importa `@/lib/tenant` na linha 5. Ou seja: ESTE arquivo entra também no
// bundle do NAVEGADOR, onde `process.env` não existe. O único valor que
// sobrevive é o que o Next INLINA em build, e o Next só inlina
// `process.env.NEXT_PUBLIC_X` escrito por extenso. Acesso dinâmico
// (`process.env[chave]`) NÃO é substituído: viraria `undefined` no browser, a
// picker mostraria a marca neutra e o resto do app mostraria a do cliente.
// Marca partida ao meio, sem um único erro. Por isso cada variável aparece
// uma vez, literal. É repetitivo de propósito.
//
// ESTE ARQUIVO NUNCA LANÇA
// -------------------------
// Quem reprova é `scripts/verificar-marca.mjs`, rodado ANTES do build (ver
// Dockerfile). Um `throw` em escopo de módulo não é gate confiável — o Next
// pode nem avaliar o módulo durante `next build` — e, se disparasse, cairia
// em tempo de REQUISIÇÃO, derrubando produção. Um `exit != 0` no verificador
// só pode derrubar o build. Maker separado do checker.
// ===========================================================================

/** `""` é ausência: o EasyPanel grava string vazia quando o campo fica em branco. */
function texto(v: string | undefined): string | undefined {
  const t = (v ?? "").trim()
  return t === "" ? undefined : t
}

// --- Leitura literal. NÃO trocar por acesso dinâmico (ver cabeçalho). ------
const ENV = {
  slug: texto(process.env.NEXT_PUBLIC_TENANT_SLUG),
  name: texto(process.env.NEXT_PUBLIC_TENANT_NAME),
  logo: texto(process.env.NEXT_PUBLIC_TENANT_LOGO),
  logoLight: texto(process.env.NEXT_PUBLIC_TENANT_LOGO_LIGHT),
  favicon: texto(process.env.NEXT_PUBLIC_TENANT_FAVICON),
  primaryColor: texto(process.env.NEXT_PUBLIC_TENANT_PRIMARY_COLOR),
  accentColor: texto(process.env.NEXT_PUBLIC_TENANT_ACCENT_COLOR),
  modules: texto(process.env.NEXT_PUBLIC_TENANT_MODULES),
  partnerName: texto(process.env.NEXT_PUBLIC_TENANT_PARTNER_NAME),
  partnerLogo: texto(process.env.NEXT_PUBLIC_TENANT_PARTNER_LOGO),
  footerText: texto(process.env.NEXT_PUBLIC_TENANT_FOOTER_TEXT),
  supportEmail: texto(process.env.NEXT_PUBLIC_TENANT_SUPPORT_EMAIL),
  orgTree: texto(process.env.NEXT_PUBLIC_TENANT_ORG_TREE),
  maxInteractions: texto(process.env.NEXT_PUBLIC_TENANT_MAX_INTERACTIONS),
  sessionTimeoutHours: texto(process.env.NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS),
} as const

// ---------------------------------------------------------------------------
// O NEUTRO. Não é "a eximIA como cliente": é a AUSÊNCIA de cliente.
// Cada valor abaixo é byte a byte o que a branch `main` produzia antes desta
// mudança, para que um build sem env nenhuma tenha ZERO alteração de
// comportamento.
// ---------------------------------------------------------------------------
const NEUTRO = {
  name: "eximIA Academy",
  slug: "demo",
  logo: "/brand/logo.png",
  logoLight: "/brand/logo-color.png",
  favicon: "/brand/favicon.ico",
  primaryColor: "#2a6ab0",
  accentColor: "#C4A882",
  modules: [
    "assessments",
    "biblioteca",
    "community",
    "course-designer",
    "units",
    "integrations",
  ] as ModuleId[],
} as const

const HEX = /^#[0-9a-fA-F]{6}$/
const cor = (v: string | undefined, padrao: string) => (v && HEX.test(v) ? v : padrao)

/**
 * CSV -> ModuleId[]. Tokens desconhecidos são DESCARTADOS aqui e reprovados
 * pelo verificador. Deixá-los passar seria pior: `getEnabledModules`
 * (registry.ts) já filtra por `MODULE_IDS` em silêncio, então um typo na env
 * tiraria do cliente um módulo que ele comprou, sem produzir um único erro.
 */
function modulos(csv: string | undefined): ModuleId[] | undefined {
  if (!csv) return undefined
  const validos = new Set<string>(MODULE_IDS)
  return csv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t): t is ModuleId => validos.has(t))
}

const booleano = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true"

function inteiro(v: string | undefined, padrao: number): number {
  const n = Number.parseInt(v ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : padrao
}

// ---------------------------------------------------------------------------
// Resolução
// ---------------------------------------------------------------------------
const modulosDaEnv = modulos(ENV.modules)

const config: TenantConfig = {
  brand: {
    name: ENV.name ?? NEUTRO.name,
    slug: ENV.slug ?? NEUTRO.slug,
    logo: ENV.logo ?? NEUTRO.logo,
    logoLight: ENV.logoLight ?? ENV.logo ?? NEUTRO.logoLight,
    favicon: ENV.favicon ?? NEUTRO.favicon,
    primaryColor: cor(ENV.primaryColor, NEUTRO.primaryColor),
    accentColor: cor(ENV.accentColor, NEUTRO.accentColor),
    ...(ENV.partnerName ? { partnerName: ENV.partnerName } : {}),
    ...(ENV.partnerLogo ? { partnerLogo: ENV.partnerLogo } : {}),
  },
  modules: modulosDaEnv && modulosDaEnv.length > 0 ? modulosDaEnv : NEUTRO.modules,
  ...(booleano(ENV.orgTree) ? { features: { orgTree: true } } : {}),
  settings: {
    maxInteractionsPerSession: inteiro(ENV.maxInteractions, 10),
    sessionTimeoutHours: inteiro(ENV.sessionTimeoutHours, 24),
    ...(ENV.footerText ? { footerText: ENV.footerText } : {}),
    ...(ENV.supportEmail ? { supportEmail: ENV.supportEmail } : {}),
    // `customCSS` NÃO é exposto por env de propósito: ele desemboca em
    // `dangerouslySetInnerHTML` ((platform)/layout.tsx). Quem edita o serviço
    // no EasyPanel passaria a injetar CSS arbitrário na página. Nenhuma das
    // duas branches usa o campo hoje. Foco por subtração.
  },
}

export default config
