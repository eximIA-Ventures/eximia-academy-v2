import { MODULE_IDS, type ModuleId, type TenantConfig } from "@eximia/shared"

// ===========================================================================
// BANCO -> ENV LEGADO -> INSTÂNCIA -> NEUTRO, CAMPO A CAMPO (D4)
//
// A ordem completa, de quem vence para quem cede:
//
//   1. BANCO — `tenants.brand`, `tenants.modules`, `tenants.settings` e
//      `whitelabel_config` da empresa desta requisição.
//   2. ENV LEGADO — as `NEXT_PUBLIC_TENANT_*` do serviço de um cliente único
//      (D2, passo 3), e SÓ quando `NEXT_PUBLIC_TENANT_SLUG` existe: sem ele
//      não há cliente declarado, e um resíduo de env não pode repintar a
//      instância inteira.
//   3. INSTÂNCIA — a marca de PLATAFORMA deste serviço (`PLATFORM_*`).
//      "eximIA Academy" e "Argos Academy" são a mesma imagem em serviços
//      diferentes; a Argos não é cliente, é operadora de uma instalação.
//   4. NEUTRO — o eximIA de fábrica, quando nada disso existe.
//
// As camadas 2-4 chegam aqui já achatadas, no parâmetro `base`
// (`configDoAmbiente()` em `tenant.config.ts`). Esta função só resolve o topo
// da pilha: BANCO sobre `base`.
//
// A CONSEQUÊNCIA QUE IMPORTA: empresa cadastrada SEM marca própria herda a
// marca da INSTÂNCIA, não a da eximIA. Numa instalação da Argos que preencheu
// `PLATFORM_BRAND_PARTNER_*`, "Cory" aparece como "Cory Academy by Argos" —
// sem uma linha de configuração por empresa.
//
// `tenants.brand` PODE SER PARCIAL, e isso é legal: a RPC `provisionar_tenant`
// garante só `name` e `slug` (uma empresa pode ser cadastrada sem logo). Por
// isso a mescla é campo a campo sobre a base — assumir que a coluna traz o
// objeto inteiro produziria `logo: undefined` numa tag `<img>`. É essa mesma
// mescla por CAMPO que faz a herança da instância funcionar: o que a empresa
// não declara continua vindo de baixo.
//
// `customCSS` NUNCA entra aqui. Não é esquecimento: ele desemboca em
// `dangerouslySetInnerHTML` em 4 pontos do app e a coluna
// `whitelabel_config->>'custom_css'` é gravável por qualquer chapéu `admin` de
// cliente — seria XSS armazenado com formulário próprio. Ver
// `docs/faxina-2026-09/06-contrato-de-dados.md` §2.2.
//
// Esta função é PURA: recebe a linha e a base, devolve a config. É ela que os
// testes exercitam; a leitura do banco fica em `lib/tenant.ts`.
// ===========================================================================

/** As colunas de `tenants` que a marca consome. Nada de `branding`/`custom_css`. */
export interface LinhaDeTenant {
  id: string
  slug: string
  name: string
  brand: unknown
  modules: string[] | null
  settings: unknown
  whitelabel_config: unknown
}

/** As 7 colunas, na forma exata do `.select()`. Uma fonte, não duas. */
export const COLUNAS_DE_MARCA = "id, slug, name, brand, modules, settings, whitelabel_config"

function objeto(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** String não-vazia, ou `undefined`. `""` no jsonb é ausência, como no env. */
function texto(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined
  const t = v.trim()
  return t === "" ? undefined : t
}

const HEX = /^#[0-9a-fA-F]{6}$/
function corValida(v: unknown): string | undefined {
  const t = texto(v)
  return t && HEX.test(t) ? t : undefined
}

function inteiroPositivo(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Tokens fora de `MODULE_IDS` caem fora — o mesmo filtro do parser de env. */
function modulosValidos(brutos: string[] | null | undefined): ModuleId[] {
  if (!brutos || brutos.length === 0) return []
  const validos = new Set<string>(MODULE_IDS)
  return brutos.filter((m): m is ModuleId => validos.has(m))
}

/**
 * A ESCRITA de `tenants.brand`, do lado oposto de `montarConfigDoTenant`.
 *
 * Mora aqui, junto do leitor, de propósito: as duas telas que editam marca
 * (`admin/settings/actions.ts` e `admin/settings/whitelabel-actions.ts`) tinham
 * virado WRITE-ONLY quando a leitura passou a sair só de `brand` — cada uma
 * gravava a coluna legada dela e nada chegava à tela. Uma função de escrita
 * separada por tela seria a mesma divergência de novo, num arquivo diferente.
 *
 * A mescla é RASA e sobre o valor ATUAL: `brand` pode ser parcial, e cada tela
 * edita só uma fatia dela — sobrescrever o objeto inteiro apagaria `logoLight`,
 * `partnerName` ou o logo, conforme quem salvasse por último.
 *
 * `undefined` em `mudancas` REMOVE a chave, e essa é a parte que importa: em
 * `montarConfigDoTenant` chave ausente cai no fallback do NEUTRO, enquanto uma
 * string vazia gravada viraria `<img src="">` / `<link href="">` na página.
 */
export function mesclarBrand(
  atual: unknown,
  mudancas: Record<string, string | undefined>,
): Record<string, unknown> {
  const base = objeto(atual) ?? {}
  const removidas = new Set(
    Object.entries(mudancas)
      .filter(([, valor]) => valor === undefined)
      .map(([chave]) => chave),
  )
  return {
    ...Object.fromEntries(Object.entries(base).filter(([chave]) => !removidas.has(chave))),
    ...Object.fromEntries(Object.entries(mudancas).filter(([, valor]) => valor !== undefined)),
  }
}

/**
 * A `TenantConfig` de uma empresa: banco sobre `base` (que já é env legado
 * sobre a marca da instância sobre o NEUTRO), campo a campo.
 *
 * `linha === null` devolve a base intacta — é o caminho do host neutro e o do
 * tenant que sumiu do banco entre uma requisição e outra.
 */
export function montarConfigDoTenant(
  linha: LinhaDeTenant | null,
  base: TenantConfig,
): TenantConfig {
  if (!linha) return base

  const brand = objeto(linha.brand) ?? {}
  const settings = objeto(linha.settings) ?? {}
  const whitelabel = objeto(linha.whitelabel_config) ?? {}
  const features = objeto(settings.features) ?? {}

  const logo = texto(brand.logo) ?? base.brand.logo
  const modulos = modulosValidos(linha.modules)

  // `org_tree` só sai do banco quando a chave EXISTE; ausente, o env decide.
  // Um `false` gravado tem que vencer o env — por isso o teste é de presença
  // da chave, não de veracidade do valor.
  const orgTreeNoBanco = Object.hasOwn(features, "org_tree")
    ? features.org_tree === true
    : undefined
  const orgTree = orgTreeNoBanco ?? base.features?.orgTree ?? false

  const footerText = texto(whitelabel.footer_text) ?? base.settings?.footerText
  const supportEmail = texto(whitelabel.support_email) ?? base.settings?.supportEmail
  const partnerName = texto(brand.partnerName) ?? base.brand.partnerName
  const partnerLogo = texto(brand.partnerLogo) ?? base.brand.partnerLogo

  return {
    brand: {
      name: texto(brand.name) ?? linha.name,
      // O slug da IDENTIDADE é o da coluna, não o do jsonb: `tenants.slug` é o
      // que tem UNIQUE e o que o host canônico deriva. `brand.slug` é cópia.
      slug: linha.slug,
      logo,
      logoLight: texto(brand.logoLight) ?? logo,
      favicon: texto(brand.favicon) ?? base.brand.favicon,
      primaryColor: corValida(brand.primaryColor) ?? base.brand.primaryColor,
      accentColor: corValida(brand.accentColor) ?? base.brand.accentColor,
      ...(partnerName ? { partnerName } : {}),
      ...(partnerLogo ? { partnerLogo } : {}),
    },
    // `modules` vazio no banco = "não declarado" (a coluna nasceu com `'{}'` e
    // não foi backfillada), então cai na base. Não é "nenhum módulo".
    modules: modulos.length > 0 ? modulos : base.modules,
    ...(orgTree ? { features: { orgTree: true } } : {}),
    settings: {
      maxInteractionsPerSession:
        inteiroPositivo(settings.max_interactions_per_session) ??
        base.settings?.maxInteractionsPerSession ??
        10,
      // `sessionTimeoutHours` NÃO existe no banco (contrato §2.2): env ou 24.
      sessionTimeoutHours: base.settings?.sessionTimeoutHours ?? 24,
      ...(texto(settings.ai_model) ? { aiModel: texto(settings.ai_model) } : {}),
      ...(footerText ? { footerText } : {}),
      ...(supportEmail ? { supportEmail } : {}),
      // customCSS: ausente de propósito. Ver cabeçalho.
    },
  }
}
