"use client"

import type { KolbResult } from "@/lib/assessments/kolb-scoring"
import { Brain, Eye, Hammer, Lightbulb } from "lucide-react"

interface KolbResultsProps {
  result: KolbResult
}

const STYLE_CONFIG: Record<string, { icon: typeof Brain; color: string; bgColor: string }> = {
  Divergente: { icon: Eye, color: "text-purple-400", bgColor: "bg-purple-500/15" },
  Assimilador: { icon: Brain, color: "text-cerrado-600", bgColor: "bg-cerrado-600/15" },
  Convergente: { icon: Lightbulb, color: "text-varzea", bgColor: "bg-varzea/15" },
  Acomodador: { icon: Hammer, color: "text-accent-gold", bgColor: "bg-accent-gold/15" },
}

export function KolbResults({ result }: KolbResultsProps) {
  const config = STYLE_CONFIG[result.style] ?? STYLE_CONFIG.Divergente
  const Icon = config.icon

  // Map to visual quadrant position (percentage within a 200×200 area)
  const maxAxis = 36
  const dotX = 50 + (result.transformingAxis / maxAxis) * 45
  const dotY = 50 - (result.graspingAxis / maxAxis) * 45

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Main result */}
      <div className="rounded-2xl bg-gradient-to-br from-varzea/5 via-bg-card to-bg-card shadow-card p-8 text-center space-y-4">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${config.bgColor}`}>
          <Icon size={32} className={config.color} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-varzea">Seu Estilo de Aprendizagem</p>
          <h2 className="mt-1 text-3xl font-bold text-text-primary">{result.style}</h2>
          <p className="mt-1 text-sm text-text-muted">Confiança: {result.confidence}%</p>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">{result.description}</p>
      </div>

      {/* Quadrant visualization */}
      <div className="rounded-2xl bg-bg-card shadow-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Mapa de Aprendizagem</h3>

        <div className="relative mx-auto w-full max-w-[320px] aspect-square">
          {/* Background grid */}
          <div className="absolute inset-0 rounded-xl bg-bg-primary shadow-card">
            {/* Axis lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-bg-elevated" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-bg-elevated" />

            {/* Quadrant labels */}
            <span className="absolute left-2 top-2 text-[9px] font-semibold text-purple-400/60">Divergente</span>
            <span className="absolute right-2 top-2 text-[9px] font-semibold text-accent-gold/60">Acomodador</span>
            <span className="absolute left-2 bottom-2 text-[9px] font-semibold text-cerrado-600/60">Assimilador</span>
            <span className="absolute right-2 bottom-2 text-[9px] font-semibold text-varzea/60">Convergente</span>

            {/* Axis labels */}
            <span className="absolute left-1/2 -translate-x-1/2 top-1 text-[8px] text-text-muted/40">Concreto</span>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-1 text-[8px] text-text-muted/40">Abstrato</span>
            <span className="absolute top-1/2 -translate-y-1/2 left-1 text-[8px] text-text-muted/40 [writing-mode:vertical-lr] rotate-180">Reflexivo</span>
            <span className="absolute top-1/2 -translate-y-1/2 right-1 text-[8px] text-text-muted/40 [writing-mode:vertical-lr]">Ativo</span>

            {/* User position dot */}
            <div
              className={`absolute h-5 w-5 rounded-full ${config.bgColor} ring-2 ring-white shadow-[0_0_12px_rgba(45,212,191,0.3)] transition-all`}
              style={{
                left: `${dotX}%`,
                top: `${dotY}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className={`absolute inset-1 rounded-full ${config.color === "text-varzea" ? "bg-varzea" : config.color === "text-accent-gold" ? "bg-accent-gold" : config.color === "text-cerrado-600" ? "bg-cerrado-600" : "bg-purple-500"}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Mode scores */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Experiência Concreta", value: result.ce, max: 48, color: "bg-accent-gold" },
          { label: "Observação Reflexiva", value: result.ro, max: 48, color: "bg-purple-500" },
          { label: "Conceituação Abstrata", value: result.ac, max: 48, color: "bg-cerrado-600" },
          { label: "Experimentação Ativa", value: result.ae, max: 48, color: "bg-varzea" },
        ].map((mode) => (
          <div key={mode.label} className="rounded-xl bg-bg-card shadow-card p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{mode.label}</p>
            <p className="text-2xl font-bold text-text-primary">{mode.value}</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={`h-full rounded-full ${mode.color} transition-all duration-500`}
                style={{ width: `${(mode.value / mode.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Axes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-bg-card shadow-card p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Eixo Percepção</p>
          <p className="text-xl font-bold text-text-primary">
            {result.graspingAxis > 0 ? "+" : ""}{result.graspingAxis}
          </p>
          <p className="text-[10px] text-text-muted">
            {result.graspingAxis >= 0 ? "Preferência Concreta" : "Preferência Abstrata"}
          </p>
        </div>
        <div className="rounded-xl bg-bg-card shadow-card p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Eixo Processamento</p>
          <p className="text-xl font-bold text-text-primary">
            {result.transformingAxis > 0 ? "+" : ""}{result.transformingAxis}
          </p>
          <p className="text-[10px] text-text-muted">
            {result.transformingAxis >= 0 ? "Preferência Ativa" : "Preferência Reflexiva"}
          </p>
        </div>
      </div>
    </div>
  )
}
