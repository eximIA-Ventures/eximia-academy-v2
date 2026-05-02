"use client"

import { analytics } from "@/lib/analytics"
import { ArrowLeft, BookOpen } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@eximia/ui"
import { ChatInput } from "./chat-input"
import { ChatMessage } from "./chat-message"
import { InteractionCounter } from "./interaction-counter"
import { SessionCompleteBar } from "./session-complete-bar"
import { TypingIndicator } from "./typing-indicator"

interface ChatMessageData {
  id: string
  role: "user" | "assistant"
  content: string
}

interface SocraticChatProps {
  sessionId: string
  courseId: string
  chapterId: string
  chapterTitle: string
  initialQuestion: string
  initialMessages: ChatMessageData[]
  maxInteractions: number
  currentInteractionsRemaining: number
  sessionStatus: "active" | "completed"
  sessionCreatedAt: string
  sessionCompletedAt: string | null
  nextChapterId: string | null
}

export function SocraticChat({
  sessionId,
  courseId,
  chapterId,
  chapterTitle,
  initialMessages,
  maxInteractions,
  currentInteractionsRemaining,
  sessionStatus: initialSessionStatus,
  sessionCreatedAt,
  sessionCompletedAt,
  nextChapterId,
}: SocraticChatProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [interactionsRemaining, setInteractionsRemaining] = useState(currentInteractionsRemaining)
  const [sessionStatus, setSessionStatus] = useState(initialSessionStatus)
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastResponseTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    analytics.sessionStarted(sessionId, courseId, chapterId)
  }, [sessionId, courseId, chapterId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      lastResponseTimeRef.current = Date.now()
    }
  }, [isLoading, messages.length])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value),
    [],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isLoading) return

      const userMsg: ChatMessageData = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)

      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            response_time_seconds: Math.round((Date.now() - lastResponseTimeRef.current) / 1000),
          }),
        })

        if (!res.ok) {
          throw new Error(res.status === 409 ? "Sessão não disponível" : "Erro no servidor")
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let assistantContent = ""
        const assistantId = `assistant-${Date.now()}`

        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])

        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line) continue

            if (line.startsWith("0:")) {
              const text = JSON.parse(line.slice(2)) as string
              assistantContent += text
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m)),
              )
            } else if (line.startsWith("2:")) {
              const annotations = JSON.parse(line.slice(2)) as Array<Record<string, unknown>>
              for (const ann of annotations) {
                if (ann.interactions_remaining !== undefined) {
                  setInteractionsRemaining(ann.interactions_remaining as number)
                }
                if (ann.session_status === "completed") {
                  setSessionStatus("completed")
                  const durationMs = Date.now() - new Date(sessionCreatedAt).getTime()
                  analytics.sessionCompleted(
                    sessionId,
                    maxInteractions - interactionsRemaining,
                    durationMs,
                  )
                }
              }
            }
          }
        }
      } catch (err) {
        toast({ variant: "error", title: err instanceof Error ? err.message : "Erro ao processar. Tente novamente." })
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, sessionId, interactionsRemaining, maxInteractions, sessionCreatedAt],
  )

  const isCompleted = sessionStatus === "completed"

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-b border-border-subtle bg-bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href={`/courses/${courseId}/chapters/${chapterId}`}
            className="flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Voltar</span>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <BookOpen size={14} className="text-text-muted" />
            <span className="max-w-[200px] truncate text-text-secondary sm:max-w-none">
              {chapterTitle}
            </span>
          </div>

          <InteractionCounter remaining={interactionsRemaining} total={maxInteractions} />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
          {messages.map((message) => (
            <ChatMessage key={message.id} role={message.role} content={message.content} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area or completion bar */}
      <div className="border-t border-border-subtle bg-bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {isCompleted ? (
            <SessionCompleteBar
              courseId={courseId}
              chapterId={chapterId}
              messages={messages}
              sessionCreatedAt={sessionCreatedAt}
              sessionCompletedAt={sessionCompletedAt}
              nextChapterId={nextChapterId}
            />
          ) : (
            <ChatInput
              input={input}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              disabled={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  )
}
