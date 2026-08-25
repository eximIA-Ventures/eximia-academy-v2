// ---------------------------------------------------------------------------
// A MOLDURA das 3 vistas de "Aprendizagem do Time": título, subtítulo,
// seletor de domínio (Ativação ⇄ Aprendizagem), filtros (reusados tal-qual
// de Ativação — mesmo recorte de equipe/curso/período) e a trinca de vistas.
//
// Ao contrário da trinca de Ativação (onde "Visão geral" desenha o próprio
// cabeçalho e as outras duas usam `_trinca/moldura.tsx`), aqui as 3 vistas
// passam pela MESMA moldura — não há razão histórica pra dividir, e dividir
// só multiplicaria onde o cabeçalho é definido.
// ---------------------------------------------------------------------------

import {
  type ItemNavSecundaria,
  NavSecundaria,
} from "@/components/analytics/aprendizagem-time/nav-secundaria"
import { TEXTO } from "@/components/analytics/visao-geral/design"
import {
  type ControlesFiltro,
  FiltrosEscopo,
} from "@/components/analytics/visao-geral/filtros-escopo"
import type { DestinoAbas } from "@/components/analytics/visao-geral/nav-abas"
import { type VistaId, vistasComAtiva } from "@/lib/analytics/aprendizagem-time/vistas"
import { itensDominio } from "@/lib/analytics/dominios"

const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

/** `?vista=` reescrito, todo o resto (inclusive `dominio=aprendizagem`) preservado. */
function hrefDaVista(destino: DestinoAbas, vistaId: string): string {
  const parametros = new URLSearchParams(destino.query)
  parametros.set("vista", vistaId)
  parametros.set("dominio", "aprendizagem")
  return `${destino.pathname}?${parametros.toString()}`
}

export function MolduraAprendizagem({
  vista,
  destino,
  controles,
}: {
  vista: VistaId
  destino: DestinoAbas
  controles: ControlesFiltro
}) {
  // A volta para Ativação leva os filtros junto — o recorte descreve a mesma
  // equipe nos dois domínios (ver `lib/analytics/dominios.ts`).
  const dominios: ItemNavSecundaria[] = itensDominio("aprendizagem", destino.query)
  const itensVista: ItemNavSecundaria[] = vistasComAtiva(vista).map((v) => ({
    id: v.id,
    rotulo: v.rotulo,
    ativo: v.ativa,
    href: hrefDaVista(destino, v.id),
  }))

  return (
    <div className={`${RECUO_DA_COLUNA} pb-[12px]`} style={{ color: TEXTO.primario }}>
      <NavSecundaria itens={dominios} ariaLabel="Domínio do Analytics" />

      <header className="mt-[10px] flex items-start justify-between gap-[24px] pr-[11px]">
        <div className="min-w-0 max-w-[560px]">
          <h1
            className="text-[33px] leading-[36px] font-bold"
            style={{ color: TEXTO.primario, letterSpacing: "-0.021em", wordSpacing: "2px" }}
          >
            Aprendizagem do Time
          </h1>
          <p
            className="mt-[4px] text-[14.8px] leading-[20px]"
            style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
          >
            Veja a qualidade da aprendizagem da sua equipe e onde apoiar o desenvolvimento de
            capacidades.
          </p>
        </div>
        <div className="shrink-0">
          <FiltrosEscopo controles={controles} />
        </div>
      </header>

      <NavSecundaria itens={itensVista} ariaLabel="Vistas de Aprendizagem do Time" />
    </div>
  )
}

/** Mesma tela de falha da Ativação (`_trinca/moldura.tsx`), deliberadamente idêntica. */
export function TelaEmFalhaAprendizagem({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="max-w-[720px] rounded-xl border border-border-medium bg-bg-card p-6">
      <p className="text-base font-semibold text-text-primary">{titulo}</p>
      <p className="mt-2 text-sm text-text-secondary">
        Nenhum número é exibido enquanto a leitura não for confiável.
      </p>
      <p className="mt-3 font-mono text-xs text-text-muted">{detalhe}</p>
    </div>
  )
}
