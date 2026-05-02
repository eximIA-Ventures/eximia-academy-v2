"use client"

import { Info } from "lucide-react"

export function ProfileDisclaimer() {
  return (
    <div className="flex items-start gap-2 text-text-muted">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-xs">
        Este perfil e baseado em suas interacoes com o tutor e evolui continuamente. Ele nao define
        suas capacidades — e uma ferramenta de autoconhecimento.
      </p>
    </div>
  )
}
