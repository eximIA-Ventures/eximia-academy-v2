"use client"

import { Card } from "@eximia/ui"
import { BookOpen, LayoutDashboard, MessageSquare, Settings } from "lucide-react"

interface BrandingPreviewProps {
  primaryColor: string
  secondaryColor: string
  logoUrl?: string
  tenantName: string
}

export function BrandingPreview({
  primaryColor,
  secondaryColor,
  logoUrl,
  tenantName,
}: BrandingPreviewProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-secondary">Preview em tempo real</p>
      <Card className="overflow-hidden">
        <div className="flex h-64">
          {/* Mini sidebar preview */}
          <div
            className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-border-subtle p-3"
            style={{ backgroundColor: secondaryColor }}
          >
            {/* Logo placeholder */}
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] font-bold text-white" style={{ color: primaryColor }}>
                  eA
                </span>
              )}
            </div>
            {/* Nav items */}
            {[LayoutDashboard, BookOpen, MessageSquare, Settings].map((Icon, i) => (
              <div
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                style={i === 0 ? { backgroundColor: `${primaryColor}20` } : undefined}
              >
                <Icon
                  size={14}
                  style={{ color: i === 0 ? primaryColor : "rgba(255,255,255,0.4)" }}
                />
              </div>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 p-4">
            {/* Header bar */}
            <div className="mb-3 flex items-center justify-between rounded-lg bg-bg-card/50 px-3 py-2">
              <span className="text-[10px] font-semibold text-text-primary">{tenantName}</span>
              <div className="h-5 w-5 rounded-full bg-bg-surface" />
            </div>

            {/* Accent card */}
            <div
              className="mb-3 rounded-lg p-3"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}40, ${secondaryColor})`,
              }}
            >
              <p className="text-[10px] font-bold text-white">Painel de Gestao</p>
              <p className="mt-1 text-[8px] text-white/60">Visão geral da plataforma</p>
            </div>

            {/* Mini cards */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-md bg-bg-card/60 p-2">
                  <div
                    className="mb-1 h-1.5 w-6 rounded-full"
                    style={{ backgroundColor: `${primaryColor}60` }}
                  />
                  <div className="h-1 w-10 rounded-full bg-text-muted/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
