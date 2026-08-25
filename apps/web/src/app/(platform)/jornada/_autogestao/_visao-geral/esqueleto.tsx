// ---------------------------------------------------------------------------
// O que "Visão Geral" (autogestão) mostra ENQUANTO o servidor lê os dados.
// ---------------------------------------------------------------------------
// Mesma doutrina de `analytics/_visao-geral/esqueleto.tsx` (gestor) e de
// `_mapa/esqueleto.tsx` (irmã desta run): nunca piscar zeros. Um "No ritmo" ou
// um "50%" que dura 400ms é indistinguível de um "50%" que é verdade — a
// silhueta cinza é honesta, o número provisório não é. As alturas aproximam a
// grade real (§8 em 4 tiles + síntese, duas colunas de 2 cards cada, §14 em
// largura total) para o conteúdo não saltar quando os dados chegarem.
// ---------------------------------------------------------------------------

function Bloco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-black/[0.055] ${className}`} />
}

export function EsqueletoVisaoGeralAutogestao() {
  return (
    <div
      className="flex flex-col gap-[14px]"
      aria-busy="true"
      aria-label="Carregando minha visão geral"
    >
      {/* §8 — 4 tiles + §9 mensagem-síntese, dentro de um card só. */}
      <Bloco className="h-[220px] w-full" />

      {/* §10/§12 e §11/§13, em duas colunas empilhadas. */}
      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
        <div className="flex flex-col gap-[14px]">
          <Bloco className="h-[150px] w-full" />
          <Bloco className="h-[190px] w-full" />
        </div>
        <div className="flex flex-col gap-[14px]">
          <Bloco className="h-[170px] w-full" />
          <Bloco className="h-[170px] w-full" />
        </div>
      </div>

      {/* §14 — Sinais do meu momento, largura total. */}
      <Bloco className="h-[110px] w-full" />
    </div>
  )
}
