// ---------------------------------------------------------------------------
// A MOLDURA da Autogestão da minha Jornada — cabeçalho + barra de 3 abas.
// ---------------------------------------------------------------------------
// Ao contrário da trinca do gestor (onde cada aba tem título/subtítulo
// PRÓPRIOS — `_trinca/moldura.tsx`), aqui o cabeçalho é o MESMO nas três abas
// (ESPECIFICACAO.md §3: "Autogestão da minha Jornada" / mesmo subtítulo em
// todas). É por isso que o cabeçalho vive aqui, uma vez, envolvendo as três —
// e não dentro de cada painel.
//
// O FILTRO DE PERÍODO VIVE NA URL (`?periodo=`), preservando `vista=` e
// `aba=` — mesmo princípio da trinca do gestor (`filtros-escopo.tsx`): estado
// local morre na navegação, um link com `?periodo=` sobrevive a refresh, ao
// botão de voltar e a um link colado no chat.
//
// PRIMITIVAS REUSADAS do design system do gestor (`components/analytics/
// visao-geral/design.tsx`): `TEXTO`, `COR_ACAO` — mesma linguagem tipográfica
// e cromática, não uma segunda paleta inventada para esta tela.
// ---------------------------------------------------------------------------

import { COR_ACAO, TEXTO } from "@/components/analytics/visao-geral/design"
import Link from "next/link"
import { FiltroPeriodoAutogestao } from "./filtro-periodo"
import { SeletorVistaJornada } from "./seletor-vista"

export type AbaAutogestao = "visao-geral" | "padroes" | "mapa"

const ABAS: ReadonlyArray<{ id: AbaAutogestao; rotulo: string }> = [
  { id: "visao-geral", rotulo: "Visão Geral" },
  { id: "padroes", rotulo: "Meus Padrões e Tendências" },
  { id: "mapa", rotulo: "Meu Mapa da Jornada" },
]

/** `?aba=` da string informada é válida? Cai no default (`visao-geral`) senão. */
export function lerAbaAutogestao(bruto: string | undefined): AbaAutogestao {
  if (bruto === "padroes" || bruto === "mapa") return bruto
  return "visao-geral"
}

/** `?periodo=` reescrito nas 3 abas, MESMO da leitura em `recorte.ts`. */
export function lerPeriodoAutogestao(bruto: string | undefined): 7 | 30 | 90 {
  const numero = bruto ? Number.parseInt(bruto, 10) : 30
  return (numero === 7 || numero === 90 ? numero : 30) as 7 | 30 | 90
}

/** `?aba=` reescrito, o resto da query (inclusive `vista=autogestao`) preservado. */
function hrefDaAba(queryAtual: string, aba: AbaAutogestao): string {
  const parametros = new URLSearchParams(queryAtual)
  parametros.set("vista", "autogestao")
  parametros.set("aba", aba)
  return `/jornada?${parametros.toString()}`
}

/**
 * A barra de 3 abas. Mesma anatomia visual da trinca do gestor (rótulo em
 * laranja + sublinhado quando ativo, cinza-mudo quando inativo) — reproduzida
 * aqui porque `NavAbas` do gestor está fixado ao parâmetro `?tab=` e ao tipo
 * `AbaId` dele; o invariante que muda de propósito (nome do parâmetro da
 * URL) é o que justifica não reusá-lo cru.
 */
function NavAbasAutogestao({
  abaAtiva,
  queryAtual,
  hrefDeAba,
}: {
  abaAtiva: AbaAutogestao
  queryAtual: string
  /** Override do destino da aba — ver `MolduraAutogestao` abaixo. */
  hrefDeAba?: (aba: AbaAutogestao) => string
}) {
  // mt-[16px], não 10. Medido: a folga título→subtítulo é de 6px, e com apenas
  // 10px até a régua de abas o olho agrupava o SUBTÍTULO com a NAVEGAÇÃO em vez
  // de com o título — os dois espaços eram próximos demais para separar o que é
  // cabeçalho do que é navegação. 16px restaura a hierarquia sem custar altura,
  // porque o subtítulo passou a caber em uma linha (ver o comentário do max-w no
  // cabeçalho desta moldura).
  return (
    <nav
      className="mt-[16px] flex gap-[20px] border-b border-border-subtle"
      aria-label="Abas da Autogestão"
    >
      {ABAS.map((aba) => {
        const ativa = aba.id === abaAtiva
        return (
          <Link
            key={aba.id}
            href={hrefDeAba ? hrefDeAba(aba.id) : hrefDaAba(queryAtual, aba.id)}
            aria-current={ativa ? "page" : undefined}
            className="px-[2px] pb-[9px] text-[14.1px] leading-[18px] font-medium whitespace-nowrap"
            style={{
              color: ativa ? COR_ACAO : TEXTO.mudo,
              fontWeight: ativa ? 600 : 500,
              borderBottom: ativa ? `3px solid ${COR_ACAO}` : "3px solid transparent",
            }}
          >
            {aba.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}

export function MolduraAutogestao({
  abaAtiva,
  queryAtual,
  periodoDias,
  children,
  hrefDeAba,
}: {
  abaAtiva: AbaAutogestao
  /** A query ATUAL sem `vista`/`aba` (o que precisa sobreviver à troca). */
  queryAtual: string
  periodoDias: 7 | 30 | 90
  children: React.ReactNode
  /**
   * Override OPCIONAL do destino de cada aba. Ausente = comportamento de
   * produção intocado (`hrefDaAba`, sempre `/jornada?...`). Existe para os 3
   * harnesses `/gauntlet-preview/autogestao-*` (rotas IRMÃS, não query params)
   * apontarem a navegação para dentro do próprio preview, sem essa moldura
   * (compartilhada pelas 3 telas de produção) saber que preview existe.
   */
  hrefDeAba?: (aba: AbaAutogestao) => string
}) {
  return (
    <div className="pb-24 pl-[8px] pr-[16px] pt-2 sm:pl-[24px]" style={{ color: TEXTO.primario }}>
      {/* Nível ACIMA das 3 abas — CONTRATO-DE-DADOS.md §NAVEGAÇÃO N.3. Volta ao
          plano sem digitar URL; ver `seletor-vista.tsx`. */}
      <div className="mb-4">
        <SeletorVistaJornada vistaAtiva="autogestao" queryAtual={queryAtual} />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        {/*
          max-w-[1100px], não 560. MEDIDO no DOM a 1440×1080, não estimado.
          ------------------------------------------------------------------
          Com 560px o subtítulo quebrava em DUAS linhas (precisa de 664px para
          caber em uma), e o resultado é o critério G-02 reprovando nas TRÊS
          telas ao mesmo tempo: o subtítulo perdia a leitura de linha de apoio
          e passava a competir com o título.
          O espaço estava livre o tempo todo — o seletor de período começa em
          x=1174, ou seja, havia 566px ociosos à direita e nenhuma colisão.
          1100 cabe com folga (o limite antes de encostar no filtro é 1110).
          Bônus medido: com o subtítulo em uma linha a página encolhe 20px, o
          que devolve orçamento vertical ao gráfico da Tela 2 (P-18).
        */}
        <div className="min-w-0 max-w-[1100px]">
          <h1
            className="text-[28px] leading-[32px] font-bold sm:text-[33px] sm:leading-[36px]"
            style={{ color: TEXTO.primario, letterSpacing: "-0.021em", wordSpacing: "2px" }}
          >
            Autogestão da minha Jornada
          </h1>
          <p
            className="mt-[6px] text-[14.8px] leading-[20px]"
            style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
          >
            Use seus dados para entender seus padrões, manter seu ritmo e decidir seus próximos
            passos.
          </p>
        </div>

        <div className="shrink-0">
          <FiltroPeriodoAutogestao periodoDias={periodoDias} queryAtual={queryAtual} />
        </div>
      </header>

      <NavAbasAutogestao abaAtiva={abaAtiva} queryAtual={queryAtual} hrefDeAba={hrefDeAba} />

      <div className="mt-[20px] flex flex-col gap-[18px]">{children}</div>
    </div>
  )
}
