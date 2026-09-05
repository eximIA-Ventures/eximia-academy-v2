"use client"

import { MODULE_DEFINITIONS, MODULE_IDS, type ModuleId } from "@eximia/shared"
import {
  Badge,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import { DownloadCloud, Globe } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

// ===========================================================================
// A MARCA DA EMPRESA, COMO ELA ESTÁ GRAVADA — e o botão da D20.
//
// O painel mostra `tenants.brand`, `tenants.modules` e os endereços porque, sem
// isso, "importar a marca do ambiente" seria um botão que faz algo invisível: o
// super_admin não teria como saber o que havia antes nem o que mudou.
//
// O host canônico exibido é derivado por STRING (`{slug}.{base}`, D1) e não sai
// de `tenant_domains` — aquela tabela guarda só o domínio PRÓPRIO.
// ===========================================================================

interface PainelDeMarcaProps {
  tenantId: string
  slug: string
  plan: string
  brand: Record<string, unknown>
  modules: string[]
  /** `{slug}.{base}`; `null` quando NEXT_PUBLIC_APP_BASE_DOMAIN não existe. */
  host: string | null
  dominiosProprios: Array<{ host: string; is_primary: boolean; verified_at: string | null }>
}

function corOuNada(valor: unknown): string | null {
  return typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : null
}

export function PainelDeMarca({
  tenantId,
  slug,
  plan,
  brand,
  modules,
  host,
  dominiosProprios,
}: PainelDeMarcaProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [confirmando, setConfirmando] = useState(false)
  const [importando, setImportando] = useState(false)

  const primaria = corOuNada(brand.primaryColor)
  const destaque = corOuNada(brand.accentColor)
  const logo = typeof brand.logo === "string" ? brand.logo : null

  const validos = new Set<string>(MODULE_IDS)
  const modulosLegiveis = modules
    .filter((m): m is ModuleId => validos.has(m))
    .map((m) => MODULE_DEFINITIONS[m])

  async function importarDoAmbiente() {
    setImportando(true)
    try {
      const resposta = await fetch(`/api/admin/tenants/${tenantId}/importar-marca-do-ambiente`, {
        method: "POST",
      })
      const json = await resposta.json()
      if (!resposta.ok) {
        toast({ variant: "error", title: json.error ?? "Falha ao importar a marca" })
        return
      }
      toast({ variant: "success", title: "Marca do ambiente importada." })
      setConfirmando(false)
      router.refresh()
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="rounded-2xl bg-bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Marca e endereços</h3>
          <p className="text-xs text-text-muted">
            O que o app serve para esta empresa, por host. Plano: {plan}.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirmando(true)}>
          <DownloadCloud size={14} />
          Importar marca do ambiente
        </Button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Endereços
          </p>
          <p className="flex items-center gap-2 font-mono text-sm text-text-primary">
            <Globe size={14} className="text-text-muted" />
            {host ?? "NEXT_PUBLIC_APP_BASE_DOMAIN não definido"}
          </p>
          {dominiosProprios.map((dominio) => (
            <p key={dominio.host} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="font-mono">{dominio.host}</span>
              {dominio.is_primary && (
                <Badge badgeSize="sm" variant="info">
                  primário
                </Badge>
              )}
              {!dominio.verified_at && (
                <Badge badgeSize="sm" variant="warning">
                  sem verificação
                </Badge>
              )}
            </p>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Marca
          </p>
          <div className="flex items-center gap-3">
            {logo ? (
              // Sem `next/image`: a URL vem do Storage do tenant e o otimizador
              // exigiria cadastrar o domínio no build.
              <img
                src={logo}
                alt={`Logo de ${String(brand.name ?? slug)}`}
                className="h-10 w-10 rounded-lg bg-bg-surface object-contain"
              />
            ) : (
              <span className="text-xs text-text-muted">sem logo</span>
            )}
            {primaria && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span
                  className="h-5 w-5 rounded-sm shadow-card"
                  style={{ backgroundColor: primaria }}
                  aria-hidden
                />
                <span className="font-mono">{primaria}</span>
              </span>
            )}
            {destaque && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span
                  className="h-5 w-5 rounded-sm shadow-card"
                  style={{ backgroundColor: destaque }}
                  aria-hidden
                />
                <span className="font-mono">{destaque}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          Módulos
        </p>
        {modulosLegiveis.length === 0 ? (
          <p className="text-xs text-text-muted">
            Nenhum módulo declarado no banco — o app cai no ambiente e, depois, no neutro.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {modulosLegiveis.map((modulo) => (
              <Badge key={modulo.id} badgeSize="sm" variant={modulo.core ? "default" : "info"}>
                {modulo.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Modal open={confirmando} onOpenChange={setConfirmando}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Importar marca do ambiente</ModalTitle>
            <ModalDescription>
              Copia as variáveis NEXT_PUBLIC_TENANT_* DESTE serviço para a marca, os módulos e as
              configurações de {String(brand.name ?? slug)}. Só funciona se o serviço estiver
              configurado para o slug <span className="font-mono">{slug}</span> — se não estiver, o
              pedido é recusado em vez de gravar a marca de outra empresa aqui.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={importando}>
              Cancelar
            </Button>
            <Button onClick={importarDoAmbiente} disabled={importando}>
              {importando ? "Importando..." : "Importar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
