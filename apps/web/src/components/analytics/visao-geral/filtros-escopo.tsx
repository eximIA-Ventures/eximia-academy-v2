"use client"

// ---------------------------------------------------------------------------
// Bandeja de escopo da aba "Visão geral" — os controles REAIS da Academy.
//
// SUBSTITUI os 3 `ChipFiltro` desenhados à mão que viviam no cabeçalho deste
// componente. A troca não é 1:1, e isso é da natureza dos controles reais:
//
//   chip do mockup        onde ele vive agora
//   ────────────────────  ──────────────────────────────────────────────────
//   "Meu time"            `ContextSwitcher` real, no HEADER do shell (topo
//                         direito) — sai do conteúdo. Rótulo real é
//                         "Meu Time", com T maiúsculo.
//   "Últimos 30 dias"     `PeriodFilter` real: segmentado com as 3 opções à
//                         vista ("7 dias" / "30 dias" / "90 dias"). A string
//                         "Últimos 30 dias" deixa de existir.
//   "Todos os cursos"     não existe componente compartilhado; no app real é
//                         markup inline em `analytics-dashboard.tsx`
//                         (L530-550) e só na aba "Uso". Reproduzido aqui com
//                         o MESMO padrão de pílula, sem tocar em produção —
//                         extrair o bloco é trabalho de produção, rodada
//                         própria e decisão do dono.
//
// POR QUE ESTE ARQUIVO É `"use client"`: `PeriodFilter` recebe `onChange`, e
// função não atravessa a fronteira servidor → cliente. `visao-geral-tab.tsx`
// é componente de SERVIDOR, então o estado dos filtros precisa de uma ilha
// própria. `ScopeBar` também é `"use client"`.
//
// A fixture NÃO declara lista de cursos, então a fileira de pílulas tem só a
// primeira ("Todos os cursos"), que é justamente a selecionada.
// ---------------------------------------------------------------------------

import { ScopeBar } from "@/components/analytics/analytics-ui"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import { useState } from "react"

const OPCOES_PERIODO = [
  { label: "7 dias", value: "7" },
  { label: "30 dias", value: "30" },
  { label: "90 dias", value: "90" },
]

export function FiltrosEscopo() {
  // 30 dias é o período que a fixture congela (`contexto.periodoDias`).
  const [periodo, setPeriodo] = useState("30")

  return (
    <ScopeBar>
      <PeriodFilter value={periodo} onChange={setPeriodo} options={OPCOES_PERIODO} />

      {/* Pílula de curso — mesmo padrão de `analytics-dashboard.tsx` L530-550:
          o selecionado é marcador de ESTADO, logo identidade do mundo
          (`--world-accent` / `--world-accent-fg`), nunca um hex chumbado. */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-pressed="true"
          className="rounded-md bg-[var(--world-accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--world-accent-fg)]"
        >
          Todos os cursos
        </button>
      </div>
    </ScopeBar>
  )
}
