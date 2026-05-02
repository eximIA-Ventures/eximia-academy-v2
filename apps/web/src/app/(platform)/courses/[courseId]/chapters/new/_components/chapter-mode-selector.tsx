"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eximia/ui"
import { useRouter } from "next/navigation"

interface ChapterModeSelectorProps {
  courseId: string
}

export function ChapterModeSelector({ courseId }: ChapterModeSelectorProps) {
  const router = useRouter()

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <Card
        className="cursor-pointer transition-colors hover:border-accent-blue-mid"
        onClick={() => router.push(`/courses/${courseId}/chapters/new/edit`)}
      >
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
            </svg>
          </div>
          <CardTitle>Criar manualmente</CardTitle>
          <CardDescription>
            Crie o capítulo preenchendo titulo, conteúdo e objetivo de aprendizagem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-xs text-text-muted">Formulario de criacao</span>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer transition-colors hover:border-accent-blue-mid"
        onClick={() => router.push(`/courses/${courseId}/chapters/new/ingest`)}
      >
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-blue-mid/10 text-accent-blue-mid">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16v-8" />
              <path d="m8 12 4-4 4 4" />
              <rect width="20" height="20" x="2" y="2" rx="5" />
            </svg>
          </div>
          <CardTitle>Importar com IA</CardTitle>
          <CardDescription>
            Envie um PDF, DOCX, audio ou cole texto e a IA gera o capítulo automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-xs text-accent-blue-mid">Recomendado</span>
        </CardContent>
      </Card>
    </div>
  )
}
