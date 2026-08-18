// ---------------------------------------------------------------------------
// A aba "Padrões e tendências" com DADO REAL — o lado servidor.
// ---------------------------------------------------------------------------
// Este arquivo é cola, e é curto de propósito. As três peças já existiam:
//   • `_trinca/recorte.ts`, que resolve QUEM o gestor alcança (o mesmo caminho
//     gated da "Visão geral", não um segundo ao lado dele);
//   • `lib/analytics/padroes-tendencias/`, que transforma leitura crua na tela
//     inteira e NÃO resolve escopo de propósito — recebe o universo e obedece;
//   • `components/analytics/padroes-tendencias/`, que desenha.
//
// ZERO CONSULTA NOVA, e isso não é promessa: `carregarPadroesTendencias` lê pelo
// `lerFontePadroes`, que é `lerFonteVisaoGeral` reexportado
// (`padroes-tendencias/fonte-supabase.ts`, decisão IDS "REUSAR"). A aba anterior
// e esta leem o banco pela MESMA porta, com o MESMO recorte — é o que impede a
// mesma pessoa de entrar na conta numa aba e sair dela na outra.
//
// A ROTA DE PREVIEW (`/gauntlet-preview/padroes-tendencias`) monta a mesma tela
// pelo mesmo motor, e a única diferença é o recorte: lá não há sessão, então ela
// passa `escopoAlunoIds: null` e `gestorId: "preview"`. Aqui os dois vêm do
// gestor logado, que é exatamente o que a camada de preview declara não resolver.
//
// SOMENTE LEITURA. Nenhuma escrita, nenhuma migration, nenhuma semente — o
// `.env.local` deste repositório aponta para o Supabase de PRODUÇÃO.
// ---------------------------------------------------------------------------

import { PadroesTendenciasTab } from "@/components/analytics/padroes-tendencias/padroes-tendencias-tab"
import type { DestinoAbas } from "@/components/analytics/visao-geral/nav-abas"
import { carregarPadroesTendencias } from "@/lib/analytics/padroes-tendencias"
import { MolduraAba, RECUO_DA_COLUNA, TelaEmFalha } from "../_trinca/moldura"
import { controlesDaTrinca, resolverRecorteDaTrinca } from "../_trinca/recorte"

export async function PainelPadroes({
  params,
  destinoAbas,
}: {
  params: Record<string, string | undefined>
  destinoAbas: DestinoAbas
}) {
  const recorte = await resolverRecorteDaTrinca(params)
  const controles = controlesDaTrinca(recorte)

  // A falha do filtro de curso NÃO pode virar "tenant inteiro" (alarga o
  // recorte) nem "recorte vazio" (finge que o curso não tem ninguém). As duas
  // mentem, cada uma para um lado. A tela para e diz que parou — com a moldura
  // inteira à vista, para o gestor poder voltar para outra aba sem recarregar.
  if (recorte.erroCurso) {
    return (
      <>
        <MolduraAba aba="padroes" destino={destinoAbas} controles={controles} />
        <div className={RECUO_DA_COLUNA}>
          <TelaEmFalha
            titulo="Não foi possível aplicar o filtro de curso"
            detalhe={`MATRICULAS_DO_CURSO: ${recorte.erroCurso}`}
          />
        </div>
      </>
    )
  }

  const dados = await carregarPadroesTendencias({
    db: recorte.db,
    tenantId: recorte.tenantId,
    gestorId: recorte.gestorId,
    escopoAlunoIds: recorte.escopoAlunoIds,
    agoraMs: Date.now(),
    periodoDias: recorte.periodoDias,
  })

  // `PadroesTendenciasTab` traz o próprio recuo de coluna (ele é o dono do
  // orçamento horizontal da tela dele), por isso a moldura é IRMÃ e não mãe —
  // envolvê-la duplicaria os 31px da esquerda.
  return (
    <>
      <MolduraAba aba="padroes" destino={destinoAbas} controles={controles} />
      <PadroesTendenciasTab dados={dados} />
    </>
  )
}
