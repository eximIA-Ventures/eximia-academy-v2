// ---------------------------------------------------------------------------
// Despacho interno do domínio "Aprendizagem do Time" — segundo nível
// (?vista=), depois que `page.tsx` já despachou por `?dominio=aprendizagem`
// e o gate (`garantirAcessoAnalytics`) já rodou na porta da rota.
// ---------------------------------------------------------------------------

import type { DestinoAbas } from "@/components/analytics/visao-geral/nav-abas"
import { lerVista } from "@/lib/analytics/aprendizagem-time/vistas"
import { Suspense } from "react"

export async function despacharAprendizagemTime(params: Record<string, string | undefined>) {
  const vista = lerVista(params.vista)
  const query = new URLSearchParams(
    Object.entries(params).filter(
      (entrada): entrada is [string, string] => entrada[0] !== "vista" && entrada[1] !== undefined,
    ),
  )
  query.set("dominio", "aprendizagem")
  const destinoVistas: DestinoAbas = { pathname: "/analytics", query: query.toString() }

  if (vista === "mapa") {
    const [{ PainelMapaCapacidades }, { EsqueletoMapaCapacidades }] = await Promise.all([
      import("./_mapa/painel"),
      import("./_mapa/esqueleto"),
    ])
    return (
      <Suspense key={JSON.stringify(params)} fallback={<EsqueletoMapaCapacidades />}>
        <PainelMapaCapacidades params={params} destinoVistas={destinoVistas} />
      </Suspense>
    )
  }

  if (vista === "padroes") {
    const [{ PainelPadroesEvolucao }, { EsqueletoPadroesEvolucao }] = await Promise.all([
      import("./_padroes/painel"),
      import("./_padroes/esqueleto"),
    ])
    return (
      <Suspense key={JSON.stringify(params)} fallback={<EsqueletoPadroesEvolucao />}>
        <PainelPadroesEvolucao params={params} destinoVistas={destinoVistas} />
      </Suspense>
    )
  }

  const [{ PainelVisaoGeralAprendizagem }, { EsqueletoVisaoGeralAprendizagem }] = await Promise.all(
    [import("./_visao-geral/painel"), import("./_visao-geral/esqueleto")],
  )
  return (
    <Suspense key={JSON.stringify(params)} fallback={<EsqueletoVisaoGeralAprendizagem />}>
      <PainelVisaoGeralAprendizagem params={params} destinoVistas={destinoVistas} />
    </Suspense>
  )
}
