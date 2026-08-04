"use client"

// ---------------------------------------------------------------------------
// O tour do construtor, montado DENTRO do `JourneyBuilder`.
//
// O gatilho é o MOUNT DO CONSTRUTOR, nunca a rota `/jornada`, e a story §0.2
// tem a prova medida: a faixa da home aponta para `/jornada` sem `?curso=`, e
// a página devolve `initialView="hub"` sempre que o param falta — inclusive
// para quem tem uma matrícula só, por decisão registrada do Hugo (JRN-D/D11).
// Ou seja, 100% das entradas pela faixa caem no hub, onde NENHUM dos 6
// controles que o tour ensina existe. Amarrar o tour à rota seria amarrá-lo a
// uma tela que não tem o que ele ensina.
//
// Este componente também carrega a afordância da story §2.3 ("Ver o guia do
// construtor"), pelo mesmo motivo de vizinhança: quem rearma o guia está no
// construtor, e o guia abre ali mesmo, sem recarregar a página.
// ---------------------------------------------------------------------------

import { consumeTourRequest, recordOnboarding } from "@/lib/onboarding/client"
import { catalogEntryFor } from "@/lib/onboarding/catalog"
import { FEATURE_KEYS, type PendingArtifact } from "@/lib/onboarding/types"
import { HelpCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { TourHost } from "./tour-host"

export interface JourneyTourMountProps {
  /** Resolvido no servidor (`resolveOnboarding` com `surface: "builder"`).
   *  `null` é o caso comum — quem já concluiu o guia não o vê de novo. */
  artifact?: PendingArtifact | null
  /** Modo demonstração: exibe, grava NADA. */
  preview?: boolean
}

const entry = catalogEntryFor(FEATURE_KEYS.tour)
const TOUR_STEPS = entry.kind === "product_onboarding" ? entry.steps : []

export function JourneyTourMount({ artifact, preview = false }: JourneyTourMountProps) {
  const pendente = artifact?.kind === "product_onboarding"
  const [ativo, setAtivo] = useState(pendente)
  const [passoInicial, setPassoInicial] = useState(artifact?.lastStep ?? 0)

  // Pedido vindo da OUTRA tela (o link do `JourneyDashboard`, ou o "Abrir
  // agora" da novidade 2). Só no cliente: `sessionStorage` não existe no SSR,
  // e ler no primeiro efeito evita divergência de hidratação.
  useEffect(() => {
    if (consumeTourRequest()) {
      setPassoInicial(0)
      setAtivo(true)
    }
  }, [])

  const gravar = useCallback(
    (input: Parameters<typeof recordOnboarding>[0]) => {
      if (preview) return
      void recordOnboarding(input)
    },
    [preview],
  )

  const verGuia = useCallback(() => {
    // Rearma no servidor E abre agora. `rearm: true` é a única exceção à
    // invariante "nunca regride de terminal" (ver `api/onboarding/route.ts`):
    // aqui a pessoa PEDIU para rever, então rearmar é a intenção dela.
    gravar({ featureKey: FEATURE_KEYS.tour, state: "armed", rearm: true })
    setPassoInicial(0)
    setAtivo(true)
  }, [gravar])

  return (
    <>
      <button
        type="button"
        onClick={verGuia}
        data-testid="onboarding-ver-guia"
        className="inline-flex items-center gap-1.5 text-text-muted text-xs transition-colors hover:text-cerrado-500"
      >
        <HelpCircle size={13} aria-hidden="true" />
        Ver o guia do construtor
      </button>
      {ativo && TOUR_STEPS.length > 0 && (
        <TourHost
          // Remonta a cada reabertura para o `initialStep` novo valer (o
          // `useState` do host só lê o inicial no primeiro mount).
          key={`tour-${passoInicial}-${ativo}`}
          steps={TOUR_STEPS}
          initialStep={passoInicial}
          onStepChange={(step) =>
            gravar({ featureKey: FEATURE_KEYS.tour, lastStep: step })
          }
          onResolve={(lastStep) => {
            gravar({ featureKey: FEATURE_KEYS.tour, state: "completed", lastStep })
            setAtivo(false)
          }}
          // Sair antes do fim NÃO resolve: a linha continua `armed` e o guia
          // volta no próximo mount do construtor (story §2.2).
          onExit={() => setAtivo(false)}
        />
      )}
    </>
  )
}
