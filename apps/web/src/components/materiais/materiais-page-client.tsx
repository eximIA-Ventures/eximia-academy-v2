"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Button,
  Card,
  CardContent,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalClose,
  useToast,
} from "@eximia/ui"
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileImage,
  Film,
  File,
  Upload,
  Trash2,
  FolderOpen,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { uploadMaterial } from "@/lib/utils/material-upload"

interface Material {
  id: string
  title: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  created_at: string
}

function fileIcon(type: string | null) {
  switch (type) {
    case "pdf":
      return <FileText className="h-8 w-8 text-red-400" />
    case "ppt":
    case "pptx":
      return <FileSpreadsheet className="h-8 w-8 text-orange-400" />
    case "xls":
    case "xlsx":
    case "csv":
      return <FileSpreadsheet className="h-8 w-8 text-green-400" />
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return <FileImage className="h-8 w-8 text-blue-400" />
    case "mp4":
    case "mov":
      return <Film className="h-8 w-8 text-purple-400" />
    default:
      return <File className="h-8 w-8 text-text-muted" />
  }
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const canManage = (role: string) => ["manager", "admin", "super_admin"].includes(role)

export function MateriaisPageClient({ role, tenantId }: { role: string; tenantId: string }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMaterials = useCallback(async () => {
    const { data } = await supabase
      .from("materials")
      .select("id, title, file_name, file_url, file_type, file_size, created_at")
      .order("created_at", { ascending: false })

    setMaterials(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  async function handleUpload() {
    if (!file || !title.trim()) return
    setUploading(true)
    try {
      const result = await uploadMaterial(supabase, file, tenantId)

      const { error } = await supabase.from("materials").insert({
        tenant_id: tenantId,
        title: title.trim(),
        file_name: result.fileName,
        file_url: result.publicUrl,
        file_type: result.fileType,
        file_size: result.fileSize,
      })

      if (error) throw new Error(error.message)

      toast({ title: "Material enviado com sucesso" })
      setModalOpen(false)
      setTitle("")
      setFile(null)
      fetchMaterials()
    } catch (err) {
      toast({ title: "Erro ao enviar material", description: (err as Error).message, variant: "error" })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(material: Material) {
    const { error } = await supabase.from("materials").delete().eq("id", material.id)
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "error" })
      return
    }
    toast({ title: "Material removido" })
    fetchMaterials()
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      {canManage(role) && (
        <div className="flex justify-end">
          <Button onClick={() => setModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Enviar Material
          </Button>
        </div>
      )}

      {/* Count */}
      {!loading && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          {materials.length} {materials.length === 1 ? "material" : "materiais"}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-bg-surface shadow-card" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple/5 via-bg-card to-bg-card py-16 shadow-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-purple/10">
            <FolderOpen className="h-8 w-8 text-accent-purple/60" />
          </div>
          <p className="mt-4 text-base font-semibold text-text-primary">Nenhum material disponivel</p>
          <p className="mt-1 text-sm text-text-muted">
            {canManage(role) ? 'Clique em "Enviar Material" para adicionar.' : "Aguarde novos materiais."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {materials.map((m) => (
            <div
              key={m.id}
              className="group flex flex-col rounded-2xl bg-gradient-to-br from-accent-purple/5 via-bg-card to-bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated hover:ring-accent-purple/20"
            >
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-purple/10">
                    {fileIcon(m.file_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-text-primary transition-colors group-hover:text-accent-purple">
                      {m.title}
                    </h3>
                    <p className="truncate text-xs text-text-muted">{m.file_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-bg-elevated/80 px-2 py-0.5 text-[10px] font-semibold text-text-muted shadow-card backdrop-blur-sm">
                    {formatSize(m.file_size)}
                  </span>
                  <span className="text-text-muted/30">·</span>
                  <span className="text-[10px] font-medium text-text-muted">{formatDate(m.created_at)}</span>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-purple/10 px-3 py-2 text-sm font-medium text-accent-purple transition-colors hover:bg-accent-purple/20"
                  >
                    <Download className="h-4 w-4" />
                    Baixar
                  </a>
                  {canManage(role) && (
                    <button
                      onClick={() => handleDelete(m)}
                      className="rounded-xl p-2 text-text-muted transition-colors hover:bg-semantic-error/10 hover:text-semantic-error"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Enviar Material</ModalTitle>
          </ModalHeader>

          <div className="space-y-4 px-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Titulo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Apresentacao Modulo 1"
                className="h-10 w-full rounded-xl shadow-card bg-bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Arquivo</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-accent-purple/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-purple hover:file:bg-accent-purple/20"
              />
            </div>
          </div>

          <ModalFooter>
            <ModalClose>Cancelar</ModalClose>
            <Button onClick={handleUpload} disabled={uploading || !file || !title.trim()}>
              {uploading ? "Enviando..." : "Enviar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
