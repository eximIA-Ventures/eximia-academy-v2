"use client"

import { createClient } from "@/lib/supabase/client"
import { Button, Label } from "@eximia/ui"
import { ImageIcon, Trash2, Upload } from "lucide-react"
import { useCallback, useRef, useState } from "react"

// ===========================================================================
// POR QUE ESTE COMPONENTE EXISTE AO LADO DE `components/admin/logo-upload.tsx`
//
// `LogoUpload` crava o caminho `${tenantId}/logo.png` (linha 46). O wizard sobe
// TRÊS arquivos para a mesma pasta — logo, logo claro e favicon — e com o nome
// cravado os três se sobrescreveriam: o super_admin escolheria três imagens e
// ficaria com uma. Generalizar `LogoUpload` com uma prop `path` é o desfecho
// certo, mas aquele arquivo tem outro dono nesta rodada; até lá, o logo
// principal continua sendo subido por ele (mesmo caminho que o resto do app
// espera) e os outros dois passam por aqui.
//
// O bucket é `tenant-assets` e a pasta é o `tenantId` gerado no cliente ANTES do
// POST — é por isso que o wizard gera o UUID e o manda no corpo: as policies de
// D12 amarram a pasta ao tenant, então um id diferente deixaria o arquivo numa
// pasta que o admin da empresa jamais poderia reescrever. Quem escreve aqui é
// super_admin (`tenant_assets_super_admin_write`), que pode gravar antes de a
// empresa existir.
// ===========================================================================

const TAMANHO_MAXIMO = 2 * 1024 * 1024 // 2MB, igual ao LogoUpload
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/svg+xml", "image/x-icon"]

interface UploadDeArquivoDaMarcaProps {
  label: string
  tenantId: string
  /** Nome do objeto dentro de `tenant-assets/{tenantId}/`. Ex.: `logo-light.png`. */
  nomeDoArquivo: string
  valorAtual?: string
  ajuda?: string
  onUpload: (url: string) => void
}

export function UploadDeArquivoDaMarca({
  label,
  tenantId,
  nomeDoArquivo,
  valorAtual,
  ajuda,
  onUpload,
}: UploadDeArquivoDaMarcaProps) {
  const [preview, setPreview] = useState<string | null>(valorAtual ?? null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const aoEscolherArquivo = useCallback(
    async (evento: React.ChangeEvent<HTMLInputElement>) => {
      const arquivo = evento.target.files?.[0]
      if (!arquivo) return

      setErro(null)
      if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        setErro("Tipo inválido. Use PNG, JPG, SVG ou ICO.")
        return
      }
      if (arquivo.size > TAMANHO_MAXIMO) {
        setErro("Arquivo muito grande. Maximo 2MB.")
        return
      }

      setPreview(URL.createObjectURL(arquivo))
      setEnviando(true)
      try {
        const supabase = createClient()
        const caminho = `${tenantId}/${nomeDoArquivo}`
        const { error: erroDeUpload } = await supabase.storage
          .from("tenant-assets")
          .upload(caminho, arquivo, { cacheControl: "3600", upsert: true })

        if (erroDeUpload) {
          setErro(erroDeUpload.message)
          setPreview(valorAtual ?? null)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("tenant-assets").getPublicUrl(caminho)
        const urlFinal = `${publicUrl}?t=${Date.now()}`
        setPreview(urlFinal)
        onUpload(urlFinal)
      } catch {
        setErro("Falha ao enviar arquivo.")
        setPreview(valorAtual ?? null)
      } finally {
        setEnviando(false)
      }
    },
    [tenantId, nomeDoArquivo, valorAtual, onUpload],
  )

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-surface shadow-card">
          {preview ? (
            // Sem `next/image`: a URL do Storage é pública e o preview local é um
            // blob: — o otimizador não serve nenhum dos dois sem configuração de
            // domínio, que é ajuste de build, não de tela.
            <img
              src={preview}
              alt={`Previa de ${label}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon size={24} className="text-text-muted" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
            >
              <Upload size={14} />
              {enviando ? "Enviando..." : "Upload"}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreview(null)
                  onUpload("")
                  if (inputRef.current) inputRef.current.value = ""
                }}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted">{ajuda ?? "PNG, JPG, SVG ou ICO. Max 2MB."}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_ACEITOS.join(",")}
        onChange={aoEscolherArquivo}
        className="hidden"
        aria-label={`Upload de ${label}`}
      />

      {erro && <p className="text-xs text-semantic-error">{erro}</p>}
    </div>
  )
}
