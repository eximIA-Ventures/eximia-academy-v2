"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"

interface WhitelabelPreviewProps {
  appName: string
  tagline: string
  loginTitle: string
  loginSubtitle: string
  footerText: string
  faviconUrl: string
}

function isValidHttpsUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function WhitelabelPreview({
  appName,
  tagline,
  loginTitle,
  loginSubtitle,
  footerText,
  faviconUrl,
}: WhitelabelPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Preview</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mini Login Screen */}
        <div className="overflow-hidden rounded-lg border border-border-medium bg-bg-app">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border-medium bg-bg-surface px-4 py-3">
            {faviconUrl && isValidHttpsUrl(faviconUrl) && (
              <img src={faviconUrl} alt="" className="h-4 w-4" />
            )}
            <span className="text-xs font-bold text-text-primary">
              {appName || "exímIA Academy"}
            </span>
          </div>

          {/* Login Body */}
          <div className="flex flex-col items-center px-4 py-8">
            <p className="text-xs font-medium text-text-muted">
              {tagline || "Aprendizado potencializado por IA"}
            </p>
            <h3 className="mt-3 text-base font-bold text-text-primary">
              {loginTitle || "Bem-vindo"}
            </h3>
            <p className="mt-1 text-center text-[10px] text-text-secondary">
              {loginSubtitle || "Faca login para acessar a plataforma"}
            </p>

            {/* Mock form */}
            <div className="mt-4 w-full space-y-2">
              <div className="h-7 w-full rounded-md border border-border-medium bg-bg-surface" />
              <div className="h-7 w-full rounded-md border border-border-medium bg-bg-surface" />
              <div className="h-7 w-full rounded-md bg-accent-blue-mid text-center text-[10px] font-medium leading-7 text-white">
                Entrar
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border-medium px-4 py-2">
            <p className="text-center text-[9px] text-text-muted">
              {footerText || "© 2026 exímIA Academy"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
