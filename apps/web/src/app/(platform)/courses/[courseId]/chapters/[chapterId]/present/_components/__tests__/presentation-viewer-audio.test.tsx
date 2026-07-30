import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PresentationViewer } from "../presentation-viewer"

/**
 * INB-031, sintoma 1 — "clicar em play não avança o tempo".
 *
 * Reprodução: no tenant demo Vértice Indústria, `chapters.slide_audio_url` e
 * `chapters.audio_url` guardam a MESMA URL de mp3. Isso liga as abas
 * Podcast/Audiobook (`hasBothAudios`) sem que a URL ativa mude entre elas.
 * Como o `<audio>` tem `key={audioMode}`, trocar de aba REMONTA o elemento,
 * mas o efeito que registra os listeners dependia só de `activeAudioUrl` —
 * que não mudou. Os listeners ficavam presos ao nó desmontado e o `timeupdate`
 * do elemento novo nunca chegava ao state: tempo congelado em 0:00.
 */

vi.mock("next/image", () => ({
  default: ({ alt, ...rest }: { alt?: string }) => <img {...rest} alt={alt ?? ""} />,
}))
vi.mock("next/link", () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}))
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/layout/view-as-student-toggle", () => ({
  ViewAsStudentToggle: () => null,
}))
vi.mock("../../../_components/chapter-complete-button", () => ({
  ChapterCompleteButton: () => <button type="button">Módulo Concluído</button>,
}))
vi.mock("../../../_components/session-button", () => ({
  SessionButton: () => null,
}))
vi.mock("../../../_components/reflection-prompt", () => ({
  ReflectionPrompt: ({ question }: { question: string }) => (
    <div data-testid="reflection">{question}</div>
  ),
}))

/** Mesma URL nos dois campos — o cenário real do tenant demo. */
const SAME_URL = "https://example.test/podcast.mp3"

const SLIDES = [
  {
    id: "s1",
    order: 0,
    image_url: null,
    text_content: "Slide um",
    audio_start_ms: null,
    audio_end_ms: null,
  },
  {
    id: "s2",
    order: 1,
    image_url: null,
    text_content: "Slide dois",
    audio_start_ms: null,
    audio_end_ms: null,
  },
]

function renderViewer() {
  return render(
    <PresentationViewer
      courseTitle="Análise e Solução de Problemas"
      chapterTitle="Padronização"
      slides={SLIDES}
      audioUrl={SAME_URL}
      podcastUrl={SAME_URL}
      narrationUrl={SAME_URL}
      chapterId="ch1"
      hasContent={false}
      backUrl="/courses/c1"
      tenantId="t1"
      courseId="c1"
    />,
  )
}

/** Simula o browser emitindo `timeupdate` com o tempo corrente do elemento. */
function emitTimeUpdate(audio: HTMLAudioElement, seconds: number) {
  Object.defineProperty(audio, "currentTime", {
    value: seconds,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(audio, "duration", { value: 24, configurable: true, writable: true })
  fireEvent(audio, new Event("timeupdate"))
}

describe("PresentationViewer — barra de áudio (INB-031)", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
  })

  it("acompanha o tempo no primeiro áudio montado", () => {
    const { container } = renderViewer()
    const audio = container.querySelector("audio") as HTMLAudioElement
    expect(audio).toBeTruthy()

    emitTimeUpdate(audio, 5)

    expect(screen.getAllByText("0:05").length).toBeGreaterThan(0)
  })

  it("continua acompanhando o tempo depois de trocar Podcast → Audiobook com a MESMA url", () => {
    const { container } = renderViewer()

    // Troca de aba: o <audio> é remontado por key={audioMode}, mas activeAudioUrl não muda.
    fireEvent.click(screen.getAllByText("Audiobook")[0])

    const audio = container.querySelector("audio") as HTMLAudioElement
    expect(audio).toBeTruthy()

    emitTimeUpdate(audio, 7)

    // Com o bug, o listener ficou no elemento antigo e o tempo congela em 0:00.
    expect(screen.getAllByText("0:07").length).toBeGreaterThan(0)
  })
})
