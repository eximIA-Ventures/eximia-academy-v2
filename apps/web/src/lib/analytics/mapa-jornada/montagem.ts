// ---------------------------------------------------------------------------
// Montagem da tela — a função PURA que transforma leitura crua em Mapa.
// ---------------------------------------------------------------------------
// Nenhum `Date.now()`, nenhuma consulta, nenhum acesso a `process.env`. Tudo
// entra por parâmetro, inclusive o instante "agora". É o que permite ao teste
// deslocar o tempo, cruzar a meia-noite UTC e duplicar a população sem mock — e
// é o que faz de F-33 e F-35 propriedades verificáveis em vez de promessas.
//
// A CADEIA DE DERIVAÇÃO É DELIBERADA, e é o que impede os blocos de discordarem
// entre si (o defeito clássico desta tela):
//
//   base → matriz  ─┐
//                   ├→ gargalos ─┬→ travados (âncora = topo do gargalo, F-17)
//   base → partição ┘            └→ insights (módulos citados = topo, F-28/F-29)
//
// Ninguém recalcula "o módulo com mais gente parada". Ele é computado UMA vez.
// ---------------------------------------------------------------------------

import { montarBaseMapa } from "./base"
import { montarDetalhesMapa } from "./detalhes"
import { montarDistribuicao } from "./distribuicao"
import type { FonteMapaJornada } from "./fonte"
import { TODAS_AS_CHAVES, primeiraFalhaMapa } from "./fonte"
import { montarFunil } from "./funil"
import { montarGargalos } from "./gargalos"
import { montarInsights } from "./insights"
import { linhasDaMatriz, montarMatriz } from "./matriz"
import { FAIXA_RODAPE, REGUA_PERIODO } from "./textos"
import type { ContextoMapa, MapaJornadaDados } from "./tipos"
import { montarTravados } from "./travados"

/** O que a tela precisa saber e não está no banco de aprendizagem. */
export interface ContextoDeTelaMapa {
  /** Nome do curso filtrado, ou `null` para "Todos os cursos". */
  cursoFiltroNome: string | null
}

export function montarMapaJornada(
  fonte: FonteMapaJornada,
  contextoDeTela: ContextoDeTelaMapa,
): MapaJornadaDados {
  const base = montarBaseMapa(fonte)
  const { falhas } = fonte

  const mapa = montarMatriz(base, falhas)
  const gargalos = montarGargalos(base, falhas)
  const distribuicao = montarDistribuicao(base, falhas)
  const travados = montarTravados(
    { base, ordenados: gargalos.ordenados, pessoasPorModulo: gargalos.pessoasPorModulo },
    falhas,
  )
  const funil = montarFunil(base, falhas)
  const insights = montarInsights(
    {
      base,
      particao: distribuicao.particao,
      // F-27/F-28 · o insight LÊ o percentual do tile em vez de recalculá-lo.
      // Dois caminhos para o mesmo número divergem em silêncio, e divergiram:
      // 72% no tile contra 71% na frase, pelo arredondamento que fecha a soma.
      tiles: distribuicao.bloco.tiles,
      ordenados: gargalos.ordenados,
      ancora: travados.ancora,
      pessoasPorModulo: gargalos.pessoasPorModulo,
    },
    falhas,
  )

  // O DESTINO dos CTAs desta tela, e as fichas da §30. Lê os agregados que
  // acabaram de ser calculados — nunca reconta o banco, pela mesma razão que a
  // cadeia de derivação acima existe.
  const detalhes = montarDetalhesMapa({
    base,
    ordenados: gargalos.ordenados,
    pessoasPorModulo: gargalos.pessoasPorModulo,
    ancoraModuloId: travados.ancora?.moduloId ?? null,
    ancoraTitulo: travados.ancora?.titulo ?? "",
    linhasFunil: funil.linhas,
    matrizCompleta: linhasDaMatriz(base),
  })

  const contexto: ContextoMapa = {
    agoraISO: new Date(fonte.agoraMs).toISOString(),
    periodoDias: fonte.periodoDias,
    cursoFiltro: contextoDeTela.cursoFiltroNome,
    totalAlunos: base.roster.length,
  }

  const blocos = [mapa, gargalos.bloco, distribuicao.bloco, travados.bloco, funil, insights]

  // O estado do TOPO é conservador: falha na leitura do roster invalida a tela
  // inteira (sem universo, todo denominador é chute). Falha parcial deixa a
  // tela em "ok" e o bloco afetado em "erro" — que é o ponto de ter estado por
  // bloco em vez de um booleano global.
  const estado: "ok" | "vazio" | "erro" = falhas.roster
    ? "erro"
    : blocos.every((b) => b.estado === "vazio")
      ? "vazio"
      : "ok"

  return {
    estado,
    erro: primeiraFalhaMapa(falhas, TODAS_AS_CHAVES),
    contexto,
    mapa,
    gargalos: gargalos.bloco,
    distribuicao: distribuicao.bloco,
    travados: travados.bloco,
    funil,
    insights,
    detalhes,
    faixaRodape: FAIXA_RODAPE,
    notaPeriodo: REGUA_PERIODO,
  }
}
