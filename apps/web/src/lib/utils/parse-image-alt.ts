export type ImageSize = "33" | "50" | "75" | "100"
export type ImageAlign = "left" | "center" | "right"

interface ParsedImageAlt {
  displayAlt: string
  size: ImageSize
  align: ImageAlign
}

const VALID_SIZES = new Set<string>(["33", "50", "75", "100"])
const VALID_ALIGNS = new Set<string>(["left", "center", "right"])

export function parseImageAlt(raw: string | undefined): ParsedImageAlt {
  if (!raw || !raw.includes("|")) {
    return { displayAlt: raw ?? "", size: "100", align: "center" }
  }

  const parts = raw.split("|").map((s) => s.trim())
  const displayAlt = parts[0] ?? ""
  const rawSize = parts[1] ?? ""
  const rawAlign = parts[2] ?? ""

  const size: ImageSize = VALID_SIZES.has(rawSize) ? (rawSize as ImageSize) : "100"
  const align: ImageAlign = VALID_ALIGNS.has(rawAlign) ? (rawAlign as ImageAlign) : "center"

  return { displayAlt, size, align }
}

const LAYOUT_CLASSES: Record<string, string> = {
  "100-left": "my-6 w-full",
  "100-center": "my-6 w-full",
  "100-right": "my-6 w-full",
  "75-center": "my-6 mx-auto w-3/4",
  "75-left": "my-2 mr-4 float-left w-3/4",
  "75-right": "my-2 ml-4 float-right w-3/4",
  "50-center": "my-6 mx-auto w-1/2",
  "50-left": "my-2 mr-4 float-left w-1/2",
  "50-right": "my-2 ml-4 float-right w-1/2",
  "33-center": "my-6 mx-auto w-1/3",
  "33-left": "my-2 mr-4 float-left w-1/3",
  "33-right": "my-2 ml-4 float-right w-1/3",
}

export function getImageLayoutClasses(size: ImageSize, align: ImageAlign): string {
  return LAYOUT_CLASSES[`${size}-${align}`] ?? "my-6 w-full"
}

// ─── Grid-based image positioning (5-column grid) ────────────────
const GRID_TOTAL = 5

function clampGrid(col: number, span: number) {
  const c = Math.max(0, Math.min(col, GRID_TOTAL - 1))
  const s = Math.max(1, Math.min(span, GRID_TOTAL - c))
  return { c, s }
}

/** Editor-only: width + margin, NO float (float breaks Plate.js editing) */
export function getGridImageEditorStyles(
  col: number,
  span: number,
): React.CSSProperties {
  const { c, s } = clampGrid(col, span)
  const widthPercent = (s / GRID_TOTAL) * 100
  const offsetPercent = (c / GRID_TOTAL) * 100
  return {
    width: `${widthPercent}%`,
    marginLeft: offsetPercent > 0 ? `${offsetPercent}%` : undefined,
    marginTop: "0.5rem",
    marginBottom: "0.5rem",
  }
}

/** Read-only renderer: width + float for text wrap */
export function getGridImageStyles(
  col: number,
  span: number,
  row?: number,
  rowSpan?: number,
): React.CSSProperties {
  const { c, s } = clampGrid(col, span)
  const widthPercent = (s / GRID_TOTAL) * 100
  const effectiveRowSpan = Math.max(1, Math.min(rowSpan ?? GRID_TOTAL, GRID_TOTAL))

  // Float only when image is narrow enough for text to fit beside it (≤ 3/5 = 60%)
  const canFloat = s <= 3
  const touchesLeft = c === 0
  const touchesRight = c + s >= GRID_TOTAL

  let float: "left" | "right" | undefined
  let marginLeft: string | undefined
  let marginRight: string | undefined

  if (!canFloat) {
    float = undefined
    if (c > 0) {
      marginLeft = `${(c / GRID_TOTAL) * 100}%`
    }
  } else if (touchesLeft) {
    float = "left"
    marginRight = "1.5rem"
  } else if (touchesRight) {
    float = "right"
    marginLeft = "1.5rem"
  } else {
    float = "left"
    marginLeft = `${(c / GRID_TOTAL) * 100}%`
    marginRight = "1.5rem"
  }

  return {
    width: `${widthPercent}%`,
    float,
    marginLeft,
    marginRight,
    marginTop: "0.5rem",
    marginBottom: "0.5rem",
    ...(effectiveRowSpan < GRID_TOTAL && {
      maxHeight: `${(effectiveRowSpan / GRID_TOTAL) * 100}vh`,
      overflow: "hidden",
    }),
  }
}
