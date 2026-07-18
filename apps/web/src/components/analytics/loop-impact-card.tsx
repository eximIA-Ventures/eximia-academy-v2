"use client"

import type { LoopStats } from "@/types/analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"

interface LoopImpactCardProps {
  loopStats?: LoopStats
}

/**
 * "O loop que você causou" (redesign Analytics Apple-like, aba Uso da
 * Plataforma). Mostra quantos alunos acionados por nudge voltaram a estudar,
 * sinal observado (notifications.sent_at → returned_at), nunca apresentado
 * como prova de causa. Sem sends no escopo/período, mostra estado vazio honesto.
 */
export function LoopImpactCard({ loopStats }: LoopImpactCardProps) {
  const hasData = !!loopStats && loopStats.acionados > 0

  return (
    <Card className="dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:border dark:border-white/[0.06]">
      <CardHeader>
        <CardTitle className="text-base">O loop que você causou</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData || !loopStats ? (
          <p className="py-4 text-center text-sm text-text-muted">
            Sem dados no período selecionado, nenhum aluno foi acionado por nudge neste intervalo.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="font-display text-2xl font-semibold tabular-nums text-text-primary">
              {loopStats.voltaram} de {loopStats.acionados}{" "}
              <span className="text-sm font-normal text-text-muted">
                alunos acionados voltaram a estudar
              </span>
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-semantic-success"
                style={{ width: `${loopStats.returnRatePct}%` }}
              />
            </div>
            <p className="text-xs text-text-muted">
              dos alunos acionados por nudge no período, {loopStats.returnRatePct}% voltaram a
              estudar depois, sinal observado, não prova de causa (parte deles poderia voltar de
              qualquer forma).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
