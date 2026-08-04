"use client"

// ---------------------------------------------------------------------------
// Host do anúncio na home do aluno.
//
// Ele NÃO decide elegibilidade. Quem decide é `resolveOnboarding()` no
// servidor (`lib/onboarding/resolve.ts`); aqui só chega um artefato já
// resolvido, ou `null`. Essa separação é o ponto: uma flag lida no bundle do
// cliente não se mata, e neste repo "deploy" é rebuild manual no EasyPanel —
// desligar precisa valer no PRÓXIMO request, não no próximo build.
//
// O host implementa a sequência aprovada no protótipo
// (`app/dev/preview-feature-review/page.tsx`, fases `n1 → n1-app` e
// `n2 → n2-aponta`): o modal explica, e um balão pousa em cima do controle
// real que ele acabou de descrever. É por isso que as âncoras
// `ritmo-percorrido` e `faixa-jornada` existem — sem esta segunda metade, o
// aluno lê "é aqui que elas ficam" e não vê onde.
// ---------------------------------------------------------------------------

import {
  markModalShownThisSession,
  recordOnboarding,
  requestTourOnBuilderMount,
} from "@/lib/onboarding/client"
import {
  ANCHORS,
  type AnchorName,
  FEATURE_KEYS,
  type PendingArtifact,
  anchorSelector,
} from "@/lib/onboarding/types"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AnnouncementModal } from "./announcement-modal"
import { TourBalloon } from "./tour-balloon"
import { useAnchorRect } from "./use-anchor-rect"

import { type AnnouncementCatalogEntry, catalogEntryFor } from "@/lib/onboarding/catalog"

/**
 * O balão de aterrissagem de cada novidade: o texto verbatim do protótipo
 * aprovado, a âncora que ele aponta e o que o botão final faz.
 */
const LANDINGS: Record<
  string,
  { anchor: AnchorName; titulo: string; corpo: string; rotuloFinal: string; href?: string }
> = {
  [FEATURE_KEYS.percorrido]: {
    anchor: ANCHORS.ritmoPercorrido,
    titulo: "É aqui que elas ficam",
    corpo: "Percorrido e Conclusão, uma embaixo da outra, na tabela Meu ritmo.",
    rotuloFinal: "Entendi",
  },
  [FEATURE_KEYS.jornada]: {
    anchor: ANCHORS.faixaJornada,
    titulo: "É esta faixa aqui",
    corpo:
      "Ela abre a tela onde você define os prazos. Pode entrar agora, ou deixar para depois.",
    rotuloFinal: "Abrir agora",
    href: "/jornada",
  },
}

export interface AnnouncementHostProps {
  /** Já resolvido no servidor. `null` = nada a mostrar, e este componente
   *  não renderiza nada (nem monta efeito, nem grava cookie). */
  artifact: PendingArtifact | null
  /** Modo demonstração: exibe tudo, grava NADA. É o que permite conferir a
   *  peça com a migration ainda não aplicada. */
  preview?: boolean
}

type Fase = "modal" | "balao" | "fim"

export function AnnouncementHost({ artifact, preview = false }: AnnouncementHostProps) {
  if (!artifact || artifact.kind !== "announcement") return null
  const entry = catalogEntryFor(artifact.featureKey)
  if (entry.kind !== "announcement") return null
  // `key` remonta o host quando o artefato muda (ex.: o Senhor trocando
  // `?onboarding=percorrido` por `?onboarding=jornada` sem recarregar).
  return (
    <AnnouncementFlow
      key={artifact.featureKey}
      artifact={artifact}
      entry={entry}
      preview={preview}
    />
  )
}

function AnnouncementFlow({
  artifact,
  entry,
  preview,
}: {
  artifact: PendingArtifact
  entry: AnnouncementCatalogEntry
  preview: boolean
}) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>("modal")
  const [i, setI] = useState(0)
  const landing = LANDINGS[artifact.featureKey]
  const total = entry.pages.length

  // Um modal por sessão (story §Fase 3). Marcado no MOUNT, não na dispensa:
  // duas abas abertas ao mesmo tempo não devem render dois modais diferentes.
  // Em demonstração não marca — conferir não pode consumir a sessão real.
  useEffect(() => {
    if (!preview) markModalShownThisSession()
  }, [preview])

  /**
   * Resolve o artefato no servidor. Acontece ao FIM DO MODAL, não ao fim do
   * balão: o balão é o ponteiro, o modal é a novidade. Se a âncora do balão
   * sumir num refactor futuro, o anúncio ainda assim se resolve — do
   * contrário ele voltaria toda sessão até a janela fechar, e a pessoa
   * aprenderia a fechá-lo no reflexo, que é o dano que a story §Fase 3
   * inteira tenta evitar.
   */
  const resolver = useCallback(
    (state: "seen" | "skipped") => {
      if (preview) return
      void recordOnboarding({ featureKey: artifact.featureKey, version: artifact.version, state })
      // A novidade 2 é quem ARMA o tour (story §Fase 2, "Como nasce"). Vale
      // também no "deixar para depois": a pessoa já sabe que a jornada
      // existe, e se ela abrir o construtor o guia tem de estar lá.
      if (artifact.featureKey === FEATURE_KEYS.jornada) {
        void recordOnboarding({ featureKey: FEATURE_KEYS.tour, state: "armed" })
      }
    },
    [preview, artifact.featureKey, artifact.version],
  )

  const irParaBalao = useCallback(() => {
    resolver("seen")
    // Sem âncora no DOM não há onde pousar o balão — nesse caso o passo é
    // pulado e a ação final dele acontece direto, em vez de deixar a pessoa
    // olhando para uma tela sem saída (`TourBalloon` devolve `null` quando o
    // retângulo é nulo).
    const existe = landing && document.querySelector(anchorSelector(landing.anchor)) !== null
    if (!existe) {
      setFase("fim")
      if (landing?.href) router.push(landing.href)
      return
    }
    setFase("balao")
  }, [resolver, landing, router])

  const pular = useCallback(() => {
    resolver("skipped")
    setFase("fim")
  }, [resolver])

  const concluirBalao = useCallback(() => {
    setFase("fim")
    if (!landing?.href) return
    // Entrando na jornada logo depois da novidade 2, o guia do construtor
    // deve abrir junto — é a mesma sequência do protótipo aprovado
    // (`abrirJornada` leva ao construtor JÁ com o tour rodando).
    requestTourOnBuilderMount()
    router.push(landing.href)
  }, [landing, router])

  if (fase === "fim") return null

  if (fase === "balao" && landing) {
    return (
      <LandingBalloon
        anchor={landing.anchor}
        titulo={landing.titulo}
        corpo={landing.corpo}
        rotuloFinal={landing.rotuloFinal}
        onVoltar={() => {
          setI(total - 1)
          setFase("modal")
        }}
        onAvancar={concluirBalao}
        onSair={() => setFase("fim")}
      />
    )
  }

  return (
    <AnnouncementModal
      pagina={entry.pages[i]}
      passo={i + 1}
      total={total}
      selo={entry.selo}
      rotuloPular={entry.rotuloPular}
      onVoltar={i > 0 ? () => setI(i - 1) : undefined}
      onAvancar={() => (i === total - 1 ? irParaBalao() : setI(i + 1))}
      onPular={pular}
    />
  )
}

/**
 * O balão de aterrissagem, ancorado no controle real. É um passo único (o
 * "passo 1 de 1" do protótipo), então não usa o `TourHost` — a regra dura de
 * resolução dele (story §2.2) protege o TOUR, que precisa das 6 âncoras
 * simultâneas; aqui um ponteiro solitário não tem o que proteger.
 */
function LandingBalloon({
  anchor,
  titulo,
  corpo,
  rotuloFinal,
  onVoltar,
  onAvancar,
  onSair,
}: {
  anchor: AnchorName
  titulo: string
  corpo: string
  rotuloFinal: string
  onVoltar: () => void
  onAvancar: () => void
  onSair: () => void
}) {
  const rect = useAnchorRect(anchor)
  return (
    <TourBalloon
      titulo={titulo}
      corpo={corpo}
      passo={1}
      total={1}
      anchorRect={rect}
      rotuloFinal={rotuloFinal}
      onVoltar={onVoltar}
      onAvancar={onAvancar}
      onSair={onSair}
    />
  )
}
