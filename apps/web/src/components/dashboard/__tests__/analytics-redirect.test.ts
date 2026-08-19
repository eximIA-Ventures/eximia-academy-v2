import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock auth to return a student (non-manager) so redirect("/dashboard") fires.
// `papeisAtuais` é o que a suíte troca entre o caso NEGATIVO (aluno, tem de ser
// barrado) e o CONTROLE POSITIVO (gestor, não pode ser barrado).
let papeisAtuais: string[] = ["student"]

vi.mock("@/lib/auth", () => ({
  getAuthProfile: vi.fn(async () => ({
    user: { id: "user-1" },
    profile: { role: papeisAtuais[0], tenant_id: "t-1" },
    roles: papeisAtuais,
    supabase: {},
  })),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  }),
}))

// The page reads the active-area cookie (via next/headers `cookies()`) before the
// role check runs. Without this mock, the real `next/headers` throws outside a
// Next.js request context, which the test's empty catch swallows silently —
// masking the actual assertion (redirect was never reached).
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

async function renderizarAnalytics(params: Record<string, string | undefined>) {
  const { default: AnalyticsPage } = await import("../../../app/(platform)/analytics/page")
  try {
    await AnalyticsPage({ searchParams: Promise.resolve(params) })
  } catch {
    // redirect throws NEXT_REDIRECT. Um papel PERMITIDO pode estourar mais
    // adiante (o corpo real quer banco); a asserção é sempre sobre `redirect`,
    // nunca sobre a página ter terminado.
  }
}

/**
 * As quatro superfícies que `/analytics` serve hoje. Sem `?tab` é a aba de
 * ENTRADA (Visão geral) — é ela que a regressão abriu.
 *
 * `discriminaARegressao` registra, sem maquiagem, quais destes casos provam a
 * correção e qual não prova: com o gate no filho em vez de na rota, os três
 * primeiros devolviam JSX sem checar papel nenhum, enquanto `?tab=legado`
 * continuava caindo no corpo antigo, que ainda tinha a checagem inline. O caso
 * do legado é cobertura legítima (tranca o que já funcionava), não evidência
 * desta correção — e dizer o contrário seria vender teste decorativo como prova.
 */
const SUPERFICIES: { nome: string; params: Record<string, string | undefined> }[] = [
  { nome: "sem ?tab (Visão geral, a aba de entrada)", params: {} },
  { nome: "?tab=padroes", params: { tab: "padroes" } },
  { nome: "?tab=mapa", params: { tab: "mapa" } },
  { nome: "?tab=legado", params: { tab: "legado" } },
  // `?tab` desconhecido cai na aba de entrada (`lerAba`) — não pode ser uma
  // quinta porta sem gate.
  { nome: "?tab desconhecido", params: { tab: "nao-existe" } },
]

describe("/analytics redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    papeisAtuais = ["student"]
  })

  it("redirects non-manager to /dashboard", async () => {
    const { redirect } = await import("next/navigation")
    await renderizarAnalytics({})

    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })

  describe("o gate vale para TODAS as abas da trinca", () => {
    for (const superficie of SUPERFICIES) {
      it(`barra o aluno em ${superficie.nome}`, async () => {
        const { redirect } = await import("next/navigation")
        await renderizarAnalytics(superficie.params)

        expect(redirect).toHaveBeenCalledWith("/dashboard")
      })
    }
  })

  /**
   * CONTROLE POSITIVO — sem ele, os casos acima passariam com uma rota que
   * redireciona TODO MUNDO, que é uma tela quebrada, não um gate. Aqui o mesmo
   * caminho tem de deixar o gestor entrar.
   */
  describe("controle positivo: quem tem o chapéu NÃO é barrado", () => {
    for (const superficie of SUPERFICIES) {
      it(`deixa o gestor passar em ${superficie.nome}`, async () => {
        papeisAtuais = ["manager"]
        const { redirect } = await import("next/navigation")
        await renderizarAnalytics(superficie.params)

        expect(redirect).not.toHaveBeenCalledWith("/dashboard")
      })
    }
  })

  /**
   * O gate roda ANTES do despacho de aba. A prova é indireta e é a única
   * disponível a este nível: se o painel da aba tivesse sido invocado, ele teria
   * pedido o client de serviço, que nesta suíte não existe — o erro seria de
   * Supabase, não `NEXT_REDIRECT`.
   */
  it("recusa antes de despachar a aba (o erro é o redirect, não o banco)", async () => {
    const { default: AnalyticsPage } = await import("../../../app/(platform)/analytics/page")

    await expect(
      AnalyticsPage({ searchParams: Promise.resolve({ tab: "padroes" }) }),
    ).rejects.toThrow("NEXT_REDIRECT")
  })
})
