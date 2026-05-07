"use client"

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import type { TranscriptMessage } from "@/types/analytics"

interface AnnotatedTranscriptProps {
  messages: TranscriptMessage[]
}

export function AnnotatedTranscript({ messages }: AnnotatedTranscriptProps) {
  if (messages.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="py-8 text-center text-sm text-text-muted">
          Nenhuma mensagem encontrada para esta sessao.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Conversa Anotada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* Annotations between messages */}
            {msg.annotations && Object.keys(msg.annotations).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 py-1.5 pl-4">
                {msg.annotations.depthLevel != null && (
                  <Badge variant="info" badgeSize="sm">
                    depth: {msg.annotations.depthLevel}
                  </Badge>
                )}
                {msg.annotations.emotionalState && (
                  <Badge variant="default" badgeSize="sm">
                    {msg.annotations.emotionalState}
                  </Badge>
                )}
                {msg.annotations.detectedPattern && (
                  <Badge variant="warning" badgeSize="sm">
                    {msg.annotations.detectedPattern}
                  </Badge>
                )}
                {msg.annotations.isBreakthrough && (
                  <Badge variant="success" badgeSize="sm">
                    breakthrough
                  </Badge>
                )}
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`rounded-lg p-4 ${
                msg.role === "user"
                  ? "ml-0 mr-8 bg-bg-surface"
                  : "ml-8 mr-0 shadow-card bg-bg-card"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted">
                  {msg.role === "user" ? "Aluno" : "Mestre"} — T{msg.turnNumber}
                </span>
                <span className="text-2xs text-text-muted">
                  {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-text-primary">{msg.content}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
