// ---------------------------------------------------------------------------
// A barra de abas do Analytics do gestor.
// ---------------------------------------------------------------------------
// Ela saiu de dentro de `visao-geral-tab.tsx` quando as outras duas abas da
// trinca ganharam tela própria: a barra tem que ser a MESMA nas três, senão o
// gestor clica e sente que trocou de aplicativo. As medidas abaixo são as que
// foram calibradas contra a referência e vieram inteiras — nenhuma mudou.
//
// DUAS FORMAS, e a diferença é deliberada:
//   • SEM `destino` ⇒ `<span>` inerte, exatamente como antes. É o que o harness
//     de preview (`/gauntlet-preview/visao-geral`) usa: sem roteador, sem
//     sessão, screenshot byte a byte igual a cada rodada.
//   • COM `destino` ⇒ `<Link>` real. O `<a>` do Tailwind preflight herda cor e
//     decoração (`color: inherit; text-decoration: inherit`), e a cor aqui é
//     inline, então a caixa e a tinta são as mesmas do `<span>`.
//
// O href COMPLETO (e não o `?tab=…` relativo que a camada de dados emite)
// existe por causa da §3.4 da spec: "ao navegar entre Visão Geral → Padrões e
// Tendências → Mapa da Jornada, os filtros devem permanecer selecionados". Um
// `?tab=padroes` cru substituiria a query inteira e apagaria `?periodo=`,
// `?curso=` e `?escopo=` — o gestor voltaria para a Visão geral com outro
// recorte do que ele estava lendo, e sem nada na tela dizendo isso.
// ---------------------------------------------------------------------------

import type { Aba } from "@/lib/analytics/visao-geral/tipos"
import Link from "next/link"
import { COR_ACAO, TEXTO } from "./design"

export interface DestinoAbas {
  /** Caminho da rota que serve a trinca. Hoje, sempre `/analytics`. */
  pathname: string
  /** A query ATUAL, sem o "?" e já sem o `tab` — o que precisa sobreviver. */
  query: string
}

/** `?tab=` reescrito, todo o resto preservado. */
export function hrefDaAba(destino: DestinoAbas, abaId: string): string {
  const parametros = new URLSearchParams(destino.query)
  parametros.set("tab", abaId)
  return `${destino.pathname}?${parametros.toString()}`
}

/**
 * ESCALA CALIBRADA (rodada 6, preservada). A 15px a aba media cap 12 e 80px de
 * tinta em "Visão geral", fora da banda 9–11 de B-29. Medida de tinta na
 * referência (y 117‥131):
 *   rótulo               ref    r5 (15px)   quociente
 *   Visão geral ......... 75      80          0,938
 *   Padrões e tendências  143     152         0,941
 *   Mapa da jornada ..... 110     117         0,940
 * O quociente é o mesmo nos três: o erro era de TAMANHO, não de tracking.
 * 15 × 0,94 = 14,1px devolve 75/143/110 e o cap a ~10. O sublinhado é
 * consequência, não ajuste separado — o `px-[9px]` de cada lado o mantém em
 * rótulo + 18px (A-20 pede + 10 a 22) e centrado.
 *
 * A caixa de linha (18) e o vão até o sublinhado (3) são a compressão vertical
 * da mesma rodada: folga, nunca tinta.
 */
const CLASSE_ABA = "px-[9px] pb-[3px] text-[14.1px] leading-[18px] whitespace-nowrap"

function estiloDaAba(ativa: boolean): React.CSSProperties {
  return {
    color: ativa ? COR_ACAO : TEXTO.mudo,
    fontWeight: ativa ? 600 : 500,
    letterSpacing: "-0.006em",
    // NÃO existe régua horizontal de largura total (A-21): o sublinhado
    // pertence só ao item ativo. A borda transparente nos demais mantém a
    // linha de base igual, sem desenhar nada.
    borderBottom: ativa ? `3px solid ${COR_ACAO}` : "3px solid transparent",
  }
}

export function NavAbas({
  abas,
  destino,
}: {
  abas: readonly Aba[]
  destino?: DestinoAbas
}) {
  return (
    <nav className="mt-[4px] flex gap-[17px]" aria-label="Seções do Analytics">
      {abas.map((aba) =>
        destino ? (
          <Link
            key={aba.id}
            href={hrefDaAba(destino, aba.id)}
            className={CLASSE_ABA}
            style={estiloDaAba(aba.ativa)}
            aria-current={aba.ativa ? "page" : undefined}
          >
            {aba.rotulo}
          </Link>
        ) : (
          <span key={aba.id} className={CLASSE_ABA} style={estiloDaAba(aba.ativa)}>
            {aba.rotulo}
          </span>
        ),
      )}
    </nav>
  )
}
