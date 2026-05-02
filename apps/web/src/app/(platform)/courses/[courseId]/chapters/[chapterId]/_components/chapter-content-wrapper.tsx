"use client"

import type { ChapterSlide, LearningMode } from "@eximia/shared"
import { useCallback, useRef, useState } from "react"
import { AssignmentPlayer } from "./assignment-player"
import { ChapterCompleteButton } from "./chapter-complete-button"
import { ChapterModeSelector } from "./chapter-mode-selector"
import { ChapterTocSheet } from "./chapter-toc-sheet"
import { QuizPlayer } from "./quiz-player"
import { ScenarioPlayer } from "./scenario-player"
import { SessionButton } from "./session-button"

interface QuizQuestion {
  id: string
  text: string
  question_type: "multiple_choice" | "true_false" | "open_ended"
  options: string[] | null
  correct_answer: string | null
  explanation: string | null
  skill: string | null
}

interface TocChapter {
  id: string
  title: string
  order: number
}

interface ChapterContentWrapperProps {
  content: string
  contentBlocks: Record<string, unknown>[] | null
  videoUrl: string | null
  audioUrl: string | null
  userPreference: LearningMode
  slides: ChapterSlide[]
  hasSlides: boolean
  slideAudioUrl: string | null
  // Interaction props
  interactionType: string | null
  quizQuestions: QuizQuestion[]
  scenarioData?: Record<string, unknown> | null
  assignmentData?: Record<string, unknown> | null
  courseId: string
  chapterId: string
  hasActiveQuestions: boolean
  activeQuestionCount: number
  activeSession: { id: string; status: string } | null
  lastCompletedSession: { id: string; status: string } | null
  // TOC props
  tocChapters: TocChapter[]
  tocCourseTitle: string
  tocSections: { text: string; slug: string }[]
}

export function ChapterContentWrapper({
  content,
  contentBlocks,
  videoUrl,
  audioUrl,
  userPreference,
  slides,
  hasSlides,
  slideAudioUrl,
  interactionType,
  quizQuestions,
  scenarioData,
  assignmentData,
  courseId,
  chapterId,
  hasActiveQuestions,
  activeQuestionCount,
  activeSession,
  lastCompletedSession,
  tocChapters,
  tocCourseTitle,
  tocSections,
}: ChapterContentWrapperProps) {
  const [isAtLastSlide, setIsAtLastSlide] = useState(!hasSlides)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const goToSlideRef = useRef<((index: number) => void) | null>(null)

  const handleSlideReachEnd = useCallback((atEnd: boolean) => {
    setIsAtLastSlide(atEnd)
  }, [])

  const hasQuiz = interactionType === "quiz" && quizQuestions.length > 0
  const hasScenario = interactionType === "scenario" && !!scenarioData
  const hasAssignment = interactionType === "assignment" && !!assignmentData
  const hasSocratic = !hasQuiz && !hasScenario && !hasAssignment && hasActiveQuestions

  const slideEntries = hasSlides
    ? slides.map((s) => ({
        order: s.order,
        label: s.text_content
          ? s.text_content.substring(0, 50).replace(/[*#\n]/g, "").trim() + "..."
          : `Slide ${s.order + 1}`,
      }))
    : undefined

  return (
    <>
      <ChapterModeSelector
        content={content}
        contentBlocks={contentBlocks}
        videoUrl={videoUrl}
        audioUrl={audioUrl}
        userPreference={userPreference}
        slides={slides}
        hasSlides={hasSlides}
        slideAudioUrl={slideAudioUrl}
        onSlideReachEnd={handleSlideReachEnd}
        goToSlideRef={goToSlideRef}
        onSlideChange={setCurrentSlideIndex}
      />

      {/* Interaction area — only visible at last slide (or always if no slides) */}
      {isAtLastSlide && (
        <div className="mt-8 space-y-6">
          {hasQuiz && (
            <div className="space-y-3">
              <div className="text-center">
                <h2 className="text-lg font-bold text-text-primary">
                  Teste seus Conhecimentos
                </h2>
                <p className="text-sm text-text-muted">
                  {quizQuestions.length} questões sobre o conteúdo deste capítulo
                </p>
              </div>
              <QuizPlayer
                questions={quizQuestions}
                chapterId={chapterId}
                courseId={courseId}
                onComplete={(score, total) => setQuizCompleted(true)}
              />
            </div>
          )}

          {/* Scenario */}
          {hasScenario && (
            <ScenarioPlayer
              scenario={scenarioData as any}
              chapterId={chapterId}
              courseId={courseId}
            />
          )}

          {/* Assignment */}
          {hasAssignment && (
            <AssignmentPlayer
              assignment={assignmentData as any}
              chapterId={chapterId}
              courseId={courseId}
            />
          )}

          {hasSocratic && (
            <div className="flex justify-center">
              <SessionButton
                courseId={courseId}
                chapterId={chapterId}
                hasActiveQuestions={hasActiveQuestions}
                activeQuestionCount={activeQuestionCount}
                activeSession={activeSession}
                lastCompletedSession={lastCompletedSession}
              />
            </div>
          )}

          {/* Chapter completion button — for non-socratic chapters */}
          {!hasSocratic && (
            <div className="flex justify-center pt-4">
              <ChapterCompleteButton
                courseId={courseId}
                chapterId={chapterId}
                isCompleted={!!lastCompletedSession}
              />
            </div>
          )}
        </div>
      )}

      {/* TOC — with slide navigation when slides exist */}
      <ChapterTocSheet
        courseId={courseId}
        courseTitle={tocCourseTitle}
        chapters={tocChapters}
        currentChapterId={chapterId}
        currentSections={tocSections}
        slides={slideEntries}
        currentSlideIndex={currentSlideIndex}
        onGoToSlide={(index) => goToSlideRef.current?.(index)}
      />
    </>
  )
}
