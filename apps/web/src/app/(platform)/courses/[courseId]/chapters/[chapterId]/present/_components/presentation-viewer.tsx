"use client"

import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Maximize2, MessageSquare, Minimize2, Monitor, Pause, Play, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import Markdown from "react-markdown"
import { useCallback, useEffect, useRef, useState } from "react"
import { ViewAsStudentToggle } from "@/components/layout/view-as-student-toggle"
import { SessionButton } from "../../_components/session-button"

function getVideoEmbed(url: string): { type: "iframe" | "native"; src: string } {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return { type: "iframe", src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1` }
  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) return { type: "iframe", src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` }
  // Direct video URL (.mp4, .webm, etc.)
  return { type: "native", src: url }
}

function VideoPlayer({ url }: { url: string }) {
  const embed = getVideoEmbed(url)
  if (embed.type === "iframe") {
    return (
      <iframe
        src={embed.src}
        className="w-full h-full rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video src={embed.src} controls autoPlay className="w-full h-full rounded-lg" />
  )
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}
import { ReflectionPrompt } from "../../_components/reflection-prompt"

interface Slide {
  id: string
  order: number
  image_url: string | null
  text_content: string | null
  audio_start_ms: number | null
  audio_end_ms: number | null
}

interface InteractionProps {
  type: "socratic" | "quiz"
  courseId: string
  chapterId: string
  // Socratic
  hasActiveQuestions?: boolean
  activeQuestionCount?: number
  activeSession?: { id: string; status: string } | null
  lastCompletedSession?: { id: string; status: string } | null
  // Quiz
  questions?: Array<{ id: string; text: string; question_type: string; options: string[] | null; correct_answer: string | null; explanation: string | null; skill: string | null }>
}

interface SavedReflection {
  slide_id: string
  response: string
  ai_response: string | null
}

interface PresentationViewerProps {
  courseTitle: string
  chapterTitle: string
  slides: Slide[]
  audioUrl: string | null
  podcastUrl?: string | null
  narrationUrl?: string | null
  chapterId?: string
  hasContent?: boolean
  backUrl: string
  videoUrl?: string | null
  interaction?: InteractionProps
  tenantId?: string
  reflections?: SavedReflection[]
  aiReflectionEnabled?: boolean
  userRole?: string
  viewAsStudent?: boolean
  courseId?: string
  nextChapter?: { id: string; title: string } | null
}

/** Recursively extract plain text from React children */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (!node) return ""
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (typeof node === "object" && "props" in node) return extractText((node as any).props.children)
  return ""
}

/** Check if a blockquote text looks like a reflection prompt */
function isReflectionBlock(text: string): boolean {
  // "Reflexão" heading
  if (/reflex[ãa]o/i.test(text)) return true
  // "Agora reflita", "Agora pense", "reflita por um momento"
  if (/agora\s+(refli[tj]a|pense|imagine|considere)/i.test(text)) return true
  if (/refli[tj]a\s+por\s+um\s+momento/i.test(text)) return true
  // Reflection emojis (both magnifying glasses + others)
  if (/[🔍🔎💡🤔🪞💬🧠✨🎯📝]/u.test(text) && /\?/.test(text)) return true
  // Question with reflection keywords
  if (/\?/.test(text) && /pense|imagine|considere|momento/i.test(text)) return true
  return false
}

export function PresentationViewer({ courseTitle, chapterTitle, slides, audioUrl, podcastUrl, narrationUrl, chapterId, hasContent, backUrl, videoUrl, interaction, tenantId, reflections = [], aiReflectionEnabled, userRole, viewAsStudent, courseId, nextChapter }: PresentationViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showNotes, setShowNotes] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [audioMode, setAudioMode] = useState<"podcast" | "narration">(podcastUrl ? "podcast" : "narration")
  const [generatingNarration, setGeneratingNarration] = useState(false)
  const [localNarrationUrl, setLocalNarrationUrl] = useState(narrationUrl)

  const activeAudioUrl = audioMode === "podcast" ? (podcastUrl ?? localNarrationUrl ?? audioUrl) : (localNarrationUrl ?? podcastUrl ?? audioUrl)
  const hasBothAudios = !!(podcastUrl && localNarrationUrl)
  const canGenerateNarration = !localNarrationUrl && hasContent && chapterId

  async function generateNarration() {
    if (!chapterId) return
    setGeneratingNarration(true)
    try {
      const res = await fetch(`/api/chapters/${chapterId}/generate-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "narration" }),
      })
      if (res.ok) {
        const data = await res.json()
        setLocalNarrationUrl(data.audioUrl)
        setAudioMode("narration")
      }
    } finally {
      setGeneratingNarration(false)
    }
  }
  const [showVideo, setShowVideo] = useState(false)

  // Default notes off on mobile — slide visibility is priority
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setShowNotes(false)
    }
  }, [])

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const userNavigatedRef = useRef(false)

  const slide = slides[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < slides.length - 1

  const goToSlide = useCallback((index: number) => {
    userNavigatedRef.current = true
    setCurrentIndex(index)
    const s = slides[index]
    if (s?.audio_start_ms != null && audioRef.current) {
      audioRef.current.currentTime = s.audio_start_ms / 1000
      setCurrentTime(s.audio_start_ms)
    }
  }, [slides])

  const goNext = useCallback(() => {
    if (hasNext) goToSlide(currentIndex + 1)
  }, [hasNext, currentIndex, goToSlide])

  const goPrev = useCallback(() => {
    if (hasPrev) goToSlide(currentIndex - 1)
  }, [hasPrev, currentIndex, goToSlide])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      setCurrentTime(audio.currentTime * 1000)
      // Continuously update duration (streaming audio may report partial duration initially)
      if (audio.duration && !Number.isNaN(audio.duration) && Number.isFinite(audio.duration)) {
        setAudioDuration(audio.duration * 1000)
      }
    }
    const syncDuration = () => {
      if (audio.duration && !Number.isNaN(audio.duration) && Number.isFinite(audio.duration)) setAudioDuration(audio.duration * 1000)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnd = () => setIsPlaying(false)
    // Attach listeners
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("durationchange", syncDuration)
    audio.addEventListener("loadedmetadata", syncDuration)
    audio.addEventListener("canplay", syncDuration)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnd)
    // If already loaded (cached), sync now
    syncDuration()
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("durationchange", syncDuration)
      audio.removeEventListener("loadedmetadata", syncDuration)
      audio.removeEventListener("canplay", syncDuration)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnd)
    }
  }, [activeAudioUrl])

  // Auto-advance slides based on audio timestamps
  useEffect(() => {
    if (userNavigatedRef.current) { userNavigatedRef.current = false; return }
    if (!activeAudioUrl || !isPlaying) return
    const hasTimestamps = slides.some((s) => s.audio_start_ms != null && s.audio_end_ms != null)
    if (!hasTimestamps) return
    for (let i = slides.length - 1; i >= 0; i--) {
      const s = slides[i]
      if (s.audio_start_ms != null && s.audio_end_ms != null && currentTime >= s.audio_start_ms && currentTime < s.audio_end_ms) {
        if (i !== currentIndex) setCurrentIndex(i)
        break
      }
    }
  }, [currentTime, slides, activeAudioUrl, isPlaying, currentIndex])

  // Audio controls
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play()
    else audio.pause()
  }, [])

  const seekTo = useCallback((timeMs: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = timeMs / 1000
    setCurrentTime(timeMs)
  }, [])

  const changePlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = rate
    setPlaybackRate(rate)
  }, [])

  // Keyboard navigation — ignore when typing in inputs/textareas
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable
      if (isTyping) return

      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); goNext() }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goPrev() }
      if (e.key === "n" || e.key === "N") setShowNotes((v) => !v)
      if (e.key === "Escape") setIsFullscreen(false)
      if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
          setIsFullscreen(true)
        } else {
          document.exitFullscreen()
          setIsFullscreen(false)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev])

  // Fullscreen change listener
  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar — hidden in fullscreen */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-4 py-2 bg-black/80 ">
          <div className="flex items-center gap-3">
            <Link href={backUrl} className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors">
              <ChevronLeft size={14} />
              Sair
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs text-white/40 truncate max-w-[200px]">{courseTitle}</span>
            <span className="text-xs text-white/40">·</span>
            <span className="text-xs text-white truncate max-w-[200px]">{chapterTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Audio player with progress bar */}
            {activeAudioUrl && (
              <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors shrink-0"
                >
                  {isPlaying ? <Pause size={11} fill="white" /> : <Play size={11} fill="white" className="ml-0.5" />}
                </button>
                <span className="text-[10px] text-white/40 tabular-nums shrink-0">
                  {formatMs(currentTime)}
                </span>
                <div
                  className="relative h-1.5 w-28 rounded-full bg-white/10 cursor-pointer group"
                  onMouseDown={(e) => {
                    if (!audioDuration) return
                    const bar = e.currentTarget
                    const seek = (ev: MouseEvent) => {
                      const rect = bar.getBoundingClientRect()
                      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
                      seekTo(pct * audioDuration)
                    }
                    seek(e.nativeEvent)
                    const onMove = (ev: MouseEvent) => seek(ev)
                    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
                    document.addEventListener("mousemove", onMove)
                    document.addEventListener("mouseup", onUp)
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-cerrado-600 transition-[width] duration-100"
                    style={{ width: audioDuration ? `${(currentTime / audioDuration) * 100}%` : "0%" }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: audioDuration ? `calc(${(currentTime / audioDuration) * 100}% - 6px)` : "0" }}
                  />
                </div>
                <span className="text-[10px] text-white/40 tabular-nums shrink-0">
                  {formatMs(audioDuration)}
                </span>
                <button
                  type="button"
                  onClick={() => changePlaybackRate(playbackRate >= 2 ? 0.5 : playbackRate + 0.25)}
                  className="text-[10px] text-white/50 hover:text-white tabular-nums transition-colors shrink-0 min-w-[24px]"
                >
                  {playbackRate}x
                </button>
              </div>
            )}
            {/* Audio mode toggle: Podcast vs Leitura */}
            {(hasBothAudios || canGenerateNarration) && (
              <>
                <div className="h-4 w-px bg-white/10" />
                {hasBothAudios ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = audioMode === "podcast" ? "narration" : "podcast"
                      setAudioMode(next)
                      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
                    }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-white/10 text-white hover:bg-white/15 transition-colors"
                  >
                    {audioMode === "podcast" ? "🎙 Podcast" : "📖 Leitura"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={generateNarration}
                    disabled={generatingNarration}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {generatingNarration ? "Gerando..." : "📖 Gerar Leitura"}
                  </button>
                )}
              </>
            )}
            {/* Video button */}
            {videoUrl && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => setShowVideo((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${showVideo ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
                >
                  <Monitor size={13} />
                  Vídeo
                </button>
              </>
            )}
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs text-white/40 tabular-nums">
              {currentIndex + 1} / {slides.length}
            </span>
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className={`text-xs px-2 py-1 rounded transition-colors ${showNotes ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
            >
              Notas
            </button>
            <button type="button" onClick={toggleFullscreen} className="text-white/50 hover:text-white transition-colors">
              <Maximize2 size={16} />
            </button>
            {/* View as student toggle — instructors only */}
            {userRole === "instructor" && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <ViewAsStudentToggle active={viewAsStudent ?? false} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Slide + thumbnails column */}
        <div className="flex flex-col min-h-0" style={{ width: !isFullscreen && showNotes ? "calc(100% - 380px)" : "100%" }}>
        <div className={`flex-1 flex items-center justify-center relative ${isFullscreen ? "p-0" : "p-4"}`}>
          {/* Prev/Next click zones */}
          <button
            type="button"
            onClick={goPrev}
            disabled={!hasPrev}
            className="absolute left-0 top-0 bottom-0 w-1/5 z-10 cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-start pl-4 transition-opacity disabled:cursor-default"
          >
            {hasPrev && <ArrowLeft size={32} className="text-white/50" />}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!hasNext}
            className="absolute right-0 top-0 bottom-0 w-1/5 z-10 cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-end pr-4 transition-opacity disabled:cursor-default"
          >
            {hasNext && <ArrowRight size={32} className="text-white/50" />}
          </button>

          {slide?.image_url && (
            <div className={`relative w-full h-full ${isFullscreen ? "" : "max-w-[1200px]"}`}>
              <Image
                src={slide.image_url}
                alt={`Slide ${currentIndex + 1}`}
                fill
                className="object-contain"
                priority
                sizes="100vw"
              />
            </div>
          )}


          {/* Next chapter — bottom center, only on last slide */}
          {currentIndex === slides.length - 1 && !isFullscreen && nextChapter && courseId && (
            <Link
              href={`/courses/${courseId}/chapters/${nextChapter.id}`}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] pl-4 pr-3 py-2 hover:bg-white/[0.14] transition-all group"
            >
              <span className="text-[11px] text-white/50">Próximo módulo</span>
              <span className="text-[11px] font-medium text-white">{nextChapter.title}</span>
              <ChevronRight size={14} className="text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>
          )}
          {currentIndex === slides.length - 1 && !isFullscreen && !nextChapter && (
            <Link
              href={backUrl}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.1] px-4 py-2 hover:bg-white/[0.14] transition-all text-[11px] text-white/50"
            >
              Voltar ao Curso
            </Link>
          )}

          {/* Fullscreen exit hint — shows briefly on hover at top */}
          {isFullscreen && (
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-b from-black/60 to-transparent">
              <span className="text-xs text-white/50 tabular-nums">
                {currentIndex + 1} / {slides.length}
              </span>
              <button type="button" onClick={toggleFullscreen} className="text-white/50 hover:text-white transition-colors">
                <Minimize2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Thumbnails — centered, inside slide column */}
        {!isFullscreen && (
          <div className="flex items-center justify-center gap-1 px-4 py-2 bg-black/80  overflow-x-auto">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSlide(i)}
                className={`shrink-0 w-16 h-10 rounded overflow-hidden ring-2 transition-all ${
                  i === currentIndex ? "ring-cerrado-600" : "ring-transparent opacity-50 hover:opacity-80"
                }`}
              >
                {s.image_url && (
                  <Image
                    src={s.image_url}
                    alt={`Slide ${i + 1}`}
                    width={64}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        </div>

        {/* Notes panel — hidden in fullscreen, desktop only */}
        {!isFullscreen && showNotes && (
          <div className="w-[380px] border-l border-border-subtle bg-bg-app/95 overflow-y-auto p-5 shrink-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted/50 mb-3">
              {slide?.text_content ? "Notas" : "Sem notas para este slide"}
            </p>
            <div className="text-sm leading-relaxed text-white/70">
              <Markdown
                components={{
                  h2: ({ children }) => <h2 className="text-base font-bold text-white mb-3 mt-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold text-white mb-2 mt-4">{children}</h3>,
                  p: ({ children }) => <p className="text-sm leading-relaxed text-white/70 mb-3">{children}</p>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  blockquote: ({ children }) => {
                    // Extract text content from children to check if it's a reflection
                    const text = extractText(children)
                    if (tenantId && isReflectionBlock(text)) {
                      const saved = reflections.find((r) => r.slide_id === slide.id)
                      return (
                        <ReflectionPrompt
                          slideId={slide.id}
                          tenantId={tenantId}
                          question={text}
                          savedResponse={saved?.response}
                          savedAiResponse={saved?.ai_response}
                          aiEnabled={aiReflectionEnabled}
                          slideContext={slide.text_content ?? ""}
                        />
                      )
                    }
                    return <blockquote className="border-l-2 border-cerrado-600/40 pl-3 my-3 text-white/50 text-sm">{children}</blockquote>
                  },
                  ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                }}
              >
                {slide.text_content}
              </Markdown>
            </div>

            {/* Session button — bottom of notes, last slide */}
            {currentIndex === slides.length - 1 && interaction?.type === "socratic" && (
              <div className="mt-6 pt-4 ">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={13} className="text-varzea" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-varzea/70">Sessão Socrática</span>
                </div>
                <p className="text-[11px] text-white/40 mb-3">Aprofunde com uma conversa guiada por IA.</p>
                <SessionButton
                  courseId={interaction.courseId}
                  chapterId={interaction.chapterId}
                  hasActiveQuestions={interaction.hasActiveQuestions ?? false}
                  activeQuestionCount={interaction.activeQuestionCount ?? 0}
                  activeSession={interaction.activeSession ?? null}
                  lastCompletedSession={interaction.lastCompletedSession ?? null}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile audio bar — fixed at bottom on small screens */}
      {!isFullscreen && activeAudioUrl && (
        <div className="sm:hidden flex items-center gap-2.5 px-3 py-2 bg-black/90  shrink-0">
          <button
            type="button"
            onClick={goPrev}
            disabled={!hasPrev}
            className="text-white/50 hover:text-white disabled:opacity-30 transition-colors"
            aria-label="Slide anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shrink-0"
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!hasNext}
            className="text-white/50 hover:text-white disabled:opacity-30 transition-colors"
            aria-label="Próximo slide"
          >
            <ChevronRight size={18} />
          </button>
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] tabular-nums text-text-muted shrink-0">{formatMs(currentTime)}</span>
            <div className="relative flex-1 h-1.5 rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-cerrado-600"
                style={{ width: audioDuration ? `${(currentTime / audioDuration) * 100}%` : "0%" }}
              />
              <input
                type="range"
                min="0"
                max="1000"
                value={audioDuration > 0 ? (currentTime / audioDuration) * 1000 : 0}
                onChange={(e) => seekTo((Number(e.target.value) / 1000) * audioDuration)}
                className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                aria-label="Progresso do áudio"
              />
            </div>
            <span className="text-[10px] tabular-nums text-text-muted shrink-0">{formatMs(audioDuration)}</span>
          </div>
          <button
            type="button"
            onClick={() => changePlaybackRate(playbackRate >= 2 ? 0.5 : playbackRate + 0.25)}
            className="text-[10px] font-semibold tabular-nums text-white/50 hover:text-white min-w-[24px] shrink-0"
          >
            {playbackRate}x
          </button>
        </div>
      )}

      {/* Audio element — must be early in DOM for ref attachment */}
      {activeAudioUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio ref={audioRef} src={activeAudioUrl ?? ""} preload="metadata" className="hidden" />
      )}

      {/* Video overlay */}
      {showVideo && videoUrl && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/95">
          <div className="relative w-full max-w-5xl aspect-video mx-4">
            <VideoPlayer url={videoUrl} />
          </div>
          <button
            type="button"
            onClick={() => setShowVideo(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-sm transition-colors"
          >
            ✕ Fechar
          </button>
        </div>
      )}

      {/* Mobile notes overlay — fullscreen on small screens */}
      {!isFullscreen && showNotes && slide?.text_content && (
        <div className="absolute inset-0 z-30 md:hidden bg-black/95 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm ">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted/50">Notas — Slide {currentIndex + 1}</p>
            <button
              type="button"
              onClick={() => setShowNotes(false)}
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
            >
              <X size={14} />
              Fechar
            </button>
          </div>
          <div className="p-4 pb-20 text-sm leading-relaxed text-white/70">
            <Markdown
              components={{
                h2: ({ children }) => <h2 className="text-base font-bold text-white mb-3 mt-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-white mb-2 mt-4">{children}</h3>,
                p: ({ children }) => <p className="text-sm leading-relaxed text-white/70 mb-3">{children}</p>,
                strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                blockquote: ({ children }) => {
                  const text = extractText(children)
                  if (tenantId && isReflectionBlock(text)) {
                    const saved = reflections.find((r) => r.slide_id === slide.id)
                    return (
                      <ReflectionPrompt
                        slideId={slide.id}
                        tenantId={tenantId}
                        question={text}
                        savedResponse={saved?.response}
                        savedAiResponse={saved?.ai_response}
                        aiEnabled={aiReflectionEnabled}
                        slideContext={slide.text_content ?? ""}
                      />
                    )
                  }
                  return <blockquote className="border-l-2 border-cerrado-600/40 pl-3 my-3 text-white/50 text-sm">{children}</blockquote>
                },
                ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1 text-sm text-white/70">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
              }}
            >
              {slide.text_content}
            </Markdown>
          </div>

          {/* Session button on last slide — mobile */}
          {currentIndex === slides.length - 1 && interaction?.type === "socratic" && (
            <div className="px-4 pb-6 pt-2 ">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={13} className="text-varzea" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-varzea/70">Sessão Socrática</span>
              </div>
              <SessionButton
                courseId={interaction.courseId}
                chapterId={interaction.chapterId}
                hasActiveQuestions={interaction.hasActiveQuestions ?? false}
                activeQuestionCount={interaction.activeQuestionCount ?? 0}
                activeSession={interaction.activeSession ?? null}
                lastCompletedSession={interaction.lastCompletedSession ?? null}
              />
            </div>
          )}
        </div>
      )}

    </div>
  )
}
