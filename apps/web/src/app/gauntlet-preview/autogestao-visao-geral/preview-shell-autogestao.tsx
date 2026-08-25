// ---------------------------------------------------------------------------
// PreviewShellAutogestao — a moldura da Academy para o harness das 3 rotas
// `/gauntlet-preview/autogestao-*`, SEM a barra lateral.
//
// POR QUE ESTE ARQUIVO EXISTE, E NÃO REUSA `../visao-geral/preview-shell.tsx`:
// aquele `<PreviewShell/>` é o shell da TRINCA DO GESTOR — monta `<Sidebar/>`
// com `roles: ["manager"]` e `context: TIME` (propositalmente, para a barra do
// gestor aparecer nas 3 rotas dele). Reusá-lo aqui faria a Autogestão do ALUNO
// nascer com a navegação de GESTOR ("GESTÃO DO TIME", "Perfis da Equipe") —
// achado medido comparando a rodada 0 contra a referência do dono.
//
// A referência (`docs/gauntlet/autogestao-jornada/referencia/*.png`, 1440px)
// mostra só a ÁREA DE CONTEÚDO — a barra lateral é cromo idêntico em toda
// tela do produto, e a referência nunca a inclui. Este shell existe para
// fotografar exatamente essa área, sem inventar uma segunda implementação do
// `<Header/>` real: ele é o MESMO componente de produção, só que alimentado
// por um contexto PESSOAL de aluno (não o TIME do gestor) e sem `<Sidebar/>`.
//
// `DISPONIVEIS` tem UM item só (`PESSOAL`) de propósito: com <= 1 contexto
// disponível, `ContextSwitcher` renderiza `null` (mesma regra de
// `context-switcher.tsx` que o `PreviewShell` do gestor documenta) — é o
// comportamento real de um aluno puro, que nunca vê o seletor "Meu Time".
// ---------------------------------------------------------------------------

import { Header } from "@/components/layout/header"
import { AreaProvider } from "@/components/providers/area-provider"
import { BrandProvider } from "@/components/providers/brand-provider"
import { ContextProvider } from "@/components/providers/context-provider"
import { ModuleProvider } from "@/components/providers/module-provider"
import type { AvailableContext } from "@/lib/context-resolver"
import { getTenantConfig } from "@/lib/tenant"
import type { Role } from "@eximia/shared"

/** O único contexto do aluno na Autogestão — nunca `team`/`org`. */
const PESSOAL: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }
const DISPONIVEIS: AvailableContext[] = [PESSOAL]

/** Aluno puro — sem chapéu de gestão, para a barra nunca escolher a navegação errada. */
const PAPEIS: Role[] = ["student"]

// Nome literal, nunca um dado real de nenhum tenant — só alimenta o avatar do
// `<Header/>`, que os componentes de conteúdo (`VisaoGeralAutogestaoTab` etc.)
// não leem.
const USUARIO = { full_name: "Estudante", roles: PAPEIS }

export function PreviewShellAutogestao({ children }: { children: React.ReactNode }) {
  const config = getTenantConfig()

  return (
    <ModuleProvider modules={config.modules}>
      <BrandProvider brand={config.brand}>
        <AreaProvider activeArea={null} userAreas={[]}>
          <ContextProvider value={{ active: PESSOAL, available: DISPONIVEIS }}>
            {/* `data-world="standard"` OBRIGATÓRIO, mesma razão do shell do gestor:
                `--world-accent` só existe sob `[data-world]`. */}
            <div
              data-world="standard"
              className="flex min-h-screen flex-col bg-bg-app font-sans text-text-primary"
            >
              <Header
                user={USUARIO}
                tenantContext={null}
                activeContext={PESSOAL}
                availableContexts={DISPONIVEIS}
                initialUnreadCount={0}
                showAreaSelector={false}
              />
              <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">
                {children}
              </main>
            </div>
          </ContextProvider>
        </AreaProvider>
      </BrandProvider>
    </ModuleProvider>
  )
}
