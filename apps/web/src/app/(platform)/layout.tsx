import { AdminHeader } from "@/components/admin/admin-header"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { Header } from "@/components/layout/header"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { PlatformFooter } from "@/components/layout/platform-footer"
import { Sidebar } from "@/components/layout/sidebar"
import { AreaProvider } from "@/components/providers/area-provider"
import { BrandProvider } from "@/components/providers/brand-provider"
import { ContextProvider } from "@/components/providers/context-provider"
import { ModuleProvider } from "@/components/providers/module-provider"
import { PostHogIdentify } from "@/components/providers/posthog-identify"
import { QueryProvider } from "@/components/providers/query-provider"
import { SessionTimeoutProvider } from "@/components/providers/session-timeout-provider"
import { StudioHeader } from "@/components/studio/studio-header"
import { StudioSidebar } from "@/components/studio/studio-sidebar"
import { StudioViewAsStudentBar } from "@/components/studio/studio-view-as-student-bar"
import { getActiveAreaId, getUserAreas } from "@/lib/area-context"
import { getAuthProfile, orderedTenantQuery } from "@/lib/auth"
import { resolveContext } from "@/lib/context-resolver"
import { bumpLastSeen } from "@/lib/last-seen"
import { needsTenantSelector } from "@/lib/multi-tenant-access"
import { unreadCount } from "@/lib/notifications/inbox"
import { hasAnyRole, hasRole } from "@/lib/role-helpers"
import { getTenantConfig } from "@/lib/tenant"
import { sanitizeCSS } from "@/lib/utils/sanitize-css"
import { getActiveWorkspace } from "@/lib/workspace-context"
import { accessibleWorkspaces, resolvePlatformShell } from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { after } from "next/server"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function sanitizeHex(value: string, fallback: string): string {
  return HEX_COLOR_RE.test(value) ? value : fallback
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const config = getTenantConfig()
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) {
    redirect("/login")
  }

  // FOLLOW-UP B (Hugo 2026-07-14) — pure-navigation access signal. Post-response
  // (after()) and throttled (~1h/user), never on the page's critical path;
  // tolerant to the users.last_seen_at column not existing yet (pre-migration).
  after(() => bumpLastSeen(user.id))

  // Capability profile (E1 union of hats). All view/visibility checks use
  // hasRole/hasAnyRole over this — NEVER `profile.role` equality (E8 AC1/AC8).
  const capabilityProfile = { roles }

  // BUG-2: the Studio nav links to SHARED pages that physically live in this
  // (platform) route group (/courses, /materiais, /lives, /trails, /analytics —
  // only /instructor lives in (studio)). Since route groups do not share a
  // layout, an instructor arriving from the Estúdio would otherwise render the
  // standard shell and "switch workspace on his own". When the active workspace
  // is the Estúdio (and the real instructor hat backs it — fail-closed), keep the
  // Studio shell here so the workspace identity is preserved on those pages.
  const activeWorkspace = await getActiveWorkspace()
  const platformShell = resolvePlatformShell(activeWorkspace, roles as Role[])
  if (platformShell === "studio") {
    const firstName = profile.full_name?.split(" ")[0] ?? ""
    const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
    const primaryColor = sanitizeHex(config.brand.primaryColor, "#2a6ab0")
    const accentColor = sanitizeHex(config.brand.accentColor, "#C4A882")
    const sessionTimeoutHours = config.settings?.sessionTimeoutHours ?? 24
    const customCSS = config.settings?.customCSS ? sanitizeCSS(config.settings.customCSS) : ""

    return (
      <QueryProvider>
        <BrandProvider brand={config.brand}>
          <style
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered CSS vars with sanitized hex values
            dangerouslySetInnerHTML={{
              __html: `:root{--tenant-primary:${primaryColor};--tenant-secondary:${accentColor}}`,
            }}
          />
          {customCSS && (
            <style
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized custom CSS
              dangerouslySetInnerHTML={{ __html: customCSS }}
            />
          )}
          <SessionTimeoutProvider timeoutHours={sessionTimeoutHours}>
            {/* RODADA 10 (A3) — o shell declara SÓ em que mundo está; a cor
                (clara e escura) mora em `styles/theme.css`, bloco WORLD ACCENT.
                Tudo abaixo (item ativo da barra, marcador, foco) deriva daqui
                via `--world-accent`. */}
            <div
              data-world="studio"
              className="flex h-screen bg-bg-app font-sans text-text-primary"
            >
              <StudioSidebar
                canSwitchWorkspace={accessibleWorkspaces(roles as Role[]).length > 1}
              />
              <div className="flex flex-1 flex-col min-w-0">
                {viewAsStudent && <StudioViewAsStudentBar />}
                <StudioHeader
                  firstName={firstName}
                  fullName={profile.full_name ?? ""}
                  viewAsStudent={viewAsStudent}
                />
                <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">
                  {children}
                </main>
              </div>
            </div>
          </SessionTimeoutProvider>
        </BrandProvider>
      </QueryProvider>
    )
  }

  // Seletor multi-tenant (super_admin / admin global). Resolvido AQUI, ACIMA do
  // shell do mundo admin, porque os DOIS shells (admin e Padrão) montam o mesmo
  // seletor sob a MESMA condição (`needsTenantSelector`, transcrita verbatim do
  // que este arquivo já fazia). Correção de auditoria FURO 2: sem isto, o
  // super_admin que clicava "Empresas" caía no mundo admin sem o dropdown e
  // ficava preso ao tenant do cookie `x-sa-active-tenant`, que várias telas
  // administrativas leem.
  //
  // RODADA 10, A1 — o seletor passou a ser MUNDO-DEPENDENTE. Antes bastava
  // `needsTenantSelector(profile)`, e o shell Padrão montava o dropdown de
  // empresa dentro do mundo de APRENDIZAGEM: escolher sobre qual empresa se
  // opera é ato administrativo, e a doutrina de workspaces
  // (`docs/stories/workspace-separation.story.md`) proíbe um mundo conter o
  // outro. Agora o critério é uma CONJUNÇÃO: o chapéu permite (verbatim, o
  // `needsTenantSelector` intocado) E o mundo ativo é administrativo.
  //
  // Efeito colateral deliberadamente ausente: as telas do Padrão que leem a
  // empresa ativa continuam funcionando, porque o cookie `x-sa-active-tenant`
  // não é apagado nem ignorado — some o CONTROLE, permanece o ESTADO. E a
  // consulta de tenants deixa de rodar em todo request do Padrão/Estúdio, que
  // é ganho colateral, não o motivo.
  let allTenants: Array<{ id: string; name: string; slug: string }> = []
  let activeTenantId: string | null = null
  const isAdminWorld = platformShell === "admin" || platformShell === "super"
  const showTenantSelector = isAdminWorld && needsTenantSelector(profile)
  if (showTenantSelector) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    const svc = createServiceClient()
    // Correção de auditoria (rodada 5): a ordem sai de `orderedTenantQuery`, a
    // MESMA que o fallback de `resolveTenantId` usa. Antes o cabeçalho ordenava
    // por `name` e o fallback não ordenava por nada — o topo podia anunciar uma
    // empresa e o hub gravar em outra. `.order("name")` sozinho ainda deixaria
    // homônimos ao critério do banco.
    const { data } = await orderedTenantQuery(svc.from("tenants").select("id, name, slug"))
    allTenants = data ?? []
    activeTenantId = (await cookies()).get("x-sa-active-tenant")?.value ?? allTenants[0]?.id ?? null
  }
  // Consumido SÓ pelo `AdminHeader` (mundos Administração e Super Admin). O
  // `Header` do Padrão não recebe mais este objeto — a prop saiu do componente.
  const multiTenant = showTenantSelector
    ? { activeTenantId: activeTenantId ?? "", tenants: allTenants }
    : null

  // 3º WORKSPACE (W1) — o mundo do ADMIN. Mesmo mecanismo do Estúdio acima: as
  // páginas administrativas moram fisicamente em `(platform)/admin/*`, então o
  // shell é escolhido AQUI pelo workspace ativo (fail-closed pelo chapéu real em
  // `resolvePlatformShell`), sem mover 14 diretórios para um route group novo.
  // Diferença frente ao Estúdio: aqui o `ModuleProvider` é OBRIGATÓRIO — a nav
  // administrativa vem do registry e depende dos módulos do tenant. `AreaProvider`
  // e `ContextProvider` NÃO entram (nenhuma página de /admin os consome em runtime;
  // `admin/users/loader.ts` importa apenas o TIPO `AreaData`).
  //
  // RODADA 9 — o mesmo ramo serve o 4º mundo (SUPER ADMIN). Ele tem a MESMA
  // anatomia de shell (barra do registry + header slim + seletor de empresa) e
  // difere só no que já é parametrizado: a cor, o nome no badge, a home do
  // lockup e a chave de nav (`world`). Duplicar 60 linhas de providers para
  // trocar uma string seria criar um segundo lugar onde o mesmo bug pode nascer.
  if (platformShell === "admin" || platformShell === "super") {
    const firstName = profile.full_name?.split(" ")[0] ?? ""
    const primaryColor = sanitizeHex(config.brand.primaryColor, "#2a6ab0")
    const accentColor = sanitizeHex(config.brand.accentColor, "#C4A882")
    const sessionTimeoutHours = config.settings?.sessionTimeoutHours ?? 24
    const customCSS = config.settings?.customCSS ? sanitizeCSS(config.settings.customCSS) : ""

    return (
      <QueryProvider>
        <ModuleProvider modules={config.modules}>
          <BrandProvider brand={config.brand}>
            <style
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered CSS vars with sanitized hex values
              dangerouslySetInnerHTML={{
                __html: `:root{--tenant-primary:${primaryColor};--tenant-secondary:${accentColor}}`,
              }}
            />
            {customCSS && (
              <style
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized custom CSS
                dangerouslySetInnerHTML={{ __html: customCSS }}
              />
            )}
            <SessionTimeoutProvider timeoutHours={sessionTimeoutHours}>
              <NavigationProgress />
              {/* RODADA 10 (A3) — mesma anatomia, DUAS identidades: teal para
                  Administração, violeta para Super Admin. O `platformShell` já
                  é exatamente a chave do mundo, então o atributo é ele mesmo. */}
              <div
                data-world={platformShell}
                className="flex h-screen bg-bg-app font-sans text-text-primary"
              >
                <AdminSidebar
                  roles={roles as Role[]}
                  canSwitchWorkspace={accessibleWorkspaces(roles as Role[]).length > 1}
                  world={platformShell}
                />
                <div className="flex flex-1 flex-col min-w-0">
                  <AdminHeader
                    firstName={firstName}
                    fullName={profile.full_name ?? ""}
                    multiTenant={multiTenant}
                    roleLabel={
                      hasRole(capabilityProfile, "super_admin") ? "Super Admin" : "Administrador"
                    }
                  />
                  <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">
                    {children}
                  </main>
                </div>
              </div>
            </SessionTimeoutProvider>
          </BrandProvider>
        </ModuleProvider>
      </QueryProvider>
    )
  }

  // Redirect to onboarding if not completed (students only)
  if (!profile.onboarding_completed && profile.role === "student") {
    redirect("/onboarding")
  }

  // Área context resolution (only when units module is enabled)
  let userAreas: Array<{ id: string; name: string; slug: string }> = []
  let activeArea: { id: string; name: string; slug: string } | null = null

  if (config.modules.includes("units")) {
    // Staff (by CAPABILITY) see ALL tenant areas; others see only assigned areas.
    const isStaff = hasAnyRole(capabilityProfile, ["instructor", "admin", "super_admin", "manager"])
    if (isStaff && profile.tenant_id) {
      const { createClient } = await import("@/lib/supabase/server")
      const sb = await createClient()
      const { data: allAreas } = await sb
        .from("areas")
        .select("id, name, slug")
        .eq("tenant_id", profile.tenant_id)
        .order("name")
      userAreas = (allAreas ?? []).map((a) => ({ id: a.id, name: a.name, slug: a.slug }))
    } else {
      userAreas = await getUserAreas(user.id)
    }
    const activeAreaId = await getActiveAreaId()

    if (activeAreaId) {
      activeArea = userAreas.find((a) => a.id === activeAreaId) ?? null
    }
    // When activeAreaId is null (cookie cleared via "Empresa"), keep activeArea as null
    // This allows the user to see data from all areas combined
  }

  // Active context (E7): resolved AFTER area (place first, context second —
  // E7 §4.8). Reuses the getAuthProfile cache (no duplicate query). `active` is
  // the safe default ("Minha Trilha") when no elevated cookie is present.
  // "View as student" is ABSORBED here: the student view is now the `personal`
  // context (`isSelfContext`); no more `x-view-as-student`-derived boolean.
  const { active: activeContext, available: availableContexts } = await resolveContext()
  const isSelfContext = activeContext.type === "personal"

  // "Ver como Aluno" preview (D3a/S4): the exit bar must stay visible while the
  // instructor previews content in the standard-world course pages, not only in
  // the Studio shell. The cookie is only ever set by the instructor-only toggle,
  // so gate the bar on the real instructor hat (never on the singular role) to
  // keep it invisible to plain students/managers.
  const isPreviewingAsStudent =
    hasRole(capabilityProfile, "instructor") &&
    (await cookies()).get("x-view-as-student")?.value === "true"

  // Multi-tenant selector: RODADA 10 (A1) — não existe mais neste mundo. Ele é
  // resolvido acima sob `isAdminWorld` e montado só pelo `AdminHeader`.

  // Pre-fetch unread count for the bell badge (non-blocking; defaults to 0 on
  // error). Shown for students (by capability) and anyone in the personal
  // ("Minha Trilha") context — covers the gestor-aluno in self context.
  const initialUnreadCount =
    hasRole(capabilityProfile, "student") || isSelfContext ? await unreadCount().catch(() => 0) : 0

  const primaryColor = sanitizeHex(config.brand.primaryColor, "#2a6ab0")
  const accentColor = sanitizeHex(config.brand.accentColor, "#C4A882")

  const sessionTimeoutHours = config.settings?.sessionTimeoutHours ?? 24
  const footerText = config.settings?.footerText
  const supportEmail = config.settings?.supportEmail
  const customCSS = config.settings?.customCSS ? sanitizeCSS(config.settings.customCSS) : ""

  return (
    <QueryProvider>
      <PostHogIdentify
        user={{
          id: user.id,
          role: profile.role,
          tenantId: config.brand.slug,
        }}
      />
      <ModuleProvider modules={config.modules}>
        <BrandProvider brand={config.brand}>
          <AreaProvider activeArea={activeArea} userAreas={userAreas}>
            <ContextProvider value={{ active: activeContext, available: availableContexts }}>
              <style
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered CSS vars with sanitized hex values
                dangerouslySetInnerHTML={{
                  __html: `:root{--tenant-primary:${primaryColor};--tenant-secondary:${accentColor}}`,
                }}
              />
              {customCSS && (
                <style
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized custom CSS
                  dangerouslySetInnerHTML={{ __html: customCSS }}
                />
              )}
              <SessionTimeoutProvider timeoutHours={sessionTimeoutHours}>
                <NavigationProgress />
                {/* RODADA 10 (A3) — o mundo PADRÃO segue cerrado; o atributo é
                    explícito mesmo sendo o default, para os quatro shells se
                    lerem do mesmo jeito e o mundo nunca ficar implícito. */}
                <div
                  data-world="standard"
                  className="flex h-screen bg-bg-app font-sans text-text-primary"
                >
                  <Sidebar
                    context={activeContext}
                    roles={roles as Role[]}
                    canSwitchWorkspace={accessibleWorkspaces(roles as Role[]).length > 1}
                  />
                  <div className="flex flex-1 flex-col min-w-0">
                    {isPreviewingAsStudent && <StudioViewAsStudentBar />}
                    <Header
                      user={{ full_name: profile.full_name, roles: roles as Role[] }}
                      tenantContext={null}
                      activeContext={activeContext}
                      availableContexts={availableContexts}
                      initialUnreadCount={initialUnreadCount}
                      // "Unidade" filter is a place/scope selector — only in a
                      // team/org context, never in the personal trail (E7). Resolved
                      // server-side (isSelfContext) so there is no client flicker.
                      showAreaSelector={!isSelfContext}
                    />
                    <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">
                      {children}
                    </main>
                    <div
                      aria-live="polite"
                      aria-atomic="true"
                      className="sr-only"
                      id="route-announcer"
                    />
                    <PlatformFooter footerText={footerText} supportEmail={supportEmail} />
                  </div>
                </div>
              </SessionTimeoutProvider>
            </ContextProvider>
          </AreaProvider>
        </BrandProvider>
      </ModuleProvider>
    </QueryProvider>
  )
}
