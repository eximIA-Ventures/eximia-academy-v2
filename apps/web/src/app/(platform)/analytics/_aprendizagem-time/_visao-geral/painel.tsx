// ---------------------------------------------------------------------------
// TELA 1 de Aprendizagem do Time, com dado real — o lado servidor.
//
// Mesma cola de `_visao-geral/painel.tsx` (Ativação): reusa
// `resolverRecorteDaTrinca`/`controlesDaTrinca` de `_trinca/recorte.ts` —
// ZERO resolução de escopo paralela. `lib/analytics/aprendizagem-time`
// transforma leitura crua na tela; `components/analytics/aprendizagem-time`
// desenha.
//
// SOMENTE LEITURA neste caminho. Quem escreve é o pipeline de classificação,
// disparado pelo client (`GatilhoClassificacao`), fora do render.
// ---------------------------------------------------------------------------

import { GatilhoClassificacao } from "@/components/analytics/aprendizagem-time/gatilho-classificacao"
import { VisaoGeralAprendizagemTab } from "@/components/analytics/aprendizagem-time/visao-geral-tab"
import type { DestinoAbas } from "@/components/analytics/visao-geral/nav-abas"
import { carregarVisaoGeralAprendizagem } from "@/lib/analytics/aprendizagem-time"
import { controlesDaTrinca, resolverRecorteDaTrinca } from "../../_trinca/recorte"
import { MolduraAprendizagem, TelaEmFalhaAprendizagem } from "../moldura"

export async function PainelVisaoGeralAprendizagem({
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
          vista="visao-geral"
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
  const dados = await carregarVisaoGeralAprendizagem({
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
      <GatilhoClassificacao />
      <MolduraAprendizagem
        vista="visao-geral"
        destino={destinoVistas}
        controles={controlesDaTrinca(recorte)}
      />
      <VisaoGeralAprendizagemTab data={dados} />
    </>
  )
}
