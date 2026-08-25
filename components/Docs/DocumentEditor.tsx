/**
 * components/Docs/DocumentEditor.tsx — Notion/Google-Docs–style WYSIWYG surface
 *
 * Single viewing pane (no markdown split). Highlight text → change font / size
 * like Google Docs. Hyperlinks: click to open, right-click to edit, Ctrl/Cmd+K
 * dialog, paste URL onto selection, type URL + space to auto-link. Cmd/Ctrl+V
 * pastes plain text (no rich formatting), like Google Sheets.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  FileUp,
  Type,
  Quote,
  RemoveFormatting,
} from "lucide-react"
import {
  GOOGLE_FONTS,
  ensureGoogleFontsLoaded,
  fontFamilyCss,
  isAllowedFont,
} from "@/lib/google-fonts"
import {
  DOC_FONT_SIZES,
  applyFontToNearestHeading,
  applyInlineStyleToSelection,
  bodyToEditorHtml,
  escapeHtmlText,
  htmlWordCount,
  sanitizeDocHtml,
  selectionBlockTag,
} from "@/lib/doc-html"
import { pdfArrayBufferToHtml } from "@/lib/pdf-to-html"
import {
  closestAnchor,
  isPlainUrl,
  linkifyPlainText,
  normalizeHref,
  trailingUrlToLink,
  urlOnlyToAnchorHtml,
  wordBeforeCaret,
} from "@/lib/doc-links"
import { LinkDialog, type LinkDialogValues } from "@/components/Docs/LinkDialog"
import { resizeImageForDoc } from "@/lib/image-resize"
import "./document-editor.css"

interface DocumentEditorProps {
  /** Document HTML (or legacy markdown — converted on load). */
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
  readOnly?: boolean
  placeholder?: string
  /** Default body font for the whole page (selection overrides locally). */
  documentFont?: string
  onDocumentFontChange?: (font: string) => void
  /** Remount key when switching documents. */
  docId?: string
}

export function DocumentEditor({
  value,
  onChange,
  onBlur,
  readOnly = false,
  placeholder = "Start writing…",
  documentFont,
  onDocumentFontChange,
  docId,
}: DocumentEditorProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const lastEmitted = useRef<string>("")
  const [selFont, setSelFont] = useState(documentFont && isAllowedFont(documentFont) ? documentFont : "Merriweather")
  const [selSize, setSelSize] = useState("16")
  const [headingFont, setHeadingFont] = useState("Playfair Display")
  const [blockTag, setBlockTag] = useState<string | null>("p")
  const [busy, setBusy] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInitial, setLinkInitial] = useState<LinkDialogValues>({ text: "", url: "" })
  const [linkEditing, setLinkEditing] = useState(false)
  const savedRange = useRef<Range | null>(null)
  const editingAnchor = useRef<HTMLAnchorElement | null>(null)

  // Load document into the surface when docId / external value changes.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const html = bodyToEditorHtml(value)
    if (html === lastEmitted.current && el.innerHTML === html) return
    // Don't clobber while the user is typing the same doc unless value is external.
    if (document.activeElement === el && lastEmitted.current && value === lastEmitted.current) return
    el.innerHTML = html
    lastEmitted.current = html
    setWordCount(htmlWordCount(html))
  }, [docId]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only remount on doc switch

  // When parent flushes a different body while not focused, sync.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    if (document.activeElement === el) return
    const html = bodyToEditorHtml(value)
    if (html !== el.innerHTML) {
      el.innerHTML = html
      lastEmitted.current = html
      setWordCount(htmlWordCount(html))
    }
  }, [value])

  useEffect(() => {
    const fonts = [
      ...(isAllowedFont(documentFont) ? [documentFont] : []),
      ...(isAllowedFont(selFont) ? [selFont] : []),
      ...(isAllowedFont(headingFont) ? [headingFont] : []),
      ...GOOGLE_FONTS.slice(0, 12),
    ]
    ensureGoogleFontsLoaded(fonts)
  }, [documentFont, selFont, headingFont])

  const emit = useCallback(() => {
    const el = surfaceRef.current
    if (!el) return
    const html = sanitizeDocHtml(el.innerHTML)
    lastEmitted.current = html
    setWordCount(htmlWordCount(html))
    onChange(html)
  }, [onChange])

  const runCommand = (command: string, valueArg?: string) => {
    if (readOnly) return
    surfaceRef.current?.focus()
    document.execCommand(command, false, valueArg)
    emit()
    setBlockTag(selectionBlockTag())
  }

  const applySelectionFont = (font: string) => {
    if (!isAllowedFont(font) || readOnly) return
    setSelFont(font)
    ensureGoogleFontsLoaded([font])
    surfaceRef.current?.focus()
    applyInlineStyleToSelection({ fontFamily: `"${font}", sans-serif` })
    emit()
  }

  const applySelectionSize = (px: string) => {
    if (readOnly) return
    setSelSize(px)
    surfaceRef.current?.focus()
    applyInlineStyleToSelection({ fontSize: `${px}px` })
    emit()
  }

  const applyHeading = (tag: "h1" | "h2" | "h3" | "p") => {
    runCommand("formatBlock", tag)
    if (tag !== "p" && isAllowedFont(headingFont)) {
      applyFontToNearestHeading(headingFont)
      emit()
    }
  }

  const applyHeadingFont = (font: string) => {
    if (!isAllowedFont(font) || readOnly) return
    setHeadingFont(font)
    ensureGoogleFontsLoaded([font])
    surfaceRef.current?.focus()
    applyFontToNearestHeading(font)
    emit()
  }

  const saveSelection = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      savedRange.current = null
      return
    }
    const range = sel.getRangeAt(0)
    const root = surfaceRef.current
    if (!root || !root.contains(range.commonAncestorContainer)) {
      savedRange.current = null
      return
    }
    savedRange.current = range.cloneRange()
  }

  const restoreSelection = () => {
    const range = savedRange.current
    const root = surfaceRef.current
    if (!range || !root) return false
    root.focus()
    const sel = window.getSelection()
    if (!sel) return false
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  }

  const openLinkDialog = (opts?: { anchor?: HTMLAnchorElement | null }) => {
    if (readOnly) return
    const root = surfaceRef.current
    if (!root) return
    saveSelection()
    const anchor =
      opts?.anchor ??
      (() => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return null
        return closestAnchor(sel.anchorNode, root)
      })()

    editingAnchor.current = anchor
    setLinkEditing(!!anchor)

    if (anchor) {
      setLinkInitial({
        text: anchor.textContent ?? "",
        url: anchor.getAttribute("href") ?? "",
      })
    } else {
      const sel = window.getSelection()
      const selected = sel && !sel.isCollapsed ? sel.toString() : ""
      const prefillUrl = isPlainUrl(selected) ? normalizeHref(selected.trim()) : "https://"
      setLinkInitial({
        text: isPlainUrl(selected) ? "" : selected,
        url: isPlainUrl(selected) ? prefillUrl : selected && !/\s/.test(selected) && selected.includes(".") ? normalizeHref(selected) : "https://",
      })
    }
    setLinkOpen(true)
  }

  const applyLinkFromDialog = ({ text, href }: { text: string; href: string }) => {
    const root = surfaceRef.current
    if (!root) return
    setLinkOpen(false)

    const existing = editingAnchor.current
    if (existing && root.contains(existing)) {
      existing.setAttribute("href", href)
      existing.setAttribute("target", "_blank")
      existing.setAttribute("rel", "noopener noreferrer")
      if (text && text !== existing.textContent) existing.textContent = text
      editingAnchor.current = null
      emit()
      root.focus()
      return
    }

    restoreSelection()
    const sel = window.getSelection()
    const hasSelection = !!(sel && !sel.isCollapsed && sel.toString().length > 0)

    if (hasSelection) {
      // Link the highlighted text; if dialog text differs, replace then link.
      if (text && sel && text !== sel.toString()) {
        document.execCommand("insertText", false, text)
        // Re-select inserted text
        const r = savedRange.current
        if (r) {
          // After insertText selection collapses at end — select backward by text length
          const after = window.getSelection()
          if (after && after.rangeCount) {
            const end = after.getRangeAt(0)
            end.setStart(end.startContainer, Math.max(0, end.startOffset - text.length))
            after.removeAllRanges()
            after.addRange(end)
          }
        }
      }
      document.execCommand("createLink", false, href)
      // Ensure target/rel on new anchors
      const a = closestAnchor(window.getSelection()?.anchorNode ?? null, root)
      if (a) {
        a.setAttribute("target", "_blank")
        a.setAttribute("rel", "noopener noreferrer")
      }
    } else {
      const html = `<a href="${escapeHtmlText(href)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(text)}</a>`
      document.execCommand("insertHTML", false, html)
    }
    editingAnchor.current = null
    emit()
    root.focus()
  }

  const removeLinkFromDialog = () => {
    const root = surfaceRef.current
    const existing = editingAnchor.current
    setLinkOpen(false)
    if (existing && root?.contains(existing)) {
      const text = existing.textContent ?? ""
      const tn = document.createTextNode(text)
      existing.parentNode?.replaceChild(tn, existing)
      editingAnchor.current = null
      emit()
      root.focus()
      return
    }
    restoreSelection()
    document.execCommand("unlink")
    emit()
  }

  const tryAutoLinkBeforeCaret = (): boolean => {
    const sel = window.getSelection()
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return false
    const range = sel.getRangeAt(0)
    const info = wordBeforeCaret(range)
    if (!info) return false
    const link = trailingUrlToLink(info.word)
    if (!link) return false
    // Don't re-link inside an existing anchor.
    const root = surfaceRef.current
    if (!root || closestAnchor(info.textNode, root)) return false

    const linkRange = document.createRange()
    linkRange.setStart(info.textNode, info.startOffset)
    linkRange.setEnd(info.textNode, info.startOffset + link.coreLength)
    sel.removeAllRanges()
    sel.addRange(linkRange)
    document.execCommand("createLink", false, link.href)
    const a = closestAnchor(sel.anchorNode, root)
    if (a) {
      a.setAttribute("target", "_blank")
      a.setAttribute("rel", "noopener noreferrer")
    }
    // Place caret after the link (and any trailing punct left in the text node).
    const after = document.createRange()
    if (a?.nextSibling) {
      after.setStart(a.nextSibling, 0)
    } else if (a?.parentNode) {
      after.setStartAfter(a)
    }
    after.collapse(true)
    sel.removeAllRanges()
    sel.addRange(after)
    return true
  }

  const insertLink = () => openLinkDialog()

  const onSurfaceInput = () => emit()

  const onSurfaceBlur = () => {
    // Don't flush-blur while the link dialog is open (focus moves there).
    if (linkOpen) return
    emit()
    onBlur?.()
  }

  const onSelectionChange = useCallback(() => {
    const el = surfaceRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
    setBlockTag(selectionBlockTag())
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", onSelectionChange)
    return () => document.removeEventListener("selectionchange", onSelectionChange)
  }, [onSelectionChange])

  const insertImageFile = async (file: File) => {
    if (readOnly) return
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file.")
      return
    }
    setBusy("Resizing image…")
    try {
      const { dataUrl } = await resizeImageForDoc(file, {
        maxEdge: 1920,
        maxBytes: 1.5 * 1024 * 1024,
      })
      if (!dataUrl.startsWith("data:image/")) {
        window.alert("Could not read that image.")
        return
      }
      surfaceRef.current?.focus()
      const alt = file.name.replace(/"/g, "").replace(/\.[^.]+$/, "") || "image"
      document.execCommand(
        "insertHTML",
        false,
        `<img class="docs-img" src="${dataUrl}" alt="${alt}" />`,
      )
      emit()
    } catch (err) {
      console.error(err)
      window.alert("Could not insert that image.")
    } finally {
      setBusy(null)
    }
  }

  const ingestPdfFile = async (file: File) => {
    if (readOnly) return
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      window.alert("Please choose a PDF file.")
      return
    }
    setBusy("Reading PDF…")
    try {
      const buf = await file.arrayBuffer()
      const result = await pdfArrayBufferToHtml(buf)
      const el = surfaceRef.current
      if (!el) return
      const hasContent = (el.textContent ?? "").trim().length > 0
      const header = `<p><strong>From PDF: ${file.name.replace(/</g, "")}</strong></p>`
      if (hasContent) {
        const append = window.confirm(
          `Ingested ${result.pageCount} page(s) (~${result.charCount} characters).\n\nOK = Append to end · Cancel = Replace document`,
        )
        el.innerHTML = sanitizeDocHtml(
          append ? `${el.innerHTML}<hr />${header}${result.html}` : `${header}${result.html}`,
        )
      } else {
        el.innerHTML = sanitizeDocHtml(`${header}${result.html}`)
      }
      emit()
    } catch (err) {
      console.error(err)
      window.alert("Could not read that PDF. It may be encrypted or image-only.")
    } finally {
      setBusy(null)
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) return
    const items = e.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) void insertImageFile(file)
          return
        }
      }
    }

    const plain = e.clipboardData.getData("text/plain")
    // Always paste without rich formatting (Google Sheets–style Cmd/Ctrl+V).
    e.preventDefault()
    if (!plain) return

    const sel = window.getSelection()
    const selected = sel && !sel.isCollapsed ? sel.toString() : ""

    // Paste a URL onto selected text → that text becomes the link.
    if (selected && isPlainUrl(plain)) {
      const href = normalizeHref(plain.trim())
      document.execCommand("createLink", false, href)
      const root = surfaceRef.current
      const a = root ? closestAnchor(window.getSelection()?.anchorNode ?? null, root) : null
      if (a) {
        a.setAttribute("target", "_blank")
        a.setAttribute("rel", "noopener noreferrer")
      }
      emit()
      return
    }

    // Bare URL with no selection → insert as a clickable link.
    if (!selected && isPlainUrl(plain)) {
      const html = urlOnlyToAnchorHtml(plain)
      if (html) {
        document.execCommand("insertHTML", false, html)
        emit()
        return
      }
    }

    // Plain text only: escape + optional URL linkify, never clipboard HTML styles.
    document.execCommand("insertHTML", false, sanitizeDocHtml(linkifyPlainText(plain)))
    emit()
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (readOnly) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    e.preventDefault()
    if (file.type.startsWith("image/")) void insertImageFile(file)
    else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      void ingestPdfFile(file)
    }
  }

  const paneStyle = {
    fontFamily: fontFamilyCss(documentFont),
    fontSize: "16px",
  }

  return (
    <div className="docs-editor" data-no95>
      <div className="docs-editor-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" className="docs-tool" title="Bold" aria-label="Bold" onClick={() => runCommand("bold")} disabled={readOnly}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="docs-tool" title="Italic" onClick={() => runCommand("italic")} disabled={readOnly}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="docs-tool" title="Underline" onClick={() => runCommand("underline")} disabled={readOnly}>
          <Underline className="h-3.5 w-3.5" />
        </button>
        <span className="docs-tool-sep" aria-hidden />

        <button
          type="button"
          className="docs-tool"
          title="Heading 1"
          aria-pressed={blockTag === "h1"}
          onClick={() => applyHeading("h1")}
          disabled={readOnly}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="docs-tool"
          title="Heading 2"
          aria-pressed={blockTag === "h2"}
          onClick={() => applyHeading("h2")}
          disabled={readOnly}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="docs-tool"
          title="Heading 3"
          aria-pressed={blockTag === "h3"}
          onClick={() => applyHeading("h3")}
          disabled={readOnly}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="docs-tool" title="Normal paragraph" onClick={() => applyHeading("p")} disabled={readOnly}>
          <Type className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="docs-tool" title="Quote" onClick={() => runCommand("formatBlock", "blockquote")} disabled={readOnly}>
          <Quote className="h-3.5 w-3.5" />
        </button>

        <span className="docs-tool-sep" aria-hidden />

        <button type="button" className="docs-tool" title="Bulleted list" onClick={() => runCommand("insertUnorderedList")} disabled={readOnly}>
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="docs-tool" title="Numbered list" onClick={() => runCommand("insertOrderedList")} disabled={readOnly}>
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="docs-tool"
          title="Insert link (Ctrl/Cmd+K)"
          onClick={insertLink}
          disabled={readOnly}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>

        <span className="docs-tool-sep" aria-hidden />

        <label className="docs-picker" title="Font for highlighted text">
          <span className="docs-picker-label">Font</span>
          <select
            className="docs-select"
            value={selFont}
            disabled={readOnly}
            onChange={(e) => applySelectionFont(e.target.value)}
            aria-label="Font for selection"
          >
            {GOOGLE_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="docs-picker" title="Size for highlighted text">
          <span className="docs-picker-label">Size</span>
          <select
            className="docs-select docs-select-sm"
            value={selSize}
            disabled={readOnly}
            onChange={(e) => applySelectionSize(e.target.value)}
            aria-label="Text size for selection"
          >
            {DOC_FONT_SIZES.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="docs-picker" title="Font for the current heading">
          <span className="docs-picker-label">H-font</span>
          <select
            className="docs-select"
            value={headingFont}
            disabled={readOnly}
            onChange={(e) => applyHeadingFont(e.target.value)}
            aria-label="Heading font"
          >
            {GOOGLE_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        {onDocumentFontChange && (
          <label className="docs-picker" title="Default font for the whole document">
            <span className="docs-picker-label">Page</span>
            <select
              className="docs-select"
              value={isAllowedFont(documentFont) ? documentFont : "Merriweather"}
              disabled={readOnly}
              onChange={(e) => onDocumentFontChange(e.target.value)}
              aria-label="Document default font"
            >
              {GOOGLE_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className="docs-tool-sep" aria-hidden />

        <button
          type="button"
          className="docs-tool"
          title="Upload image"
          disabled={readOnly}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="docs-tool"
          title="Upload PDF (ingest as editable text)"
          disabled={readOnly || !!busy}
          onClick={() => pdfInputRef.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="docs-tool"
          title="Clear formatting"
          disabled={readOnly}
          onClick={() => runCommand("removeFormat")}
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="docs-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void insertImageFile(f)
            e.target.value = ""
          }}
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="docs-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void ingestPdfFile(f)
          }}
        />
      </div>

      <div
        ref={surfaceRef}
        className="docs-surface"
        style={paneStyle}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Document"
        data-placeholder={placeholder}
        onInput={onSurfaceInput}
        onBlur={onSurfaceBlur}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={(e) => {
          const root = surfaceRef.current
          if (!root) return
          const anchor = closestAnchor(e.target as Node, root)
          if (!anchor) return
          e.preventDefault()
          e.stopPropagation()
          window.open(anchor.href, "_blank", "noopener,noreferrer")
        }}
        onContextMenu={(e) => {
          if (readOnly) return
          const root = surfaceRef.current
          if (!root) return
          const anchor = closestAnchor(e.target as Node, root)
          if (!anchor) return
          e.preventDefault()
          openLinkDialog({ anchor })
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
              if (tryAutoLinkBeforeCaret()) emit()
            }
          }
          if (!(e.metaKey || e.ctrlKey)) return
          const k = e.key.toLowerCase()
          if (k === "b") {
            e.preventDefault()
            runCommand("bold")
          } else if (k === "i") {
            e.preventDefault()
            runCommand("italic")
          } else if (k === "u") {
            e.preventDefault()
            runCommand("underline")
          } else if (k === "k") {
            e.preventDefault()
            openLinkDialog()
          }
        }}
      />

      <LinkDialog
        open={linkOpen}
        initial={linkInitial}
        editing={linkEditing}
        onApply={applyLinkFromDialog}
        onRemove={linkEditing ? removeLinkFromDialog : undefined}
        onClose={() => {
          setLinkOpen(false)
          editingAnchor.current = null
          surfaceRef.current?.focus()
          restoreSelection()
        }}
      />

      <div className="docs-editor-status">
        <span>{busy ?? "Plain paste · click link to open · right-click to edit"}</span>
        <span>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>
    </div>
  )
}
