"use client"

import { useEffect } from "react"

// ---------------------------------------------------------------------------
// ForceLightTheme — mantém o <html> SEM a classe `dark` enquanto o preview
// estiver montado.
//
// POR QUE UM MutationObserver E NÃO UM useEffect SIMPLES:
// o ThemeProvider do app (apps/web/src/components/providers/theme-provider.tsx)
// resolve o tema no MOUNT dele e chama classList.add("dark") quando o modo é
// "system" e o SO está escuro. Em React, os effects dos FILHOS rodam ANTES do
// effect do PAI — ou seja, um `classList.remove("dark")` feito aqui seria
// desfeito pelo provider logo em seguida. O observer é a única forma de vencer
// essa corrida sem tocar no provider (que é código de produção fora do escopo).
//
// NÃO escreve em localStorage de propósito: isso mudaria silenciosamente o tema
// do app inteiro no navegador de quem abrisse a URL de preview.
// ---------------------------------------------------------------------------
export function ForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement
    const forceLight = () => {
      if (root.classList.contains("dark")) root.classList.remove("dark")
    }

    forceLight()
    const observer = new MutationObserver(forceLight)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [])

  return null
}
