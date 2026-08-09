import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// CFG-5.1 (AC1) — SALVAR E DESCARTAR.
//
// "Salvar" tem prova indireta em qualquer grep (a chamada está lá). DESCARTAR
// não tem: é o único comportamento desta tela que só existe em estado de
// cliente, e um bug ali (descartar que grava, descartar que não reverte, ou que
// reverte só o nome e esquece as cores) passaria despercebido por `tsc`, por
// `biome` e por leitura de diff. É exatamente o buraco que este arquivo fecha.
//
// `LogoUpload` é o único componente mockado, e por motivo de I/O: ele sobe
// arquivo para o storage. `ColorPicker` e `BrandingPreview` entram REAIS — são
// eles que provam que Descartar reverte a identidade visual, não só o nome.
// =============================================================================

const saveTenantSettings = vi.fn(
  async (_payload: Record<string, unknown>) =>
    ({ success: true }) as { success?: boolean; error?: string },
)

vi.mock("@/app/(platform)/admin/settings/actions", () => ({
  saveTenantSettings: (payload: Record<string, unknown>) => saveTenantSettings(payload),
}))

/**
 * O `LogoUpload` real sobe arquivo para o storage (I/O), então entra dublado —
 * mas o dublê REPRODUZ o contrato dele de propósito: preview em estado local
 * semeado UMA vez de `currentUrl` (`useState(currentUrl || null)`, o real faz
 * exatamente isso). Um dublê que lesse a prop a cada render esconderia o furo de
 * Descartar em vez de prová-lo.
 */
vi.mock("@/components/admin/logo-upload", () => ({
  LogoUpload: ({
    currentUrl,
    onUpload,
  }: {
    currentUrl?: string
    onUpload: (url: string) => void
  }) => {
    const [preview, setPreview] = React.useState(currentUrl ?? "")
    return (
      <div>
        <span data-testid="logo-url">{preview}</span>
        <button
          type="button"
          onClick={() => {
            setPreview("https://cdn.exemplo.com/novo.png")
            onUpload("https://cdn.exemplo.com/novo.png")
          }}
        >
          trocar logo
        </button>
      </div>
    )
  },
}))

import { OrgDataForm } from "../_components/org-data-form"

const INICIAL = {
  tenantId: "tenant-7",
  initialName: "Cory",
  initialLogoUrl: "https://cdn.exemplo.com/original.png",
  initialPrimaryColor: "#2a6ab0",
  initialSecondaryColor: "#1e1e1e",
}

function nomeInput() {
  return screen.getByLabelText("Nome da organização")
}

/** O `ColorPicker` real expõe o hex num campo de texto ao lado do `<input type=color>`. */
function corTextInputs() {
  return screen
    .getAllByRole("textbox")
    .filter((el) => (el as HTMLInputElement).value.startsWith("#"))
}

beforeEach(() => {
  vi.clearAllMocks()
  saveTenantSettings.mockResolvedValue({ success: true })
})

describe("OrgDataForm — Salvar", () => {
  it("envia nome e branding no formato exato que `saveTenantSettings` valida", async () => {
    render(<OrgDataForm {...INICIAL} />)

    fireEvent.change(nomeInput(), { target: { value: "Cory Agro" } })
    fireEvent.click(screen.getByText("trocar logo"))
    fireEvent.click(screen.getByText("Salvar"))

    await waitFor(() => expect(saveTenantSettings).toHaveBeenCalledTimes(1))
    expect(saveTenantSettings).toHaveBeenCalledWith({
      name: "Cory Agro",
      branding: {
        logo_url: "https://cdn.exemplo.com/novo.png",
        primary_color: "#2a6ab0",
        secondary_color: "#1e1e1e",
      },
    })
  })

  it("apara espaços do nome antes de enviar (o schema exige min 1)", async () => {
    render(<OrgDataForm {...INICIAL} />)

    fireEvent.change(nomeInput(), { target: { value: "  Cory  " } })
    fireEvent.click(screen.getByText("Salvar"))

    await waitFor(() => expect(saveTenantSettings).toHaveBeenCalledTimes(1))
    expect(saveTenantSettings.mock.calls[0][0]).toMatchObject({ name: "Cory" })
  })

  it("nome vazio desabilita Salvar (não chega a disparar a action)", () => {
    render(<OrgDataForm {...INICIAL} />)

    fireEvent.change(nomeInput(), { target: { value: "   " } })

    expect(screen.getByText("Salvar").closest("button")).toBeDisabled()
    expect(saveTenantSettings).not.toHaveBeenCalled()
  })

  it("erro devolvido pela action vira mensagem na tela, não 'salvo'", async () => {
    saveTenantSettings.mockResolvedValue({ error: "Acesso negado" })

    render(<OrgDataForm {...INICIAL} />)
    fireEvent.click(screen.getByText("Salvar"))

    await waitFor(() => expect(screen.getByText("Acesso negado")).toBeInTheDocument())
    expect(screen.queryByText("Dados da organização salvos.")).toBeNull()
  })
})

describe("OrgDataForm — Descartar", () => {
  it("reverte TODOS os campos para o valor persistido e NÃO chama a action", () => {
    render(<OrgDataForm {...INICIAL} />)

    fireEvent.change(nomeInput(), { target: { value: "Nome rascunhado" } })
    fireEvent.click(screen.getByText("trocar logo"))
    const [primaria, secundaria] = corTextInputs()
    fireEvent.change(primaria, { target: { value: "#ff0000" } })
    fireEvent.change(secundaria, { target: { value: "#00ff00" } })

    // Sanidade: o rascunho realmente existia antes do descarte.
    expect(nomeInput()).toHaveValue("Nome rascunhado")
    expect(screen.getByTestId("logo-url")).toHaveTextContent("https://cdn.exemplo.com/novo.png")

    fireEvent.click(screen.getByText("Descartar"))

    expect(nomeInput()).toHaveValue("Cory")
    expect(screen.getByTestId("logo-url")).toHaveTextContent("https://cdn.exemplo.com/original.png")
    const [primariaDepois, secundariaDepois] = corTextInputs()
    expect(primariaDepois).toHaveValue("#2a6ab0")
    expect(secundariaDepois).toHaveValue("#1e1e1e")

    // O ponto da story: descartar é local. Nada foi gravado.
    expect(saveTenantSettings).not.toHaveBeenCalled()
  })

  it("descartar depois de salvar volta ao valor PERSISTIDO na abertura, sem gravar de novo", async () => {
    render(<OrgDataForm {...INICIAL} />)

    fireEvent.change(nomeInput(), { target: { value: "Cory Agro" } })
    fireEvent.click(screen.getByText("Salvar"))
    // Esperar o FIM da transição, não só a chamada: durante `isPending` os dois
    // botões ficam desabilitados e um clique em Descartar seria engolido.
    await waitFor(() =>
      expect(screen.getByText("Dados da organização salvos.")).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByText("Descartar"))

    expect(nomeInput()).toHaveValue("Cory")
    expect(saveTenantSettings).toHaveBeenCalledTimes(1)
  })

  it("limpa a mensagem de erro pendente (o descarte não deixa alarme órfão)", async () => {
    saveTenantSettings.mockResolvedValue({ error: "Acesso negado" })

    render(<OrgDataForm {...INICIAL} />)
    fireEvent.click(screen.getByText("Salvar"))
    await waitFor(() => expect(screen.getByText("Acesso negado")).toBeInTheDocument())

    fireEvent.click(screen.getByText("Descartar"))

    expect(screen.queryByText("Acesso negado")).toBeNull()
  })

  it("sem logo inicial, descartar volta para vazio (e não para 'undefined')", () => {
    render(<OrgDataForm {...INICIAL} initialLogoUrl={undefined} />)

    fireEvent.click(screen.getByText("trocar logo"))
    expect(screen.getByTestId("logo-url")).toHaveTextContent("https://cdn.exemplo.com/novo.png")

    fireEvent.click(screen.getByText("Descartar"))
    expect(screen.getByTestId("logo-url")).toHaveTextContent("")
  })
})
