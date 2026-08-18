// ---------------------------------------------------------------------------
// A aba "Visão geral" com DADO REAL — o lado servidor.
// ---------------------------------------------------------------------------
// Este arquivo é a única cola entre três coisas que já existiam separadas:
//   • a autenticação e o RECORTE da Academy (cookies de contexto + as RPCs
//     ancoradas em `auth.uid()`), que decidem QUEM o gestor alcança;
//   • `lib/analytics/visao-geral/`, que transforma leitura crua na tela inteira
//     e NÃO resolve escopo de propósito (índice do módulo, §"o que esta camada
//     não faz") — ela recebe o universo já resolvido e obedece;
//   • `components/analytics/visao-geral/`, que desenha.
//
// POR QUE O ESCOPO NÃO É RESOLVIDO AQUI DO ZERO. Existe UMA cadeia gated no
// app (`auth_subtree_user_ids` → `getDirectTeamStudentIds` /
// `getManagedTeamStudentIds` / `getSubtreeStudentIdsAtNode`), e ela é o gate de
// segurança entre times. Escrever uma segunda resolução ao lado seria abrir um
// caminho paralelo a esse gate, que é literalmente como vazamento entre equipes
// acontece. Esse ESCOLHER-entre-ramos-existentes saiu deste arquivo e virou
// `_trinca/recorte.ts` quando as outras duas abas da trinca ganharam tela real:
// as três respondem sobre a mesma equipe, e duas resoluções de escopo lado a
// lado dariam duas populações sem que ninguém tivesse mudado filtro nenhum. O
// comportamento é o mesmo de antes, item por item — só deixou de ser exclusivo
// desta aba.
//
// SOMENTE LEITURA. Nenhuma escrita, nenhuma migration, nenhuma semente. O
// `.env.local` deste repositório aponta para o Supabase de PRODUÇÃO.
// ---------------------------------------------------------------------------

import type { DestinoAbas } from "@/components/analytics/visao-geral/nav-abas"
import { VisaoGeralTab } from "@/components/analytics/visao-geral/visao-geral-tab"
import { acoesEstaoAtivas, carregarVisaoGeral } from "@/lib/analytics/visao-geral"
import { TelaEmFalha } from "../_trinca/moldura"
import { controlesDaTrinca, resolverRecorteDaTrinca } from "../_trinca/recorte"

// O gate de escrita mora em `lib/analytics/visao-geral/index.ts` e é UM só.
// Havia uma segunda leitura aqui, com um conjunto de nomes diferente do que a
// camada de dados lia — e era ela que permitia o teste `f-44` ficar verde
// dizendo "desligado" enquanto esta tela gravava. Uma função, um veredito.

export async function PainelVisaoGeral({
  params,
  destinoAbas,
}: {
  params: Record<string, string | undefined>
  /**
   * Ausente ⇒ a barra de abas fica inerte. A rota real sempre passa, e é o que
   * faz "Padrões e tendências" e "Mapa da jornada" ficarem clicáveis levando os
   * filtros atuais junto.
   */
  destinoAbas?: DestinoAbas
}) {
  const recorte = await resolverRecorteDaTrinca(params)

  // A falha do filtro de curso NÃO pode virar "tenant inteiro" (alarga o
  // recorte) nem "recorte vazio" (finge que o curso não tem ninguém). As duas
  // mentem, cada uma para um lado. A tela para e diz que parou.
  if (recorte.erroCurso) {
    return (
      <TelaEmFalha
        titulo="Não foi possível aplicar o filtro de curso"
        detalhe={`MATRICULAS_DO_CURSO: ${recorte.erroCurso}`}
      />
    )
  }

  const agoraMs = Date.now()
  const dados = await carregarVisaoGeral({
    db: recorte.db,
    tenantId: recorte.tenantId,
    gestorId: recorte.gestorId,
    escopoAlunoIds: recorte.escopoAlunoIds,
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
    <VisaoGeralTab
      data={dados}
      destinoAbas={destinoAbas}
      acionamentoAtivo={acoesEstaoAtivas()}
      controles={controlesDaTrinca(recorte)}
    />
  )
}
