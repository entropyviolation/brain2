/**
 * components/ItemDetail/ItemResourcesPanel.tsx — Files attached to an item
 *
 * Any file can be attached to any item as a resource: a PDF, a picture, a
 * recording, a spreadsheet, a ticket. Drop files on the tray or use Attach
 * files. Bytes go to the attachments IndexedDB (`lib/attachments.ts`), the item
 * keeps an `ItemResource` (name, kind, size, when, optional caption) in
 * `Task.resources`. Text is extracted in the background where possible so the
 * file is searchable.
 *
 * Each resource is a card: an image shows itself; other kinds show an
 * engraved kind plate. Selecting a card opens it in the viewer well below
 * (image, PDF, audio, video, or text), with Open and Download keys.
 *
 * Removing a resource takes it off the item draft. The stored bytes are kept
 * so Discard can bring it back.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Button } from "@/components/ui/button"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Download, ExternalLink, Paperclip, Trash2 } from "lucide-react"
import type { ItemResource } from "@/lib/types"
import { fileToFileValue } from "@/components/Lists/attributes/helpers"
import { enrichWithText, useFileHref } from "@/components/Lists/attributes/AttributeValueField"
import { formatBytes, resourceKind, RESOURCE_KIND_LABEL, resourcesTotalBytes, toResource } from "@/lib/item-resources"
import { noteDayLabel, localDayIso } from "@/lib/item-notes"

export interface ItemResourcesPanelProps {
  resources: ItemResource[] | undefined
  onChange: (resources: ItemResource[] | undefined) => void
}

function ResourceCard({
  resource,
  selected,
  onSelect,
}: {
  resource: ItemResource
  selected: boolean
  onSelect: () => void
}) {
  const kind = resourceKind(resource)
  const href = useFileHref(kind === "image" ? resource.uri : "")
  return (
    <button
      type="button"
      className="id-res-card"
      aria-pressed={selected}
      onClick={onSelect}
      title={resource.caption || resource.name}
      data-testid="resource-card"
    >
      <span className="id-res-face" data-kind={kind}>
        {kind === "image" && href ? <img src={href} alt="" /> : <span className="id-res-plate">{RESOURCE_KIND_LABEL[kind]}</span>}
      </span>
      <span className="id-res-name">{resource.name}</span>
      <span className="id-res-meta">
        {[formatBytes(resource.size), noteDayLabel(localDayIso(new Date(resource.addedAt)))].filter(Boolean).join(" · ")}
      </span>
    </button>
  )
}

function TextPreview({ href }: { href: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!href) return
    let live = true
    fetch(href)
      .then((r) => r.text())
      .then((t) => {
        if (live) setText(t.slice(0, 20_000))
      })
      .catch(() => {
        if (live) setText(null)
      })
    return () => {
      live = false
    }
  }, [href])
  return <pre className="id-res-text">{text ?? "Loading…"}</pre>
}

function ResourceViewer({
  resource,
  onCaption,
  onRemove,
}: {
  resource: ItemResource
  onCaption: (caption: string) => void
  onRemove: () => void
}) {
  const kind = resourceKind(resource)
  const href = useFileHref(resource.uri)
  return (
    <div className="id-res-viewer" aria-label={`Viewing ${resource.name}`}>
      <div className="id-res-viewer-head">
        <span className="attr-file-kind" data-kind={kind}>
          {RESOURCE_KIND_LABEL[kind]}
        </span>
        <span className="id-res-viewer-name">{resource.name}</span>
        {formatBytes(resource.size) && <span className="attr-file-size">{formatBytes(resource.size)}</span>}
        {resource.extractedText && <span className="attr-file-text">✓ searchable</span>}
        <span className="id-res-viewer-keys">
          <a className="attr-mini-key" href={href || undefined} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3 w-3" /> Open
          </a>
          <a className="attr-mini-key" href={href || undefined} download={resource.name}>
            <Download className="h-3 w-3" /> Download
          </a>
          <button type="button" className="attr-mini-key id-res-remove" onClick={onRemove} aria-label={`Remove ${resource.name}`}>
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </span>
      </div>
      <IsolatedInput
        value={resource.caption ?? ""}
        onCommit={onCaption}
        placeholder="Caption: what this file is for"
        aria-label="Caption"
        className="h-8"
      />
      <div className="id-res-glass" data-kind={kind}>
        {!href ? (
          <p className="id-res-glass-note">Loading…</p>
        ) : kind === "image" ? (
          <img src={href} alt={resource.caption || resource.name} />
        ) : kind === "pdf" ? (
          <iframe src={href} title={resource.name} />
        ) : kind === "audio" ? (
          <audio src={href} controls />
        ) : kind === "video" ? (
          <video src={href} controls />
        ) : kind === "text" ? (
          <TextPreview href={href} />
        ) : (
          <p className="id-res-glass-note">No preview for this kind of file. Open or Download it.</p>
        )}
      </div>
      {kind === "pdf" && <p className="id-note-hint">A blank well means this window has no PDF viewer. Open shows it in a tab.</p>}
    </div>
  )
}

export function ItemResourcesPanel({ resources, onChange }: ItemResourcesPanelProps) {
  const list = useMemo(() => resources ?? [], [resources])
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Latest list for async patches (extraction lands after the user may have added more).
  const latest = useRef(list)
  latest.current = list

  const selected = list.find((r) => r.id === selectedId) ?? list[0]
  const write = (next: ItemResource[]) => onChange(next.length ? next : undefined)

  const attach = async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setBusy(true)
    let added: ItemResource[]
    try {
      added = (await Promise.all(files.map(fileToFileValue))).map((f) => toResource(f))
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : "Could not store the file. Storage may be full.")
      return
    }
    setBusy(false)
    write([...latest.current, ...added])
    setSelectedId(added[added.length - 1].id)
    void enrichWithText(added).then((enriched) => {
      const byId = new Map(enriched.filter((f) => f.extractedText).map((f) => [f.id, f.extractedText]))
      if (byId.size === 0) return
      write(latest.current.map((r) => (byId.has(r.id) ? { ...r, extractedText: byId.get(r.id) } : r)))
    })
  }

  const pick = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.onchange = () => void attach(Array.from(input.files || []))
    input.click()
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    void attach(Array.from(e.dataTransfer.files || []))
  }

  const total = resourcesTotalBytes(list)

  return (
    <section className="id-res" aria-label="Resources">
      <div
        className={`id-res-tray${dragging ? " is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="resource-tray"
      >
        <Paperclip className="h-5 w-5" aria-hidden />
        <div className="id-res-tray-copy">
          <strong>{dragging ? "Release to attach" : "Drop files here"}</strong>
          <span>PDFs, pictures, recordings, anything. Stored on this device with the item.</span>
        </div>
        <Button type="button" className="id-btn id-btn-primary" onClick={pick} disabled={busy}>
          <Paperclip className="h-4 w-4" />
          {busy ? "Attaching…" : "Attach files"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {list.length === 0 ? (
        <p className="id-attrs-empty">No resources yet. A manual, a ticket, a scan, a reference photo: attach it here.</p>
      ) : (
        <>
          <div className="id-res-status">
            <span>
              {list.length} {list.length === 1 ? "file" : "files"}
            </span>
            {total > 0 && <span>{formatBytes(total)}</span>}
          </div>
          <div className="id-res-grid">
            {list.map((r) => (
              <ResourceCard key={r.id} resource={r} selected={selected?.id === r.id} onSelect={() => setSelectedId(r.id)} />
            ))}
          </div>
          {selected && (
            <ResourceViewer
              key={selected.id}
              resource={selected}
              onCaption={(caption) =>
                write(list.map((r) => (r.id === selected.id ? { ...r, caption: caption.trim() || undefined } : r)))
              }
              onRemove={() => {
                const next = list.filter((r) => r.id !== selected.id)
                write(next)
                setSelectedId(next[0]?.id ?? null)
              }}
            />
          )}
        </>
      )}
    </section>
  )
}
