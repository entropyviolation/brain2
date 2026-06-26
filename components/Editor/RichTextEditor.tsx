/**
 * components/Editor/RichTextEditor.tsx — Dependency-light markdown editor
 *
 * A small, self-contained rich-text editor for document-type items (Feature 4,
 * Worker D). It stores plain **markdown** (so the value is portable and diffable)
 * and offers a live HTML preview rendered by the safe in-house `renderMarkdown`
 * (no third-party markdown/editor deps). A Win95-skinned toolbar applies
 * selection-aware transforms (bold/italic/code/headings/lists/quote/link) via the
 * pure helpers in `./markdown`, and an Edit / Split / Preview switch controls the
 * layout. Styling lives in `./editor.css` (scoped under `.rte`).
 *
 * Controlled component: pass `value` (markdown) and `onChange`. It keeps no
 * persisted state of its own — the host (`BodyPanel`) owns reads/writes.
 */
"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  Bold,
  Italic,
  Code,
  Heading,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Eye,
  Pencil,
  Columns2,
} from "lucide-react"
import {
  renderMarkdown,
  applyInlineWrap,
  applyLinePrefix,
  applyInsert,
  type EditResult,
} from "./markdown"
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
}

const WORDS = /\S+/g

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write in markdown… **bold**, *italic*, # headings, - lists",
  readOnly = false,
  onBlur,
  defaultView = "edit",
}: RichTextEditorProps) {
  const [view, setView] = useState<ViewMode>(defaultView)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const html = useMemo(() => renderMarkdown(value), [value])
  const wordCount = useMemo(() => (value.match(WORDS) ?? []).length, [value])

  /** Apply a pure transform to the current selection, then restore focus/caret. */
  const transform = useCallback(
    (fn: (text: string, start: number, end: number) => EditResult) => {
      const el = textareaRef.current
      if (!el || readOnly) return
      const { value: text, selectionStart, selectionEnd } = el
      const result = fn(text, selectionStart, selectionEnd)
      onChange(result.text)
      // Restore selection after React re-renders the controlled value.
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

  const showEdit = view === "edit" || view === "split"
  const showPreview = view === "preview" || view === "split"

  return (
    <div className="rte" data-no95>
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
            <div className="rte-preview" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="rte-preview rte-preview-empty">Nothing to preview yet.</div>
          )
        )}
      </div>

      <div className="rte-statusbar">
        <span>Markdown</span>
        <span>
          {wordCount} {wordCount === 1 ? "word" : "words"} · {value.length} chars
        </span>
      </div>
    </div>
  )
}
