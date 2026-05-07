"use client"

import * as Sentry from "@sentry/nextjs"
import { type ReactNode, useCallback } from "react"

interface ErrorFallbackProps {
  error: Error & { digest?: string }
  resetErrorBoundary: () => void
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-md border border-semantic-error/20 bg-semantic-error/10 p-6 text-center">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Algo deu errado</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.
        </p>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="rounded-md bg-cerrado-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cerrado-600/80"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

interface SentryErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

export function SentryErrorBoundary({ children, fallback }: SentryErrorBoundaryProps) {
  const handleFallback = useCallback(
    ({ error, resetError }: { error: unknown; resetError: () => void }) => {
      if (fallback) return <>{fallback}</>
      const err = error instanceof Error ? error : new Error(String(error))
      return <ErrorFallback error={err} resetErrorBoundary={resetError} />
    },
    [fallback],
  )

  return <Sentry.ErrorBoundary fallback={handleFallback}>{children}</Sentry.ErrorBoundary>
}
