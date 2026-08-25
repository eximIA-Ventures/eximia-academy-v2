// ---------------------------------------------------------------------------
// O seletor de PRIMEIRO NÍVEL de `/jornada` — "Meu Plano" × "Autogestão".
// ---------------------------------------------------------------------------
// CONTRATO-DE-DADOS.md §NAVEGAÇÃO, N.3: até aqui a Autogestão só era alcançável
// digitando a URL. A sidebar (`registry.ts`, módulo `academy`) leva a
// `/jornada` — que sem `?vista=autogestao` é "Meu Plano", o conteúdo de
// sempre — mas nada DENTRO da rota levava do plano para a Autogestão, nem
// desta de volta ao plano. As 3 abas da Autogestão (`moldura.tsx`) já se
// navegam entre si; este componente é o nível ACIMA delas, renderizado nas
// DUAS vistas (aqui, e no topo de cada tela do `JourneyShell`), para o aluno
// ir e voltar sem digitar URL.
//
// Deliberadamente uma PÍLULA segmentada (`bg-bg-card` + `shadow-card`, o
// mesmo "chip de controle" do `CourseSwitcher`/`FiltroPeriodoAutogestao`), não
// o sublinhado das 3 abas — a diferença de forma marca que este é o nível
// ACIMA delas, nunca uma quarta aba.
//
// `queryAtual` segue o MESMO contrato de `MolduraAutogestao`/`hrefDaAba`: a
// query ATUAL sem `vista`/`aba`, copiada inteira via `URLSearchParams` — nunca
// parâmetro por parâmetro à mão, para `curso`/`periodo`/o que vier depois
// sobreviverem à troca de vista sem este arquivo precisar conhecer cada nome.
// ---------------------------------------------------------------------------

import { COR_ACAO, COR_ACAO_TENUE, TEXTO } from "@/components/analytics/visao-geral/design"
import Link from "next/link"

export type VistaJornada = "plano" | "autogestao"

const VISTAS: ReadonlyArray<{ id: VistaJornada; rotulo: string }> = [
  { id: "plano", rotulo: "Meu Plano" },
  { id: "autogestao", rotulo: "Autogestão" },
]

/**
 * `?vista=` reescrito, resto da query preservado; `aba` cai fora — cada vista
 * decide a própria entrada (a Autogestão abre em "Visão Geral" por padrão via
 * `lerAbaAutogestao`, o plano não tem abas).
 */
function hrefDaVista(queryAtual: string, vista: VistaJornada): string {
  const parametros = new URLSearchParams(queryAtual)
  parametros.delete("aba")
  parametros.set("vista", vista)
  return `/jornada?${parametros.toString()}`
}

export function SeletorVistaJornada({
  vistaAtiva,
  queryAtual,
}: {
  vistaAtiva: VistaJornada
  /** A query ATUAL sem `vista`/`aba` — mesmo contrato de `MolduraAutogestao`. */
  queryAtual: string
}) {
  return (
    <nav
      aria-label="Alternar entre o plano e a autogestão da jornada"
      className="inline-flex items-center gap-1 rounded-xl bg-bg-card p-1 shadow-card"
    >
      {VISTAS.map((vista) => {
        const ativa = vista.id === vistaAtiva
        return (
          <Link
            key={vista.id}
            href={hrefDaVista(queryAtual, vista.id)}
            aria-current={ativa ? "page" : undefined}
            className="rounded-lg px-3 py-1.5 text-[13px] font-semibold leading-[18px] transition-colors"
            style={{
              color: ativa ? COR_ACAO : TEXTO.mudo,
              backgroundColor: ativa ? COR_ACAO_TENUE : "transparent",
            }}
          >
            {vista.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
