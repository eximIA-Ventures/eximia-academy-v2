import { getImageLayoutClasses, getGridImageStyles, type ImageSize, type ImageAlign } from "@/lib/utils/parse-image-alt"
import { ImageWithLightbox } from "./image-with-lightbox"

interface SlateNode {
  type?: string
  text?: string
  url?: string
  imgSize?: string
  imgAlign?: string
  imgCol?: number
  imgSpan?: number
  imgRow?: number
  imgRowSpan?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  code?: boolean
  children?: SlateNode[]
  width?: string
}

function renderText(node: SlateNode, idx: number): React.ReactNode {
  if (node.text !== undefined) {
    let content: React.ReactNode = node.text
    if (node.bold) content = <strong key={idx}>{content}</strong>
    if (node.italic) content = <em>{content}</em>
    if (node.underline) content = <u>{content}</u>
    if (node.code) content = <code className="text-accent-teal-light bg-bg-elevated px-1 py-0.5 rounded text-sm">{content}</code>
    return <span key={idx}>{content}</span>
  }
  return null
}

function renderChildren(children?: SlateNode[]): React.ReactNode {
  if (!children) return null
  return children.map((child, i) => {
    if (child.type) {
      return <BlockNode key={i} node={child} />
    }
    return renderText(child, i)
  })
}

function BlockNode({ node }: { node: SlateNode }) {
  switch (node.type) {
    case "p":
      return <p>{renderChildren(node.children)}</p>
    case "h1":
      return <h1 className="clear-both">{renderChildren(node.children)}</h1>
    case "h2":
      return <h2 className="clear-both">{renderChildren(node.children)}</h2>
    case "h3":
      return <h3 className="clear-both">{renderChildren(node.children)}</h3>
    case "img": {
      // Grid-based positioning (new) or legacy size/align
      if (node.imgSpan !== undefined) {
        const gridStyles = getGridImageStyles(node.imgCol ?? 0, node.imgSpan, node.imgRow, node.imgRowSpan)
        return (
          <figure style={gridStyles}>
            <ImageWithLightbox
              src={node.url ?? ""}
              alt=""
              className="rounded-md w-full h-auto"
            />
          </figure>
        )
      }
      const size = (node.imgSize ?? "100") as ImageSize
      const align = (node.imgAlign ?? "center") as ImageAlign
      const layoutClasses = getImageLayoutClasses(size, align)
      return (
        <figure className={layoutClasses}>
          <ImageWithLightbox
            src={node.url ?? ""}
            alt=""
            className="rounded-md w-full h-auto"
          />
        </figure>
      )
    }
    case "column_group":
      return (
        <div className="grid grid-cols-1 gap-4 my-4 sm:grid-flow-col sm:auto-cols-fr sm:gap-6 sm:my-6">
          {renderChildren(node.children)}
        </div>
      )
    case "column": {
      const width = node.width
      return (
        <div style={width ? { width } : undefined}>
          {renderChildren(node.children)}
        </div>
      )
    }
    default:
      return <div>{renderChildren(node.children)}</div>
  }
}

interface ChapterBlocksRendererProps {
  blocks: Record<string, unknown>[]
}

export function ChapterBlocksRenderer({ blocks }: ChapterBlocksRendererProps) {
  return (
    <article className="prose prose-invert max-w-none overflow-hidden prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-accent-blue-mid prose-strong:text-text-primary prose-code:text-accent-teal-light">
      {(blocks as unknown as SlateNode[]).map((node, i) => (
        <BlockNode key={i} node={node} />
      ))}
    </article>
  )
}
