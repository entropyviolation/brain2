/**
 * components/Lists/attributes/AttributeValueField.tsx — Per-type value editors
 *
 * Renders the correct input for a single attribute value based on its type.
 * Each type reads as what it holds:
 *  - list: the list's items, bubbles or lines. A bubble opens that item. A line renames it.
 *    Double-click the list title to open the list.
 *  - string: auto-growing text · multistring: Bubbles (chips, drag to reorder) or Lines;
 *    double-click an entry to edit in a white box that grows with the text; Make Brain2 List builds a list from the lines
 *  - number: unit suffix, −/+ keys for whole numbers · goal: x / y + meter
 *  - boolean: checkbox or rocker with a Yes / No word · selection: keys or chips
 *  - color: swatch, hex, and preset chips · datetime: Today / Now + how far away
 *  - link: field + Open key showing the host · item: searchable typeahead
 *  - image / multiimage: preview / gallery
 *  - file / multifile: file chips · formula: computed readout
 * Used by the values editors (Lists, Inbox, Item detail).
 */
"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { IsolatedInput, IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { menuLayerStyle } from "@/components/ui/menu-layer"
import { ExternalLink, Minus, Plus, X } from "lucide-react"
import type { AttributeDefinition, AttributeValue, FileValue } from "@/lib/types"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import { computeFormulaValue, formatFormulaValue } from "@/lib/formula"
import { useTaskStore } from "@/lib/task-store"
import { putAttachment } from "@/lib/attachments"
import { useAttachmentSrcList } from "@/hooks/use-attachment-src"
import { ListPicker } from "@/components/Lists/list-picker"
import { StringPicker } from "@/components/Lists/item-picker"
import { formatBytes, resourceKind, RESOURCE_KIND_LABEL } from "@/lib/item-resources"
import { asArray, asFile, asFiles, asGoal, fileToFileValue } from "./helpers"
import { reorderStrings, textListToBrainList } from "@/lib/text-list-to-list"
import { itemTitle, createListItem } from "@/lib/item-utils"
import { pushItemLayer } from "@/lib/step-item-stack"
import { iconFor } from "@/components/Icons/Icon"
import { formatHandle, normalizeHandle } from "@/lib/phone-sync/handles"
import "./attribute-fields.css"

/** At most this many options draw as a row of keys; more fall back to a menu. */
const MAX_KEY_OPTIONS = 6

function SelectionValueEditor({
  def,
  value,
  onChange,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)

  const options = useMemo(() => {
    if (def.optionSource === "list" && def.optionListId) {
      return tasks.filter((t) => t.lists?.includes(def.optionListId!)).map((t) => itemTitle(t))
    }
    return def.options || []
  }, [def, tasks])

  const current = typeof value === "string" ? value : ""

  if (options.length === 0) {
    return <span className="attr-empty-hint">No options yet. Name them in this attribute&apos;s settings.</span>
  }

  if (options.length > MAX_KEY_OPTIONS) {
    const multiple = !!def.allowMultiple
    const chosen = multiple ? asArray(value) : current ? [current] : []
    return (
      <StringPicker
        options={options}
        mode={multiple ? "multi" : "single"}
        selected={chosen}
        searchLabel={def.name || "Search options"}
        onChange={(next) => onChange(multiple ? (next.length ? next : undefined) : next[0] || undefined)}
      />
    )
  }

  if (def.allowMultiple) {
    const arr = asArray(value)
    return (
      <div className="attr-chips" role="group" aria-label={def.name}>
        {options.map((o) => {
          const on = arr.includes(o)
          return (
            <button
              key={o}
              type="button"
              className="attr-chip attr-chip-toggle"
              aria-pressed={on}
              onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
            >
              <span className="attr-lamp" aria-hidden />
              {o}
            </button>
          )
        })}
      </div>
    )
  }

  const short = options.length <= MAX_KEY_OPTIONS && options.every((o) => o.length <= 18)
  if (short) {
    return (
      <div className="attr-keys" role="radiogroup" aria-label={def.name}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={current === o}
            className="attr-key"
            title={current === o ? "Click again to clear" : undefined}
            onClick={() => onChange(current === o ? undefined : o)}
          >
            {o}
          </button>
        ))}
      </div>
    )
  }

  return (
    <Select value={current || "none"} onValueChange={(val) => onChange(val === "none" ? undefined : val)}>
      <SelectTrigger className="h-9" aria-label={def.name}>
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const TEXT_LIST_VIEW_KEY = "brain2-text-list-view"

type TextListView = "bubbles" | "lines"

type TextListBinding = {
  listId?: string
  onBind: (listId: string) => void
  onOpen?: (listId: string) => void
}

function readTextListView(attributeId: string): TextListView {
  try {
    const raw = localStorage.getItem(TEXT_LIST_VIEW_KEY)
    if (!raw) return "bubbles"
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "bubbles"
    return (parsed as Record<string, unknown>)[attributeId] === "lines" ? "lines" : "bubbles"
  } catch {
    return "bubbles"
  }
}

function writeTextListView(attributeId: string, view: TextListView) {
  try {
    const raw = localStorage.getItem(TEXT_LIST_VIEW_KEY)
    let bag: Record<string, unknown> = {}
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        bag = { ...(parsed as Record<string, unknown>) }
      }
    }
    bag[attributeId] = view
    localStorage.setItem(TEXT_LIST_VIEW_KEY, JSON.stringify(bag))
  } catch {
    /* private mode or a full disk */
  }
}

function FitEntry({
  value,
  label,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string
  label: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <textarea
      ref={ref}
      rows={1}
      className="attr-edit-box"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onCommit()
        } else if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
      }}
      onBlur={onCommit}
    />
  )
}

function MultiStringEditor({
  attributeId,
  value,
  onChange,
  label,
  textListBinding,
}: {
  attributeId?: string
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  label?: string
  textListBinding?: TextListBinding
}) {
  const arr = asArray(value)
  const lists = useTaskStore((s) => s.lists)
  const [draft, setDraft] = useState("")
  const [view, setView] = useState<TextListView>(() => (attributeId ? readTextListView(attributeId) : "bubbles"))
  const [editing, setEditing] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [dragging, setDragging] = useState<number | null>(null)
  const dragFrom = useRef<number | null>(null)
  const editingIndex = useRef<number | null>(null)
  const editDraftRef = useRef("")
  const boundList = textListBinding?.listId ? lists.find((row) => row.id === textListBinding.listId) : undefined

  const choose = (next: TextListView) => {
    setView(next)
    if (attributeId) writeTextListView(attributeId, next)
  }

  const commit = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    onChange([...arr, ...parts.filter((p) => !arr.includes(p))])
    setDraft("")
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      commit()
    } else if (e.key === "Backspace" && draft === "" && arr.length > 0) {
      onChange(arr.slice(0, -1))
    }
  }

  const beginEdit = (i: number) => {
    const text = arr[i] ?? ""
    editingIndex.current = i
    editDraftRef.current = text
    setEditing(i)
    setEditDraft(text)
  }

  const finishEdit = (commitEdit: boolean) => {
    const i = editingIndex.current
    if (i == null) return
    editingIndex.current = null
    setEditing(null)
    if (!commitEdit) return
    const original = arr[i]
    if (original === undefined) return
    const next = editDraftRef.current.trim()
    if (next === original) return
    if (!next) {
      onChange(arr.filter((_, idx) => idx !== i))
      return
    }
    const copy = arr.slice()
    copy[i] = next
    onChange(copy)
  }

  const removeAt = (i: number) => {
    if (editingIndex.current === i) {
      editingIndex.current = null
      setEditing(null)
    }
    onChange(arr.filter((_, idx) => idx !== i))
  }

  const makeList = () => {
    const { list, items } = textListToBrainList(label || "List", arr)
    const store = useTaskStore.getState()
    store.addList(list)
    for (const item of items) store.addTask(item)
    textListBinding?.onBind(list.id)
  }

  const addInput = (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      placeholder={arr.length ? "Add…" : "Type, then Enter"}
      aria-label={label ? `Add to ${label}` : "Add entry"}
      className="attr-chip-input"
    />
  )

  const editInput = (original: string) => (
    <FitEntry
      value={editDraft}
      label={`Edit ${original}`}
      onChange={(next) => {
        editDraftRef.current = next
        setEditDraft(next)
      }}
      onCommit={() => finishEdit(true)}
      onCancel={() => finishEdit(false)}
    />
  )

  const removeButton = (s: string, i: number) => (
    <button
      type="button"
      className="attr-chip-x"
      aria-label={`Remove ${s}`}
      onClick={() => removeAt(i)}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <X className="h-3 w-3" />
    </button>
  )

  return boundList && attributeId ? (
    <ListRefField
      attributeId={attributeId}
      value={boundList.id}
      onChange={() => {}}
      onOpenList={textListBinding?.onOpen}
      locked
    />
  ) : (
    <div className="attr-textlist">
      <div className="attr-textlist-bar" role="group" aria-label={label ? `${label} view` : "Text list view"}>
        <button type="button" className="attr-view-key" aria-pressed={view === "bubbles"} onClick={() => choose("bubbles")}>
          Bubbles
        </button>
        <button type="button" className="attr-view-key" aria-pressed={view === "lines"} onClick={() => choose("lines")}>
          Lines
        </button>
      </div>
      {view === "lines" ? (
        <>
          <ul className="attr-lines">
            {arr.map((s, i) => (
              <li
                key={`${i}-${s}`}
                className={`attr-line${editing === i ? " is-editing" : ""}`}
                onDoubleClick={() => editing !== i && beginEdit(i)}
              >
                {editing === i ? editInput(s) : <span className="attr-line-text">{s}</span>}
                {removeButton(s, i)}
              </li>
            ))}
          </ul>
          <div className="attr-chip-field">{addInput}</div>
        </>
      ) : (
        <div className="attr-chip-field">
          {arr.map((s, i) => (
            <span
              key={`${i}-${s}`}
              className={`attr-chip${dragging === i ? " is-dragging" : ""}${editing === i ? " is-editing" : ""}`}
              draggable={editing !== i}
              onDragStart={(e) => {
                dragFrom.current = i
                const token = i
                requestAnimationFrame(() => {
                  if (dragFrom.current === token) setDragging(token)
                })
                try {
                  e.dataTransfer.effectAllowed = "move"
                  e.dataTransfer.setData("text/plain", String(i))
                } catch {
                  /* jsdom fires drag events without dataTransfer */
                }
              }}
              onDragEnd={() => {
                dragFrom.current = null
                setDragging(null)
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragFrom.current
                if (from == null) return
                const next = reorderStrings(arr, from, i)
                if (next !== arr) onChange(next)
              }}
            >
              {editing === i ? (
                editInput(s)
              ) : (
                <span onDoubleClick={() => beginEdit(i)}>{s}</span>
              )}
              {removeButton(s, i)}
            </span>
          ))}
          {addInput}
        </div>
      )}
        <button type="button" className="attr-make-list" onClick={makeList}>
          Make Brain2 List
        </button>
    </div>
  )
}

/** Phone numbers as chips. Typed numbers are stored as +<digits>; each chip dials. */
function PhoneValueEditor({
  value,
  onChange,
  label,
}: {
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  label?: string
}) {
  const arr = asArray(value)
  const [draft, setDraft] = useState("")

  const commit = () => {
    const parts = draft
      .split(/[,;\n]/)
      .map((s) => normalizeHandle(s))
      .filter(Boolean)
    setDraft("")
    const fresh = parts.filter((p) => !arr.some((have) => normalizeHandle(have) === p))
    if (fresh.length) onChange([...arr, ...fresh])
  }

  return (
    <div className="attr-chip-field">
      {arr.map((s, i) => (
        <span key={`${s}-${i}`} className="attr-chip">
          <a href={`tel:${normalizeHandle(s)}`} title="Call">
            {formatHandle(s)}
          </a>
          <button
            type="button"
            className="attr-chip-x"
            aria-label={`Remove ${formatHandle(s)}`}
            onClick={() => onChange(arr.filter((_, idx) => idx !== i).length ? arr.filter((_, idx) => idx !== i) : undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="tel"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            commit()
          } else if (e.key === "Backspace" && draft === "" && arr.length > 0) {
            onChange(arr.length > 1 ? arr.slice(0, -1) : undefined)
          }
        }}
        onBlur={commit}
        placeholder={arr.length ? "Add another number…" : "Phone number, then Enter"}
        aria-label={label ? `Add to ${label}` : "Add phone number"}
        className="attr-chip-input"
      />
    </div>
  )
}

function ImageValueEditor({
  multiple,
  value,
  onChange,
}: {
  multiple: boolean
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const pick = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.multiple = multiple
    input.onchange = () => {
      const files = Array.from(input.files || [])
      if (!files.length) return
      // Bytes go to the attachments IDB; the cell keeps `idb:<id>`. A data URL
      // here put whole pictures in the Lists JSON and filled the origin.
      Promise.all(
        files.map(async (f) => putAttachment(`img_${crypto.randomUUID()}`, f, { name: f.name, mime: f.type })),
      ).then((uris) => {
        if (multiple) onChange([...asArray(value), ...uris])
        else onChange(uris[0])
      })
    }
    input.click()
  }

  const urls = multiple ? asArray(value) : value ? [String(value)] : []
  const srcs = useAttachmentSrcList(urls.map(String))

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className={multiple ? "attr-gallery" : "attr-photo"}>
          {urls.map((url, i) => (
            <figure key={`${url}-${i}`} className="attr-thumb">
              {srcs[i] ? (
                <a href={srcs[i]} target="_blank" rel="noreferrer" title="Open full size">
                  <img src={srcs[i]} alt="" />
                </a>
              ) : (
                <span className="attr-thumb-blank" />
              )}
              <button
                type="button"
                className="attr-thumb-x"
                aria-label="Remove image"
                onClick={() => {
                  if (multiple) onChange(urls.filter((_, idx) => idx !== i))
                  else onChange(undefined)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </figure>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={pick}>
        <Plus className="h-3 w-3 mr-1" />
        {multiple ? (urls.length ? "Add images" : "Choose images") : urls.length ? "Replace image" : "Choose image"}
      </Button>
    </div>
  )
}

/**
 * Best-effort text extraction for newly attached files, patched onto a copy of
 * each `FileValue`. Dynamically imports `lib/file-extract` so the (potentially
 * heavier) extraction path stays out of the initial bundle. Never throws.
 */
export async function enrichWithText<T extends FileValue>(files: T[]): Promise<T[]> {
  try {
    const { extractText, canExtractText } = await import("@/lib/file-extract")
    return await Promise.all(
      files.map(async (f) => {
        if (!canExtractText(f)) return f
        const text = await extractText(f)
        return text ? { ...f, extractedText: text } : f
      }),
    )
  } catch {
    return files
  }
}

/** Resolve a stored file uri (`idb:` / data / blob / http) to something an `<a>` can open. */
export function useFileHref(uri: string): string {
  const direct = uri.startsWith("data:") || uri.startsWith("blob:") || uri.startsWith("http")
  const [href, setHref] = useState(direct ? uri : "")

  useEffect(() => {
    if (!uri || uri.startsWith("data:") || uri.startsWith("blob:") || uri.startsWith("http")) {
      setHref(uri)
      return
    }
    let objectUrl = ""
    let cancelled = false
    void import("@/lib/attachments").then(({ getAttachmentObjectUrl }) =>
      getAttachmentObjectUrl(uri)
        .then((url) => {
          if (cancelled) {
            if (url.startsWith("blob:")) URL.revokeObjectURL(url)
            return
          }
          objectUrl = url
          setHref(url)
        })
        .catch(() => undefined),
    )
    return () => {
      cancelled = true
      if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl)
    }
  }, [uri])

  return href
}

function FileAttachmentChip({ file, onRemove }: { file: FileValue; onRemove: () => void }) {
  const href = useFileHref(file.uri)
  const kind = resourceKind(file)

  return (
    <div className="attr-file-chip">
      <span className="attr-file-kind" data-kind={kind}>
        {RESOURCE_KIND_LABEL[kind]}
      </span>
      <a
        href={href || undefined}
        target="_blank"
        rel="noreferrer"
        title={file.extractedText ? "Text extracted (searchable)" : file.name}
        className="truncate max-w-[200px] hover:underline"
      >
        {file.name}
      </a>
      {formatBytes(file.size) && <span className="attr-file-size">{formatBytes(file.size)}</span>}
      {file.extractedText && (
        <span className="attr-file-text" title="Searchable text extracted">
          ✓ text
        </span>
      )}
      <button type="button" className="attr-chip-x" onClick={onRemove} aria-label={`Remove ${file.name}`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function FileValueEditor({
  multiple,
  value,
  onChange,
}: {
  multiple: boolean
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const files: FileValue[] = multiple ? asFiles(value) : asFile(value) ? [asFile(value)!] : []
  const [attachError, setAttachError] = useState<string | null>(null)

  const pick = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = multiple
    input.onchange = async () => {
      const picked = Array.from(input.files || [])
      if (!picked.length) return
      setAttachError(null)
      // Snapshot the existing files so the async extraction patch below stays
      // consistent with what was on screen when the picker opened.
      const base = multiple ? asFiles(value) : []
      let added: FileValue[]
      try {
        added = await Promise.all(picked.map(fileToFileValue))
      } catch (e) {
        setAttachError(e instanceof Error ? e.message : "Could not store the file. Storage may be full.")
        return
      }

      // Show the chips immediately (extraction must never block the UI).
      if (multiple) onChange([...base, ...added])
      else onChange(added[0])

      // Patch in extracted text once it resolves (PDF via Electron, text inline).
      void enrichWithText(added).then((enriched) => {
        if (!enriched.some((f) => f.extractedText)) return
        if (multiple) onChange([...base, ...enriched])
        else onChange(enriched[0])
      })
    }
    input.click()
  }

  const removeAt = (i: number) => {
    const target = files[i]
    if (target?.uri) {
      void import("@/lib/attachments").then(({ deleteAttachment }) => deleteAttachment(target.uri))
    }
    if (multiple) onChange(files.filter((_, idx) => idx !== i))
    else onChange(undefined)
  }

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <FileAttachmentChip key={f.id || i} file={f} onRemove={() => removeAt(i)} />
          ))}
        </div>
      )}
      {attachError && <p className="text-xs text-destructive">{attachError}</p>}
      <Button type="button" variant="outline" size="sm" onClick={pick}>
        <Plus className="h-3 w-3 mr-1" />
        {multiple ? (files.length ? "Add files" : "Choose files") : files.length ? "Replace file" : "Choose file"}
      </Button>
    </div>
  )
}

/** Searchable item reference. The match list is portaled above every well (menu layer). */
function ItemRefField({
  def,
  value,
  onChange,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedId = typeof value === "string" && value ? value : null
  const selected = selectedId ? tasks.find((t) => t.id === selectedId) : undefined
  const selectedList = selected ? lists.find((l) => selected.lists?.includes(l.id)) : undefined

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scoped = def.refListId ? tasks.filter((t) => t.lists?.includes(def.refListId!)) : tasks
    const hits = q ? scoped.filter((t) => itemTitle(t).toLowerCase().includes(q)) : scoped
    return hits.slice(0, 8)
  }, [query, tasks, def.refListId])

  const openList = () => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    setOpen(true)
  }

  return (
    <div className="attr-ref">
      {selected || selectedId ? (
        <span className="attr-ref-chip">
          <img
            className="attr-ref-orb"
            alt=""
            src={iconFor(selectedList?.id ?? selectedId ?? "item", selectedList?.icon ?? selected?.icon)}
          />
          <span className="truncate">{selected ? itemTitle(selected) : "Missing item"}</span>
          {selectedList && <span className="attr-ref-list">{selectedList.name}</span>}
          <button type="button" className="attr-chip-x" aria-label="Clear item" onClick={() => onChange(undefined)}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          openList()
        }}
        onFocus={openList}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={selectedId ? "Change…" : "Search items…"}
        aria-label={`Search items for ${def.name}`}
        className="attr-ref-input"
      />
      {open &&
        rect &&
        matches.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="attr-ref-menu"
            role="listbox"
            style={menuLayerStyle({
              position: "fixed",
              left: rect.left,
              top: rect.bottom + 2,
              width: Math.max(rect.width, 220),
            })}
          >
            {matches.map((t) => {
              const list = lists.find((l) => t.lists?.includes(l.id))
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={t.id === selectedId}
                  className="attr-ref-option"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(t.id)
                    setQuery("")
                    setOpen(false)
                  }}
                >
                  <img className="attr-ref-orb" alt="" src={iconFor(list?.id ?? t.id, list?.icon ?? t.icon)} />
                  <span className="truncate">{itemTitle(t)}</span>
                  {list && <span className="attr-ref-list">{list.name}</span>}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

/** A list reference: the list's own items, in the same bubbles / lines face as a text list. */
function ListRefField({
  attributeId,
  value,
  onChange,
  onOpenList,
  locked = false,
}: {
  attributeId: string
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  onOpenList?: (listId: string) => void
  /** A text list already joined to this list. Hide Change list. */
  locked?: boolean
}) {
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)
  const [choosing, setChoosing] = useState(false)
  const [view, setView] = useState<TextListView>(() => readTextListView(attributeId))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const editHold = useRef("")
  const [addDraft, setAddDraft] = useState("")
  const id = typeof value === "string" && value ? value : null
  const list = id ? lists.find((row) => row.id === id) : undefined
  const members = useMemo(() => (id ? tasks.filter((row) => row.lists?.includes(id)) : []), [tasks, id])

  const choose = (next: TextListView) => {
    setView(next)
    writeTextListView(attributeId, next)
  }

  const finish = (commitEdit: boolean) => {
    const taskId = editingId
    setEditingId(null)
    if (!commitEdit || !taskId) return
    const next = editHold.current.trim()
    const task = useTaskStore.getState().tasks.find((row) => row.id === taskId)
    if (!task || !next || itemTitle(task) === next) return
    useTaskStore.getState().updateTask({ ...task, title: next, description: next })
  }

  const addItem = () => {
    const name = addDraft.trim()
    if (!name || !id) return
    useTaskStore.getState().addTask(createListItem(name, [id]))
    setAddDraft("")
  }

  if (!list) {
    return (
      <div className="space-y-2">
        <button type="button" className="attr-mini-key" aria-expanded={choosing} onClick={() => setChoosing((v) => !v)}>
          {choosing ? "Done" : "Choose list"}
        </button>
        {choosing && (
          <ListPicker
            mode="single"
            selected={id ? [id] : []}
            onChange={(ids) => {
              onChange(ids[0])
              if (ids[0]) setChoosing(false)
            }}
            compact
          />
        )}
      </div>
    )
  }

  return (
    <div className="attr-textlist">
      <div className="attr-textlist-bar" role="group" aria-label={`${list.name} view`}>
        <button type="button" className="attr-view-key" aria-pressed={view === "bubbles"} onClick={() => choose("bubbles")}>
          Bubbles
        </button>
        <button type="button" className="attr-view-key" aria-pressed={view === "lines"} onClick={() => choose("lines")}>
          Lines
        </button>
        {locked ? null : (
        <button type="button" className="attr-view-key" aria-expanded={choosing} onClick={() => setChoosing((v) => !v)}>
          {choosing ? "Done" : "Change list"}
        </button>
        )}
      </div>
      <button
        type="button"
        className="attr-ref-chip attr-list-card"
        data-no95
        title="Double-click to open this list"
        onDoubleClick={() => onOpenList?.(list.id)}
      >
        <img className="attr-ref-orb" alt="" src={iconFor(list.id, list.icon)} />
        <span className="truncate">{list.name}</span>
      </button>
      {choosing && (
        <ListPicker
          mode="single"
          selected={[list.id]}
          onChange={(ids) => {
            onChange(ids[0])
            if (ids[0]) setChoosing(false)
          }}
          compact
        />
      )}
      {view === "lines" ? (
        <ul className="attr-lines">
          {members.map((row) => (
            <li
              key={row.id}
              className={`attr-line${editingId === row.id ? " is-editing" : ""}`}
              onDoubleClick={() => {
                if (editingId === row.id) return
                const name = itemTitle(row)
                editHold.current = name
                setEditingId(row.id)
                setEditDraft(name)
              }}
            >
              {editingId === row.id ? (
                <FitEntry
                  value={editDraft}
                  label={`Edit ${itemTitle(row)}`}
                  onChange={(next) => {
                    editHold.current = next
                    setEditDraft(next)
                  }}
                  onCommit={() => finish(true)}
                  onCancel={() => finish(false)}
                />
              ) : (
                <span className="attr-line-text">{itemTitle(row)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="attr-chip-field">
          {members.map((row) => (
            <button key={row.id} type="button" className="attr-ref-chip" data-no95 onClick={() => pushItemLayer(row.id)}>
              <img className="attr-ref-orb" alt="" src={iconFor(row.id, row.icon)} />
              <span className="truncate">{itemTitle(row)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="attr-chip-field">
        <input
          value={addDraft}
          onChange={(e) => setAddDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addItem()
            }
          }}
          onBlur={addItem}
          placeholder={members.length ? "Add…" : "Type, then Enter"}
          aria-label={`Add to ${list.name}`}
          className="attr-chip-input"
        />
      </div>
    </div>
  )
}

const COLOR_PRESETS = ["#7dffc4", "#000080", "#c0c0c0", "#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"]

function ColorValueEditor({ value, onChange, label }: { value: AttributeValue; onChange: (v: AttributeValue) => void; label: string }) {
  const hex = typeof value === "string" ? value : ""
  return (
    <div className="attr-color">
      <ColorSwatch value={hex || "#3b82f6"} onChange={(c) => onChange(c)} aria-label={label} size="md" />
      <IsolatedInput value={hex} onCommit={(v) => onChange(v.trim() || undefined)} className="h-8 w-24 font-mono" placeholder="#hex" />
      <span className="attr-color-presets" role="group" aria-label={`${label} presets`}>
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            className="attr-color-chip"
            style={{ background: c }}
            aria-label={c}
            aria-pressed={hex.toLowerCase() === c}
            onClick={() => onChange(c)}
          />
        ))}
      </span>
    </div>
  )
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

/** "in 3 days", "2 days ago", "today". Date-only strings are read as local days. */
export function relativeDayPhrase(raw: string, now: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (!m) return ""
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  const abs = Math.abs(diff)
  const span = abs >= 365 ? `${Math.round(abs / 36.5) / 10} yr` : abs >= 60 ? `${Math.round(abs / 30)} mo` : `${abs} days`
  return diff > 0 ? `in ${span}` : `${span} ago`
}

function DateValueEditor({
  mode,
  value,
  onChange,
  label,
}: {
  mode: "date" | "datetime"
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  label: string
}) {
  const raw = value === undefined || value === null ? "" : String(value)
  const shown = mode === "datetime" ? raw.slice(0, 16) : raw.slice(0, 10)
  const now = () => {
    const d = new Date()
    const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    onChange(mode === "datetime" ? `${day}T${pad2(d.getHours())}:${pad2(d.getMinutes())}` : day)
  }
  const phrase = raw ? relativeDayPhrase(raw) : ""
  return (
    <div className="attr-date">
      <Input
        type={mode === "datetime" ? "datetime-local" : "date"}
        value={shown}
        aria-label={label}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        className="h-8 w-auto"
      />
      <button type="button" className="attr-mini-key" onClick={now}>
        {mode === "datetime" ? "Now" : "Today"}
      </button>
      {phrase && <span className="attr-readout">{phrase}</span>}
    </div>
  )
}

function linkHost(raw: string): string {
  try {
    return new URL(raw).host.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function LinkValueEditor({
  value,
  onChange,
  onLive,
  label,
}: {
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  onLive?: (v: AttributeValue) => void
  label: string
}) {
  const raw = value === undefined || value === null ? "" : String(value)
  const href = raw && !/^[a-z]+:/i.test(raw) ? `https://${raw}` : raw
  const host = href ? linkHost(href) : ""
  return (
    <div className="attr-link">
      <IsolatedInput
        type="url"
        value={raw}
        aria-label={label}
        onCommit={(next) => onChange(next.trim() === "" ? undefined : next.trim())}
        onLiveChange={onLive ? (next) => onLive(next.trim() === "" ? undefined : next.trim()) : undefined}
        className="h-8 flex-1"
        placeholder="https://…"
      />
      {host && (
        <a className="attr-mini-key attr-link-open" href={href} target="_blank" rel="noreferrer" title={href}>
          <ExternalLink className="h-3 w-3" />
          {host}
        </a>
      )}
    </div>
  )
}

function GoalValueEditor({
  def,
  value,
  onChange,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const g = asGoal(value)
  const pct = g.target > 0 ? Math.max(0, Math.min(100, Math.round((g.current / g.target) * 100))) : 0
  return (
    <div className="attr-goal">
      <div className="attr-goal-inputs">
        <IsolatedInput
          type="number"
          value={String(g.current || "")}
          placeholder={def.labels?.current || "Actual"}
          aria-label={def.labels?.current || "Actual"}
          onCommit={(raw) => onChange({ ...g, current: Number(raw) || 0 })}
          className="h-8"
        />
        <span className="attr-goal-slash">/</span>
        <IsolatedInput
          type="number"
          value={String(g.target || "")}
          placeholder={def.labels?.target || "Goal"}
          aria-label={def.labels?.target || "Goal"}
          onCommit={(raw) => onChange({ ...g, target: Number(raw) || 0 })}
          className="h-8"
        />
        {def.unit && <span className="attr-unit">{def.unit}</span>}
      </div>
      <div
        className="attr-meter"
        role="meter"
        aria-label={`${def.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className="attr-meter-fill" style={{ width: `${pct}%` }} />
        <span className="attr-meter-pct">{g.target > 0 ? `${pct}%` : "set a goal"}</span>
      </div>
    </div>
  )
}

function parseNumber(raw: string, whole: boolean): AttributeValue {
  if (raw === "") return undefined
  return whole ? parseInt(raw, 10) : Number(raw)
}

function NumberValueEditor({
  def,
  value,
  onChange,
  onLive,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  onLive?: (v: AttributeValue) => void
}) {
  const whole = def.allowFloat === false
  const n = typeof value === "number" ? value : value === undefined || value === null || value === "" ? undefined : Number(value)
  const step = (delta: number) => onChange((Number.isFinite(n) ? (n as number) : 0) + delta)
  return (
    <div className="attr-number">
      {def.unit && def.unit.length <= 2 && /[$£€¥]/.test(def.unit) && <span className="attr-unit">{def.unit}</span>}
      <IsolatedInput
        type="number"
        step={whole ? 1 : "any"}
        aria-label={def.name}
        value={n === undefined || !Number.isFinite(n) ? "" : String(n)}
        onCommit={(raw) => onChange(parseNumber(raw, whole))}
        onLiveChange={onLive ? (raw) => onLive(parseNumber(raw, whole)) : undefined}
        className="h-8"
      />
      {def.unit && !/[$£€¥]/.test(def.unit) && <span className="attr-unit">{def.unit}</span>}
      {whole && (
        <span className="attr-stepper">
          <button type="button" className="attr-mini-key" aria-label={`Decrease ${def.name}`} onClick={() => step(-1)}>
            <Minus className="h-3 w-3" />
          </button>
          <button type="button" className="attr-mini-key" aria-label={`Increase ${def.name}`} onClick={() => step(1)}>
            <Plus className="h-3 w-3" />
          </button>
        </span>
      )}
    </div>
  )
}

export function AttributeValueField({
  def,
  value,
  onChange,
  onLive,
  definitions,
  siblingValues,
  textListBinding,
  onOpenList,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  /**
   * Every keystroke in a text, number or link field (keep cheap: ref writes).
   * `onChange` still fires once, on blur / Enter.
   */
  onLive?: (v: AttributeValue) => void
  /** Sibling attribute schema — enables live formula evaluation when provided. */
  definitions?: AttributeDefinition[]
  /** This item's other attribute values — required to compute formula results. */
  siblingValues?: Record<string, AttributeValue>
  /** Set on a text list so Make Brain2 List can join the item. */
  textListBinding?: TextListBinding
  /** Double-click a list reference's title to open that list. */
  onOpenList?: (listId: string) => void
}) {
  const type = normalizeAttributeType(def.type)
  const label = def.name || "Value"

  switch (type) {
    case "formula": {
      const canCompute = !!def.formula && !!siblingValues && !!definitions
      const result = canCompute
        ? computeFormulaValue(def, siblingValues!, Object.fromEntries(definitions!.map((d) => [d.id, d])))
        : null
      const expr = def.formula ? `= ${def.formula.replace(/^=/, "").trim()}` : "No formula set"
      return (
        <div className="attr-formula" title={def.formula || undefined}>
          <span className="attr-formula-f" aria-hidden>
            ƒ
          </span>
          {result ? (
            <span className={result.error ? "text-destructive font-medium" : "attr-formula-value"}>
              {formatFormulaValue(result, def) || "—"}
            </span>
          ) : null}
          <span className="attr-formula-expr">{expr}</span>
        </div>
      )
    }
    case "boolean": {
      const on = !!value
      return (
        <label className="attr-bool">
          {def.booleanDisplay === "switch" ? (
            <Switch checked={on} onCheckedChange={(c) => onChange(!!c)} aria-label={label} />
          ) : (
            <Checkbox checked={on} onCheckedChange={(c) => onChange(!!c)} aria-label={label} />
          )}
          <span className="attr-bool-word" data-on={on ? "true" : "false"}>
            {on ? "Yes" : "No"}
          </span>
        </label>
      )
    }
    case "color":
      return <ColorValueEditor value={value} onChange={onChange} label={label} />
    case "datetime": {
      const mode = def.datetimeMode || "date"
      if (mode === "time") {
        return (
          <ClockPicker
            aria-label={label}
            className="h-9"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(next) => onChange(next === "" ? undefined : next)}
          />
        )
      }
      return <DateValueEditor mode={mode} value={value} onChange={onChange} label={label} />
    }
    case "list":
      return <ListRefField attributeId={def.id} value={value} onChange={onChange} onOpenList={onOpenList} />
    case "item":
      return <ItemRefField def={def} value={value} onChange={onChange} />
    case "multistring":
      return (
        <MultiStringEditor
          attributeId={def.id}
          value={value}
          onChange={onChange}
          label={label}
          textListBinding={textListBinding}
        />
      )
    case "selection":
      return <SelectionValueEditor def={def} value={value} onChange={onChange} />
    case "image":
      return <ImageValueEditor multiple={false} value={value} onChange={onChange} />
    case "multiimage":
      return <ImageValueEditor multiple value={value} onChange={onChange} />
    case "file":
      return <FileValueEditor multiple={false} value={value} onChange={onChange} />
    case "multifile":
      return <FileValueEditor multiple value={value} onChange={onChange} />
    case "phone":
      return <PhoneValueEditor value={value} onChange={onChange} label={label} />
    case "link":
      return <LinkValueEditor value={value} onChange={onChange} onLive={onLive} label={label} />
    case "goal":
      return <GoalValueEditor def={def} value={value} onChange={onChange} />
    case "number":
      return <NumberValueEditor def={def} value={value} onChange={onChange} onLive={onLive} />
    case "string":
    default:
      return (
        <IsolatedTextarea
          value={value === undefined || value === null ? "" : String(value)}
          onCommit={(raw) => onChange(raw === "" ? undefined : raw)}
          onLiveChange={onLive ? (raw) => onLive(raw === "" ? undefined : raw) : undefined}
          aria-label={label}
          rows={1}
          className="attr-text min-h-[32px] resize-y"
        />
      )
  }
}

