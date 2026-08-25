// ---------------------------------------------------------------------------
// Esqueleto de carregamento — "Meus Padrões e Tendências" (Tela 2).
// ---------------------------------------------------------------------------
// Usado como `fallback` de um `<Suspense/>` em volta de `<PainelPadroes/>`
// (a integração em `jornada/page.tsx` é de quem monta a rota — este arquivo
// só entrega a peça). A forma reproduz os 4 blocos reais (§16-19) na MESMA
// ordem e com a MESMA moldura de `Card`, para o layout não "pular" quando o
// dado real chega: cada retângulo cinza ocupa aproximadamente a altura que o
// bloco correspondente ocupa com conteúdo.
//
// `aria-hidden` no miolo pulsante: o rótulo acessível do carregamento é o
// texto "Carregando seus padrões..." via `role="status"`, não os retângulos
// (que não carregam informação nenhuma, só a promessa de que ela vem).
// ---------------------------------------------------------------------------

import {
  Card as CardPrimitivo,
  CardTitulo,
} from "@/components/analytics/autogestao/design-autogestao"

function BarraPulsante({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[6px] bg-[#EDE8E5] ${className}`} aria-hidden="true" />
  )
}

function CardEsqueleto({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <CardPrimitivo className="p-6">
      <CardTitulo>{titulo}</CardTitulo>
      <div className="mt-[14px]">{children}</div>
    </CardPrimitivo>
  )
}

export function PainelPadroesEsqueleto() {
  return (
    <output aria-label="Carregando seus padrões e tendências" className="flex flex-col gap-[18px]">
      <span className="sr-only">Carregando seus padrões e tendências...</span>

      {/* §16 — Minha regularidade ao longo do tempo. */}
      <CardEsqueleto titulo="Minha regularidade ao longo do tempo">
        <BarraPulsante className="h-[16px] w-[220px]" />
        <BarraPulsante className="mt-[16px] h-[200px] w-full" />
      </CardEsqueleto>

      {/* §17 — Meu padrão de continuidade. */}
      <CardEsqueleto titulo="Meu padrão de continuidade">
        <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-[10px] p-[14px]" style={{ backgroundColor: "#FAF8F7" }}>
              <BarraPulsante className="h-[28px] w-[28px] rounded-full" />
              <BarraPulsante className="mt-[10px] h-[12px] w-[80%]" />
              <BarraPulsante className="mt-[6px] h-[20px] w-[60%]" />
            </div>
          ))}
        </div>
      </CardEsqueleto>

      {/* §18 — O que favorece meu ritmo? */}
      <CardEsqueleto titulo="O que favorece meu ritmo?">
        <div className="flex flex-col gap-[12px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-[10px]">
              <BarraPulsante className="h-[22px] w-[22px] shrink-0 rounded-full" />
              <BarraPulsante className="h-[14px] w-full" />
            </div>
          ))}
        </div>
      </CardEsqueleto>

      {/* §19 — Tendência atual. */}
      <CardEsqueleto titulo="Tendência atual">
        <div className="flex items-center gap-[12px]">
          <BarraPulsante className="h-[24px] w-[110px] rounded-full" />
          <BarraPulsante className="h-[14px] w-[260px]" />
        </div>
        <div className="mt-[14px] flex flex-wrap gap-[8px]">
          {[0, 1, 2, 3].map((i) => (
            <BarraPulsante key={i} className="h-[26px] w-[130px] rounded-[8px]" />
          ))}
        </div>
      </CardEsqueleto>
    </output>
  )
}
