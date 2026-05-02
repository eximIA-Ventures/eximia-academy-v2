"use client"

import { uploadChapterAsset } from "@/lib/utils/chapter-asset-upload"
import { createClient } from "@/lib/supabase/client"
import { Button, Input, RadioGroup, RadioItem, useToast } from "@eximia/ui"
import type { ImageSize, ImageAlign } from "@/lib/utils/parse-image-alt"
import { ImagePlus } from "lucide-react"
import { useRef, useState } from "react"

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp"

interface ImageUploadButtonProps {
  chapterId: string
  tenantId: string
  onInsert: (markdownImg: string) => void
}

export function ImageUploadButton({ chapterId, tenantId, onInsert }: ImageUploadButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [altText, setAltText] = useState("")
  const [size, setSize] = useState<ImageSize>("100")
  const [align, setAlign] = useState<ImageAlign>("center")
  const { toast } = useToast()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const supabase = createClient()
      const url = await uploadChapterAsset(supabase, file, tenantId, chapterId, "images")
      setUploadedUrl(url)
      setAltText("")
      setSize("100")
      setAlign("center")
    } catch (err) {
      toast({ variant: "error", title: err instanceof Error ? err.message : "Erro ao fazer upload da imagem" })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function handleInsert() {
    if (!uploadedUrl) return

    const safeAlt = altText.replace(/\|/g, "-")
    const needsPipes = size !== "100" || align !== "center"
    const altPart = needsPipes ? `${safeAlt}|${size}|${align}` : safeAlt
    onInsert(`![${altPart}](${uploadedUrl})`)
    setUploadedUrl(null)
  }

  function handleCancel() {
    setUploadedUrl(null)
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGES}
        onChange={handleFileChange}
        className="hidden"
      />

      {!uploadedUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <ImagePlus size={14} className="mr-1.5" />
          {uploading ? "Enviando..." : "Inserir Imagem"}
        </Button>
      )}

      {uploadedUrl && (
        <div className="w-full rounded-md border border-border-medium bg-bg-card p-4 space-y-4">
          {/* Thumbnail */}
          <div className="flex justify-center">
            <img
              src={uploadedUrl}
              alt="Preview"
              className="max-h-32 rounded-md object-contain"
            />
          </div>

          {/* Alt text */}
          <div className="space-y-1">
            <label htmlFor="img-alt" className="text-xs font-medium text-text-secondary">
              Descrição (alt text)
            </label>
            <Input
              id="img-alt"
              placeholder="Descreva a imagem..."
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
            />
          </div>

          {/* Size */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-text-secondary">Tamanho</span>
            <RadioGroup value={size} onValueChange={(v) => setSize(v as ImageSize)}>
              <RadioItem value="33">33%</RadioItem>
              <RadioItem value="50">50%</RadioItem>
              <RadioItem value="75">75%</RadioItem>
              <RadioItem value="100">100%</RadioItem>
            </RadioGroup>
          </div>

          {/* Alignment */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-text-secondary">Posicao</span>
            <RadioGroup value={align} onValueChange={(v) => setAlign(v as ImageAlign)}>
              <RadioItem value="left">Esquerda</RadioItem>
              <RadioItem value="center">Centro</RadioItem>
              <RadioItem value="right">Direita</RadioItem>
            </RadioGroup>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleInsert}>
              Inserir
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
