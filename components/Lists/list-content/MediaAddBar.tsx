"use client"

import { useRef, useState, type DragEvent, type ReactNode } from "react"
import type { MediaDraft } from "./types"

/**
 * Add bar + drop target shared by the Photo and Document galleries. Type a
 * description, choose files, or both; dropping files anywhere adds them at once.
 */
export function MediaAddWrap({
  noun,
  accept,
  onAddMedia,
  children,
}: {
  noun: string
  accept: string
  onAddMedia?: (drafts: MediaDraft[]) => void | Promise<void>
  children: ReactNode
}) {
  const [text, setText] = useState("")
  const [staged, setStaged] = useState<File[]>([])
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const run = async (drafts: MediaDraft[]) => {
    if (!onAddMedia || drafts.length === 0) return
    setBusy(true)
    try {
      await onAddMedia(drafts)
    } finally {
      setBusy(false)
    }
  }
  const commit = async () => {
    const title = text.trim()
    if (!title && staged.length === 0) return
    // One description + several files: the description names the first file only.
    const drafts: MediaDraft[] = staged.length
      ? staged.map((file, i) => ({ file, title: i === 0 ? title || undefined : undefined }))
      : [{ title }]
    setText("")
    setStaged([])
    await run(drafts)
  }
  const onDrop = (e: DragEvent) => {
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length === 0) return
    e.preventDefault()
    setOver(false)
    void run(files.map((file) => ({ file })))
  }

  if (!onAddMedia) return <>{children}</>
  return (
    <div
      className={`fm-media${over ? " is-over" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={onDrop}
    >
      <div className="fm-media-bar">
        <input
          className="fm-media-text"
          value={text}
          placeholder={`Describe the ${noun}, or choose a file first…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void commit()}
        />
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={(e) => {
            setStaged((s) => [...s, ...Array.from(e.target.files ?? [])])
            e.target.value = ""
          }}
        />
        <button type="button" className="fm-btn fm-btn-sm" onClick={() => input.current?.click()}>
          Choose file…
        </button>
        <button
          type="button"
          className="fm-btn fm-btn-sm"
          disabled={busy || (!text.trim() && staged.length === 0)}
          onClick={() => void commit()}
        >
          {busy ? "Adding…" : `Add ${noun}`}
        </button>
        {staged.length > 0 && (
          <span className="fm-media-staged">
            {staged.map((f) => f.name).join(", ")}{" "}
            <button type="button" className="fm-media-clear" aria-label="Clear chosen files" onClick={() => setStaged([])}>
              ×
            </button>
          </span>
        )}
      </div>
      {children}
      {over && <div className="fm-media-drop">Drop to add {noun}s</div>}
    </div>
  )
}
