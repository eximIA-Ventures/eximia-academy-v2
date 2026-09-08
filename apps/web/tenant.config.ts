import {
  MODULE_IDS,
  type ModuleId,
  RESERVED_SLUGS,
  type TenantConfig,
  isReservedSlug,
} from "@eximia/shared"

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
// mesmo artefato serve todas as empresas. Este arquivo ficou com quatro
// coisas, e só elas:
//
//   1. `NEUTRO` — a AUSÊNCIA de cliente (D5). Não é "a eximIA como cliente":
//      é o que se serve quando o host não aponta para empresa nenhuma. O slug
//      é `__neutro__` justamente para NUNCA casar com uma linha de `tenants`
//      — o antigo `demo` casava com o tenant real criado por
//      `supabase/seed.sql`, e "host desconhecido" acabava servindo a marca de
//      uma empresa existente.
//   2. `marcaDaInstancia()` — a marca da PLATAFORMA deste serviço, lida das
//      `PLATFORM_*` em runtime. Ver o bloco "INSTÂNCIA" logo abaixo.
//   3. `configDoAmbiente()` — o parser das `NEXT_PUBLIC_TENANT_*`, que continua
//      vivo como MODO LEGADO (D2, passo 3): o serviço de um cliente único que
//      ainda não migrou para resolução por host segue funcionando com as mesmas
//      variáveis do EasyPanel, sem redeploy coordenado.
//   4. `RESERVED_SLUGS` — os rótulos que não podem virar subdomínio de empresa.
//
// O QUE É UMA INSTÂNCIA (e por que ela não é um tenant)
// -----------------------------------------------------
// "eximIA Academy" e "Argos Academy" são a MESMA imagem Docker rodando em
// dois serviços do EasyPanel, cada um com seu projeto Supabase, seu domínio
// base e sua marca de plataforma. A Argos não é cliente: é OPERADORA de uma
// instância, com super_admin próprio, que cadastra as empresas dela.
//
// Dentro de cada instância o multi-tenant por host continua igual (D1-D5). O
// que era eximIA cravado no código é só a marca da PORTA DE ENTRADA — o
// `app.{base}`, a empresa sem marca própria, o e-mail, o favicon, o título.
// Isso virou `PLATFORM_*`, lido do PROCESSO. Não é `NEXT_PUBLIC_` e não é
// build arg de propósito: com valor inlinado em build, a Argos precisaria de
// uma IMAGEM própria, que é exatamente o que a faxina desfez.
//
// `PLATFORM_SLUG` identifica a INSTÂNCIA (`eximia`, `argos`), NUNCA um tenant:
// o slug do neutro continua `__neutro__` (D5), e nenhuma linha de `tenants` é
// alcançável por ele.
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
 * Reexportado de `@eximia/shared` (`validators/whitelabel.ts`) — era uma
 * segunda cópia mantida aqui à mão, e duas listas de reservados divergem na
 * primeira vez que alguém acrescentar um rótulo em só uma delas. A MESMA
 * lista também é validada dentro de `provisionar_tenant`
 * (`supabase/migrations/20260906003000_provisionamento_de_tenant.sql`): o
 * banco é a trava real (o app pode ser contornado), o app é quem dá a
 * mensagem de erro decente antes de chamar a RPC.
 */
export { RESERVED_SLUGS }

export function ehSlugReservado(slug: string): boolean {
  return isReservedSlug(slug)
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

// ---------------------------------------------------------------------------
// A MARCA DA INSTÂNCIA (`PLATFORM_*`)
// ---------------------------------------------------------------------------

/** Identidade da instância. NUNCA um tenant, NUNCA uma trava de acesso. */
export interface InstanciaDaPlataforma {
  /** `PLATFORM_SLUG` normalizado. `eximia` quando a variável não existe. */
  slug: string
  /** O nome de marca que a porta de entrada exibe (`PLATFORM_BRAND_NAME`). */
  brandName: string
}

/** O mesmo `^[a-z0-9-]{1,50}$` dos slugs de empresa — um rótulo, não uma frase. */
const SLUG_DE_INSTANCIA = /^[a-z0-9-]{1,50}$/

/**
 * Qual instância é esta: `eximia` (o default) ou o que `PLATFORM_SLUG` disser.
 *
 * Serve para personalização (copy, ilustração, uma feature flag por instância
 * = `instancia.slug === "argos"`). NUNCA para AUTORIZAÇÃO: o valor é uma
 * variável do serviço, não uma afirmação verificada sobre quem está pedindo.
 * Quem decide o que cada pessoa lê continua sendo a RLS, com o JWT dela.
 */
export function slugDaInstancia(): string {
  const bruto = env("PLATFORM_SLUG")?.toLowerCase()
  return bruto && SLUG_DE_INSTANCIA.test(bruto) ? bruto : "eximia"
}

/**
 * A `TenantConfig` da INSTÂNCIA: o NEUTRO eximIA sobreposto, campo a campo,
 * pelo que vier das `PLATFORM_*`.
 *
 * Sem nenhuma variável o resultado é o NEUTRO byte a byte — é isso que mantém
 * o serviço eximIA idêntico ao que ele era antes desta rodada.
 *
 * É uma FUNÇÃO, não uma constante de módulo, pela mesma razão de
 * `configDoAmbiente()`: uma constante congelaria o env do primeiro
 * carregamento e trocar a marca da instância exigiria restart, não deploy.
 *
 * `customCSS` não é exposto aqui pelo mesmo motivo do modo legado e do banco
 * (D4): ele desemboca em `dangerouslySetInnerHTML`.
 */
export function marcaDaInstancia(): TenantConfig {
  const logo = env("PLATFORM_BRAND_LOGO")
  const parceiroNome = env("PLATFORM_BRAND_PARTNER_NAME")
  const parceiroLogo = env("PLATFORM_BRAND_PARTNER_LOGO")
  const rodape = env("PLATFORM_FOOTER_TEXT")
  const suporte = env("PLATFORM_SUPPORT_EMAIL")
  const modulosDaEnv = modulos(env("PLATFORM_MODULES"))

  return {
    brand: {
      name: env("PLATFORM_BRAND_NAME") ?? NEUTRO.brand.name,
      // O slug continua `__neutro__` (D5). `PLATFORM_SLUG` é outra coisa: ele
      // identifica o SERVIÇO. Escrevê-lo aqui faria "argos" virar um slug de
      // tenant procurável em `tenants`, que é o defeito que a D5 fechou.
      slug: NEUTRO.brand.slug,
      logo: logo ?? NEUTRO.brand.logo,
      // Sem `LOGO_LIGHT` explícito, o tema claro usa o logo da instância — e
      // não o da eximIA. Marca partida ao meio é o defeito que isto impede.
      logoLight: env("PLATFORM_BRAND_LOGO_LIGHT") ?? logo ?? NEUTRO.brand.logoLight,
      favicon: env("PLATFORM_BRAND_FAVICON") ?? NEUTRO.brand.favicon,
      primaryColor: cor(env("PLATFORM_BRAND_PRIMARY_COLOR"), NEUTRO.brand.primaryColor),
      accentColor: cor(env("PLATFORM_BRAND_ACCENT_COLOR"), NEUTRO.brand.accentColor),
      ...(parceiroNome ? { partnerName: parceiroNome } : {}),
      ...(parceiroLogo ? { partnerLogo: parceiroLogo } : {}),
    },
    modules: modulosDaEnv && modulosDaEnv.length > 0 ? modulosDaEnv : [...NEUTRO.modules],
    settings: {
      maxInteractionsPerSession: NEUTRO.settings?.maxInteractionsPerSession ?? 10,
      sessionTimeoutHours: NEUTRO.settings?.sessionTimeoutHours ?? 24,
      ...(rodape ? { footerText: rodape } : {}),
      ...(suporte ? { supportEmail: suporte } : {}),
    },
  }
}

/** `{slug, brandName}` da instância, para personalização — nunca autorização. */
export function instanciaDaPlataforma(): InstanciaDaPlataforma {
  return { slug: slugDaInstancia(), brandName: marcaDaInstancia().brand.name }
}

/**
 * O modo LEGADO (D2, passo 3): a marca das `NEXT_PUBLIC_TENANT_*` mesclada
 * sobre a MARCA DA INSTÂNCIA (que por sua vez é o NEUTRO sobreposto pelas
 * `PLATFORM_*`), campo a campo.
 *
 * O modo só LIGA quando `NEXT_PUBLIC_TENANT_SLUG` existe, e isso é a parte que
 * importa desde que há mais de uma instância: um serviço da Argos clonado de
 * um serviço antigo carrega `NEXT_PUBLIC_TENANT_NAME` esquecido no painel, e
 * sem esta trava esse resíduo sobreporia em silêncio a marca de plataforma da
 * instância inteira. Sem slug não há cliente único declarado — logo não há
 * modo legado, e a base da instância passa intacta. (É a mesma condição que a
 * rota `importar-marca-do-ambiente` (D20) já exige para copiar essas
 * variáveis para o banco.)
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
  const base = marcaDaInstancia()
  const slug = env("NEXT_PUBLIC_TENANT_SLUG")
  if (!slug) return base

  const nome = env("NEXT_PUBLIC_TENANT_NAME")
  const logo = env("NEXT_PUBLIC_TENANT_LOGO")
  const logoClaro = env("NEXT_PUBLIC_TENANT_LOGO_LIGHT")
  const favicon = env("NEXT_PUBLIC_TENANT_FAVICON")
  const modulosDaEnv = modulos(env("NEXT_PUBLIC_TENANT_MODULES"))
  // Parceiro/rodapé/suporte HERDAM a instância quando a env do cliente não os
  // declara: numa instância da Argos, a empresa sem marca própria é "Cory
  // Academy by Argos", não "Cory Academy" solta.
  const parceiroNome = env("NEXT_PUBLIC_TENANT_PARTNER_NAME") ?? base.brand.partnerName
  const parceiroLogo = env("NEXT_PUBLIC_TENANT_PARTNER_LOGO") ?? base.brand.partnerLogo
  const rodape = env("NEXT_PUBLIC_TENANT_FOOTER_TEXT") ?? base.settings?.footerText
  const suporte = env("NEXT_PUBLIC_TENANT_SUPPORT_EMAIL") ?? base.settings?.supportEmail

  return {
    brand: {
      name: nome ?? base.brand.name,
      slug,
      logo: logo ?? base.brand.logo,
      logoLight: logoClaro ?? logo ?? base.brand.logoLight,
      favicon: favicon ?? base.brand.favicon,
      primaryColor: cor(env("NEXT_PUBLIC_TENANT_PRIMARY_COLOR"), base.brand.primaryColor),
      accentColor: cor(env("NEXT_PUBLIC_TENANT_ACCENT_COLOR"), base.brand.accentColor),
      ...(parceiroNome ? { partnerName: parceiroNome } : {}),
      ...(parceiroLogo ? { partnerLogo: parceiroLogo } : {}),
    },
    modules: modulosDaEnv && modulosDaEnv.length > 0 ? modulosDaEnv : base.modules,
    ...(booleano(env("NEXT_PUBLIC_TENANT_ORG_TREE")) ? { features: { orgTree: true } } : {}),
    settings: {
      maxInteractionsPerSession: inteiro(
        env("NEXT_PUBLIC_TENANT_MAX_INTERACTIONS"),
        base.settings?.maxInteractionsPerSession ?? 10,
      ),
      sessionTimeoutHours: inteiro(
        env("NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS"),
        base.settings?.sessionTimeoutHours ?? 24,
      ),
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
