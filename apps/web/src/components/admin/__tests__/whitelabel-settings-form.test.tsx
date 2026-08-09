import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// CFG-4.1 (AC2) — A PROVA QUE NUNCA EXISTIU.
//
// O `WhitelabelSettingsForm` é o MESMO componente montado pela aba antiga de
// `/admin/settings` e pela seção "Marca & Aparência" do hub — e não tinha um
// único teste. A story trata suas capacidades como "já entregues, preservar";
// preservação sem gate é promessa, não garantia. Este arquivo é o gate: cobre os
// três comportamentos que só existem no cliente (contador reativo, validação de
// favicon e o reset), justamente os que um refactor silencioso quebraria sem
// que `tsc` ou `biome` percebessem.
//
// O único mock é o server action (I/O). Os componentes de `@eximia/ui` e o
// `WhitelabelPreview` entram REAIS, senão o teste passaria a provar o mock.
// =============================================================================

const saveWhitelabelConfig = vi.fn(
  async (_payload: Record<string, unknown>) => ({ error: null }) as { error: string | null },
)

vi.mock("@/app/(platform)/admin/settings/whitelabel-actions", () => ({
  saveWhitelabelConfig: (payload: Record<string, unknown>) => saveWhitelabelConfig(payload),
}))

import { WhitelabelSettingsForm } from "../whitelabel-settings-form"

const CONFIG_VAZIA: Record<string, unknown> = {}

beforeEach(() => {
  vi.clearAllMocks()
  saveWhitelabelConfig.mockResolvedValue({ error: null })
})

describe("WhitelabelSettingsForm — contador do nome do app", () => {
  it("parte do valor persistido, não de zero", () => {
    render(
      <WhitelabelSettingsForm
        tenantId="t1"
        whitelabelConfig={{ custom_texts: { app_name: "Cory" } }}
      />,
    )
    expect(screen.getByText("4/100 caracteres")).toBeInTheDocument()
  })

  it("atualiza a cada tecla (é reativo, não só inicial)", () => {
    render(<WhitelabelSettingsForm tenantId="t1" whitelabelConfig={CONFIG_VAZIA} />)

    expect(screen.getByText("0/100 caracteres")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nome do App"), {
      target: { value: "exímIA" },
    })
    expect(screen.getByText("6/100 caracteres")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Nome do App"), {
      target: { value: "exímIA Academy" },
    })
    expect(screen.getByText("14/100 caracteres")).toBeInTheDocument()
  })
})

describe("WhitelabelSettingsForm — favicon exige HTTPS", () => {
  it("URL http:// é rejeitada com a mensagem esperada e NÃO gera preview", () => {
    render(<WhitelabelSettingsForm tenantId="t1" whitelabelConfig={CONFIG_VAZIA} />)

    fireEvent.change(screen.getByLabelText("URL do Favicon"), {
      target: { value: "http://exemplo.com/favicon.ico" },
    })

    expect(screen.getByText("URL deve usar HTTPS")).toBeInTheDocument()
    expect(screen.queryByAltText("Favicon preview")).toBeNull()
  })

  it("texto que nem é URL também é rejeitado (não estoura o `new URL`)", () => {
    render(<WhitelabelSettingsForm tenantId="t1" whitelabelConfig={CONFIG_VAZIA} />)

    fireEvent.change(screen.getByLabelText("URL do Favicon"), {
      target: { value: "favicon.ico" },
    })

    expect(screen.getByText("URL deve usar HTTPS")).toBeInTheDocument()
  })

  it("URL https:// passa, some o erro e aparece o preview", () => {
    render(<WhitelabelSettingsForm tenantId="t1" whitelabelConfig={CONFIG_VAZIA} />)

    fireEvent.change(screen.getByLabelText("URL do Favicon"), {
      target: { value: "https://exemplo.com/favicon.ico" },
    })

    expect(screen.queryByText("URL deve usar HTTPS")).toBeNull()
    expect(screen.getByAltText("Favicon preview")).toHaveAttribute(
      "src",
      "https://exemplo.com/favicon.ico",
    )
  })
})

describe("WhitelabelSettingsForm — Resetar para Padrão", () => {
  it("chama saveWhitelabelConfig com objeto VAZIO (o que apaga a customização)", async () => {
    render(
      <WhitelabelSettingsForm
        tenantId="t1"
        whitelabelConfig={{
          custom_texts: { app_name: "Cory", tagline: "Aprender" },
          footer_text: "© Cory",
        }}
      />,
    )

    fireEvent.click(screen.getByText("Resetar para Padrao"))

    await waitFor(() => expect(saveWhitelabelConfig).toHaveBeenCalledTimes(1))
    expect(saveWhitelabelConfig).toHaveBeenCalledWith({})
  })

  it("limpa os campos na tela junto com o reset", async () => {
    render(
      <WhitelabelSettingsForm
        tenantId="t1"
        whitelabelConfig={{ custom_texts: { app_name: "Cory" } }}
      />,
    )

    fireEvent.click(screen.getByText("Resetar para Padrao"))

    await waitFor(() => expect(screen.getByText("0/100 caracteres")).toBeInTheDocument())
    expect(screen.getByLabelText("Nome do App")).toHaveValue("")
  })

  it("erro do servidor vira mensagem na tela, não sucesso silencioso", async () => {
    saveWhitelabelConfig.mockResolvedValue({ error: "Acesso negado" })

    render(<WhitelabelSettingsForm tenantId="t1" whitelabelConfig={CONFIG_VAZIA} />)
    fireEvent.click(screen.getByText("Resetar para Padrao"))

    await waitFor(() => expect(screen.getByText("Acesso negado")).toBeInTheDocument())
    expect(screen.queryByText("Configurações resetadas para o padrão!")).toBeNull()
  })
})

describe("WhitelabelSettingsForm — Salvar", () => {
  it("envia os textos digitados no formato que a action espera", async () => {
    render(<WhitelabelSettingsForm tenantId="t1" whitelabelConfig={CONFIG_VAZIA} />)

    fireEvent.change(screen.getByLabelText("Nome do App"), { target: { value: "Cory" } })
    fireEvent.change(screen.getByLabelText("Email de Suporte"), {
      target: { value: "suporte@cory.com" },
    })
    fireEvent.click(screen.getByText("Salvar Whitelabel"))

    await waitFor(() => expect(saveWhitelabelConfig).toHaveBeenCalledTimes(1))
    expect(saveWhitelabelConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_texts: expect.objectContaining({ app_name: "Cory" }),
        support_email: "suporte@cory.com",
      }),
    )
  })
})
