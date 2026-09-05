import { MODULE_IDS, type ModuleId, type TenantConfig } from "@eximia/shared"

// ===========================================================================
// O QUE SOBROU DESTE ARQUIVO, E POR QUE ELE ENCOLHEU
//
// Ele já foi a identidade do cliente. Era `import tenantConfig from
// "../../tenant.config"` dentro de `src/lib/tenant.ts` — import estático,
// resolvido em BUILD —, então dar marca diferente a clientes diferentes exigia
// dar CÓDIGO (ou ao menos ARTEFATO) diferente: uma branch `deploy/{cliente}`,
// ou 16 `ARG`/`ENV` de marca no Dockerfile. Um app, um cliente.
//
// A marca agora vem do BANCO, resolvida por HOST a cada requisição
// (`src/lib/tenant/resolver.ts` → `src/lib/tenant.ts`, decisões D1/D2/D4). O
// mesmo artefato serve todas as empresas. Este arquivo ficou com três coisas,
// e só elas:
//
//   1. `NEUTRO` — a AUSÊNCIA de cliente (D5). Não é "a eximIA como cliente":
//      é o que se serve quando o host não aponta para empresa nenhuma. O slug
//      é `__neutro__` justamente para NUNCA casar com uma linha de `tenants`
//      — o antigo `demo` casava com o tenant real criado por
//      `supabase/seed.sql`, e "host desconhecido" acabava servindo a marca de
//      uma empresa existente.
//   2. `configDoAmbiente()` — o parser das `NEXT_PUBLIC_TENANT_*`, que continua
//      vivo como MODO LEGADO (D2, passo 3): o serviço de um cliente único que
//      ainda não migrou para resolução por host segue funcionando com as mesmas
//      variáveis do EasyPanel, sem redeploy coordenado.
//   3. `RESERVED_SLUGS` — os rótulos que não podem virar subdomínio de empresa.
//
// POR QUE O ACESSO A `process.env` DEIXOU DE SER LITERAL
// ------------------------------------------------------
// Antes cada variável aparecia escrita por extenso, de propósito: o
// `workspace-picker.tsx` é `"use client"` e importava `@/lib/tenant`, logo este
// módulo entrava no bundle do NAVEGADOR, onde `process.env` não existe — só
// sobrevivia o que o Next INLINA em build, e o Next só inlina
// `process.env.NEXT_PUBLIC_X` escrito por extenso.
//
// O picker parou de importar daqui (recebe `brand` por prop do Server
// Component pai). Sem cliente nenhum no caminho, este módulo é código de
// SERVIDOR, e no servidor `process.env[chave]` é lido em RUNTIME. Isso é o
// ponto, não um detalhe de estilo: com leitura literal o valor fica cravado no
// artefato em build, e trocar a marca do serviço legado exigiria rebuild.
// ===========================================================================

/**
 * Rótulos que não podem virar subdomínio de empresa (D5).
 *
 * `demo` está na lista porque `supabase/seed.sql` cria um tenant REAL com esse
 * slug. `neutro` e `__neutro__` estão porque são o nome da ausência — deixá-los
 * livres permitiria cadastrar uma empresa que sequestra o caso "sem empresa".
 *
 * A MESMA lista é validada dentro de `provisionar_tenant`
 * (`supabase/migrations/20260906003000_provisionamento_de_tenant.sql`). Duas
 * cópias, de propósito: o banco é a trava real (o app pode ser contornado), o
 * app é quem dá a mensagem de erro decente antes de chamar a RPC.
 */
export const RESERVED_SLUGS = [
  "www",
  "app",
  "api",
  "admin",
  "central",
  "academy",
  "demo",
  "neutro",
  "__neutro__",
] as const

export function ehSlugReservado(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug)
}

/** `""` é ausência: o EasyPanel grava string vazia quando o campo fica em branco. */
function texto(v: string | undefined): string | undefined {
  const t = (v ?? "").trim()
  return t === "" ? undefined : t
}

/**
 * Leitura de env em RUNTIME, no servidor.
 *
 * Acesso dinâmico de propósito (ver cabeçalho): o Next NÃO substitui
 * `process.env[chave]` em build, então o valor é o do processo, não o do
 * artefato. Este módulo não pode ser importado por componente `"use client"`
 * — lá `process.env` não existe e tudo cairia no NEUTRO em silêncio.
 */
function env(chave: string): string | undefined {
  return texto(process.env[chave])
}

// ---------------------------------------------------------------------------
// O NEUTRO. Não é "a eximIA como cliente": é a AUSÊNCIA de cliente.
// Os valores são byte a byte os que a branch `main` produzia antes da faxina,
// exceto o `slug` (`demo` -> `__neutro__`, D5).
// ---------------------------------------------------------------------------
export const NEUTRO: TenantConfig = {
  brand: {
    name: "eximIA Academy",
    slug: "__neutro__",
    logo: "/brand/logo.png",
    logoLight: "/brand/logo-color.png",
    favicon: "/brand/favicon.ico",
    primaryColor: "#2a6ab0",
    accentColor: "#C4A882",
  },
  modules: ["assessments", "biblioteca", "community", "course-designer", "units", "integrations"],
  settings: {
    maxInteractionsPerSession: 10,
    sessionTimeoutHours: 24,
  },
}

const HEX = /^#[0-9a-fA-F]{6}$/
const cor = (v: string | undefined, padrao: string) => (v && HEX.test(v) ? v : padrao)

/**
 * CSV -> ModuleId[]. Tokens desconhecidos são DESCARTADOS aqui. Deixá-los
 * passar seria pior: `getEnabledModules` (registry.ts) já filtra por
 * `MODULE_IDS` em silêncio, então um typo na env tiraria do cliente um módulo
 * que ele comprou, sem produzir um único erro.
 */
export function modulos(csv: string | undefined): ModuleId[] | undefined {
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

/**
 * O modo LEGADO (D2, passo 3): a marca das `NEXT_PUBLIC_TENANT_*` mesclada
 * sobre o NEUTRO, campo a campo.
 *
 * É uma FUNÇÃO, não uma constante de módulo, porque o valor tem que ser lido a
 * cada requisição: uma constante congelaria o env do primeiro carregamento do
 * módulo e voltaria a exigir rebuild para trocar a marca do serviço legado.
 *
 * `customCSS` NÃO é exposto por env de propósito: ele desemboca em
 * `dangerouslySetInnerHTML` e quem edita o serviço no EasyPanel passaria a
 * injetar CSS arbitrário na página. Pela MESMA razão ele também não vem do
 * banco (D4).
 */
export function configDoAmbiente(): TenantConfig {
  const slug = env("NEXT_PUBLIC_TENANT_SLUG")
  const nome = env("NEXT_PUBLIC_TENANT_NAME")
  const logo = env("NEXT_PUBLIC_TENANT_LOGO")
  const logoClaro = env("NEXT_PUBLIC_TENANT_LOGO_LIGHT")
  const favicon = env("NEXT_PUBLIC_TENANT_FAVICON")
  const parceiroNome = env("NEXT_PUBLIC_TENANT_PARTNER_NAME")
  const parceiroLogo = env("NEXT_PUBLIC_TENANT_PARTNER_LOGO")
  const rodape = env("NEXT_PUBLIC_TENANT_FOOTER_TEXT")
  const suporte = env("NEXT_PUBLIC_TENANT_SUPPORT_EMAIL")
  const modulosDaEnv = modulos(env("NEXT_PUBLIC_TENANT_MODULES"))

  return {
    brand: {
      name: nome ?? NEUTRO.brand.name,
      slug: slug ?? NEUTRO.brand.slug,
      logo: logo ?? NEUTRO.brand.logo,
      logoLight: logoClaro ?? logo ?? NEUTRO.brand.logoLight,
      favicon: favicon ?? NEUTRO.brand.favicon,
      primaryColor: cor(env("NEXT_PUBLIC_TENANT_PRIMARY_COLOR"), NEUTRO.brand.primaryColor),
      accentColor: cor(env("NEXT_PUBLIC_TENANT_ACCENT_COLOR"), NEUTRO.brand.accentColor),
      ...(parceiroNome ? { partnerName: parceiroNome } : {}),
      ...(parceiroLogo ? { partnerLogo: parceiroLogo } : {}),
    },
    modules: modulosDaEnv && modulosDaEnv.length > 0 ? modulosDaEnv : [...NEUTRO.modules],
    ...(booleano(env("NEXT_PUBLIC_TENANT_ORG_TREE")) ? { features: { orgTree: true } } : {}),
    settings: {
      maxInteractionsPerSession: inteiro(env("NEXT_PUBLIC_TENANT_MAX_INTERACTIONS"), 10),
      sessionTimeoutHours: inteiro(env("NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS"), 24),
      ...(rodape ? { footerText: rodape } : {}),
      ...(suporte ? { supportEmail: suporte } : {}),
    },
  }
}

/** O slug do modo legado, sem montar a config inteira (D2, passo 3). */
export function slugDoAmbiente(): string | undefined {
  return env("NEXT_PUBLIC_TENANT_SLUG")
}

/** Domínio base da plataforma (D1). Ex.: `academy.eximiaventures.com.br`. */
export function dominioBase(): string | undefined {
  return env("NEXT_PUBLIC_APP_BASE_DOMAIN")?.toLowerCase()
}
