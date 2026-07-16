import type { JourneyPosition } from "@/components/dashboard/types"
import { Flag } from "lucide-react"

const BAND_LABELS = ["Iniciando", "Em movimento", "No ritmo", "Adiantado", "Concluído"]

interface JourneyPositionCardProps {
  journey: JourneyPosition
  streakDays: number
}

/**
 * "Minha posicao na jornada" card (design v6.1): 5-band track with "Voce" marker,
 * next milestone banner and class distribution in thin bars.
 * Principle: comparison is always by band, never individual ranking.
 */
export function JourneyPositionCard({ journey, streakDays }: JourneyPositionCardProps) {
  const youPct = journey.bandIndex * 25

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">Minha posição na jornada</h2>
        <span className="text-xs text-text-muted">Faixas · sem ranking</span>
      </div>

      {/* Track de 5 faixas */}
      <div className="relative mx-1.5 mb-2 mt-8 h-[60px]">
        <div className="absolute left-0 right-0 top-[11px] h-[3px] rounded-full bg-bg-elevated" />
        <div
          className="absolute left-0 top-[11px] h-[3px] rounded-full bg-gradient-to-r from-cerrado-500 to-cerrado-700 transition-all duration-700"
          style={{ width: `${youPct}%` }}
        />
        {BAND_LABELS.map((label, index) => {
          const isYou = index === journey.bandIndex
          const isPast = index < journey.bandIndex
          return (
            <div
              key={label}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-2.5"
              style={{ left: `${index * 25}%` }}
            >
              {isYou && (
                <span className="absolute -top-6 whitespace-nowrap rounded-full bg-cerrado-600/10 px-2.5 py-0.5 text-[10px] font-bold text-cerrado-600">
                  Você
                </span>
              )}
              <span
                className={
                  isYou
                    ? "mt-1 h-4 w-4 rounded-full border-2 border-white bg-cerrado-600 shadow-[0_0_0_4px] shadow-cerrado-600/15"
                    : isPast
                      ? "mt-1.5 h-3 w-3 rounded-full border-2 border-cerrado-600 bg-cerrado-600"
                      : "mt-1.5 h-3 w-3 rounded-full border-2 border-border-medium bg-bg-card"
                }
              />
              <span
                className={`whitespace-nowrap text-[10.5px] ${
                  isYou ? "font-bold text-cerrado-600" : "font-medium text-text-muted"
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Proximo marco */}
      {journey.pctToNextBand != null && journey.nextBandLabel && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-cerrado-600/20 bg-cerrado-600/10 px-3.5 py-3">
          <Flag size={16} className="shrink-0 text-cerrado-600" />
          <p className="text-xs text-text-primary">
            Você está a{" "}
            <span className="font-semibold text-cerrado-600">
              {journey.pctToNextBand} {journey.pctToNextBand === 1 ? "ponto" : "pontos"} de
              progresso
            </span>{" "}
            de entrar na faixa {journey.nextBandLabel}.
            {streakDays > 0 && (
              <>
                {" "}
                Está{" "}
                <span className="font-semibold text-cerrado-600">
                  há {streakDays} {streakDays === 1 ? "dia" : "dias"}
                </span>{" "}
                em atividade.
              </>
            )}
          </p>
        </div>
      )}

      {/* Distribuicao da turma */}
      {journey.distribution && journey.distribution.length > 0 && (
        <>
          <h3 className="mt-5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Distribuição da turma
          </h3>
          <div className="mt-1 space-y-2.5 pt-1.5">
            {journey.distribution.map((row) => (
              <div key={row.label} className="grid grid-cols-[110px_1fr_38px] items-center gap-2.5">
                <span
                  className={`text-xs ${row.isYou ? "font-bold text-cerrado-600" : "text-text-secondary"}`}
                >
                  {row.isYou ? `${row.label} · você` : row.label}
                </span>
                <div className="h-[7px] overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className={`h-full rounded-full ${
                      row.isYou
                        ? "bg-gradient-to-r from-cerrado-500 to-cerrado-700"
                        : "bg-border-strong"
                    }`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span
                  className={`text-right text-[11px] font-semibold ${
                    row.isYou ? "text-cerrado-600" : "text-text-muted"
                  }`}
                >
                  {row.pct}%
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-text-muted">
            A comparação é sempre por faixa, nunca por posição individual.
          </p>
        </>
      )}
    </section>
  )
}
