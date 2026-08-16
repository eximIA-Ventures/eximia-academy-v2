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
//                         direito) — sai do conteúdo. O sub-modo
//                         Diretos/Hierarquia ganhou controle PRÓPRIO aqui,
//                         porque ele muda o denominador de toda métrica da
//                         tela e precisava ser visível ao lado dos números.
//   "Últimos 30 dias"     `PeriodFilter` real: segmentado com as 3 opções à
//                         vista ("7 dias" / "30 dias" / "90 dias"). A string
//                         "Últimos 30 dias" deixa de existir.
//   "Todos os cursos"     não existe componente compartilhado; no app real é
//                         markup inline em `analytics-dashboard.tsx`
//                         (L530-550) e só na aba "Uso". Reproduzido aqui com
//                         o MESMO padrão de pílula, sem tocar em produção.
//
// POR QUE ESTE ARQUIVO É `"use client"`: `PeriodFilter` recebe `onChange`, e
// função não atravessa a fronteira servidor → cliente. `visao-geral-tab.tsx`
// é componente de SERVIDOR, então o estado dos filtros precisa de uma ilha
// própria. `ScopeBar` também é `"use client"`.
//
// O ESTADO VIVE NA URL, não em `useState`, e isso é exigência da §3.4 da spec:
// "ao navegar entre Visão Geral → Padrões e Tendências → Mapa da Jornada, os
// filtros devem permanecer selecionados". Estado local morre na navegação, por
// definição; um link que carrega `?periodo=&curso=&escopo=` sobrevive a ela, a
// um refresh, ao botão de voltar e a um link colado no chat. É também o que faz
// o filtro ser AUDITÁVEL: o número na tela e a barra de endereços contam a
// mesma história.
//
// SEM `controles` o componente volta a ser o inerte de antes. É o que a rota de
// preview usa: ela não tem roteador, não tem sessão, e o screenshot do gauntlet
// precisa ser byte a byte o mesmo a cada rodada.
// ---------------------------------------------------------------------------

import { ScopeBar } from "@/components/analytics/analytics-ui"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState, useTransition } from "react"

const OPCOES_PERIODO = [
  { label: "7 dias", value: "7" },
  { label: "30 dias", value: "30" },
  { label: "90 dias", value: "90" },
]

const OPCOES_ESCOPO = [
  { label: "Diretos", value: "diretos" },
  { label: "Hierarquia", value: "hierarquia" },
]

export interface CursoFiltravel {
  id: string
  titulo: string
}

export interface ControlesFiltro {
  periodoDias: number
  escopoEquipe: "diretos" | "hierarquia"
  /**
   * O seletor Diretos/Hierarquia só existe para quem tem hierarquia: um
   * instrutor ou um admin fora do contexto de time não tem subordinados, e
   * oferecer o controle sugeriria um recorte que o backend ignoraria.
   */
  escopoEditavel: boolean
  cursoId: string | null
  cursos: readonly CursoFiltravel[]
  /** A leitura da lista de cursos falhou — a pílula única não é "só há um". */
  falhaCursos: boolean
}

export function FiltrosEscopo({ controles }: { controles?: ControlesFiltro }) {
  if (!controles) return <FiltrosInertes />
  return <FiltrosNaURL controles={controles} />
}

/** O de antes, palavra por palavra: 30 dias fixo e uma pílula de curso. */
function FiltrosInertes() {
  const [periodo, setPeriodo] = useState("30")
  return (
    <ScopeBar>
      <PeriodFilter value={periodo} onChange={setPeriodo} options={OPCOES_PERIODO} />
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

function FiltrosNaURL({ controles }: { controles: ControlesFiltro }) {
  const router = useRouter()
  const pathname = usePathname()
  const parametros = useSearchParams()
  const [pendente, iniciar] = useTransition()

  /**
   * Reescreve UM parâmetro preservando todos os outros.
   *
   * `push` e não `replace`: o botão de voltar do navegador tem que desfazer uma
   * troca de filtro, que é o que qualquer pessoa espera dele. `scroll: false`
   * porque a tela inteira cabe na dobra e um salto ao topo a cada clique seria
   * ruído. O `useTransition` mantém a tela ANTERIOR à vista enquanto o servidor
   * recalcula, em vez de piscar — a alternativa seria desmontar e remontar com
   * zeros no meio do caminho, que é a coisa que esta tela não pode fazer.
   */
  const trocar = useCallback(
    (chave: string, valor: string | null) => {
      const proximos = new URLSearchParams(parametros?.toString() ?? "")
      if (valor === null) proximos.delete(chave)
      else proximos.set(chave, valor)
      iniciar(() => {
        router.push(`${pathname}?${proximos.toString()}`, { scroll: false })
      })
    },
    [parametros, pathname, router],
  )

  return (
    <div style={{ opacity: pendente ? 0.55 : 1, transition: "opacity 120ms" }}>
      <ScopeBar>
        <PeriodFilter
          value={String(controles.periodoDias)}
          onChange={(v) => trocar("periodo", v)}
          options={OPCOES_PERIODO}
        />

        {controles.escopoEditavel ? (
          <PeriodFilter
            value={controles.escopoEquipe}
            onChange={(v) => trocar("escopo", v)}
            options={OPCOES_ESCOPO}
          />
        ) : null}

        {/* Pílula de curso — mesmo padrão de `analytics-dashboard.tsx` L530-550:
            o selecionado é marcador de ESTADO, logo identidade do mundo
            (`--world-accent` / `--world-accent-fg`), nunca um hex chumbado. */}
        <div className="flex max-w-[420px] flex-wrap items-center gap-1">
          <PilulaCurso
            rotulo="Todos os cursos"
            ativa={controles.cursoId === null}
            onClick={() => trocar("curso", null)}
          />
          {controles.cursos.map((curso) => (
            <PilulaCurso
              key={curso.id}
              rotulo={curso.titulo}
              ativa={controles.cursoId === curso.id}
              onClick={() => trocar("curso", curso.id)}
            />
          ))}
          {/* A lista vazia por FALHA e a lista vazia por AUSÊNCIA de curso são
              coisas diferentes, e calar a primeira é o defeito A-1 em miniatura:
              o gestor concluiria que só existe um recorte possível. */}
          {controles.falhaCursos ? (
            <span className="text-[10.5px] text-text-muted">
              Não foi possível carregar a lista de cursos.
            </span>
          ) : null}
        </div>
      </ScopeBar>
    </div>
  )
}

function PilulaCurso({
  rotulo,
  ativa,
  onClick,
}: {
  rotulo: string
  ativa: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={
        ativa
          ? "rounded-md bg-[var(--world-accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--world-accent-fg)]"
          : "rounded-md px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary"
      }
    >
      {rotulo}
    </button>
  )
}
