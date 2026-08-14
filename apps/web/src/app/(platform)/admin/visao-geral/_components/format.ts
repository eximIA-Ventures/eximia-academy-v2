/** Formatação compartilhada pelas três seções — uma régua só para a tela toda. */

const numberFormatter = new Intl.NumberFormat("pt-BR")

export function formatCount(value: number | null): string {
  return value === null ? "—" : numberFormatter.format(value)
}

export function formatPercent(value: number | null, fractionDigits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(fractionDigits).replace(".", ",")}%`
}

/** Variação assinada: o sinal explícito evita ler queda como alta. */
export function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : ""
  return `${sign}${numberFormatter.format(Math.abs(delta))}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(parsed))
}
