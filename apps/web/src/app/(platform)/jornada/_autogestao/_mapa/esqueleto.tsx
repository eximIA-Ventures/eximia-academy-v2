// ---------------------------------------------------------------------------
// O que "Meu Mapa da Jornada" mostra ENQUANTO o servidor lê os dados.
// ---------------------------------------------------------------------------
// Mesma doutrina de `analytics/_visao-geral/esqueleto.tsx`: nunca piscar
// zeros. Um "0%" ou uma trilha toda cinza que dura 400ms é indistinguível de
// um "0%" que é verdade — a silhueta cinza é honesta, o número provisório
// não é. As alturas aproximam a grade real (trilha alta e larga, duas colunas
// na segunda linha, tabela do histórico) para o conteúdo não saltar quando
// os dados chegarem.
// ---------------------------------------------------------------------------

function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-black/[0.055] ${className}`} />
}

export function EsqueletoMapaAutogestao() {
  return (
    <div
      className="flex flex-col gap-[16px]"
      aria-busy="true"
      aria-label="Carregando meu mapa da jornada"
    >
      <Bloco className="h-[150px] w-full" />
      <div className="flex flex-col gap-[16px] lg:flex-row">
        <Bloco className="h-[210px] flex-1" />
        <Bloco className="h-[210px] w-full lg:w-[320px] lg:shrink-0" />
      </div>
      <Bloco className="h-[90px] w-full" />
      <Bloco className="h-[180px] w-full" />
      <Bloco className="h-[52px] w-full" />
    </div>
  )
}
