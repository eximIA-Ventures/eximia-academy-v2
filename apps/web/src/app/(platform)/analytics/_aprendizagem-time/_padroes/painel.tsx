// ---------------------------------------------------------------------------
// TELA 2 de Aprendizagem do Time, com dado real — o lado servidor. Mesma cola
// de `_visao-geral/painel.tsx`: reusa `resolverRecorteDaTrinca`/
// `controlesDaTrinca`, zero resolução de escopo paralela.
// ---------------------------------------------------------------------------

import { PadroesEvolucaoTab } from "@/components/analytics/aprendizagem-time/padroes-tab"
import type { DestinoAbas } from "@/components/analytics/visao-geral/nav-abas"
import { carregarPadroesEvolucao } from "@/lib/analytics/aprendizagem-time"
import { controlesDaTrinca, resolverRecorteDaTrinca } from "../../_trinca/recorte"
import { MolduraAprendizagem, TelaEmFalhaAprendizagem } from "../moldura"

export async function PainelPadroesEvolucao({
  params,
  destinoVistas,
}: {
  params: Record<string, string | undefined>
  destinoVistas: DestinoAbas
}) {
  const recorte = await resolverRecorteDaTrinca(params)

  if (recorte.erroCurso) {
    return (
      <>
        <MolduraAprendizagem
          vista="padroes"
          destino={destinoVistas}
          controles={controlesDaTrinca(recorte)}
        />
        <div className="pr-[16px] pl-[31px] 2xl:pr-[56px]">
          <TelaEmFalhaAprendizagem
            titulo="Não foi possível aplicar o filtro de curso"
            detalhe={`MATRICULAS_DO_CURSO: ${recorte.erroCurso}`}
          />
        </div>
      </>
    )
  }

  const agoraMs = Date.now()
  const dados = await carregarPadroesEvolucao({
    db: recorte.db,
    tenantId: recorte.tenantId,
    escopoAlunoIds: recorte.escopoAlunoIds,
    cursoId: recorte.cursoId,
    agoraMs,
    periodoDias: recorte.periodoDias,
    contexto: {
      tenantNome: recorte.tenantNome,
      gestorNome: recorte.gestorNome,
      gestorPapel: recorte.gestorPapel,
      escopoEquipe: recorte.modo === "hierarchy" ? "hierarquia" : "diretos",
      cursoFiltroNome: recorte.cursoNome,
    },
  })

  return (
    <>
      <MolduraAprendizagem
        vista="padroes"
        destino={destinoVistas}
        controles={controlesDaTrinca(recorte)}
      />
      <PadroesEvolucaoTab data={dados} />
    </>
  )
}
