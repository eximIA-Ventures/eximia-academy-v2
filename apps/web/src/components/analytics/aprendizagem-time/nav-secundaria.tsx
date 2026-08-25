// ---------------------------------------------------------------------------
// Barra de navegação secundária do domínio "Aprendizagem do Time" — usada
// tanto para o seletor de DOMÍNIO (Ativação ⇄ Aprendizagem) quanto para a
// trinca de VISTAS (Visão geral / Padrões e evolução / Mapa de capacidades).
//
// Não reusa `NavAbas` (`components/analytics/visao-geral/nav-abas.tsx`)
// porque aquele componente reescreve especificamente `?tab=` via
// `hrefDaAba` — um valor com significado FIXO dentro do domínio de Ativação.
// Reusar a chave `tab=` aqui criaria ambiguidade com bookmarks antigos de
// `/analytics?tab=padroes`. Este componente aceita `href` PRONTO por item.
//
// A CLASSE/estilo é uma cópia deliberada de `nav-abas.tsx` (mesma aparência,
// para as duas trincas parecerem o mesmo produto) — não há PNG de referência
// pixel-exato para Aprendizagem do Time, então não há régua para recalibrar
// contra; a cópia mantém consistência visual sem fingir precisão que não existe.
// ---------------------------------------------------------------------------

import { COR_ACAO, TEXTO } from "@/components/analytics/visao-geral/design"
import Link from "next/link"
import type { CSSProperties } from "react"

export interface ItemNavSecundaria {
  id: string
  rotulo: string
  ativo: boolean
  href: string
}

const CLASSE_ITEM = "px-[9px] pb-[3px] text-[14.1px] leading-[18px] whitespace-nowrap"

function estiloDoItem(ativo: boolean): CSSProperties {
  return {
    color: ativo ? COR_ACAO : TEXTO.mudo,
    fontWeight: ativo ? 600 : 500,
    letterSpacing: "-0.006em",
    borderBottom: ativo ? `3px solid ${COR_ACAO}` : "3px solid transparent",
  }
}

export function NavSecundaria({
  itens,
  ariaLabel,
}: {
  itens: readonly ItemNavSecundaria[]
  ariaLabel: string
}) {
  return (
    <nav className="mt-[4px] flex gap-[17px]" aria-label={ariaLabel}>
      {itens.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={CLASSE_ITEM}
          style={estiloDoItem(item.ativo)}
          aria-current={item.ativo ? "page" : undefined}
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  )
}
