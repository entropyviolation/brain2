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
 * On desktop a file or folder can be **linked** instead: the item keeps its
 * path, not its bytes (`lib/resource-links.ts`, `docs/RESOURCE_LINKS.md`). The
 * tray's Auto / Copy / Link switch decides for drops and Attach files; Auto
 * links folders and files of 50 MB or more. When the tab opens, each link is
 * checked and a moved file is followed. A repaired path goes through the
 * draft; Missing is shown only.
 *
 * Each resource is a card: an image shows itself; other kinds show an
 * engraved kind plate. Selecting a card opens it in the viewer well below
 * (image, PDF, audio, video, or text), with Open and Download keys.
 *
 * Removing a resource takes it off the item draft. The stored bytes are kept
 * so Discard can bring it back.
 *
 * A web link is the same record with `url` set (`webLinkResource`). `useNote`
 * is what the resource is for on this item — the operation Resources tab
 * writes that same field.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Button } from "@/components/ui/button"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Download, ExternalLink, FolderOpen, Link2, Paperclip, Search, Trash2 } from "lucide-react"
import type { ItemResource } from "@/lib/types"
import { fileToFileValue } from "@/components/Lists/attributes/helpers"
import { enrichWithText, useFileHref } from "@/components/Lists/attributes/AttributeValueField"
import { formatBytes, isWebLinkResource, resourceKind, RESOURCE_KIND_LABEL, toResource, type ResourceKind } from "@/lib/item-resources"
import {
  displayPath,
  getFileLinkBridge,
  isLinkedResource,
  linkedResource,
  relinkResource,
  resolutionMoved,
  resourceBytesSplit,
  shouldLink,
  type AttachMode,
  type FileLinkBridge,
  type LinkStat,
  type LinkStatus,
} from "@/lib/resource-links"
import { noteDayLabel, localDayIso } from "@/lib/item-notes"

export interface ItemResourcesPanelProps {
  resources: ItemResource[] | undefined
  onChange: (resources: ItemResource[] | undefined) => void
}

const ATTACH_MODES: { mode: AttachMode; label: string; hint: string }[] = [
  { mode: "auto", label: "Auto", hint: "Link folders and files of 50 MB or more. Copy the rest." },
  { mode: "copy", label: "Copy", hint: "Store a copy inside Brain2. Works on every device and in backups." },
  { mode: "link", label: "Link", hint: "Keep the file where it is. No copy. Opens on this computer only." },
]

function revealLabel(): string {
  const platform = (window as unknown as { desktop?: { platform?: string } }).desktop?.platform
  return platform === "darwin" ? "Show in Finder" : "Show in folder"
}

/** `brain2-link://` URL for a linked file's preview. "" while loading or when it cannot preview. */
function useLinkPreview(resource: ItemResource, enabled: boolean): string {
  const [href, setHref] = useState("")
  const p = resource.link?.path ?? ""
  useEffect(() => {
    const bridge = getFileLinkBridge()
    if (!enabled || !bridge || !p) {
      setHref("")
      return
    }
    let live = true
    void bridge
      .previewUrl(p)
      .then((url) => {
        if (live) setHref(url || "")
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [p, enabled])
  return href
}

function LinkBadge({ status }: { status: LinkStatus | undefined }) {
  const missing = status === "missing"
  return (
    <span className="id-res-link" data-state={missing ? "missing" : "linked"} title={missing ? "Not found on disk" : "Linked, not copied"}>
      {missing ? "Missing" : "Linked"}
    </span>
  )
}

function ResourceCard({
  resource,
  selected,
  status,
  onSelect,
}: {
  resource: ItemResource
  selected: boolean
  status: LinkStatus | undefined
  onSelect: () => void
}) {
  const kind = resourceKind(resource)
  const linked = isLinkedResource(resource)
  const stored = useFileHref(kind === "image" && !linked ? resource.uri : "")
  const preview = useLinkPreview(resource, linked && kind === "image" && status !== "missing")
  const href = linked ? preview : stored
  return (
    <button
      type="button"
      className="id-res-card"
      aria-pressed={selected}
      onClick={onSelect}
      title={resource.caption || resource.link?.path || resource.name}
      data-testid="resource-card"
      data-linked={linked || undefined}
    >
      <span className="id-res-face" data-kind={kind}>
        {kind === "image" && href ? <img src={href} alt="" /> : <span className="id-res-plate">{RESOURCE_KIND_LABEL[kind]}</span>}
        {linked && <LinkBadge status={status} />}
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

function PreviewGlass({
  kind,
  href,
  resource,
  noPreview = "No preview for this kind of file. Open or Download it.",
}: {
  kind: ResourceKind
  href: string
  resource: ItemResource
  noPreview?: string
}) {
  if (!href) return <p className="id-res-glass-note">Loading…</p>
  if (kind === "image") return <img src={href} alt={resource.caption || resource.name} />
  if (kind === "pdf") return <iframe src={href} title={resource.name} />
  if (kind === "audio") return <audio src={href} controls />
  if (kind === "video") return <video src={href} controls />
  if (kind === "text") return <TextPreview href={href} />
  return <p className="id-res-glass-note">{noPreview}</p>
}

const PREVIEW_KINDS = new Set<ResourceKind>(["image", "pdf", "audio", "video", "text"])

function CaptionField({ resource, onCaption }: { resource: ItemResource; onCaption: (caption: string) => void }) {
  return (
    <IsolatedInput
      value={resource.caption ?? ""}
      onCommit={onCaption}
      placeholder="Caption: what this file is for"
      aria-label="Caption"
      className="h-8"
    />
  )
}

function UseNoteField({ resource, onUseNote }: { resource: ItemResource; onUseNote: (note: string) => void }) {
  return (
    <IsolatedInput
      value={resource.useNote ?? ""}
      onCommit={onUseNote}
      placeholder="What this is for here"
      aria-label="What this is for here"
      className="h-8"
    />
  )
}

function StoredViewer({
  resource,
  onCaption,
  onUseNote,
  onRemove,
}: {
  resource: ItemResource
  onCaption: (caption: string) => void
  onUseNote: (note: string) => void
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
      <CaptionField resource={resource} onCaption={onCaption} />
      <UseNoteField resource={resource} onUseNote={onUseNote} />
      <div className="id-res-glass" data-kind={kind}>
        <PreviewGlass kind={kind} href={href} resource={resource} />
      </div>
      {kind === "pdf" && <p className="id-note-hint">A blank well means this window has no PDF viewer. Open shows it in a tab.</p>}
    </div>
  )
}

function LinkedViewer({
  resource,
  status,
  bridge,
  onCaption,
  onUseNote,
  onRemove,
  onLocate,
}: {
  resource: ItemResource
  status: LinkStatus | undefined
  bridge: FileLinkBridge | undefined
  onCaption: (caption: string) => void
  onUseNote: (note: string) => void
  onRemove: () => void
  onLocate: () => void
}) {
  const kind = resourceKind(resource)
  const link = resource.link
  const missing = status === "missing"
  const canPreview = !!bridge && !missing && PREVIEW_KINDS.has(kind)
  const href = useLinkPreview(resource, canPreview)
  const [openError, setOpenError] = useState<string | null>(null)
  const open = async () => {
    if (!bridge || !link) return
    setOpenError(null)
    const err = await bridge.open(link.path).catch(() => "Could not open it.")
    if (err) setOpenError(err)
  }
  const listing = kind === "folder" ? (resource.extractedText ?? "").split("\n").slice(0, 200).join("\n") : ""
  return (
    <div className="id-res-viewer" aria-label={`Viewing ${resource.name}`}>
      <div className="id-res-viewer-head">
        <span className="attr-file-kind" data-kind={kind}>
          {RESOURCE_KIND_LABEL[kind]}
        </span>
        <span className="id-res-viewer-name">{resource.name}</span>
        <LinkBadge status={status} />
        {formatBytes(resource.size) && <span className="attr-file-size">{formatBytes(resource.size)}</span>}
        {resource.extractedText && <span className="attr-file-text">✓ searchable</span>}
        <span className="id-res-viewer-keys">
          {bridge && !missing && (
            <>
              <button type="button" className="attr-mini-key" onClick={() => void open()}>
                <ExternalLink className="h-3 w-3" /> Open
              </button>
              <button type="button" className="attr-mini-key" onClick={() => link && bridge.reveal(link.path)}>
                <FolderOpen className="h-3 w-3" /> {revealLabel()}
              </button>
            </>
          )}
          {bridge && (
            <button type="button" className="attr-mini-key" onClick={onLocate} data-testid="resource-locate">
              <Search className="h-3 w-3" /> Locate…
            </button>
          )}
          <button type="button" className="attr-mini-key id-res-remove" onClick={onRemove} aria-label={`Remove ${resource.name}`}>
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </span>
      </div>
      {link && (
        <p className="id-res-path" title={link.path} data-testid="resource-path">
          {displayPath(link.path)}
        </p>
      )}
      {openError && <p className="text-xs text-destructive">{openError}</p>}
      <CaptionField resource={resource} onCaption={onCaption} />
      <UseNoteField resource={resource} onUseNote={onUseNote} />
      <div className="id-res-glass" data-kind={kind}>
        {!bridge ? (
          <p className="id-res-glass-note">Linked on another computer. It is not copied here; open it there.</p>
        ) : missing ? (
          <p className="id-res-glass-note">Not found. It was moved to another disk, renamed past finding, or deleted. Locate it, or Remove the link.</p>
        ) : !PREVIEW_KINDS.has(kind) && kind !== "folder" ? (
          <p className="id-res-glass-note">No preview here. Open it in its own app.</p>
        ) : kind === "folder" ? (
          <>
            <p className="id-res-glass-note">
              Folder · {link?.fileCount ?? "?"}
              {link?.truncated ? "+" : ""} files
            </p>
            {listing && <pre className="id-res-text">{listing}</pre>}
          </>
        ) : (
          <PreviewGlass kind={kind} href={href} resource={resource} />
        )}
      </div>
    </div>
  )
}

function WebLinkViewer({
  resource,
  onCaption,
  onUseNote,
  onRemove,
}: {
  resource: ItemResource
  onCaption: (caption: string) => void
  onUseNote: (note: string) => void
  onRemove: () => void
}) {
  return (
    <div className="id-res-viewer" aria-label={`Viewing ${resource.name}`}>
      <div className="id-res-viewer-head">
        <span className="attr-file-kind" data-kind="link">
          {RESOURCE_KIND_LABEL.link}
        </span>
        <span className="id-res-viewer-name">{resource.name}</span>
        <span className="id-res-viewer-keys">
          <a className="attr-mini-key" href={resource.url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3 w-3" /> Open
          </a>
          <button type="button" className="attr-mini-key id-res-remove" onClick={onRemove} aria-label={`Remove ${resource.name}`}>
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </span>
      </div>
      {resource.url && (
        <p className="id-res-path" title={resource.url}>
          {resource.url}
        </p>
      )}
      <CaptionField resource={resource} onCaption={onCaption} />
      <UseNoteField resource={resource} onUseNote={onUseNote} />
    </div>
  )
}

export function ItemResourcesPanel({ resources, onChange }: ItemResourcesPanelProps) {
  const list = useMemo(() => resources ?? [], [resources])
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<AttachMode>("auto")
  const [linkStatus, setLinkStatus] = useState<Record<string, LinkStatus>>({})
  // Read once: the bridge is fixed for the life of the window.
  const [bridge] = useState(getFileLinkBridge)
  // Latest list for async patches (extraction lands after the user may have added more).
  const latest = useRef(list)
  latest.current = list
  const checked = useRef(new Set<string>())

  const selected = list.find((r) => r.id === selectedId) ?? list[0]
  const write = (next: ItemResource[]) => {
    // Async patches can land before the parent re-renders; read this, not the prop.
    latest.current = next
    onChange(next.length ? next : undefined)
  }
  const patch = (id: string, fn: (r: ItemResource) => ItemResource) =>
    write(latest.current.map((r) => (r.id === id ? fn(r) : r)))

  // Check each link once per open tab and follow a moved file.
  useEffect(() => {
    if (!bridge) return
    for (const r of list) {
      if (!r.link || checked.current.has(r.id)) continue
      checked.current.add(r.id)
      void bridge
        .resolve({ ...r.link, size: r.size })
        .then((res) => {
          setLinkStatus((s) => ({ ...s, [r.id]: res.status }))
          if (res.link && resolutionMoved(r, res)) patch(r.id, (cur) => relinkResource(cur, res.link!))
        })
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, bridge])

  const extractLinked = (added: ItemResource[]) => {
    if (!bridge) return
    for (const r of added) {
      if (!r.link) continue
      void bridge
        .extractText(r.link.path)
        .then((text) => {
          if (text) patch(r.id, (cur) => ({ ...cur, extractedText: text }))
        })
        .catch(() => undefined)
    }
  }

  const add = (added: ItemResource[]) => {
    if (added.length === 0) return
    for (const r of added) if (r.link) checked.current.add(r.id)
    setLinkStatus((s) => ({ ...s, ...Object.fromEntries(added.filter((r) => r.link).map((r) => [r.id, "ok" as const])) }))
    write([...latest.current, ...added])
    setSelectedId(added[added.length - 1].id)
    extractLinked(added)
    const copies = added.filter((r) => !r.link)
    if (copies.length === 0) return
    void enrichWithText(copies).then((enriched) => {
      const byId = new Map(enriched.filter((f) => f.extractedText).map((f) => [f.id, f.extractedText]))
      if (byId.size === 0) return
      write(latest.current.map((r) => (byId.has(r.id) ? { ...r, extractedText: byId.get(r.id) } : r)))
    })
  }

  const attach = async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setBusy(true)
    let added: ItemResource[]
    try {
      added = await Promise.all(
        files.map(async (file) => {
          const p = bridge?.pathForFile(file)
          const stat = p ? await bridge!.stat(p).catch(() => null) : null
          if (stat && shouldLink(mode, stat)) return linkedResource(stat)
          return toResource(await fileToFileValue(file))
        }),
      )
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : "Could not store the file. Storage may be full.")
      return
    }
    setBusy(false)
    add(added)
  }

  const linkPicked = async (folders: boolean) => {
    if (!bridge) return
    setError(null)
    const stats = await bridge.pick({ folders }).catch(() => [] as LinkStat[])
    add(stats.map((s) => linkedResource(s)))
  }

  const locate = async (r: ItemResource) => {
    if (!bridge || !r.link) return
    const [stat] = await bridge.pick({ folders: r.link.isDir }).catch(() => [] as LinkStat[])
    if (!stat) return
    setLinkStatus((s) => ({ ...s, [r.id]: "ok" }))
    patch(r.id, (cur) => relinkResource(cur, stat))
    extractLinked([{ ...r, link: { ...r.link, path: stat.path } }])
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

  const { stored, linked } = resourceBytesSplit(list)
  const modeHint = ATTACH_MODES.find((m) => m.mode === mode)?.hint

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
          <strong>{dragging ? "Release to attach" : bridge ? "Drop files or folders here" : "Drop files here"}</strong>
          <span>{bridge ? modeHint : "PDFs, pictures, recordings, anything. Stored on this device with the item."}</span>
        </div>
        {bridge && (
          <div className="id-res-mode" role="radiogroup" aria-label="How to attach">
            {ATTACH_MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={mode === m.mode}
                title={m.hint}
                onClick={() => setMode(m.mode)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        <Button type="button" className="id-btn id-btn-primary" onClick={pick} disabled={busy}>
          <Paperclip className="h-4 w-4" />
          {busy ? "Attaching…" : "Attach files"}
        </Button>
        {bridge && (
          <Button type="button" className="id-btn" onClick={() => void linkPicked(true)} disabled={busy}>
            <Link2 className="h-4 w-4" />
            Link folder
          </Button>
        )}
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
            {stored > 0 && <span>{formatBytes(stored)} stored</span>}
            {linked > 0 && <span>{formatBytes(linked)} linked</span>}
          </div>
          <div className="id-res-grid">
            {list.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                selected={selected?.id === r.id}
                status={linkStatus[r.id]}
                onSelect={() => setSelectedId(r.id)}
              />
            ))}
          </div>
          {selected &&
            (() => {
              const onCaption = (caption: string) =>
                write(list.map((r) => (r.id === selected.id ? { ...r, caption: caption.trim() || undefined } : r)))
              const onUseNote = (useNote: string) =>
                write(list.map((r) => (r.id === selected.id ? { ...r, useNote: useNote.trim() || undefined } : r)))
              const onRemove = () => {
                const next = list.filter((r) => r.id !== selected.id)
                write(next)
                setSelectedId(next[0]?.id ?? null)
              }
              if (isWebLinkResource(selected)) {
                return (
                  <WebLinkViewer
                    key={selected.id}
                    resource={selected}
                    onCaption={onCaption}
                    onUseNote={onUseNote}
                    onRemove={onRemove}
                  />
                )
              }
              return isLinkedResource(selected) ? (
                <LinkedViewer
                  key={selected.id}
                  resource={selected}
                  status={linkStatus[selected.id]}
                  bridge={bridge}
                  onCaption={onCaption}
                  onUseNote={onUseNote}
                  onRemove={onRemove}
                  onLocate={() => void locate(selected)}
                />
              ) : (
                <StoredViewer
                  key={selected.id}
                  resource={selected}
                  onCaption={onCaption}
                  onUseNote={onUseNote}
                  onRemove={onRemove}
                />
              )
            })()}
        </>
      )}
    </section>
  )
}
