// ---------------------------------------------------------------------------
// A MOLDURA das abas "Padrões e tendências" e "Mapa da jornada".
// ---------------------------------------------------------------------------
// Título, subtítulo, filtros e barra de abas. Ela existe porque as duas telas
// que a usam NÃO desenham cabeçalho: os componentes `PadroesTendenciasTab` e
// `MapaJornadaTab` começam direto no conteúdo (o orçamento vertical de
// `padroes-tendencias-tab.tsx` diz isso com todas as letras — "o cabeçalho da
// página e a barra de abas, compartilhados com as outras duas abas e fora do
// escopo desta, consomem 124px"). Quem preenche esses 124px é este arquivo.
//
// A "Visão geral" NÃO passa por aqui, e isso é deliberado: o cabeçalho dela vem
// da camada de dados (`cabecalho.titulo`, `cabecalho.subtitulo`, carimbo de
// frescor) e é desenhado dentro de `visao-geral-tab.tsx`. Reescrevê-lo aqui
// significaria dois cabeçalhos disputando a mesma tela. O que as três COMPARTILHAM
// de verdade — a barra de abas (`NavAbas`) e os filtros (`FiltrosEscopo`) — é
// importado dos mesmos arquivos nos dois caminhos, e é por isso que a barra é
// idêntica nas três: é literalmente a mesma.
//
// OS FILTROS VIVEM NA URL. `FiltrosEscopo` reescreve `?periodo=`, `?escopo=` e
// `?curso=` preservando o resto, e `NavAbas` troca só o `?tab=` — é o par que
// faz a §3.4 da spec valer ("ao navegar entre as abas, os filtros devem
// permanecer selecionados"). Nenhum `useState` guarda filtro aqui: estado local
// morre na navegação, por definição.
// ---------------------------------------------------------------------------

import { TEXTO } from "@/components/analytics/visao-geral/design"
import {
  type ControlesFiltro,
  FiltrosEscopo,
} from "@/components/analytics/visao-geral/filtros-escopo"
import { type DestinoAbas, NavAbas } from "@/components/analytics/visao-geral/nav-abas"
import { type AbaId, TRINCA, abasComAtiva } from "@/lib/analytics/visao-geral/abas"

/**
 * O recuo que põe a coluna na régua — o MESMO de `padroes-tendencias-tab.tsx`.
 *
 * O `<main>` da Academy entrega 1364px úteis; a régua exige a coluna começando
 * 31px depois da origem e terminando 80px antes da borda direita do canvas.
 * `2xl:pr-[56px]` (e não `pr-[56px]` puro) porque abaixo de 1536px a folga de 56
 * vira desperdício.
 */
export const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

/**
 * O que cada aba responde, em uma linha.
 *
 * Condensado da promessa que a tela "em construção" já anunciava ao gestor —
 * texto que o dono do produto leu e aprovou naquela forma. Escrever uma promessa
 * NOVA aqui seria contar duas histórias sobre a mesma aba.
 */
const SUBTITULO: Record<Exclude<AbaId, "visao-geral">, string> = {
  padroes: "Como o comportamento da equipe se move ao longo do tempo.",
  mapa: "Onde cada pessoa está no percurso.",
}

export function MolduraAba({
  aba,
  destino,
  controles,
}: {
  aba: Exclude<AbaId, "visao-geral">
  destino: DestinoAbas
  controles: ControlesFiltro
}) {
  const titulo = TRINCA.find((t) => t.id === aba)?.rotulo ?? ""

  return (
    // As MEDIDAS são as do cabeçalho da "Visão geral" (h1 33/36 com o mesmo
    // tracking, subtítulo 14.8/20, filtros na MESMA fileira): trocar de aba não
    // pode dar a impressão de trocar de aplicativo.
    <div className={`${RECUO_DA_COLUNA} pb-[12px]`} style={{ color: TEXTO.primario }}>
      {/*
        ═══ A FAIXA DE FILTROS TEM A MESMA ALTURA NAS TRÊS ABAS ═══════════════
        DEFEITO MEDIDO (2026-08-18): a altura do cabeçalho era função do
        COMPRIMENTO DO SUBTÍTULO. `ScopeBar` é `flex-wrap` e o bloco de título
        não tinha limite de largura, então em "Padrões e tendências" o subtítulo
        `Como o comportamento da equipe se move ao longo do tempo.` empurrava os
        filtros para duas fileiras (cabeçalho de 101px a 1512), enquanto em
        "Mapa da jornada" o subtítulo curto deixava 137px de folga e a barra
        colapsava em uma fileira (cabeçalho de 64px). Mesmo componente, duas
        alturas, e 37px de deslocamento vertical em TODO o conteúdo abaixo ao
        trocar de aba — a tela parecia pular.
        `min-w-0 max-w-[560px]` no bloco de título e `shrink-0` nos filtros
        invertem a ordem de quem cede: os controles recebem sempre a largura
        natural (uma fileira, altura constante) e quem reflui, se faltar espaço,
        é o subtítulo. Trocar de aba deixa de mover a régua.
      */}
      <header className="flex items-start justify-between gap-[24px] pr-[11px]">
        <div className="min-w-0 max-w-[560px]">
          {/* `wordSpacing` compensa o aperto que o `letterSpacing` negativo impõe
              também ao espaço entre palavras. */}
          <h1
            className="text-[33px] leading-[36px] font-bold"
            style={{ color: TEXTO.primario, letterSpacing: "-0.021em", wordSpacing: "2px" }}
          >
            {titulo}
          </h1>
          <p
            className="mt-[4px] text-[14.8px] leading-[20px]"
            style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
          >
            {SUBTITULO[aba]}
          </p>
        </div>

        {/* Os controles REAIS da Academy (`ScopeBar` + `PeriodFilter` + pílula de
            curso), os mesmos da "Visão geral" — não uma segunda barra parecida.
            Eles dividem a fileira com o título porque a dobra não comporta uma
            faixa própria de 64px. */}
        <div className="shrink-0">
          <FiltrosEscopo controles={controles} />
        </div>
      </header>

      <NavAbas abas={abasComAtiva(aba)} destino={destino} />
    </div>
  )
}

/**
 * A tela quando ela não pode ser montada. Deliberadamente feia e explícita: o
 * gestor precisa saber que está olhando para uma falha, e não para a equipe
 * dele. É o invariante I-4 na única forma que importa — a visível.
 */
export function TelaEmFalha({ titulo, detalhe }: { titulo: string; detalhe: string }) {
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
