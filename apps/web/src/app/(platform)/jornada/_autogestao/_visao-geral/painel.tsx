// ---------------------------------------------------------------------------
// A aba "Visão Geral" da Autogestão — o lado servidor.
// ---------------------------------------------------------------------------
// Casca fina: `resolverRecorteAutogestao` (auth + curso + período + relógio),
// `lerFonteAutogestao` (a única porta de I/O) e `montarVisaoGeralAutogestao`
// (o montador puro). A PÁGINA usa a mesma camada pura que as rotas HTTP
// irmãs (`app/api/analytics/autogestao/visao-geral/route.ts`) — não chama a
// rota por cima de si mesma (ver o cabeçalho de `../recorte.ts`).
//
// SOMENTE LEITURA. O `.env.local` deste repositório aponta para produção.
// ---------------------------------------------------------------------------

import { VisaoGeralAutogestaoTab } from "@/components/analytics/autogestao/visao-geral-tab"
import { lerFonteAutogestao } from "@/lib/analytics/autogestao/fonte-supabase"
import { montarVisaoGeralAutogestao } from "@/lib/analytics/autogestao/montagem"
import { EstadoSemMatricula } from "../estado-sem-matricula"
import { MolduraAutogestao } from "../moldura"
import { resolverRecorteAutogestao } from "../recorte"

export async function PainelVisaoGeralAutogestao({
  queryAtual,
}: {
  /** A query ATUAL sem `vista`/`aba` — o que a moldura preserva ao trocar de aba/período. */
  queryAtual: string
}) {
  const resultado = await resolverRecorteAutogestao(
    Object.fromEntries(new URLSearchParams(queryAtual)),
  )
  if (!resultado.ok) return <EstadoSemMatricula />

  const { recorte } = resultado
  const fonte = await lerFonteAutogestao({
    db: recorte.db,
    tenantId: recorte.tenantId,
    studentId: recorte.studentId,
    courseId: recorte.courseId,
    periodoDias: recorte.periodoDias,
  })
  const dados = montarVisaoGeralAutogestao(fonte, recorte.agora)

  return (
    <MolduraAutogestao
      abaAtiva="visao-geral"
      queryAtual={queryAtual}
      periodoDias={recorte.periodoDias}
    >
      <VisaoGeralAutogestaoTab dados={dados} />
    </MolduraAutogestao>
  )
}
