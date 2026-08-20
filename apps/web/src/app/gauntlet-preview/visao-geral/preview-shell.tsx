// ---------------------------------------------------------------------------
// PreviewShell — a moldura REAL da Academy dentro do harness DEV-ONLY.
//
// POR QUE ESTE ARQUIVO EXISTE: `/gauntlet-preview` mora na RAIZ de `app/`, fora
// do route group `(platform)`, então não herda o shell da plataforma. Até aqui o
// preview desenhava uma RÉPLICA da barra lateral (um `<aside>` de 201px dentro
// de `visao-geral-tab.tsx`). Decisão do dono (2026-08-16): o preview passa a
// montar a barra e os filtros REAIS.
//
// POR QUE NÃO REUSAR `(platform)/layout.tsx`: quem faz I/O é o LAYOUT, não o
// shell. O layout autentica o perfil e redireciona para a tela de login antes
// de qualquer página — por isso ele não pode ser reusado aqui, e por isso mover
// a rota para dentro de `(platform)` não funcionaria nem com guard `NODE_ENV`
// (o layout roda ANTES da página).
//
// A subárvore `app/gauntlet-preview` é varrida por um grep de barreira que
// exige ZERO menção a fonte de dado real; por isso nem os nomes dos símbolos de
// auth aparecem escritos aqui.
//
// O que este arquivo compõe é o shell PADRÃO de `(platform)/layout.tsx`
// (L362-395) alimentado por PROPS LITERAIS. Nada aqui lê sessão, cookie ou
// banco:
//   • `getTenantConfig()` é import estático de `tenant.config.ts` (marca +
//     módulos), o mesmo arquivo que já vai para o bundle público;
//   • `Sidebar` e `Header` são `"use client"` puros, prop-driven, sem fetch;
//   • os 4 providers são client-side puros.
//
// FICAM DE FORA, deliberadamente, os provedores que fazem I/O ou animam e que
// nem `Sidebar` nem `Header` exigem: `QueryProvider`, `PostHogIdentify`,
// `SessionTimeoutProvider`, `NavigationProgress`, `StudioViewAsStudentBar`.
// `ThemeProvider` já vem do root (`app/layout.tsx`). `PlatformFooter` também
// fica de fora — ele custa ~40px de altura útil e chama `new Date()`, e a
// versão literal do plano não o inclui.
//
// CUSTO ASSUMIDO: ~20 linhas de composição duplicadas do layout real, que podem
// divergir dele no futuro. Divergir na MOLDURA é ordens de grandeza mais barato
// que divergir na AUTH — e é melhor que a réplica desenhada à mão de antes.
// ---------------------------------------------------------------------------

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { AreaProvider } from "@/components/providers/area-provider"
import { BrandProvider } from "@/components/providers/brand-provider"
import { ContextProvider } from "@/components/providers/context-provider"
import { ModuleProvider } from "@/components/providers/module-provider"
import type { AvailableContext } from "@/lib/context-resolver"
import { getTenantConfig } from "@/lib/tenant"
import type { Role } from "@eximia/shared"

// O contexto ATIVO tem que ser `team`. `navRoleForContext`
// (packages/shared/src/modules/registry.ts) devolve `"student"` sempre que o
// contexto é `personal`, INDEPENDENTE dos chapéus — com `personal` a barra do
// gestor viraria barra de aluno.
const TIME: AvailableContext = { type: "team", id: null, label: "Meu Time" }
const PESSOAL: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }

// `available` precisa de >= 2 itens: o `ContextSwitcher` renderiza `null` com
// <= 1 (context-switcher.tsx). É ele que entrega "Meu Time" no topo direito.
const DISPONIVEIS: AvailableContext[] = [PESSOAL, TIME]

// `manager` + `workspace: "standard"` é o par que faz o registry escolher a
// chave de navegação do GESTOR.
const PAPEIS: Role[] = ["manager"]

// Nome literal, escrito aqui — nunca um dado real de nenhum tenant. Espelha o
// `contexto.gestorNome` da fixture ("Mariana Costa").
const USUARIO = { full_name: "Mariana Costa", roles: PAPEIS }

export function PreviewShell({ children }: { children: React.ReactNode }) {
  const config = getTenantConfig()

  return (
    <ModuleProvider modules={config.modules}>
      <BrandProvider brand={config.brand}>
        <AreaProvider activeArea={null} userAreas={[]}>
          <ContextProvider value={{ active: TIME, available: DISPONIVEIS }}>
            {/* `data-world="standard"` é OBRIGATÓRIO: `SidebarItem` deriva a cor
                de `--world-accent`, que só existe sob `[data-world]`. Sem isto a
                barra perde a identidade de cor do mundo Padrão. */}
            <div
              data-world="standard"
              className="flex h-screen bg-bg-app font-sans text-text-primary"
            >
              <Sidebar context={TIME} roles={PAPEIS} canSwitchWorkspace={false} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Header
                  user={USUARIO}
                  tenantContext={null}
                  activeContext={TIME}
                  availableContexts={DISPONIVEIS}
                  initialUnreadCount={0}
                  showAreaSelector={false}
                />
                <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">
                  {children}
                </main>
              </div>
            </div>
          </ContextProvider>
        </AreaProvider>
      </BrandProvider>
    </ModuleProvider>
  )
}
