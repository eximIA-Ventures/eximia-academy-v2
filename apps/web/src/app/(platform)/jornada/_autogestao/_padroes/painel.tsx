// ---------------------------------------------------------------------------
// "Meus Padrões e Tendências" — Autogestão da minha Jornada, Tela 2.
// ESPECIFICACAO.md §15-20 · CONTRATO-DE-DADOS.md itens 2.1-2.8.
// ---------------------------------------------------------------------------
// Casca fina de servidor: resolve o recorte (`../recorte.ts`), lê a fonte real
// (`lerFonteAutogestao`), monta com o montador puro `montarPadroesAutogestao`
// e entrega os dois agregados à COMPOSIÇÃO pura de `./padroes-tab.tsx`.
// NENHUMA regra de negócio aqui (ela mora em `lib/analytics/autogestao/`) e
// NENHUM desenho aqui (ele mora em `./cartoes.tsx` + `./mapa-de-calor.tsx`,
// compostos por `./padroes-tab.tsx`).
//
// Por que a composição saiu deste arquivo: só ESTE módulo depende de sessão, e
// é exatamente essa dependência que impedia o harness visual do Gauntlet de
// importar a tela — ele havia copiado a composição À MÃO, e quando esta tela
// ganhou os dois cartões de mapa de calor, a cópia ficou parada: o crítico
// media uma composição que já não existia mais aqui. Com `PadroesAutogestaoTab`
// num módulo puro, produção e harness renderizam O MESMO componente — um
// bloco novo aparece nos dois lugares por construção. Ver o cabeçalho de
// `./padroes-tab.tsx`.
// ---------------------------------------------------------------------------

import { lerFonteAutogestao } from "@/lib/analytics/autogestao/fonte-supabase"
import { montarMapaDeCalorAtividade } from "@/lib/analytics/autogestao/mapa-de-calor"
import { carimbosDeAtividade, montarPadroesAutogestao } from "@/lib/analytics/autogestao/montagem"
import { MAPA_DE_CALOR_SEMANAS_MAX } from "@/lib/analytics/autogestao/parametros"
import { EstadoSemMatricula } from "../estado-sem-matricula"
import { MolduraAutogestao } from "../moldura"
import { resolverRecorteAutogestao } from "../recorte"
import { PadroesAutogestaoTab } from "./padroes-tab"

export async function PainelPadroes({
  queryAtual,
}: {
  /** A query ATUAL sem `vista`/`aba` — o que sobrevive à troca de aba/período. */
  queryAtual: string
}) {
  const resultado = await resolverRecorteAutogestao(
    Object.fromEntries(new URLSearchParams(queryAtual)),
  )

  // Sem NENHUMA matrícula, não há abas para trocar (as 3 telas responderiam a
  // mesma ausência) — mesmo componente compartilhado que `_mapa/painel.tsx`
  // usa, sem envolver em `<MolduraAutogestao/>` (que pressupõe curso resolvido).
  if (!resultado.ok) {
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
  const dados = montarPadroesAutogestao(fonte, recorte.agora)
  // Mapa de calor: MESMA fonte (contrato 1.2, `carimbosDeAtividade`), fora do
  // agregado `PadroesAutogestaoDados` porque é `ComLastro` puro (como
  // `serie.metaLinha`), não um bloco `ComEstado` — ver o cabeçalho de
  // `./mapa-de-calor.tsx`. `MAPA_DE_CALOR_SEMANAS_MAX` (13 semanas), não
  // `periodoDias`: o mesmo padrão de `SERIE_SEMANAS_MAX` no §16, um teto FIXO
  // independente do filtro de período — o calendário mostra a MAIOR janela
  // que o piso de amostra sustenta, não um recorte do filtro.
  const mapaDeCalor = montarMapaDeCalorAtividade(
    carimbosDeAtividade(fonte),
    recorte.agora,
    fonte.fusoHorarioMinutosOffset,
    MAPA_DE_CALOR_SEMANAS_MAX,
  )

  return (
    <MolduraAutogestao abaAtiva="padroes" queryAtual={queryAtual} periodoDias={recorte.periodoDias}>
      <PadroesAutogestaoTab dados={dados} mapaDeCalor={mapaDeCalor} />
    </MolduraAutogestao>
  )
}
