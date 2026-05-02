"use client"

import { useTenantNav } from "@/lib/hooks/use-tenant-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eximia/ui"

export function ModeSelector() {
  const { push } = useTenantNav()

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      <Card
        className="cursor-pointer transition-colors hover:border-accent-blue-mid"
        onClick={() => push("/courses")}
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
            Crie o curso preenchendo titulo, descrição e capítulos manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-xs text-text-muted">Formulario de criacao</span>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer transition-colors hover:border-accent-blue-mid"
        onClick={() => push("/courses/new/ingest")}
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
            Envie um PDF, DOCX, audio ou cole texto e a IA organiza tudo automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-xs text-accent-blue-mid">Recomendado</span>
        </CardContent>
      </Card>
      <Card
        className="cursor-pointer transition-colors hover:border-accent-blue-mid"
        onClick={() => push("/courses/new/design")}
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
              <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
              <path d="m14 7 3 3" />
              <path d="M5 6v4" />
              <path d="M19 14v4" />
              <path d="M10 2v2" />
              <path d="M7 8H3" />
              <path d="M21 16h-4" />
              <path d="M11 3H9" />
            </svg>
          </div>
          <CardTitle>Designer de Blueprint</CardTitle>
          <CardDescription>
            Crie um blueprint pedagogico completo com assistencia de IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-xs text-accent-blue-mid">Novo</span>
        </CardContent>
      </Card>
    </div>
  )
}
