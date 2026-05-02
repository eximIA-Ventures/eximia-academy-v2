import { slugify } from "./slugify"

export interface Heading {
  text: string
  slug: string
  level: number
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  const lines = markdown.split("\n")

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      const text = match[1].trim()
      headings.push({
        text,
        slug: slugify(text),
        level: 2,
      })
    }
  }

  return headings
}
