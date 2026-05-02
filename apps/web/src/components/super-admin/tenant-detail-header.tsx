"use client"

import { Button, useToast } from "@eximia/ui"
import { ArrowRight, Check, Copy, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface TenantDetailHeaderProps {
  slug: string
  tenantId: string
  status: string
}

export function TenantDetailHeader({ slug, tenantId, status }: TenantDetailHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function copyUrl() {
    const url = `${window.location.origin}/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast({ title: "URL copiada", description: url, variant: "success" })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Erro", description: "Falha ao copiar URL.", variant: "error" })
    }
  }

  function handleOpenPlatform() {
    document.cookie = `x-sa-active-tenant=${tenantId};path=/;max-age=86400`
    router.push(`/${slug}/dashboard`)
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="rounded-md bg-white/[0.08] px-2 py-1 font-mono text-xs text-text-secondary ring-1 ring-white/[0.1]">
        /{slug}
      </span>

      <button
        type="button"
        onClick={copyUrl}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
        title="Copiar URL"
      >
        {copied ? <Check size={12} className="text-semantic-success" /> : <Copy size={12} />}
        {copied ? "Copiado" : "Copiar URL"}
      </button>

      <a
        href={`/${slug}/login`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
      >
        <ExternalLink size={12} />
        Abrir Login
      </a>

      {status === "active" && (
        <Button size="sm" className="rounded-xl ml-auto" onClick={handleOpenPlatform}>
          Abrir Plataforma
          <ArrowRight size={14} className="ml-1.5" />
        </Button>
      )}
    </div>
  )
}
