// Organograma palette: one distinct hue per direct subteam (assigned by
// colorIndex, the subteam's rank among the manager's directs). Colors are applied
// via INLINE STYLE (hex), not Tailwind classes, because this project is Tailwind
// v4 with a custom oklch theme and some default color utilities (rose, etc.) are
// not reliably generated. "Direto" is intentionally neutral, the ONLY team-less,
// colorless chip, so it never looks like a colored team.

// Tintura por opacidade + texto vivo (onda dark 2026-07-07): funciona nos 2 temas.
const SUBTEAM_PALETTE = [
  { dot: "#10b981", text: "#10b981", bg: "rgba(16,185,129,0.13)" }, // green
  { dot: "#3b82f6", text: "#3b82f6", bg: "rgba(59,130,246,0.13)" }, // blue
  { dot: "#f59e0b", text: "#f59e0b", bg: "rgba(245,158,11,0.14)" }, // amber
  { dot: "#a855f7", text: "#a855f7", bg: "rgba(168,85,247,0.13)" }, // purple
  { dot: "#ef4444", text: "#ef4444", bg: "rgba(239,68,68,0.13)" }, // red
  { dot: "#06b6d4", text: "#06b6d4", bg: "rgba(6,182,212,0.13)" }, // cyan
  { dot: "#ec4899", text: "#ec4899", bg: "rgba(236,72,153,0.13)" }, // pink
  { dot: "#84cc16", text: "#84cc16", bg: "rgba(132,204,22,0.13)" }, // lime
] as const

function hashIndex(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash % SUBTEAM_PALETTE.length
}

interface SubteamChipProps {
  subteam?: { id: string; name: string; colorIndex?: number; path?: string[] }
}

export function SubteamChip({ subteam }: SubteamChipProps) {
  if (!subteam) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-text-muted ring-1 ring-inset ring-neutral-200">
        Direto
      </span>
    )
  }

  // Nesting chain (top-level direct › ... › immediate manager), colored by the
  // top-level direct. Falls back to the plain name.
  const label =
    subteam.path && subteam.path.length > 0
      ? subteam.path.join(" › ")
      : subteam.name?.trim() || "Sem nome"

  const idx =
    subteam.colorIndex != null && subteam.colorIndex >= 0
      ? subteam.colorIndex % SUBTEAM_PALETTE.length
      : hashIndex(subteam.id)
  const color = SUBTEAM_PALETTE[idx] ?? SUBTEAM_PALETTE[0]

  return (
    <span
      title={label}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        boxShadow: `inset 0 0 0 1px ${color.dot}40`,
      }}
      className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
    >
      <span
        style={{ backgroundColor: color.dot }}
        className="h-2 w-2 shrink-0 rounded-full"
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </span>
  )
}
