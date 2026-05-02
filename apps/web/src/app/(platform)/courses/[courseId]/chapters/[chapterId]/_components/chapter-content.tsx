import { ChapterBlocksRenderer } from "./chapter-blocks-renderer"
import { parseImageAlt, getImageLayoutClasses } from "@/lib/utils/parse-image-alt"
import { slugify } from "@/lib/utils/slugify"
import type { ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import { ImageWithLightbox } from "./image-with-lightbox"

interface ChapterContentProps {
  content: string
  contentBlocks?: Record<string, unknown>[] | null
}

function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getTextContent).join("")
  if (node && typeof node === "object" && "props" in node) {
    return getTextContent((node as { props: { children?: ReactNode } }).props.children)
  }
  return ""
}

interface HastNode {
  type: string
  tagName?: string
  children?: HastNode[]
}

function hastHasImage(node?: HastNode): boolean {
  if (!node?.children) return false
  return node.children.some(
    (child) => child.type === "element" && child.tagName === "img"
  )
}

export function ImageFigure({ src, alt }: { src?: string; alt?: string }) {
  const { displayAlt, size, align } = parseImageAlt(alt)
  const layoutClasses = getImageLayoutClasses(size, align)

  return (
    <figure className={layoutClasses}>
      <ImageWithLightbox
        src={String(src ?? "")}
        alt={String(displayAlt)}
        className="rounded-md w-full h-auto"
      />
      {displayAlt && (
        <figcaption className="text-xs text-text-muted mt-2 text-center">
          {displayAlt}
        </figcaption>
      )}
    </figure>
  )
}

export const chapterMarkdownComponents: Components = {
  h2: ({ children }) => {
    const text = getTextContent(children)
    const id = slugify(text)
    return <h2 id={id} className="clear-both">{children}</h2>
  },
  p: ({ children, node }) => {
    if (hastHasImage(node as HastNode | undefined)) {
      return <>{children}</>
    }
    return <p>{children}</p>
  },
  img: ({ src, alt }) => <ImageFigure src={typeof src === "string" ? src : undefined} alt={alt} />,
}

export function ChapterContent({ content, contentBlocks }: ChapterContentProps) {
  if (contentBlocks && contentBlocks.length > 0) {
    return <ChapterBlocksRenderer blocks={contentBlocks} />
  }

  return (
    <article className="prose prose-invert max-w-none overflow-hidden prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-accent-blue-mid prose-strong:text-text-primary prose-code:text-accent-teal-light">
      <ReactMarkdown components={chapterMarkdownComponents}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
