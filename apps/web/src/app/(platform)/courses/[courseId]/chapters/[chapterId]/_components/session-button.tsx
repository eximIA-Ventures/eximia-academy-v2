"use client"

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@eximia/ui"
import { Trash2 } from "lucide-react"
import { useState, useTransition } from "react"
import { createSession, deleteSession } from "../actions"
import { QuestionChooserSheet } from "./question-chooser-sheet"

interface SessionButtonProps {
  courseId: string
  chapterId: string
  hasActiveQuestions: boolean
  activeQuestionCount: number
  activeSession: { id: string; status: string } | null
  lastCompletedSession: { id: string; status: string } | null
}

export function SessionButton({
  courseId,
  chapterId,
  hasActiveQuestions,
  activeQuestionCount,
  activeSession,
  lastCompletedSession,
}: SessionButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [chooserOpen, setChooserOpen] = useState(false)

  const handleClick = () => {
    // If 2+ active questions and no active session, open chooser
    if (activeQuestionCount >= 2 && !activeSession) {
      setChooserOpen(true)
      return
    }

    startTransition(() => {
      createSession(chapterId, courseId)
    })
  }

  const handleDelete = () => {
    if (!activeSession) return
    startTransition(() => {
      deleteSession(activeSession.id, chapterId, courseId)
    })
  }

  // AC9: No active questions
  if (!hasActiveQuestions) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Button disabled size="lg">
            Iniciar Sessão Socratica
          </Button>
        </TooltipTrigger>
        <TooltipContent>Aguardando perguntas do professor</TooltipContent>
      </Tooltip>
    )
  }

  // AC6: Active session exists
  if (activeSession) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <Button size="lg" className="min-h-[48px] text-sm sm:text-base" onClick={handleClick} disabled={isPending}>
          {isPending ? "Carregando..." : "Continuar Sessao"}
        </Button>
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline" size="icon" className="min-h-[48px] min-w-[48px]" onClick={handleDelete} disabled={isPending}>
              <Trash2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Abandonar sessão atual</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  // Label based on whether there's a previous session
  const label = lastCompletedSession ? "Nova Sessão Socratica" : "Iniciar Sessão Socratica"

  return (
    <>
      <Button size="lg" onClick={handleClick} disabled={isPending}>
        {isPending ? "Criando..." : label}
      </Button>

      <QuestionChooserSheet
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        chapterId={chapterId}
        courseId={courseId}
      />
    </>
  )
}
