// ---------------------------------------------------------------------------
// Silhueta de carregamento — mesma regra da Ativação (esqueleto.tsx de
// `_visao-geral/`): nunca piscar zero. Um placar de "0%" que dura 400ms é
// indistinto de um placar de "0%" que é verdade.
// ---------------------------------------------------------------------------

function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-black/[0.055] ${className}`} />
}

const RECUO_DA_COLUNA = "pr-[16px] pl-[31px] 2xl:pr-[56px]"

export function EsqueletoVisaoGeralAprendizagem() {
  return (
    <div
      className={`${RECUO_DA_COLUNA} flex flex-col gap-[14px] py-[8px]`}
      aria-busy="true"
      aria-label="Carregando Aprendizagem do Time"
    >
      <Bloco className="h-[20px] w-[280px]" />
      <Bloco className="mt-[10px] h-[36px] w-[280px]" />
      <Bloco className="h-[20px] w-[420px]" />
      <Bloco className="h-[64px] w-[420px]" />
      <Bloco className="h-[145px]" />
      <div className="flex gap-[14px]">
        <Bloco className="h-[220px] flex-1" />
        <Bloco className="h-[220px] flex-1" />
      </div>
      <div className="flex gap-[14px]">
        <Bloco className="h-[220px] flex-1" />
        <Bloco className="h-[220px] flex-1" />
      </div>
      <Bloco className="h-[140px]" />
    </div>
  )
}
