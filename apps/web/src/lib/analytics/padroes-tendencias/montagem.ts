// ---------------------------------------------------------------------------
// Montagem da aba "Padrões e tendências" — a função PURA.
// ---------------------------------------------------------------------------
// Nenhum `Date.now()`, nenhuma consulta, nenhum `process.env`. Tudo entra por
// parâmetro, inclusive o instante "agora". É o que permite ao teste deslocar o
// tempo, cruzar a meia-noite UTC e duplicar a população sem mock nenhum — e é o
// que faz de I-5 e I-6 propriedades verificáveis em vez de promessas.
//
// AS 7 AÇÕES SÃO COLETADAS DOS BLOCOS, não redigitadas aqui. Uma segunda lista
// de rótulos divergiria da primeira no dia em que alguém renomeasse um CTA, e o
// teste que conta 7 continuaria verde apontando para a lista errada.
// ---------------------------------------------------------------------------

import { montarBasePadroes } from "./base"
import type { FonteVisaoGeral } from "./fonte"
import { primeiraFalha } from "./fonte"
import { montarGargalos } from "./gargalos"
import { montarMudancas } from "./mudancas"
import { MS_DIA } from "./parametros"
import { montarParticipacao } from "./participacao"
import { montarRisco } from "./risco"
import { montarSerie } from "./serie"
import { montarSinais } from "./sinais"
import { ACAO_COMO_LER, FAIXA_FOCO, MOLDURA_TEXTO, MOLDURA_TITULO } from "./textos"
import type { Acao, ContextoPadroes, PadroesTendenciasDados } from "./tipos"

const ACAO_MOLDURA: Acao = { id: "como-ler", rotulo: ACAO_COMO_LER, ctaEscreve: false }

const TODAS_AS_CHAVES = [
  "roster",
  "sessoes",
  "reflexoes",
  "matriculas",
  "cursos",
  "participacao",
  "capitulos",
] as const

export function montarPadroesTendencias(fonte: FonteVisaoGeral): PadroesTendenciasDados {
  const base = montarBasePadroes(fonte)
  const { falhas } = fonte
  const { janelas } = base.visao

  const mudancas = montarMudancas(base, falhas)
  const serie = montarSerie(base, falhas)
  const sinais = montarSinais(base, falhas)
  const gargalos = montarGargalos(base, falhas)
  const participacao = montarParticipacao(base, falhas)
  const risco = montarRisco(base, falhas)

  const contexto: ContextoPadroes = {
    agoraISO: new Date(fonte.agoraMs).toISOString(),
    periodoDias: Math.round(janelas.duracaoMs / MS_DIA),
    periodoInicioISO: new Date(janelas.atualInicio).toISOString(),
    periodoFimISO: new Date(janelas.atualFim).toISOString(),
    periodoAnteriorInicioISO: new Date(janelas.anteriorInicio).toISOString(),
    periodoAnteriorFimISO: new Date(janelas.anteriorFim).toISOString(),
    totalRecorte: base.visao.roster.size,
  }

  const blocos = [mudancas, serie, sinais, gargalos, participacao, risco]

  // Conservador: falha na leitura do roster invalida a tela inteira (sem
  // universo, todo denominador é chute). Falha parcial deixa a tela em "ok" e o
  // bloco afetado em "erro" — que é o ponto de ter estado por bloco.
  const estado: "ok" | "vazio" | "erro" = falhas.roster
    ? "erro"
    : blocos.every((b) => b.estado === "vazio")
      ? "vazio"
      : "ok"

  return {
    estado,
    erro: primeiraFalha(falhas, TODAS_AS_CHAVES),
    contexto,
    moldura: { titulo: MOLDURA_TITULO, texto: MOLDURA_TEXTO, acao: ACAO_MOLDURA },
    mudancas,
    serie,
    sinais,
    gargalos,
    participacao,
    risco,
    faixaFoco: FAIXA_FOCO,
    acoes: [
      ACAO_MOLDURA,
      mudancas.acao,
      serie.acao,
      sinais.acao,
      gargalos.acao,
      participacao.acao,
      risco.acao,
    ],
  }
}
