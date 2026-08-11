import { cn } from "@/lib/utils"

/**
 * Renders organizer-authored welcome / success copy (docs/ux/01 §7 — the
 * welcome screen is CMS-driven rich text with headings, lists and links).
 *
 * Two input shapes are supported because both exist in the data: HTML from the
 * form builder's rich-text editor, and plain text with blank-line paragraphs
 * from seeded/imported content. HTML is sanitised to a small allowlist before
 * it is rendered — this is a public page and the content crosses a tenant
 * boundary.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "code",
  "pre",
  "span",
  "div",
])

const VOID_TAGS = new Set(["br", "hr"])

const DANGEROUS_BLOCK =
  /<(script|style|iframe|object|embed|template)\b[\s\S]*?<\/\1\s*>/gi
const DANGEROUS_TAG =
  /<\/?(script|style|iframe|object|embed|link|meta|template|form|input|button)\b[^>]*>/gi

function sanitizeHref(raw: string): string | null {
  const href = raw.trim()
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return href
  return null
}

/** Strip everything outside a conservative allowlist of tags and attributes. */
export function sanitizeRichText(input: string): string {
  let html = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DANGEROUS_BLOCK, "")
    .replace(DANGEROUS_TAG, "")

  html = html.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s[^<>]*)?)\/?>/g,
    (_match, closing: string, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) return ""
      if (closing === "/") return `</${tag}>`
      if (VOID_TAGS.has(tag)) return `<${tag} />`
      if (tag !== "a") return `<${tag}>`

      const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(rawAttrs)
      const href = sanitizeHref(hrefMatch?.[2] ?? hrefMatch?.[3] ?? "")
      // An unsafe or missing href degrades to a plain, inert anchor rather
      // than a different tag, so the closing `</a>` still balances.
      if (!href) return "<a>"
      return `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">`
    },
  )

  return html
}

const PROSE_CLASS = cn(
  "space-y-3 text-sm leading-relaxed text-foreground/80",
  "[&_h1]:font-heading [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-foreground",
  "[&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground",
  "[&_h3]:font-heading [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-foreground",
  "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
  "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]",
  "[&_hr]:my-4 [&_hr]:border-border",
)

export interface RichTextProps {
  content?: string | null
  className?: string
}

export function RichText({ content, className }: RichTextProps) {
  if (!content || content.trim() === "") return null

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(content)

  if (looksLikeHtml) {
    return (
      <div
        data-slot="rich-text"
        className={cn(PROSE_CLASS, className)}
        // Sanitised above; the allowlist drops scripts, handlers and URLs.
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
      />
    )
  }

  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <div data-slot="rich-text" className={cn(PROSE_CLASS, className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph.split(/\n/).map((line, lineIndex, lines) => (
            <span key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}
