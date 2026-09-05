import { recusaSePerfilIlegivel } from "@/lib/api-auth/perfil-de-sessao"
import { logAdminAction } from "@/lib/audit"
import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { MODULE_IDS, type ModuleId, comModulosCore } from "@eximia/shared"
import { NextResponse } from "next/server"

// ===========================================================================
// POST /api/admin/tenants/[tenantId]/importar-marca-do-ambiente (D20)
//
// A marca das empresas que rodam em serviço próprio (o modo legado, um deploy
// por cliente) existe HOJE só como `NEXT_PUBLIC_TENANT_*` no EasyPanel. Não há
// cópia dela em lugar nenhum: nem no git (as branches `deploy/{cliente}` são o
// problema que a faxina desmonta), nem no banco (`tenants.brand` nasceu vazia e
// a migration de dados só conseguiu derivar o que já estava em `branding`).
//
// Esta rota é a ponte de UMA VIAGEM: rodando DENTRO do serviço do cliente, ela
// lê as env vars daquele processo e as grava em `tenants.brand/modules/settings`
// — depois disso o app único por host passa a servir a mesma marca, e as env
// vars podem morrer.
//
// A TRAVA QUE FAZ ESTA ROTA SER SEGURA
// ------------------------------------
// Ela recusa quando `NEXT_PUBLIC_TENANT_SLUG` do processo não é EXATAMENTE o
// slug do tenant do path. Sem isso, um super_admin logado no serviço da empresa
// A poderia, com um clique na tela da empresa B, gravar a marca de A por cima
// da de B — e o erro só apareceria no dia em que alguém de B abrisse o app e
// visse o logo de outra companhia. É o tipo de dano que nenhum teste pega
// depois.
//
// LEITURA DINÂMICA DE `process.env`, DE PROPÓSITO
// -----------------------------------------------
// O Next INLINA `process.env.NEXT_PUBLIC_X` escrito por extenso em BUILD. Aqui
// isso seria exatamente o defeito: a rota leria o valor do artefato, não o do
// serviço em execução, e importaria a marca de quem BUILDOU a imagem. Este
// módulo é servidor puro (nunca importado por `"use client"`), então o acesso
// dinâmico é lido em RUNTIME, que é o que D20 pede.
// ===========================================================================

/** As 15 `NEXT_PUBLIC_TENANT_*` que `tenant.config.ts` conhece. */
const CHAVES_DE_MARCA = [
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

const HEX = /^#[0-9a-fA-F]{6}$/

/** `""` é ausência: o EasyPanel grava string vazia quando o campo fica em branco. */
function texto(chave: (typeof CHAVES_DE_MARCA)[number]): string | undefined {
  const valor = (process.env[chave] ?? "").trim()
  return valor === "" ? undefined : valor
}

function inteiro(valor: string | undefined): number | undefined {
  const n = Number.parseInt(valor ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function booleano(valor: string | undefined): boolean {
  return valor === "1" || valor?.toLowerCase() === "true"
}

/** Tokens desconhecidos caem fora — o mesmo filtro de `tenant.config.ts`. */
function modulosDaEnv(csv: string | undefined): ModuleId[] | undefined {
  if (!csv) return undefined
  const validos = new Set<string>(MODULE_IDS)
  const lista = csv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t): t is ModuleId => validos.has(t))
  return lista.length > 0 ? comModulosCore(lista) : undefined
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { user, profile, error: erroDePerfil } = await getAuthProfile()
  const indisponivel = recusaSePerfilIlegivel(
    erroDePerfil,
    "/api/admin/tenants/[tenantId]/importar-marca-do-ambiente",
  )
  if (indisponivel) return indisponivel
  if (!user || !profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params
  const slugDoAmbiente = texto("NEXT_PUBLIC_TENANT_SLUG")

  if (!slugDoAmbiente) {
    return NextResponse.json(
      {
        error:
          "Este serviço não tem NEXT_PUBLIC_TENANT_SLUG definido — não há marca de ambiente para importar.",
      },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, brand, modules, settings, whitelabel_config")
    .eq("id", tenantId)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 })
  }

  if (tenant.slug !== slugDoAmbiente) {
    return NextResponse.json(
      {
        error: `Este serviço está configurado para "${slugDoAmbiente}", e a empresa selecionada é "${tenant.slug}". Importar aqui gravaria a marca de uma empresa em outra.`,
      },
      { status: 400 },
    )
  }

  // -------------------------------------------------------------------------
  // Mesclagem CAMPO A CAMPO sobre o que já está gravado. Uma env ausente não
  // apaga o valor do banco: quem já cadastrou o logo pela tela não pode perdê-lo
  // por clicar em "importar" num serviço que só define as cores.
  // -------------------------------------------------------------------------
  const brandAtual = (tenant.brand ?? {}) as Record<string, unknown>
  const primaria = texto("NEXT_PUBLIC_TENANT_PRIMARY_COLOR")
  const destaque = texto("NEXT_PUBLIC_TENANT_ACCENT_COLOR")
  const logo = texto("NEXT_PUBLIC_TENANT_LOGO")

  const brand: Record<string, unknown> = {
    ...brandAtual,
    name: texto("NEXT_PUBLIC_TENANT_NAME") ?? brandAtual.name ?? tenant.name,
    // `brand.slug` é sempre o do tenant, nunca o da env: eles são iguais aqui
    // (a trava acima garante), e cravar o do banco mantém a invariante mesmo se
    // a trava mudar um dia.
    slug: tenant.slug,
    ...(logo ? { logo } : {}),
    ...(texto("NEXT_PUBLIC_TENANT_LOGO_LIGHT")
      ? { logoLight: texto("NEXT_PUBLIC_TENANT_LOGO_LIGHT") }
      : {}),
    ...(texto("NEXT_PUBLIC_TENANT_FAVICON")
      ? { favicon: texto("NEXT_PUBLIC_TENANT_FAVICON") }
      : {}),
    ...(primaria && HEX.test(primaria) ? { primaryColor: primaria } : {}),
    ...(destaque && HEX.test(destaque) ? { accentColor: destaque } : {}),
    ...(texto("NEXT_PUBLIC_TENANT_PARTNER_NAME")
      ? { partnerName: texto("NEXT_PUBLIC_TENANT_PARTNER_NAME") }
      : {}),
    ...(texto("NEXT_PUBLIC_TENANT_PARTNER_LOGO")
      ? { partnerLogo: texto("NEXT_PUBLIC_TENANT_PARTNER_LOGO") }
      : {}),
  }

  const modules = modulosDaEnv(texto("NEXT_PUBLIC_TENANT_MODULES")) ?? tenant.modules ?? []

  const settingsAtuais = (tenant.settings ?? {}) as Record<string, unknown>
  const maxInteracoes = inteiro(texto("NEXT_PUBLIC_TENANT_MAX_INTERACTIONS"))
  const orgTree = booleano(texto("NEXT_PUBLIC_TENANT_ORG_TREE"))
  const settings: Record<string, unknown> = {
    ...settingsAtuais,
    ...(maxInteracoes !== undefined ? { max_interactions_per_session: maxInteracoes } : {}),
    ...(orgTree
      ? {
          features: {
            ...((settingsAtuais.features ?? {}) as Record<string, unknown>),
            org_tree: true,
          },
        }
      : {}),
  }

  const whitelabelAtual = (tenant.whitelabel_config ?? {}) as Record<string, unknown>
  const rodape = texto("NEXT_PUBLIC_TENANT_FOOTER_TEXT")
  const suporte = texto("NEXT_PUBLIC_TENANT_SUPPORT_EMAIL")
  const whitelabelConfig: Record<string, unknown> = {
    ...whitelabelAtual,
    ...(rodape ? { footer_text: rodape } : {}),
    ...(suporte ? { support_email: suporte } : {}),
  }

  const { data: atualizada, error } = await supabase
    .from("tenants")
    .update({ brand, modules, settings, whitelabel_config: whitelabelConfig })
    .eq("id", tenantId)
    .select("id, name, slug, brand, modules, settings, whitelabel_config")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    actorId: user.id,
    tenantId,
    action: "tenant.brand_imported_from_env",
    targetType: "tenant",
    targetId: tenantId,
    details: {
      slug: tenant.slug,
      // Só os NOMES das variáveis presentes. O valor de uma delas é a marca do
      // cliente, e auditoria não é lugar de duplicar payload.
      variaveis_presentes: CHAVES_DE_MARCA.filter((chave) => texto(chave) !== undefined),
    },
  })

  return NextResponse.json({
    data: atualizada,
    // `sessionTimeoutHours` não tem coluna no banco (§2.2 do contrato de dados):
    // é lido de env/default no app. Dizer isso aqui evita a conclusão errada de
    // que a importação o perdeu.
    naoImportado: ["NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS"],
  })
}
