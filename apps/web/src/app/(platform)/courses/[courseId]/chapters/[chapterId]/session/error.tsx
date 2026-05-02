"use client"

import { Card, CardContent, Button } from "@eximia/ui"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"
import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect } from "react"

export default function SessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-semantic-error/10">
            <AlertTriangle className="h-8 w-8 text-semantic-error" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-primary">Erro na Sessao</h2>
            <p className="text-sm text-text-secondary">
              Ocorreu um erro durante a sessão socratica. Tente novamente.
            </p>
            {process.env.NODE_ENV === "development" && error.message && (
              <p className="mt-2 rounded-md bg-bg-surface p-3 text-xs font-mono text-text-muted">
                {error.message}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
            <Link href="/dashboard">
              <Button>
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
