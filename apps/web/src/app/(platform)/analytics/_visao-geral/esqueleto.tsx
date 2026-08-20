// ---------------------------------------------------------------------------
// O que a tela mostra ENQUANTO o servidor recalcula.
// ---------------------------------------------------------------------------
// Regra: nunca piscar zeros. Um placar de cinco `0%` que dura 400ms é indistinto
// de um placar de cinco `0%` que é verdade — e a tela inteira existe para o
// gestor decidir a partir do que lê. Silhueta cinza é honesta; número provisório
// não é.
//
// As medidas são as MESMAS da grade real (827 + 436 na linha 1 e 2, 624 + 640 na
// linha 3, alturas 185 / 335 / 155), para o conteúdo não saltar quando chegar.
// ---------------------------------------------------------------------------

function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-black/[0.055] ${className}`} />
}

export function EsqueletoVisaoGeral() {
  return (
    <div className="pt-0 pr-[56px] pl-[31px]" aria-busy="true" aria-label="Carregando visão geral">
      <div className="flex items-start justify-between pr-[11px]">
        <div>
          <Bloco className="h-[36px] w-[280px]" />
          <Bloco className="mt-[4px] h-[20px] w-[420px]" />
        </div>
        <Bloco className="h-[64px] w-[420px]" />
      </div>

      <Bloco className="mt-[4px] h-[24px] w-[380px]" />

      <div className="mt-[2px] flex flex-col">
        <div className="flex h-[185px] gap-[14px]">
          <Bloco className="h-full w-[827px] shrink-0" />
          <Bloco className="h-full flex-1" />
        </div>
        <div className="mt-[10px] flex h-[335px] gap-[14px]">
          <Bloco className="h-full w-[827px] shrink-0" />
          <Bloco className="h-full flex-1" />
        </div>
        <div className="mt-[10px] flex h-[155px] gap-[13px]">
          <Bloco className="h-full w-[624px] shrink-0" />
          <Bloco className="h-full flex-1" />
        </div>
      </div>
    </div>
  )
}
