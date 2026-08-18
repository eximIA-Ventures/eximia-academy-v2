// ---------------------------------------------------------------------------
// Fonte de dados de "Padrões e tendências" — a MESMA da Visão geral.
// ---------------------------------------------------------------------------
// NENHUMA CONSULTA NOVA. A tela inteira sai de `lerFonteVisaoGeral`, importada
// e nunca editada. Duas consequências que não são de estilo:
//
//   • I-4 continua estrutural: quem lê já desestrutura `error` e transforma
//     falha em VALOR (`falhas`), não em array vazio silencioso. Esta tela só
//     declara de quais chaves cada bloco depende (`FONTES_DE_*` abaixo) e sai
//     em `erro` quando alguma delas falhou.
//
//   • I-7 fica garantido por construção: a leitura de `slide_reflections` já é
//     escopada a `student_id`/carimbos na camada reusada, e as colunas de texto
//     da reflexão nunca entram na memória do processo. Esta tela não consulta a
//     tabela e não teria como pedir mais colunas.
//
// DUAS FONTES DELIBERADAMENTE NÃO USADAS:
//   1. `chapter_view_progress` — proibida em QUALQUER comparação temporal desta
//      tela. A tabela nasceu em 2026-07-30 e tem script de backfill: numa janela
//      de 30 dias medida hoje, o período anterior é anterior à tabela, e a
//      comparação fabricaria crescimento. Por isso a §19 mede ativação por
//      SESSÃO, não conclusão por percorrido.
//   2. Telemetria de origem de acesso — não existe no schema. Ver F-07.
// ---------------------------------------------------------------------------

import type { ChaveFonte } from "../visao-geral/fonte"

export { primeiraFalha, SEM_FALHAS } from "../visao-geral/fonte"
export type {
  ChaveFonte,
  FalhasPorFonte,
  FonteVisaoGeral,
  LinhaAluno,
  LinhaAtividade,
  LinhaCapitulo,
  LinhaMatricula,
  LinhaParticipacao,
  LinhaSessao,
} from "../visao-geral/fonte"

/** §16 compara pessoas ativas, regularidade, módulos e retomadas. */
export const FONTES_DAS_MUDANCAS: readonly ChaveFonte[] = [
  "roster",
  "sessoes",
  "reflexoes",
  "capitulos",
]

/** §17 é série de sessões, e só. */
export const FONTES_DA_SERIE: readonly ChaveFonte[] = ["roster", "sessoes"]

/** §18 mistura recorrência por módulo (capítulos) com regularidade. */
export const FONTES_DOS_SINAIS: readonly ChaveFonte[] = [
  "roster",
  "sessoes",
  "reflexoes",
  "capitulos",
]

/** §19 é variação por capítulo. */
export const FONTES_DOS_GARGALOS: readonly ChaveFonte[] = ["roster", "sessoes", "capitulos"]

/** §20 conta dias distintos por semana. */
export const FONTES_DA_PARTICIPACAO: readonly ChaveFonte[] = ["roster", "sessoes", "reflexoes"]

/** §21 depende do estado da jornada, que precisa de matrícula e prazo. */
export const FONTES_DO_RISCO: readonly ChaveFonte[] = [
  "roster",
  "sessoes",
  "reflexoes",
  "matriculas",
  "cursos",
]
