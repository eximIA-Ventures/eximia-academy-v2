"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — Shell client que roteia entre o
// CONSTRUTOR (Trilha B), o hub "Minhas jornadas" e o dashboard, a partir dos
// dados que o page.tsx (SSR) já computou.
// ---------------------------------------------------------------------------
// §Fronteira B — INTEGRADO (não mock): monta o `JourneyBuilder` real da Trilha
// B (`../builder/journey-builder`, interface `JourneyBuilderProps` estável +
// testada) e liga o `onConfirm` às server actions da Trilha A
// (`saveJourneyPlan`/`updateJourneyPlan`) com o enrollmentId-alvo. `router.refresh()`
// re-busca o SSR após confirmar. O diff-review dedicado (B: `_components/review`)
// entra na integração final; aqui "Revisar jornada" reusa o builder semeado com
// as durações persistidas (edição funcional que salva via updateJourneyPlan).
// ---------------------------------------------------------------------------

import type { JourneyCourseContext, JourneyPreferences } from "@/lib/journey/types"
import { requestTourOnBuilderMount } from "@/lib/onboarding/client"
import type { PendingArtifact } from "@/lib/onboarding/types"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { saveJourneyPlan, updateJourneyPlan } from "../../actions"
import { type BuilderSubmit, JourneyBuilder } from "../builder/journey-builder"
import { type CourseOption, CourseSwitcher } from "../course-switcher"
import type { DashboardModel } from "../dashboard/dashboard-model"
import { JourneyDashboard, type JourneyDashboardHrefs } from "../dashboard/journey-dashboard"
import type { HubCard } from "./hub-model"
import { JourneyHub } from "./journey-hub"

export interface JourneyDashboardPayload {
  model: DashboardModel
  hrefs: JourneyDashboardHrefs
}

type View = "hub" | "dashboard" | "builder"
type BuilderMode = "create" | "revise"

export function JourneyShell({
  initialView,
  hubCards,
  courseOptions,
  selectedCourseId,
  dashboard,
  builderContext,
  builderEnrollmentId,
  reviseInitial,
  tour = null,
  tourPreview = false,
}: {
  /** "builder"/"dashboard" quando um curso está selecionado; "hub" no topo. */
  initialView: View
  hubCards: HubCard[]
  /** JRN-D — cursos do aluno p/ o seletor (só aparece com 2+). */
  courseOptions: CourseOption[]
  /** JRN-D — curso ancorado nesta renderização (null no hub). */
  selectedCourseId: string | null
  /** payload da jornada ativa; null quando não há jornada persistida. */
  dashboard: JourneyDashboardPayload | null
  /** contexto do curso-alvo do construtor (criar ou revisar). */
  builderContext: JourneyCourseContext | null
  /** matrícula-alvo do save/update. */
  builderEnrollmentId: string | null
  /** durações/preferências da jornada ativa, para o modo revisar. */
  reviseInitial: { durations: number[]; preferences: JourneyPreferences } | null
  /** Guia do construtor pendente, já resolvido no SSR. Só trafega por aqui —
   *  quem o dispara é o mount do `JourneyBuilder`, não esta rota. */
  tour?: PendingArtifact | null
  /** Modo demonstração do guia (`?onboarding=tour`): exibe, não grava. */
  tourPreview?: boolean
}) {
  const router = useRouter()

  // JRN-D (fix Hugo 2026-07-25, ao vivo: "clicar no card do hub não faz nada")
  // -------------------------------------------------------------------------
  // `view` NÃO pode ser `useState(initialView)`. O card do hub e o CourseSwitcher
  // navegam com `router.push('/jornada?curso=X')`, que troca só o search param da
  // MESMA rota: o App Router preserva a instância montada deste shell, e o
  // initializer do `useState` só roda no 1º mount — o prop `initialView` novo
  // (recalculado pelo page.tsx) era ignorado. Resultado: a URL mudava e a tela
  // não. Aqui a FONTE DA VERDADE é o servidor (`initialView`); o estado local é
  // só um override ANCORADO no recorte servido (`anchor`), então qualquer
  // reancoragem do SSR o descarta sozinha, sem `useEffect` de sincronização.
  //
  // Alternativa avaliada e descartada: `key={selectedCourseId}` no <JourneyShell>
  // dentro do page.tsx. Remontaria o shell inteiro e mataria as transições
  // locais legítimas que acontecem na MESMA URL (voltar ao hub sem sair da rota,
  // "Revisar jornada" do dashboard). O remount fica só onde é necessário: nos
  // filhos por-curso, abaixo.
  const anchor = `${selectedCourseId ?? "hub"}|${initialView}`
  const [override, setOverride] = useState<{
    anchor: string
    view: View
    mode: BuilderMode
  } | null>(null)
  const local = override?.anchor === anchor ? override : null
  const view: View = local?.view ?? initialView
  // "create" quando abre sem jornada; "revise" quando vem do dashboard.
  const mode: BuilderMode = local?.mode ?? "create"
  /** transição puramente local (mesma URL, mesmo recorte servido). */
  const goToView = (next: View, nextMode: BuilderMode = "create") =>
    setOverride({ anchor, view: next, mode: nextMode })

  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(submit: BuilderSubmit, builderMode: BuilderMode) {
    if (!builderEnrollmentId) {
      setError("Matrícula-alvo indisponível.")
      return
    }
    setConfirming(true)
    setError(null)
    const input = { enrollmentId: builderEnrollmentId, ...submit }
    const res =
      builderMode === "revise" ? await updateJourneyPlan(input) : await saveJourneyPlan(input)
    setConfirming(false)
    if (res.ok) {
      // Pós-confirmação a decisão do servidor MUDA para este curso (passa a
      // existir jornada ativa → initialView vira "dashboard"), logo um override
      // local "hub" seria descartado pela reancoragem do refresh. Voltar ao hub
      // aqui é navegação de verdade: o hub é a URL sem `?curso=`.
      router.refresh()
      router.push("/jornada")
    } else {
      setError(res.error)
    }
  }

  // JRN-D — troca de curso: navega para /jornada?curso=, o SSR reancorra tudo.
  const goToCourse = (courseId: string) => {
    if (courseId === selectedCourseId) {
      // Curso JÁ ancorado na URL (ex.: voltei ao hub pelo botão local, na mesma
      // URL, e cliquei no MESMO card): `push` não mudaria prop algum e a tela
      // ficaria parada. Basta soltar o override e voltar a seguir o servidor.
      setOverride(null)
      return
    }
    router.push(`/jornada?curso=${encodeURIComponent(courseId)}`)
  }

  if (view === "builder") {
    if (!builderContext) {
      return <EmptyBuilder onBack={() => goToView("hub")} />
    }
    const builderMode: BuilderMode = mode === "revise" && reviseInitial ? "revise" : "create"
    return (
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6">
        {/* JRN-D (Hugo 2026-07-24, ao vivo) — o construtor SEMPRE tem volta. Com
            2+ cursos elegíveis → "Minhas jornadas" (hub); com 1 só curso (sem hub
            a mostrar) → "Meu ritmo" (a home /dashboard). Antes, sem `dashboard`, o
            create-flow caía num <span/> vazio e o aluno ficava preso. */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {courseOptions.length > 1 ? (
            <BackRow label="Minhas jornadas" onClick={() => goToView("hub")} />
          ) : (
            <BackRow label="Meu ritmo" onClick={() => router.push("/dashboard")} />
          )}
          <CourseSwitcher options={courseOptions} selectedCourseId={selectedCourseId} />
        </div>
        {error && (
          <p className="mb-3 rounded-lg border border-semantic-error/30 bg-semantic-error/10 px-3 py-2 text-sm text-semantic-error">
            {error}
          </p>
        )}
        {/* JRN-D (fix 2026-07-25) — `key` por curso: o construtor guarda as
            durações em estado local semeado pelos props (`useState` de
            `initialDurations`/`context`). Sem remontar, trocar de curso pelo
            CourseSwitcher manteria as durações do curso ANTERIOR (e as salvaria
            na matrícula errada). O shell em si não pode ser remontado (perderia
            as transições locais), então o remount é aqui, cirúrgico. */}
        <JourneyBuilder
          key={selectedCourseId ?? "sem-curso"}
          context={builderContext}
          initialDurations={builderMode === "revise" ? reviseInitial?.durations : undefined}
          initialPreferences={builderMode === "revise" ? reviseInitial?.preferences : undefined}
          confirming={confirming}
          onConfirm={(submit) => handleConfirm(submit, builderMode)}
          tour={tour}
          tourPreview={tourPreview}
        />
      </div>
    )
  }

  if (view === "dashboard" && dashboard) {
    return (
      <>
        {/* JRN-D (correção Hugo 2026-07-24) — seletor SEMPRE visível no dashboard
            com 1+ curso (antes `> 1` escondia p/ o aluno de 1 matrícula). A
            visibilidade real é do próprio CourseSwitcher (some só com 0 cursos);
            este guard evita a moldura/padding vazia quando não há curso algum. */}
        {courseOptions.length > 0 && (
          <div className="mx-auto flex max-w-5xl justify-end px-4 pt-6 sm:px-6">
            <CourseSwitcher options={courseOptions} selectedCourseId={selectedCourseId} />
          </div>
        )}
        {/* `key` por curso pelo mesmo motivo do construtor: o count-up do
            dashboard (`useCountUp`) roda 1x por MONTAGEM e ignora `target` novo,
            então sem remontar a troca de curso exibiria os números do anterior. */}
        <JourneyDashboard
          key={selectedCourseId ?? "sem-curso"}
          model={dashboard.model}
          hrefs={dashboard.hrefs}
          onBackToHub={() => goToView("hub")}
          onRevisar={() => goToView("builder", "revise")}
          // Afordância da story §2.3. Vai ao construtor pela MESMA transição
          // local do "Revisar jornada" — e, como transição local não re-roda o
          // SSR, o pedido de abrir o guia viaja por `sessionStorage`, não por
          // prop (ver `lib/onboarding/client.ts`).
          onVerGuia={() => {
            requestTourOnBuilderMount()
            goToView("builder", "revise")
          }}
        />
      </>
    )
  }

  // Hub: cada card navega para o SEU curso (ativa → dashboard, sem jornada →
  // construtor). O roteador SSR decide o destino a partir do ?curso=. O back
  // "Meu ritmo" leva à home (/dashboard) — sem ele o aluno fica preso no topo.
  return (
    <JourneyHub cards={hubCards} onOpen={goToCourse} onBack={() => router.push("/dashboard")} />
  )
}

function BackRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-cerrado-500"
    >
      ‹ {label}
    </button>
  )
}

function EmptyBuilder({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:px-6">
      <div className="rounded-2xl border border-dashed border-border-medium bg-bg-card p-8 text-center shadow-card">
        <h2 className="font-display text-lg font-bold text-text-primary">Jornada indisponível</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
          Não foi possível montar o contexto do curso agora. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border-medium px-5 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-cerrado-500/40 hover:bg-cerrado-500/10"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}
