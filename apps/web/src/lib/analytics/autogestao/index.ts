// ---------------------------------------------------------------------------
// Autogestão da minha Jornada — a porta de entrada da camada de dados.
// ---------------------------------------------------------------------------
// Sem `fonte-supabase.ts` nesta rodada (leitura real do banco é tarefa de
// outro agente) e sem rota HTTP. Este barrel expõe só o que já existe: os
// três montadores puros, os tipos do contrato, os parâmetros e os textos —
// tudo que a fonte real (e os componentes de tela, depois) vão consumir.
// ---------------------------------------------------------------------------

export type {
  ChaveFonteAutogestao,
  FalhasPorFonteAutogestao,
  FonteAutogestao,
  LinhaCapitulo,
  LinhaPlano,
  LinhaProgressoCapitulo,
  LinhaReflexao,
  LinhaSessao,
  ModuloDuracaoPlano,
  BaselineDoPlano,
} from "./fonte"
export { SEM_FALHAS_AUTOGESTAO, primeiraFalha } from "./fonte"

export {
  carimbosDeAtividade,
  diasAtivosOrdenados,
  regularidadeVezesPorSemana,
  rotuloVezesPorSemana,
  progressoRealPercent,
  progressoRealPercentAteMs,
  duracaoTotalPlanejadaDias,
  progressoPlanejadoHoje,
  estadoDePausa,
  contarRetomadas,
  maiorIntervaloDias,
  sequenciaAtualSemanas,
  latenciasDeRetomada,
  latenciaMediaDeRetomada,
  calcularRitmo,
  janelaAtual,
  janelaAnterior,
  deltaSessoes,
  deltaRegularidadePercent,
  deltaProgressoPp,
  sessaoEmAberto,
  escolherProximoMovimento,
  melhorHorario,
  diasDaSemanaPreferidos,
  montarVisaoGeralAutogestao,
  serieSemanalDiasAtivos,
  classificarTendencia,
  montarPadroesAutogestao,
  statusDoModulo,
  moduloAtualId,
  montarMapaAutogestao,
} from "./montagem"
export type { CandidatosProximoMovimento } from "./montagem"

export {
  carimbosDeAtividadeMultiplos,
  montarMapaDeCalorAtividade,
} from "./mapa-de-calor"

export * from "./parametros"
export * from "./textos"
export * from "./tipos"
