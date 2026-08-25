// ---------------------------------------------------------------------------
// Silhueta de carregamento da Tela 2 — mesma regra de `_visao-geral/
// esqueleto.tsx`: nunca piscar zero.
// ---------------------------------------------------------------------------

function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-black/[0.055] ${className}`} />
}

const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

export function EsqueletoPadroesEvolucao() {
  return (
    <div
      className={`${RECUO_DA_COLUNA} flex flex-col gap-[14px] py-[8px]`}
      aria-busy="true"
      aria-label="Carregando Padrões e Evolução"
    >
      <div className="flex gap-[14px]">
        <Bloco className="h-[280px] flex-[2]" />
        <Bloco className="h-[280px] flex-1" />
      </div>
      <Bloco className="h-[320px]" />
      <div className="flex gap-[14px]">
        <Bloco className="h-[220px] flex-1" />
        <Bloco className="h-[220px] flex-1" />
        <Bloco className="h-[220px] flex-1" />
      </div>
    </div>
  )
}
