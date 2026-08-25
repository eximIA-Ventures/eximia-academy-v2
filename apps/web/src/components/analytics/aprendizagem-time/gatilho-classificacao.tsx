"use client"

// ---------------------------------------------------------------------------
// Dispara o pipeline de classificação (`/api/analytics/aprendizagem-time/
// classify`) em `useEffect`, sem bloquear o render — fire-and-forget, sem
// retry visível. Mesmo modelo de staleness já em produção para
// `semantic_analyses` (a tela mostra o que já existe; a próxima carga lê o
// resultado desta chamada).
// ---------------------------------------------------------------------------

import { useEffect } from "react"

export function GatilhoClassificacao() {
  useEffect(() => {
    fetch("/api/analytics/aprendizagem-time/classify", { method: "POST" }).catch(() => {
      // Silencioso de propósito: é "melhor da próxima carga", não uma ação
      // que o gestor pediu — uma falha aqui não deve virar toast nem erro.
    })
  }, [])

  return null
}
