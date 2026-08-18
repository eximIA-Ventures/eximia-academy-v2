// ---------------------------------------------------------------------------
// Visão geral → gaveta: o roster da tela virando fichas da §30.
// ---------------------------------------------------------------------------
// Função PURA sobre `VisaoGeralDados`, e é por isso que ela roda tanto com dado
// real quanto com a fixture do preview: o roster já é parte do contrato desta
// tela (a UI usa ele para nomear destinatário e resolver `nudgeType`), então
// nenhuma consulta nova nasce aqui e nenhuma camada de dados muda.
//
// O QUE ESTE ARQUIVO NÃO FAZ: não lê banco, não recalcula estado, não ordena
// por mérito. `Aluno.estado` já é a projeção §4 feita uma vez pela camada de
// dados; refazê-la aqui daria duas verdades sobre a mesma pessoa na mesma tela.
//
// I-7: os campos produzidos são os OITO da §30 e mais nada. `PessoaDaGaveta`
// não tem onde guardar texto de reflexão, e este arquivo não lê nenhum — o
// contrato desta tela sequer carrega esse dado (ver `i-7-gate-lgpd.test.ts`).
// ---------------------------------------------------------------------------

import { ACAO_POR_ESTADO, ROTULO_ESTADO } from "@/lib/analytics/gaveta/tipos"
import type { PessoaDaGaveta } from "@/lib/analytics/gaveta/tipos"
import type { Aluno, ContextoGlobal, VisaoGeralDados } from "./tipos"

/**
 * §30 "curso". Com o filtro em "Todos os cursos" a resposta honesta é o próprio
 * recorte, não uma matrícula escolhida a dedo: esta tela agrega os cursos do
 * período (§3.2) e apontar um só faria a ficha afirmar um vínculo que o número
 * ao lado não usou.
 */
function rotuloDeCurso(contexto: ContextoGlobal): string {
  return contexto.cursoFiltro ?? "Todos os cursos"
}

/**
 * §30 "progresso".
 *
 * `null` quando NÃO HÁ prazo com que comparar: `progressoEsperadoPercent === 0`
 * é o carimbo de "curso sem deadline" da base (`avaliaveis`), e exibir
 * "esperado 0%" leria como "a pessoa deveria estar em zero". O progresso
 * realizado continua sendo dito; o que some é a comparação inexistente.
 */
function rotuloDeProgresso(aluno: Aluno): string {
  if (aluno.progressoEsperadoPercent > 0) {
    return `${aluno.progressoPercent}% concluído · esperado ${aluno.progressoEsperadoPercent}% para hoje`
  }
  return `${aluno.progressoPercent}% concluído · o curso não tem prazo definido`
}

/**
 * §30 "frequência recente". A régua é a MESMA da §8.2 (`ehRegular`: atividade em
 * ≥2 dias distintos na maioria das semanas cheias), já resolvida em
 * `Aluno.regular` — a ficha lê o campo, não reimplementa o critério.
 */
function rotuloDeFrequencia(aluno: Aluno, periodoDias: number): string {
  if (aluno.regular) return `Regular: 2+ dias por semana nos últimos ${periodoDias} dias`
  if (aluno.ativoNoPeriodo) return `Ativa, mas sem regularidade nos últimos ${periodoDias} dias`
  return `Sem atividade nos últimos ${periodoDias} dias`
}

/**
 * §30 "sinal identificado" — POR QUE a pessoa está sendo olhada.
 *
 * A frase cita os dias sem atividade quando eles existem, e diz "nunca acessou"
 * quando `diasDesdeUltimaAtividade` é `null`. `null` aqui é ausência de
 * carimbo, não zero dia: tratá-lo como 0 diria "acessou hoje" sobre quem nunca
 * entrou, que é o modo de falha do I-3 na sua forma mais cara.
 */
function rotuloDeSinal(aluno: Aluno): string {
  const dias = aluno.diasDesdeUltimaAtividade
  switch (aluno.estado) {
    case "nao-iniciou":
      return "Matriculada e ainda sem nenhuma sessão de estudo"
    case "parado":
      return dias === null
        ? "Sem carimbo de atividade no período"
        : `Sem acesso há ${dias} ${dias === 1 ? "dia" : "dias"}${
            aluno.estavaNoRitmoAntesDeParar ? ", e estava no ritmo antes de parar" : ""
          }`
    case "perdendo-ritmo":
      return "Progresso abaixo do esperado ou frequência em queda"
    case "retomando":
      return "Voltou a estudar depois de um período parada"
    case "concluido":
      return "Concluiu a jornada"
    default:
      return "Progresso em dia e atividade recente"
  }
}

export function pessoaDaGaveta(aluno: Aluno, contexto: ContextoGlobal): PessoaDaGaveta {
  return {
    id: aluno.id,
    nome: aluno.nome,
    iniciais: aluno.iniciais,
    avatarTone: aluno.avatarTone,
    estado: aluno.estado,
    statusRotulo: ROTULO_ESTADO[aluno.estado],
    cursoRotulo: rotuloDeCurso(contexto),
    progressoLabel: rotuloDeProgresso(aluno),
    ultimoAcessoLabel: aluno.ultimaAtividadeLabel,
    frequenciaLabel: rotuloDeFrequencia(aluno, contexto.periodoDias),
    sinalLabel: rotuloDeSinal(aluno),
    acaoLabel: ACAO_POR_ESTADO[aluno.estado],
  }
}

/**
 * O índice `alunoId → ficha`, montado uma vez por render da tela.
 *
 * `Map` e não objeto: quem consome está no cliente e faz lookup por id em três
 * blocos diferentes; o objeto literal só existiria para atravessar a fronteira
 * RSC, e este índice é derivado NO cliente a partir do roster que já atravessou.
 */
export function fichasDaVisaoGeral(dados: VisaoGeralDados): Map<string, PessoaDaGaveta> {
  const indice = new Map<string, PessoaDaGaveta>()
  for (const aluno of dados.roster) indice.set(aluno.id, pessoaDaGaveta(aluno, dados.contexto))
  return indice
}

/**
 * As fichas de um grupo, na ORDEM em que os ids chegaram.
 *
 * Sem `sort`: quem escolheu a ordem foi a camada de dados (a fila de triagem da
 * §10.1, a lista-alvo de uma recomendação da §11). Reordenar aqui por dias sem
 * acesso transformaria a gaveta num ranking — que é exatamente o que I-8 e a
 * §2 Regra 2 proíbem.
 */
export function fichasDoGrupo(
  ids: readonly string[],
  indice: ReadonlyMap<string, PessoaDaGaveta>,
): PessoaDaGaveta[] {
  const fichas: PessoaDaGaveta[] = []
  for (const id of ids) {
    const ficha = indice.get(id)
    if (ficha) fichas.push(ficha)
  }
  return fichas
}
