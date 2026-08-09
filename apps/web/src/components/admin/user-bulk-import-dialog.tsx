"use client"

import { SKIP_REASON_LABEL, type SkippedRow } from "@/app/(platform)/admin/users/bulk-import"
import {
  Badge,
  Button,
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Textarea,
} from "@eximia/ui"
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react"
import { type ChangeEvent, useCallback, useRef, useState } from "react"

/**
 * Import em massa de usuários (CFG-6.1).
 *
 * ## O desenho é o guarda-corpo
 *
 * O fluxo tem TRÊS passos e o do meio não é decorativo: nenhum convite sai antes
 * de a tela mostrar, em número, quantas pessoas serão criadas e quantas linhas
 * serão ignoradas — e por qual motivo cada uma. O botão que dispara diz o número
 * ("Criar 12 usuários"), não "Confirmar": um botão genérico é como alguém envia
 * 300 convites achando que enviaria 3.
 *
 * A conferência de duplicidade e de e-mail já existente NÃO acontece aqui, e sim
 * no servidor (`api/admin/users/bulk-invite`, modo `preview`), pela mesma função
 * que o `apply` usa. O navegador não tem como saber quem já existe, e um palpite
 * na tela que não valesse no servidor seria pior que nenhum palpite.
 */

/* --------------------------------- Types --------------------------------- */

interface PreviewRow {
  line: number
  full_name: string
  email: string
  role: string
}

interface PreviewPayload {
  counts: {
    total: number
    toCreate: number
    invalid: number
    duplicateInFile: number
    alreadyExists: number
  }
  toCreate: PreviewRow[]
  skipped: SkippedRow[]
}

interface ApplyPayload {
  created: { line: number; email: string }[]
  failed: { line: number; email: string; message: string }[]
}

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

const ROLE_LABEL: Record<string, string> = {
  student: "Estudante",
  leader: "Líder Educador",
  manager: "Gestor",
  admin: "Administrador",
  instructor: "Instrutor",
}

const EXAMPLE = "nome,email,papel\nMaria Silva,maria@empresa.com.br,Estudante"

/* ------------------------------- Component ------------------------------- */

export function UserBulkImportDialog({ open, onOpenChange, onImported }: BulkImportDialogProps) {
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [result, setResult] = useState<ApplyPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const reset = useCallback(() => {
    setCsv("")
    setFileName(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setBusy(false)
  }, [])

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) reset()
      onOpenChange(isOpen)
    },
    [onOpenChange, reset],
  )

  const handleFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    // Trocar o arquivo invalida a pré-visualização anterior: confirmar sobre uma
    // contagem velha é exatamente o acidente que este fluxo existe para impedir.
    setPreview(null)
    setResult(null)
    setError(null)
  }, [])

  const handlePreview = useCallback(async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/admin/users/bulk-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", csv }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Não foi possível ler o arquivo.")
      setPreview(json as PreviewPayload)
    } catch (err) {
      setPreview(null)
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setBusy(false)
    }
  }, [csv])

  const handleApply = useCallback(async () => {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users/bulk-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", csv, expected: preview.counts.toCreate }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 409) {
        // O servidor recalculou e o número mudou. Nada foi criado; a tela volta
        // para a pré-visualização NOVA, e o admin confirma de novo se quiser.
        setPreview(json as PreviewPayload)
        throw new Error(json.error ?? "O resultado mudou. Nada foi criado.")
      }
      if (!res.ok) throw new Error(json.error ?? "Falha ao criar os usuários.")
      setResult(json as ApplyPayload)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setBusy(false)
    }
  }, [csv, preview, onImported])

  return (
    <Modal open={open} onOpenChange={handleClose}>
      <ModalOverlay />
      <ModalContent size="lg">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <ModalTitle>Importar usuários em massa</ModalTitle>
            <ModalClose />
          </div>
          <ModalDescription>
            Envie uma planilha CSV com <strong>nome</strong>, <strong>email</strong> e (opcional){" "}
            <strong>papel</strong>. Nada é criado antes de você conferir a pré-visualização.
          </ModalDescription>
        </ModalHeader>

        <div className="mt-6 space-y-4">
          {/* Passo 1 — arquivo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFile}
                className="hidden"
                aria-label="Arquivo CSV"
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload size={14} />
                Escolher arquivo
              </Button>
              {fileName && <span className="text-sm text-text-secondary">{fileName}</span>}
            </div>
            <Textarea
              aria-label="Conteúdo CSV"
              rows={5}
              value={csv}
              placeholder={EXAMPLE}
              onChange={(e) => {
                setCsv(e.target.value)
                setPreview(null)
                setResult(null)
              }}
            />
            <p className="text-xs text-text-muted">
              Aceita vírgula ou ponto e vírgula como separador. Papel em branco vira Estudante.
            </p>
          </div>

          {/* Passo 2 — pré-visualização */}
          {preview && !result && (
            <div className="space-y-3 rounded-md border border-border-default p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{preview.counts.toCreate} a criar</Badge>
                <Badge variant={preview.counts.alreadyExists > 0 ? "warning" : "default"}>
                  {preview.counts.alreadyExists} já cadastrados
                </Badge>
                <Badge variant={preview.counts.duplicateInFile > 0 ? "warning" : "default"}>
                  {preview.counts.duplicateInFile} repetidos no arquivo
                </Badge>
                <Badge variant={preview.counts.invalid > 0 ? "error" : "default"}>
                  {preview.counts.invalid} inválidos
                </Badge>
                <Badge variant="default">{preview.counts.total} linhas lidas</Badge>
              </div>

              {preview.toCreate.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md bg-bg-surface p-2">
                  <p className="mb-1 font-semibold text-text-secondary text-xs uppercase tracking-wide">
                    Serão criados
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {preview.toCreate.map((row) => (
                      <li key={`${row.line}-${row.email}`} className="text-text-secondary">
                        <span className="text-text-muted">linha {row.line}</span> — {row.full_name}{" "}
                        ({row.email}) · {ROLE_LABEL[row.role] ?? row.role}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.skipped.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md bg-bg-surface p-2">
                  <p className="mb-1 flex items-center gap-1 font-semibold text-text-secondary text-xs uppercase tracking-wide">
                    <AlertTriangle size={12} />
                    Serão ignorados
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {preview.skipped.map((row) => (
                      <li key={`${row.line}-${row.reason}`} className="text-text-secondary">
                        <span className="text-text-muted">linha {row.line}</span> —{" "}
                        {row.email || "sem e-mail"} · {SKIP_REASON_LABEL[row.reason]}: {row.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Passo 3 — resultado */}
          {result && (
            <div className="space-y-2 rounded-md border border-border-default p-3">
              <p className="flex items-center gap-1.5 text-semantic-success text-sm">
                <CheckCircle2 size={14} />
                {result.created.length} usuário(s) convidado(s).
              </p>
              {result.failed.length > 0 && (
                <div className="space-y-1">
                  <p className="text-semantic-error text-sm">
                    {result.failed.length} linha(s) falharam e NÃO foram criadas:
                  </p>
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto text-sm text-text-secondary">
                    {result.failed.map((row) => (
                      <li key={`${row.line}-${row.email}`}>
                        <span className="text-text-muted">linha {row.line}</span> — {row.email}:{" "}
                        {row.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-semantic-error">{error}</p>}

          <ModalFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
              {result ? "Fechar" : "Cancelar"}
            </Button>
            {!result &&
              (preview ? (
                <Button onClick={handleApply} disabled={busy || preview.counts.toCreate === 0}>
                  {busy ? "Criando..." : `Criar ${preview.counts.toCreate} usuário(s)`}
                </Button>
              ) : (
                <Button onClick={handlePreview} disabled={busy || csv.trim() === ""}>
                  {busy ? "Analisando..." : "Pré-visualizar"}
                </Button>
              ))}
          </ModalFooter>
        </div>
      </ModalContent>
    </Modal>
  )
}
