import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// TRAVA — o upload de logo/avatar falha VISÍVEL, e não persiste nada.
// ---------------------------------------------------------------------------
// Contexto (DECISOES-ABERTAS.md, Adendo 4): os dois componentes gravam no bucket
// `tenant-assets`, que **não existe** no projeto. Medido:
//
//     GET  /storage/v1/bucket/tenant-assets  -> {"code":"NoSuchBucket"}
//     POST /storage/v1/object/tenant-assets/... -> {"message":"Bucket not found"}
//
// Ou seja: hoje TODO upload de logo de cliente e de foto de onboarding falha.
//
// Estes testes NÃO corrigem esse defeito — a correção exige CRIAR o bucket, que é
// escrita em produção e está com o Senhor. Eles trancam as duas propriedades que
// medi e que impedem o defeito de piorar para a família que perseguimos:
//
//   1. a falha APARECE (não é silenciosa);
//   2. NADA é propagado ao formulário — o callback só roda no sucesso, então não
//      se grava ponteiro para arquivo inexistente.
//
// O pior desfecho possível aqui seria alguém "limpar" o tratamento de erro e
// transformar uma falha visível numa tela que parece ter salvo o logo. Esta é a
// rede contra isso.
// ---------------------------------------------------------------------------

const ERRO_BUCKET = { message: "Bucket not found", name: "StorageApiError" }

let erroDoUpload: unknown = ERRO_BUCKET

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: erroDoUpload }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `http://duplo/${p}` } }),
      }),
    },
  }),
}))

// Duplo mínimo de `next/image`: só o preview importa aqui, e `createElement`
// evita as regras de JSX sobre `<img>` sem tocar na configuração do biome.
vi.mock("next/image", () => ({
  default: ({ src }: { src: string }) => createElement("img", { src, alt: "preview" }),
}))

import { LogoUpload } from "../logo-upload"

function arquivoPng() {
  return new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" })
}

beforeEach(() => {
  erroDoUpload = ERRO_BUCKET
  // jsdom não implementa createObjectURL, e o componente o usa para o preview local.
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", { value: () => "blob:duplo", writable: true })
  }
})

describe("LogoUpload — upload que falha não pode calar", () => {
  it("falha do storage APARECE para o administrador", async () => {
    const aoSubir = vi.fn()
    const { container } = render(
      <LogoUpload tenantId="t1" currentUrl={undefined} onUpload={aoSubir} />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [arquivoPng()] } })

    await waitFor(() => expect(screen.getByText(/bucket not found/i)).toBeInTheDocument())
  })

  it("falha do storage NÃO propaga URL nenhuma ao formulário", async () => {
    // O ponto: se `onUpload` fosse chamado apesar do erro, o formulário guardaria
    // um endereço para um arquivo que não existe, e a tela seguinte mostraria
    // imagem quebrada sem explicar. É a falha que se apresenta como sucesso.
    const aoSubir = vi.fn()
    const { container } = render(
      <LogoUpload tenantId="t1" currentUrl={undefined} onUpload={aoSubir} />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [arquivoPng()] } })

    await waitFor(() => expect(screen.getByText(/bucket not found/i)).toBeInTheDocument())
    expect(aoSubir).not.toHaveBeenCalled()
  })

  it("[CP] upload que dá certo continua propagando a URL", async () => {
    // Sem este caso, "nunca chame onUpload" ficaria verde e o componente pararia
    // de funcionar quando o bucket existir.
    erroDoUpload = null
    const aoSubir = vi.fn()
    const { container } = render(
      <LogoUpload tenantId="t1" currentUrl={undefined} onUpload={aoSubir} />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [arquivoPng()] } })

    await waitFor(() => expect(aoSubir).toHaveBeenCalledTimes(1))
    expect(String(aoSubir.mock.calls[0][0])).toContain("t1/logo.png")
  })

  it("[CP] tipo inválido continua barrado antes de tocar no storage", async () => {
    const aoSubir = vi.fn()
    const { container } = render(
      <LogoUpload tenantId="t1" currentUrl={undefined} onUpload={aoSubir} />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(["x"], "a.txt", { type: "text/plain" })] },
    })

    await waitFor(() => expect(screen.getByText(/tipo inválido/i)).toBeInTheDocument())
    expect(aoSubir).not.toHaveBeenCalled()
  })
})
