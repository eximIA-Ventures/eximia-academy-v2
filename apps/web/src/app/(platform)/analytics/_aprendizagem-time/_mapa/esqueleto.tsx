// ---------------------------------------------------------------------------
// Silhueta de carregamento da Tela 3 — mesma regra de `_visao-geral/
// esqueleto.tsx`: nunca piscar zero.
// ---------------------------------------------------------------------------

function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-black/[0.055] ${className}`} />
}

const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

export function EsqueletoMapaCapacidades() {
  return (
    <div
      className={`${RECUO_DA_COLUNA} flex flex-col gap-[14px] py-[8px]`}
      aria-busy="true"
      aria-label="Carregando Mapa de Capacidades"
    >
      <div className="flex gap-[14px]">
        <Bloco className="h-[260px] flex-1" />
        <Bloco className="h-[260px] flex-1" />
      </div>
      <Bloco className="h-[300px]" />
      <div className="flex gap-[14px]">
        <Bloco className="h-[200px] flex-1" />
        <Bloco className="h-[200px] flex-1" />
        <Bloco className="h-[200px] flex-1" />
      </div>
    </div>
  )
}
