/**
 * components/Editor/RichTextEditor.tsx — Dependency-light markdown editor
 *
 * A self-contained rich-text editor for document-type items. Stores plain
 * **markdown** (portable + diffable) with a live HTML preview via the safe
 * in-house `renderMarkdown`. Win95-skinned toolbar applies selection-aware
 * transforms (bold/italic/code/headings/lists/quote/link/image/embed/font)
 * via `./markdown`. Styling lives in `./editor.css` (scoped under `.rte`).
 *
 * Controlled: pass `value` (markdown) and `onChange`. Optional `documentFont`
 * sets the default Google Font for the edit/preview panes.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bold,
  Italic,
  Code,
  Heading,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Film,
  Eye,
  Pencil,
  Columns2,
  Type,
} from "lucide-react"
import {
  renderMarkdown,
  applyInlineWrap,
  applyLinePrefix,
  applyInsert,
  type EditResult,
} from "./markdown"
import {
  GOOGLE_FONTS,
  ensureGoogleFontsLoaded,
  extractFontMarkers,
  fontFamilyCss,
  isAllowedFont,
} from "@/lib/google-fonts"
import "./editor.css"

type ViewMode = "edit" | "split" | "preview"

interface RichTextEditorProps {
  /** Current markdown source. */
  value: string
  /** Called with the new markdown whenever the document changes. */
  onChange: (markdown: string) => void
  placeholder?: string
  readOnly?: boolean
  /** Persist hint (e.g. flush a debounce) when the textarea loses focus. */
  onBlur?: () => void
  /** Initial layout. Defaults to "edit". */
  defaultView?: ViewMode
  /** Document-level Google Font (Docs tab). */
  documentFont?: string
  /** Called when the user picks a different document font. */
  onDocumentFontChange?: (font: string) => void
  /** Show the extended Docs toolbar (fonts / image / embed). Defaults to false. */
  docsMode?: boolean
  /** Extra class on the root `.rte` element. */
  className?: string
}

const WORDS = /\S+/g

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write in markdown… **bold**, *italic*, # headings, - lists",
  readOnly = false,
  onBlur,
  defaultView = "edit",
  documentFont,
  onDocumentFontChange,
  docsMode = false,
  className,
}: RichTextEditorProps) {
  const [view, setView] = useState<ViewMode>(defaultView)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const html = useMemo(() => renderMarkdown(value), [value])
  const wordCount = useMemo(() => (value.match(WORDS) ?? []).length, [value])

  // Preload document font + any inline {font:…} markers used in the body.
  useEffect(() => {
    const families = [
      ...(isAllowedFont(documentFont) ? [documentFont] : []),
      ...extractFontMarkers(value),
    ]
    ensureGoogleFontsLoaded(families)
  }, [documentFont, value])

  const paneStyle = useMemo(
    () => ({ fontFamily: fontFamilyCss(documentFont) }),
    [documentFont],
  )

  /** Apply a pure transform to the current selection, then restore focus/caret. */
  const transform = useCallback(
    (fn: (text: string, start: number, end: number) => EditResult) => {
      const el = textareaRef.current
      if (!el || readOnly) return
      const { value: text, selectionStart, selectionEnd } = el
      const result = fn(text, selectionStart, selectionEnd)
      onChange(result.text)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(result.selectionStart, result.selectionEnd)
      })
    },
    [onChange, readOnly],
  )

  const wrap = (marker: string) => () => transform((t, s, e) => applyInlineWrap(t, s, e, marker))
  const prefix = (p: string) => () => transform((t, s, e) => applyLinePrefix(t, s, e, p))
  const insertLink = () =>
    transform((t, s, e) => {
      const label = t.slice(s, e) || "link text"
      return applyInsert(t, s, e, `[${label}](https://)`)
    })
  const insertImage = () =>
    transform((t, s, e) => {
      const alt = t.slice(s, e) || "image"
      return applyInsert(t, s, e, `![${alt}](https://)`)
    })
  const insertEmbed = () =>
    transform((t, s, e) => {
      const title = t.slice(s, e) || "Embedded link"
      return applyInsert(t, s, e, `@[${title}](https://)`)
    })
  const wrapFont = (font: string) => {
    if (!isAllowedFont(font)) return
    transform((t, s, e) => {
      const selected = t.slice(s, e) || "text"
      return applyInsert(t, s, e, `{font:${font}}${selected}{/font}`)
    })
  }

  const showEdit = view === "edit" || view === "split"
  const showPreview = view === "preview" || view === "split"

  return (
    <div className={`rte${className ? ` ${className}` : ""}`} data-no95>
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" className="rte-tool rte-tool-strong" title="Bold (Ctrl+B)" onClick={wrap("**")} disabled={readOnly}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rte-tool rte-tool-em" title="Italic (Ctrl+I)" onClick={wrap("*")} disabled={readOnly}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rte-tool" title="Inline code" onClick={wrap("`")} disabled={readOnly}>
          <Code className="h-3.5 w-3.5" />
        </button>
        <span className="rte-toolbar-sep" aria-hidden />
        <button type="button" className="rte-tool" title="Heading" onClick={prefix("# ")} disabled={readOnly}>
          <Heading className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rte-tool" title="Bulleted list" onClick={prefix("- ")} disabled={readOnly}>
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rte-tool" title="Numbered list" onClick={prefix("1. ")} disabled={readOnly}>
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rte-tool" title="Quote" onClick={prefix("> ")} disabled={readOnly}>
          <Quote className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rte-tool" title="Link" onClick={insertLink} disabled={readOnly}>
          <LinkIcon className="h-3.5 w-3.5" />
        </button>

        {docsMode && (
          <>
            <button type="button" className="rte-tool" title="Image" onClick={insertImage} disabled={readOnly}>
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="rte-tool" title="Embed link / video" onClick={insertEmbed} disabled={readOnly}>
              <Film className="h-3.5 w-3.5" />
            </button>
            <span className="rte-toolbar-sep" aria-hidden />
            <label className="rte-font-picker" title="Document font (Google Fonts)">
              <Type className="h-3.5 w-3.5" aria-hidden />
              <select
                className="rte-select"
                value={isAllowedFont(documentFont) ? documentFont : "Arial"}
                disabled={readOnly || !onDocumentFontChange}
                onChange={(e) => onDocumentFontChange?.(e.target.value)}
                aria-label="Document font"
              >
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="rte-font-picker" title="Wrap selection in a Google Font">
              <select
                className="rte-select"
                defaultValue=""
                disabled={readOnly}
                onChange={(e) => {
                  const font = e.target.value
                  e.target.value = ""
                  if (font) wrapFont(font)
                }}
                aria-label="Apply font to selection"
              >
                <option value="">Span font…</option>
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <span className="rte-toolbar-spacer" aria-hidden />

        <button
          type="button"
          className="rte-tool"
          title="Edit"
          aria-pressed={view === "edit"}
          onClick={() => setView("edit")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rte-tool"
          title="Split view"
          aria-pressed={view === "split"}
          onClick={() => setView("split")}
        >
          <Columns2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rte-tool"
          title="Preview"
          aria-pressed={view === "preview"}
          onClick={() => setView("preview")}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={`rte-body${view === "split" ? " is-split" : ""}`}>
        {showEdit && (
          <textarea
            ref={textareaRef}
            className="rte-textarea"
            style={paneStyle}
            value={value}
            placeholder={placeholder}
            readOnly={readOnly}
            spellCheck
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (!(e.metaKey || e.ctrlKey)) return
              const key = e.key.toLowerCase()
              if (key === "b") {
                e.preventDefault()
                wrap("**")()
              } else if (key === "i") {
                e.preventDefault()
                wrap("*")()
              }
            }}
          />
        )}
        {view === "split" && <div className="rte-split-divider" aria-hidden />}
        {showPreview && (
          html ? (
            <div className="rte-preview" style={paneStyle} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="rte-preview rte-preview-empty" style={paneStyle}>
              Nothing to preview yet.
            </div>
          )
        )}
      </div>

      <div className="rte-statusbar">
        <span>{docsMode ? "Brainclip Docs · Markdown" : "Markdown"}</span>
        <span>
          {wordCount} {wordCount === 1 ? "word" : "words"} · {value.length} chars
        </span>
      </div>
    </div>
  )
}
