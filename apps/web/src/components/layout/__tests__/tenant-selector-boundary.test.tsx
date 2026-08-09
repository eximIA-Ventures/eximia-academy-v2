import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { AvailableContext } from "@/lib/context-resolver"
import { AdminHeader } from "@/components/admin/admin-header"
import type { Role } from "@eximia/shared"
import { Header } from "../header"

/**
 * FRONTEIRA DO SELETOR DE EMPRESA (rodada 10, A1).
 *
 * O DEFEITO MEDIDO: no mundo PADRÃO o cabeçalho trazia a pílula "Cory Alimentos"
 * abrindo o menu "ORGANIZACOES" (Cory Alimentos, exímIA Academy, Harven
 * Finance). Escolher SOBRE QUAL EMPRESA SE OPERA é ato administrativo, e o
 * mundo cuja razão de existir é aprender não contém administração
 * (`docs/stories/workspace-separation.story.md`). Tínhamos acabado de tirar o
 * painel global do Padrão (rodada 9) e deixado ali o controle que decide a
 * empresa.
 *
 * A REGRA QUE ESTE ARQUIVO GUARDA: o seletor existe nos mundos Administração e
 * Super Admin (`AdminHeader`), e NÃO existe no Padrão nem no Estúdio.
 *
 * O `TenantSelector` NÃO é mockado aqui de propósito: o teste tem que ver a
 * coisa real aparecer de um lado e não existir do outro — um sentinela mockado
 * provaria só que o mock foi chamado.
 */

vi.mock("../area-selector", () => ({ AreaSelector: () => <div>unidade</div> }))
vi.mock("../context-switcher", () => ({ ContextSwitcher: () => <div>ctx</div> }))
vi.mock("../notification-bell", () => ({ NotificationBell: () => <div>bell</div> }))
vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => <div>bell</div>,
}))
vi.mock("../theme-toggle", () => ({ ThemeToggle: () => <div>theme</div> }))
vi.mock("@/components/layout/theme-toggle", () => ({ ThemeToggle: () => <div>theme</div> }))
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }))
// O `TenantSelector` REAL usa `useRouter` para dar refresh após a troca; fora do
// App Router isso lança. Só o roteador é stubado — o componente segue real.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin",
}))

const organization: AvailableContext = {
  type: "organization",
  id: null,
  label: "Minha Organização",
}
const personal: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }

/** As três empresas que a auditoria viu no menu, verbatim. */
const TENANTS = [
  { id: "t-cory", name: "Cory Alimentos", slug: "cory" },
  { id: "t-eximia", name: "exímIA Academy", slug: "eximia" },
  { id: "t-harven", name: "Harven Finance", slug: "harven" },
]

describe("Mundo PADRÃO — o seletor de EMPRESA não existe", () => {
  it("o cabeçalho do Padrão não renderiza a pílula da empresa ativa, nem para super_admin", () => {
    render(
      <Header
        user={{ full_name: "Hugo Capitelli", roles: ["super_admin", "student"] as Role[] }}
        activeContext={organization}
        availableContexts={[personal, organization]}
        showAreaSelector={false}
      />,
    )
    for (const t of TENANTS) {
      expect(screen.queryByText(t.name)).not.toBeInTheDocument()
    }
    expect(screen.queryByText("Selecionar tenant")).not.toBeInTheDocument()
  })

  it("o módulo do cabeçalho Padrão nem sequer importa o seletor de empresa", async () => {
    // Prova estrutural, não só de renderização: se um dia alguém devolver a
    // prop, o import volta e este teste cai antes do defeito chegar à tela.
    const [fs, path] = await Promise.all([import("node:fs"), import("node:path")])
    const src = fs.readFileSync(path.join(__dirname, "..", "header.tsx"), "utf8")
    expect(src).not.toMatch(/from\s+["']\.\/tenant-selector["']/)
    expect(src).not.toMatch(/<TenantSelector/)
  })
})

describe("Mundo ADMINISTRAÇÃO / SUPER ADMIN — o seletor de EMPRESA permanece", () => {
  it("o cabeçalho administrativo renderiza a empresa ativa com as demais disponíveis", () => {
    render(
      <AdminHeader
        firstName="Hugo"
        fullName="Hugo Capitelli"
        roleLabel="Super Admin"
        multiTenant={{ activeTenantId: "t-cory", tenants: TENANTS }}
      />,
    )
    // A pílula anuncia a empresa ATIVA (as demais só aparecem com o menu aberto).
    expect(screen.getByText("Cory Alimentos")).toBeInTheDocument()
  })

  it("sem `multiTenant` (admin de tenant único) o cabeçalho administrativo também não o mostra", () => {
    render(<AdminHeader firstName="Ana" fullName="Ana Souza" />)
    expect(screen.queryByText("Cory Alimentos")).not.toBeInTheDocument()
  })
})
