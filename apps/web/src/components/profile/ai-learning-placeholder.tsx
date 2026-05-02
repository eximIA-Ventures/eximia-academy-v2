"use client"

import { Card, CardContent } from "@eximia/ui"
import { Brain } from "lucide-react"

export function AILearningPlaceholder() {
  return (
    <Card className="border-dashed border-border-medium bg-bg-surface">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
          <Brain className="h-6 w-6" />
        </div>
        <p className="max-w-md text-sm text-text-muted">
          Conforme você interage com o tutor, seu perfil de aprendizado será construído
          automaticamente. Complete pelo menos 2 sessoes socraticas para comecar.
        </p>
      </CardContent>
    </Card>
  )
}
