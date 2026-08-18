// ---------------------------------------------------------------------------
// A aba "Mapa da jornada" com DADO REAL — o lado servidor.
// ---------------------------------------------------------------------------
// Mesma cola da aba irmã, mesmas três peças: `_trinca/recorte.ts` resolve QUEM,
// `lib/analytics/mapa-jornada/` transforma leitura crua na tela inteira, e
// `components/analytics/mapa-jornada/` desenha. O recorte é o MESMO objeto que a
// "Visão geral" e "Padrões e tendências" usam — uma resolução só para as três.
//
// POR QUE ESTA ABA TEM PORTA DE LEITURA PRÓPRIA, e isso não é um segundo caminho
// para o mesmo fato: o mapa precisa de `chapter_slides` e `chapter_view_progress`
// (o percorrido slide a slide), que `lerFonteVisaoGeral` não lê e não deveria —
// nenhum número da Visão geral depende deles. As duas leituras têm a MESMA
// semântica de paginação e de erro (`fonte-supabase.ts` do mapa declara isso item
// a item), e os fatos que ambas leem — roster, matrículas, sessões, reflexões —
// saem do mesmo recorte, resolvido uma vez só aqui em cima.
//
// O FILTRO DE CURSO CHEGA POR DOIS CAMINHOS, e os dois vêm do mesmo lugar: como
// NARROWING de população (o `escopoAlunoIds` já intersectado com quem está
// matriculado) e como RÓTULO (`cursoFiltroNome`, que a tela imprime). O nome vem
// da mesma lista que o filtro usou para narrar — nunca de uma segunda consulta.
//
// SOMENTE LEITURA. Nenhuma escrita, nenhuma migration, nenhuma semente — o
// `.env.local` deste repositório aponta para o Supabase de PRODUÇÃO.
// ---------------------------------------------------------------------------

import { MapaJornadaTab } from "@/components/analytics/mapa-jornada/mapa-jornada-tab"
import type { DestinoAbas } from "@/components/analytics/visao-geral/nav-abas"
import { carregarMapaJornada } from "@/lib/analytics/mapa-jornada"
import { MolduraAba, RECUO_DA_COLUNA, TelaEmFalha } from "../_trinca/moldura"
import { controlesDaTrinca, resolverRecorteDaTrinca } from "../_trinca/recorte"

export async function PainelMapa({
  params,
  destinoAbas,
}: {
  params: Record<string, string | undefined>
  destinoAbas: DestinoAbas
}) {
  const recorte = await resolverRecorteDaTrinca(params)
  const controles = controlesDaTrinca(recorte)

  // Filtro de curso que falhou não vira nem "tenant inteiro" nem "ninguém": as
  // duas saídas mentem, cada uma para um lado. A tela para e diz que parou.
  if (recorte.erroCurso) {
    return (
      <>
        <MolduraAba aba="mapa" destino={destinoAbas} controles={controles} />
        <div className={RECUO_DA_COLUNA}>
          <TelaEmFalha
            titulo="Não foi possível aplicar o filtro de curso"
            detalhe={`MATRICULAS_DO_CURSO: ${recorte.erroCurso}`}
          />
        </div>
      </>
    )
  }

  const dados = await carregarMapaJornada({
    db: recorte.db,
    tenantId: recorte.tenantId,
    escopoAlunoIds: recorte.escopoAlunoIds,
    agoraMs: Date.now(),
    periodoDias: recorte.periodoDias,
    contexto: { cursoFiltroNome: recorte.cursoNome },
  })

  // `MapaJornadaTab` desenha só o conteúdo (sem recuo próprio, como o harness de
  // preview mostra), então o recuo de coluna é aplicado AQUI — é o mesmo da
  // moldura e o mesmo que a aba irmã traz por dentro.
  return (
    <>
      <MolduraAba aba="mapa" destino={destinoAbas} controles={controles} />
      <div className={RECUO_DA_COLUNA}>
        <MapaJornadaTab dados={dados} />
      </div>
    </>
  )
}
