"use client"

// ---------------------------------------------------------------------------
// O controle de período (`?periodo=`) da Autogestão — ESPECIFICACAO.md §4.2.
// ---------------------------------------------------------------------------
// F-V-18 (CRITERIOS-FIDELIDADE.md): a referência do dono usa um DROPDOWN
// ÚNICO ("Últimos 30 dias" + ícone de calendário + chevron), não um grupo de
// 3 pílulas — o que a régua de composição não capturava, mas a de FORMA sim.
// Reusa a PRIMITIVA de dropdown do design system (`@eximia/ui`), a MESMA que
// `AreaSelector`/`ContextSwitcher`/`TeamFilterDropdown` já usam, em vez de um
// popover desenhado à mão. O estado continua vivendo na URL — mesmo motivo de
// sempre: um `?periodo=90` sobrevive a refresh, ao botão de voltar e a um
// link colado no chat. Trocar o VISUAL do controle não muda esse invariante,
// e o teclado continua funcionando: a `DropdownMenuTrigger` abre com
// Enter/Espaço, cada opção é um `<button>` alcançável por Tab e confirmável
// com Enter, e Escape fecha (comportamento herdado da primitiva).
// ---------------------------------------------------------------------------

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eximia/ui"
import { Calendar, Check, ChevronDown } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useTransition } from "react"

const OPCOES_PERIODO = [
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 90 dias", value: "90" },
] as const

export function FiltroPeriodoAutogestao({
  periodoDias,
  queryAtual,
}: { periodoDias: 7 | 30 | 90; queryAtual: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pendente, iniciar] = useTransition()

  const trocarPeriodo = useCallback(
    (valor: string) => {
      const proximos = new URLSearchParams(queryAtual)
      proximos.set("vista", "autogestao")
      proximos.set("periodo", valor)
      iniciar(() => {
        router.push(`${pathname}?${proximos.toString()}`, { scroll: false })
      })
    },
    [queryAtual, pathname, router],
  )

  const opcaoAtiva =
    OPCOES_PERIODO.find((opcao) => opcao.value === String(periodoDias)) ?? OPCOES_PERIODO[1]

  return (
    <div style={{ opacity: pendente ? 0.55 : 1, transition: "opacity 120ms" }}>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div
            className="flex items-center gap-2 rounded-xl bg-bg-card px-3.5 py-2 text-sm font-medium text-text-primary shadow-card transition-colors hover:text-text-secondary"
            aria-label="Filtrar por período"
          >
            <Calendar size={16} className="shrink-0 text-text-muted" aria-hidden />
            <span>{opcaoAtiva.label}</span>
            <ChevronDown size={16} className="shrink-0 text-text-muted" aria-hidden />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="left-auto right-0 w-48">
          {OPCOES_PERIODO.map((opcao) => {
            const ativa = opcao.value === String(periodoDias)
            return (
              <DropdownMenuItem key={opcao.value} onClick={() => trocarPeriodo(opcao.value)}>
                <span className="flex w-full items-center justify-between gap-2">
                  {opcao.label}
                  {ativa && <Check size={14} className="shrink-0 text-cerrado-600" />}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
