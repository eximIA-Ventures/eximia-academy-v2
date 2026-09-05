import { ToastProvider } from "@eximia/ui"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// O wizard de 3 passos (§3 do plano).
//
// O que se protege aqui é o CORPO que a tela manda: se ele divergir do
// `createTenantSchema`, o super_admin preenche três telas e leva um 400 sem
// entender por quê. O host pré-visualizado e o estado do convite entram junto,
// porque são as duas coisas que a tela promete e que não existiam antes.
// ===========================================================================

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ error: null })),
        getPublicUrl: () => ({ data: { publicUrl: "https://storage/logo.png" } }),
      }),
    },
  }),
}))

const { TenantWizard } = await import("../tenant-wizard")

function montar() {
  const onCriado = vi.fn()
  render(
    <ToastProvider>
      <TenantWizard open onOpenChange={() => {}} onCriado={onCriado} />
    </ToastProvider>,
  )
  return { onCriado }
}

function preencher(rotulo: RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
}

function corpoDoUltimoPost() {
  const chamada = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(
    -1,
  )
  return JSON.parse((chamada?.[1] as { body: string }).body)
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_BASE_DOMAIN", "academy.eximiaventures.com.br")
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      tenant: {
        id: "tenant-1",
        name: "Cory Alimentos",
        slug: "cory-alimentos",
        host: "cory-alimentos.academy.eximiaventures.com.br",
        customHost: null,
        modules: [],
      },
      adminInvite: { status: "sent" },
    }),
  })) as unknown as typeof fetch
})

describe("TenantWizard — passo 1 (identidade)", () => {
  it("deriva o slug do nome e pré-visualiza o host canônico", () => {
    montar()

    preencher(/nome da empresa/i, "Cory Alimentos")

    expect(screen.getByDisplayValue("cory-alimentos")).toBeInTheDocument()
    expect(screen.getByText("cory-alimentos.academy.eximiaventures.com.br")).toBeInTheDocument()
  })

  it("bloqueia o avanço e explica quando o slug é reservado", () => {
    montar()

    preencher(/nome da empresa/i, "Admin")

    expect(screen.getByText(/slug reservado/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /próximo/i })).toBeDisabled()
  })
})

describe("TenantWizard — o corpo enviado ao POST", () => {
  it("manda id, marca, módulos com os core e o primeiro admin", async () => {
    montar()

    preencher(/nome da empresa/i, "Cory Alimentos")
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }))
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }))
    preencher(/nome do primeiro admin/i, "Maria Silva")
    preencher(/e-mail do primeiro admin/i, "maria@cory.com.br")
    fireEvent.click(screen.getByRole("button", { name: /cadastrar empresa/i }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    const corpo = corpoDoUltimoPost()
    expect(corpo.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(corpo.slug).toBe("cory-alimentos")
    expect(corpo.plan).toBe("standard")
    expect(corpo.brand.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(corpo.admin).toEqual({ email: "maria@cory.com.br", fullName: "Maria Silva" })
    // Pré-marcação do plano standard — os core NÃO viajam daqui, quem os soma é
    // o schema (uma soma feita nos dois lados divergiria).
    expect(corpo.modules).toEqual(["biblioteca", "assessments", "units"])
  })

  it("troca a pré-marcação dos módulos quando o plano muda", async () => {
    montar()

    preencher(/nome da empresa/i, "Cory Alimentos")
    fireEvent.change(screen.getByLabelText(/plano/i), { target: { value: "essencial" } })
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }))
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }))
    preencher(/nome do primeiro admin/i, "Maria Silva")
    preencher(/e-mail do primeiro admin/i, "maria@cory.com.br")
    fireEvent.click(screen.getByRole("button", { name: /cadastrar empresa/i }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    expect(corpoDoUltimoPost().modules).toEqual(["biblioteca"])
  })
})

describe("TenantWizard — depois do cadastro", () => {
  it("mostra o host e oferece reenviar convite quando o convite falhou", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tenant: {
          id: "tenant-1",
          name: "Cory Alimentos",
          slug: "cory-alimentos",
          host: "cory-alimentos.academy.eximiaventures.com.br",
          customHost: null,
          modules: [],
        },
        adminInvite: { status: "failed", stage: "invite", error: "SMTP fora do ar" },
      }),
    })) as unknown as typeof fetch

    const { onCriado } = montar()

    preencher(/nome da empresa/i, "Cory Alimentos")
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }))
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }))
    preencher(/nome do primeiro admin/i, "Maria Silva")
    preencher(/e-mail do primeiro admin/i, "maria@cory.com.br")
    fireEvent.click(screen.getByRole("button", { name: /cadastrar empresa/i }))

    await waitFor(() => expect(screen.getByText(/empresa cadastrada/i)).toBeInTheDocument())

    expect(onCriado).toHaveBeenCalled()
    expect(screen.getByText("cory-alimentos.academy.eximiaventures.com.br")).toBeInTheDocument()
    expect(screen.getByText(/o convite para maria@cory.com.br falhou/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reenviar convite/i })).toBeInTheDocument()
  })
})
