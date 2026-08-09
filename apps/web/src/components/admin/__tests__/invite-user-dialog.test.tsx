import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InviteUserDialog } from "../invite-user-dialog"

// =============================================================================
// CONVIDAR COM ÁREA.
//
// O ponto do campo não é conveniência: convidar sem área é exatamente o que faz
// a pessoa nascer com o sinal âmbar aceso na lista. O vínculo é criado pela
// MESMA rota que a tela de Áreas usa — nenhuma escrita nova sobre `user_areas`.
// =============================================================================

vi.mock("@/lib/analytics", () => ({ analytics: { userInvited: vi.fn() } }))

const AREAS = [
  { id: "area-rp", name: "Ribeirão Preto" },
  { id: "area-mg", name: "Minas Gerais" },
]

interface RecordedCall {
  url: string
  init: RequestInit
}

let calls: RecordedCall[] = []

/** Mesmo padrão do `user-list.test.tsx`: afirma a chamada antes de ler o argumento. */
function stubFetch(porUrl: (url: string) => { ok: boolean; body?: unknown }) {
  const mock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url)
    calls.push({ url: href, init: init ?? {} })
    const r = porUrl(href)
    return { ok: r.ok, json: async () => r.body ?? {} }
  })
  vi.stubGlobal("fetch", mock)
  return mock
}

function callAt(index: number): RecordedCall {
  const call = calls[index]
  if (!call) {
    throw new Error(`esperava ao menos ${index + 1} chamada(s), houve ${calls.length}`)
  }
  return call
}

function preencherFormulario() {
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Maria Silva" } })
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "maria@empresa.com" } })
}

beforeEach(() => {
  calls = []
  vi.clearAllMocks()
})

describe("campo Área", () => {
  it("aparece quando o tenant tem áreas", () => {
    render(<InviteUserDialog open onOpenChange={() => {}} onSuccess={() => {}} areas={AREAS} />)

    expect(screen.getByLabelText("Área")).toBeInTheDocument()
    expect(screen.getByText("Ribeirão Preto")).toBeInTheDocument()
  })

  it("NÃO aparece quando não há área cadastrada — melhor ausente que select vazio", () => {
    render(<InviteUserDialog open onOpenChange={() => {}} onSuccess={() => {}} areas={[]} />)

    expect(screen.queryByLabelText("Área")).not.toBeInTheDocument()
  })
})

describe("o vínculo de área usa a rota de /api/admin/areas", () => {
  it("convida e, com área escolhida, cria o vínculo na área certa", async () => {
    stubFetch((url) =>
      url.startsWith("/api/admin/users")
        ? { ok: true, body: { data: { user: { id: "novo-1" } } } }
        : { ok: true },
    )
    const onSuccess = vi.fn()

    render(<InviteUserDialog open onOpenChange={() => {}} onSuccess={onSuccess} areas={AREAS} />)
    preencherFormulario()
    fireEvent.change(screen.getByLabelText("Área"), { target: { value: "area-mg" } })
    fireEvent.click(screen.getByText("Enviar Convite"))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())

    expect(callAt(0).url).toBe("/api/admin/users")
    expect(callAt(1).url).toBe("/api/admin/areas/area-mg/users")
    expect(callAt(1).init.method).toBe("POST")
    expect(JSON.parse(String(callAt(1).init.body))).toEqual({ user_id: "novo-1" })
  })

  it("sem área escolhida, NENHUMA escrita em user_areas acontece", async () => {
    stubFetch(() => ({ ok: true, body: { data: { user: { id: "novo-2" } } } }))
    const onSuccess = vi.fn()

    render(<InviteUserDialog open onOpenChange={() => {}} onSuccess={onSuccess} areas={AREAS} />)
    preencherFormulario()
    fireEvent.click(screen.getByText("Enviar Convite"))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(calls).toHaveLength(1)
    expect(callAt(0).url).toBe("/api/admin/users")
  })

  it("convite OK e vínculo falhando: diz o que ficou pendente, não finge sucesso", async () => {
    stubFetch((url) =>
      url.startsWith("/api/admin/users")
        ? { ok: true, body: { data: { user: { id: "novo-3" } } } }
        : { ok: false, body: { error: "Área não encontrada" } },
    )
    const onSuccess = vi.fn()

    render(<InviteUserDialog open onOpenChange={() => {}} onSuccess={onSuccess} areas={AREAS} />)
    preencherFormulario()
    fireEvent.change(screen.getByLabelText("Área"), { target: { value: "area-rp" } })
    fireEvent.click(screen.getByText("Enviar Convite"))

    await waitFor(() => expect(screen.getByText(/a área não foi vinculada/)).toBeInTheDocument())
    // O convite JÁ saiu — não pode ser reportado como sucesso limpo.
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByText(/Área não encontrada/)).toBeInTheDocument()
  })
})
