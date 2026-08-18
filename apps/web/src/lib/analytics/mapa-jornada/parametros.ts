// ---------------------------------------------------------------------------
// Mapa da jornada — TODOS os limiares num lugar só.
// ---------------------------------------------------------------------------
// Mesma regra da tela anterior: número que governa decisão de tela e mora solto
// no meio de uma função é número que ninguém reafina.
//
// O QUE NÃO ESTÁ AQUI, DE PROPÓSITO:
//   • `SEM_ACESSO_DAYS` (14 dias) — canônico em `@/lib/student-triage`.
//   • `CONCENTRACAO_MODULO_PCT` (0.2, §29 regra A) — já parametrizado em
//     `visao-geral/parametros.ts:58`. Redeclarar criaria uma segunda cópia do
//     MESMO limiar da §29, que é o defeito que a régua F-21 existe para evitar.
//   • `TAMANHO_PAGINA` / `MAX_PAGINAS` / `TAMANHO_LOTE_IDS` — idem, reusados por
//     import na leitura.
// ---------------------------------------------------------------------------

export {
  CONCENTRACAO_MODULO_PCT,
  MAX_PAGINAS,
  MS_DIA,
  MS_SEMANA,
  TAMANHO_LOTE_IDS,
  TAMANHO_PAGINA,
} from "@/lib/analytics/visao-geral/parametros"

// --- §23 amostra da matriz -------------------------------------------------
/**
 * F-06 · lido do PNG de referência: 8 linhas visíveis e o rótulo `+ 32 alunos`
 * (40 − 8 = 32). É corte de ALTURA, não de mérito — as 8 saem na mesma ordem
 * alfabética do roster, nunca "as 8 piores".
 */
export const AMOSTRA_LINHAS = 8

// --- §24 gargalos ----------------------------------------------------------
/** F-10 · o PNG mostra 5 linhas + `Ver todos os módulos ›`. */
export const GARGALOS_MAX = 5

// --- §26 pessoas que travaram ---------------------------------------------
/** F-18 · o PNG mostra 5 linhas; o CTA carrega o total COMPLETO (F-21). */
export const TRAVADOS_LINHAS_MAX = 5

// --- §28 insights ----------------------------------------------------------
/** F-31 · §28: "Máximo 3 conclusões" — nunca "exatamente 3". */
export const INSIGHTS_MAX = 3
