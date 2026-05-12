"use client"

import type { ModuleId } from "@eximia/shared"
import { useModules } from "@/components/providers/module-provider"
import { Lock, Mail } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

interface ModuleGateProps {
  /** Required module for this content to render */
  module: ModuleId
  children: ReactNode
  /** What to show when module is disabled. Default: upsell page */
  fallback?: "upsell" | "hidden" | ReactNode
}

const MODULE_NAMES: Record<string, string> = {
  assessments: "Avaliações",
  biblioteca: "Biblioteca",
  community: "Comunidade",
  "course-designer": "Course Designer",
  units: "Unidades Gerenciais",
  integrations: "Integrações",
}

export function ModuleGate({ module, children, fallback = "upsell" }: ModuleGateProps) {
  const { isEnabled } = useModules()

  if (isEnabled(module)) {
    return <>{children}</>
  }

  if (fallback === "hidden") {
    return null
  }

  if (fallback !== "upsell") {
    return <>{fallback}</>
  }

  const moduleName = MODULE_NAMES[module] ?? module

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-cerrado-600/10">
          <Lock size={28} className="text-cerrado-600" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">
          Modulo nao disponivel
        </h1>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
          O modulo <strong>{moduleName}</strong> nao esta incluso no seu plano atual.
          Entre em contato com o administrador para contratar este servico.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="mailto:suporte@eximiaventures.com.br?subject=Interesse%20no%20modulo%20${encodeURIComponent(moduleName)}"
            className="inline-flex items-center gap-2 rounded-xl bg-cerrado-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cerrado-700 active:scale-[0.98]"
          >
            <Mail size={16} />
            Entrar em contato
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-bg-surface px-5 py-2.5 text-sm font-medium text-text-primary shadow-card transition-all hover:shadow-elevated"
          >
            Voltar ao inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
