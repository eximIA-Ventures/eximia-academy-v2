// ---------------------------------------------------------------------------
// "Meu Mapa da Jornada" — o lado servidor.
// ---------------------------------------------------------------------------
// Mesma cola das demais abas da Autogestão: `../recorte.ts` resolve QUEM
// (auth + curso + período + relógio, sempre o PRÓPRIO usuário — N.4 do
// CONTRATO-DE-DADOS.md), `lib/analytics/autogestao/fonte-supabase.ts` lê o
// banco, e `montarMapaAutogestao` transforma a leitura crua na forma exata
// que `<MapaJornadaAutogestaoTab/>` consome. SOMENTE LEITURA.
//
// Este componente NÃO chama a rota HTTP (`/api/analytics/autogestao/mapa`)
// por cima de si mesmo — usa a MESMA camada pura diretamente, no padrão que
// `analytics/_mapa/painel.tsx` (gestor) já estabelece: duplicar via `fetch()`
// exigiria repassar cookies e resolver URL absoluta para ganhar nada.
// ---------------------------------------------------------------------------

import { lerFonteAutogestao } from "@/lib/analytics/autogestao/fonte-supabase"
import { montarMapaAutogestao } from "@/lib/analytics/autogestao/montagem"
import { EstadoSemMatricula } from "../estado-sem-matricula"
import { MolduraAutogestao } from "../moldura"
import { resolverRecorteAutogestao } from "../recorte"
import { MapaJornadaAutogestaoTab } from "./mapa-jornada-tab"

export async function PainelMapaAutogestao({
  queryAtual,
}: {
  /** A query ATUAL sem `vista`/`aba` — o que sobrevive à troca de aba/período. */
  queryAtual: string
}) {
  const params = Object.fromEntries(new URLSearchParams(queryAtual))
  const resultado = await resolverRecorteAutogestao(params)
  if (!resultado.ok) {
    // Sem moldura: sem curso resolvido não há abas para trocar.
    return <EstadoSemMatricula />
  }

  const { recorte } = resultado
  const fonte = await lerFonteAutogestao({
    db: recorte.db,
    tenantId: recorte.tenantId,
    studentId: recorte.studentId,
    courseId: recorte.courseId,
    periodoDias: recorte.periodoDias,
  })

  const dados = montarMapaAutogestao(fonte, recorte.agora)

  return (
    <MolduraAutogestao abaAtiva="mapa" queryAtual={queryAtual} periodoDias={recorte.periodoDias}>
      <MapaJornadaAutogestaoTab dados={dados} />
    </MolduraAutogestao>
  )
}
