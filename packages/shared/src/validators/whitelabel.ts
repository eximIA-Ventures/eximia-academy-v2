import { z } from "zod"
import { MODULE_DEFINITIONS, MODULE_IDS, type ModuleId } from "../modules/registry"

export const whitelabelConfigSchema = z.object({
  custom_texts: z
    .object({
      app_name: z.string().max(100).optional(),
      tagline: z.string().max(200).optional(),
      login_title: z.string().max(50).optional(),
      login_subtitle: z.string().max(200).optional(),
    })
    .optional(),
  favicon_url: z.string().url().nullable().optional(),
  footer_text: z.string().max(200).optional(),
  support_email: z.string().email().optional(),
  custom_css: z.string().max(5000).optional(),
})

export type WhitelabelConfigInput = z.infer<typeof whitelabelConfigSchema>

export const slugSchema = z
  .string()
  .min(3, "Slug deve ter no minimo 3 caracteres")
  .max(50, "Slug deve ter no maximo 50 caracteres")
  .regex(/^[a-z0-9]/, "Slug deve comecar com letra ou numero")
  .regex(/[a-z0-9]$/, "Slug deve terminar com letra ou numero")
  .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, numeros e hífens")

// ---------------------------------------------------------------------------
// Slugs reservados (D5 + `06-contrato-de-dados.md` §4.2)
// ---------------------------------------------------------------------------
// A MESMA lista que `provisionar_tenant` valida no banco. Existe dos dois lados
// de propósito: o banco é a trava (a RPC levanta `22023`), o zod é a mensagem
// legível — se só o banco validasse, o super_admin veria "erro 22023" em vez de
// "slug reservado".
//
// Esta é a cópia que o pacote compartilhado exporta, e é a que a rota e a tela
// de cadastro consomem. Se aparecer uma terceira cópia em `apps/web`, ela deve
// passar a importar daqui: duas listas de reservados divergem na primeira vez
// que alguém acrescentar um rótulo em só uma delas.
//
// `demo` está na lista porque `supabase/seed.sql` cria um tenant REAL com esse
// slug: resolver "host desconhecido" por ele cairia numa empresa existente em
// vez de "nenhuma".
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

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.trim().toLowerCase())
}

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------
// `module` é EXPOSIÇÃO DE UI, nunca permissão (AGENTS.md): ligar um módulo aqui
// não dá acesso a dado nenhum — quem autoriza continua sendo a RLS.
//
// Os 3 core (`academy`, `analytics`, `admin`) não são contratáveis: `getEnabledModules`
// (`modules/registry.ts`) já os liga em qualquer tenant. Gravá-los mesmo assim em
// `tenants.modules` é intencional — a coluna passa a descrever o estado real, e não
// "o que sobrou depois que alguém lembrou de somar os core".
export const CORE_MODULE_IDS: ModuleId[] = MODULE_IDS.filter((id) => MODULE_DEFINITIONS[id].core)

/** Os 6 que o super_admin marca no cadastro. */
export const CONTRACTABLE_MODULE_IDS: ModuleId[] = MODULE_IDS.filter(
  (id) => !MODULE_DEFINITIONS[id].core,
)

const moduleIdSchema = z.enum(MODULE_IDS)

/** Ordem canônica de `MODULE_IDS`, core sempre presentes, sem repetição. */
export function comModulosCore(modules: ModuleId[]): ModuleId[] {
  const pedidos = new Set<ModuleId>([...CORE_MODULE_IDS, ...modules])
  return MODULE_IDS.filter((id) => pedidos.has(id))
}

// ---------------------------------------------------------------------------
// Domínio próprio
// ---------------------------------------------------------------------------
// Só o domínio PRÓPRIO passa por aqui. O host canônico `{slug}.{base}` é derivado
// por string no app (D1) e nunca é digitado nem gravado em `tenant_domains`.
// Rótulos DNS válidos, minúsculos, ao menos um ponto, sem porta e sem esquema —
// os mesmos CHECKs de `tenant_domains` (`06-contrato-de-dados.md` §2.1).
const ROTULO_DNS = "[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
const HOST_RE = new RegExp(`^${ROTULO_DNS}(\\.${ROTULO_DNS})+$`)

export const customHostSchema = z
  .string()
  .min(4, "Domínio muito curto")
  .max(253, "Domínio muito longo")
  .regex(
    HOST_RE,
    "Domínio inválido. Use algo como academy.suaempresa.com.br, sem https:// e sem porta",
  )

// ---------------------------------------------------------------------------
// Marca (o shape de `tenants.brand`, que é `TenantConfig.brand`)
// ---------------------------------------------------------------------------
// `slug` NÃO entra: a RPC força `brand.slug = p_slug`, e aceitar os dois abriria
// a porta para uma marca dizer ser de outra empresa.
// `customCSS` NÃO entra, e isso é a decisão D4: o campo desemboca em
// `dangerouslySetInnerHTML` nos layouts, e quem grava marca é `admin` de cliente.
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor hexadecimal invalida")

export const tenantBrandInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logo: z.string().max(2000).optional(),
  logoLight: z.string().max(2000).optional(),
  favicon: z.string().max(2000).optional(),
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  partnerName: z.string().max(200).optional(),
  partnerLogo: z.string().max(2000).optional(),
})

export type TenantBrandInput = z.infer<typeof tenantBrandInputSchema>

// ---------------------------------------------------------------------------
// Cadastro de empresa (D10)
// ---------------------------------------------------------------------------
// Este schema é o corpo de `POST /api/admin/tenants` — o wizard de 3 passos do
// super_admin. Ele EVOLUIU do contrato que já existia aqui (name/slug/plan/
// branding/settings/initial_manager, sem nenhum chamador desde que foi escrito);
// não é um schema novo ao lado do antigo, porque duas definições de "empresa"
// divergiriam na primeira edição.
//
// O que mudou e por quê:
//   - `branding{logo_url,...}`     -> `brand{logo,...}`: o shape gravado passou a ser
//     `TenantConfig.brand` inteiro (D4), que é o que `tenants.brand` guarda;
//   - `settings` em snake_case     -> camelCase de `TenantConfig.settings`;
//   - `initial_manager{email,full_name,role}` -> `admin{email,fullName}`: o primeiro
//     usuário de uma empresa nova é `admin` do tenant, não `manager` — quem cadastra
//     a empresa precisa poder cadastrar gente, e `manager` não pode.
//   - `id` entrou porque o upload do logo acontece ANTES do POST (o path do bucket é
//     `tenant-assets/{tenantId}/logo.png`, §3 do contrato de dados). Ver comentário
//     abaixo.
const createTenantObjectSchema = z.object({
  /**
   * UUID escolhido pelo CLIENTE, opcional.
   *
   * O passo "Marca" do wizard sobe o logo para `tenant-assets/{tenantId}/logo.png`
   * antes de a empresa existir — as policies do bucket amarram a PASTA ao
   * `auth_tenant_id()` do admin (D12), então um id gerado só no servidor deixaria o
   * arquivo numa pasta que o admin do tenant jamais poderia reescrever. Quando
   * ausente, o servidor gera (`crypto.randomUUID`) e nada muda para quem não faz
   * upload. Só super_admin chega aqui, e um id repetido morre no `23505` da RPC.
   */
  id: z.string().uuid("Id invalido").optional(),
  name: z.string().min(1, "Nome obrigatório").max(200),
  slug: slugSchema.refine((s) => !isReservedSlug(s), {
    message: "Slug reservado pela plataforma. Escolha outro.",
  }),
  /** D6: `standard` é o DEFAULT do banco; o app não pode discordar dele. */
  plan: z.enum(["essencial", "standard", "premium"]).default("standard"),
  brand: tenantBrandInputSchema,
  modules: z.array(moduleIdSchema).default([]).transform(comModulosCore),
  settings: z
    .object({
      footerText: z.string().max(200).optional(),
      supportEmail: z.string().email("Email de suporte inválido").optional(),
      maxInteractionsPerSession: z.number().int().min(1).max(20).optional(),
    })
    .optional(),
  /** Domínio PRÓPRIO. O canônico `{slug}.{base}` nunca vem daqui (D1). */
  customHost: customHostSchema.optional(),
  admin: z.object({
    email: z.string().email("Email inválido"),
    fullName: z.string().min(1, "Nome obrigatório").max(200),
  }),
})

/**
 * Compatibilidade com o `initial_manager` da versão anterior deste schema.
 *
 * O grep de `createTenantSchema|CreateTenantInput` fora deste arquivo devolvia ZERO
 * chamadores quando esta evolução foi escrita — ou seja, ninguém quebra. O
 * `preprocess` existe mesmo assim porque o corpo antigo é o que está escrito na
 * documentação e em qualquer script solto do Hugo: recusá-lo com "admin obrigatório"
 * quando o pedido TEM um primeiro usuário declarado seria mentir sobre o motivo.
 */
export const createTenantSchema = z.preprocess((valor) => {
  if (typeof valor !== "object" || valor === null) return valor
  const corpo = valor as Record<string, unknown>
  if (corpo.admin || !corpo.initial_manager) return corpo
  const legado = corpo.initial_manager as { email?: unknown; full_name?: unknown }
  const { initial_manager: _ignorado, ...resto } = corpo
  return { ...resto, admin: { email: legado.email, fullName: legado.full_name } }
}, createTenantObjectSchema)

export type CreateTenantInput = z.input<typeof createTenantSchema>
/** O que sai do `parse`: `plan` e `modules` já resolvidos (core somados). */
export type CreateTenantData = z.output<typeof createTenantSchema>

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  plan: z.enum(["essencial", "standard", "premium"]).optional(),
  whitelabel_enabled: z.boolean().optional(),
  whitelabel_config: whitelabelConfigSchema.optional(),
  settings: z
    .object({
      ai_model: z.string().optional(),
      max_interactions_per_session: z.number().int().min(1).max(20).optional(),
      features: z
        .object({
          ai_detection: z.boolean().optional(),
          learning_journal: z.boolean().optional(),
          certificates: z.boolean().optional(),
          analytics_dashboard: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>
