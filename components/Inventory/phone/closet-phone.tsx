/**
 * components/Inventory/phone/closet-phone.tsx — Closet on the phone
 *
 * Cutout grid, category chips, and in-scene tabs. Photos reuse the desk
 * cutout helper and `ClosetPhoto`. A full drag board stays on the desk;
 * tapping pieces builds a composition. Lookbooks are one planned line.
 */
"use client"

import { useMemo, useRef, useState } from "react"
import { ClosetPhoto } from "../closet/closet-photo"
import { packingRows } from "../closet/packing-rows"
import { pieceChipId, type PieceChipId } from "../closet/piece-chip"
import { piecePhotoDataUrl } from "../closet/piece-photo"
import { putImageDataUrl } from "@/lib/attachments"
import { itemTitle } from "@/lib/item-utils"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import {
  PIECE_CATEGORIES,
  PIECE_CATEGORY_LABEL,
  useWardrobeStore,
  type Outfit,
  type Piece,
  type PieceCategory,
} from "@/lib/wardrobe"
import { phoneCompositionSlots } from "./closet-phone-slots"

type Chip = "all" | PieceChipId
type ClosetTab = "closet" | "outfits" | "lookbooks" | "settings"

const TABS: { id: ClosetTab; label: string }[] = [
  { id: "closet", label: "Closet" },
  { id: "outfits", label: "Outfits" },
  { id: "lookbooks", label: "Lookbooks" },
  { id: "settings", label: "Settings" },
]

export function ClosetPhone() {
  const [tab, setTab] = useState<ClosetTab>("closet")
  return (
    <div className="inv-phone-closet" data-testid="closet-phone">
      <div className="inv-phone-closet-main">
        {tab === "closet" ? <ClosetPieces /> : null}
        {tab === "outfits" ? <ClosetOutfits /> : null}
        {tab === "lookbooks" ? <p className="inv-phone-quiet">Lookbooks are planned.</p> : null}
        {tab === "settings" ? <ClosetSettings /> : null}
      </div>
      <div className="inv-phone-dock" role="tablist" aria-label="Closet">
        {TABS.map((row) => (
          <button
            key={row.id}
            type="button"
            role="tab"
            aria-selected={tab === row.id}
            onClick={() => setTab(row.id)}
          >
            {row.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function nameFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  return base || "Piece"
}

function ClosetPieces() {
  const pieces = useWardrobeStore((state) => state.pieces)
  const addPiece = useWardrobeStore((state) => state.addPiece)
  const [chip, setChip] = useState<Chip>("all")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [name, setName] = useState("")
  const [category, setCategory] = useState<PieceCategory>("top")
  const [cutout, setCutout] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const chips = useMemo(() => {
    const next: { id: Chip; label: string }[] = [
      { id: "all", label: "All" },
      { id: "uncategorized", label: "Uncategorized" },
    ]
    for (const categoryId of PIECE_CATEGORIES) {
      if (!pieces.some((piece) => pieceChipId(piece) === categoryId)) continue
      next.push({ id: categoryId, label: PIECE_CATEGORY_LABEL[categoryId] })
    }
    return next
  }, [pieces])

  const active: Chip = chips.some((row) => row.id === chip) ? chip : "all"
  const visible = pieces.filter((piece) => active === "all" || pieceChipId(piece) === active)

  function clearDraft() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return ""
    })
    setFile(null)
    setName("")
    setCategory("top")
    setCutout(true)
    if (fileRef.current) fileRef.current.value = ""
  }

  function onFile(next: File | undefined) {
    if (!next) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setName(nameFromFile(next))
    setNotice("")
  }

  async function save() {
    if (!file || busy) return
    const pieceName = name.trim()
    if (!pieceName) return
    setBusy(true)
    setNotice("")
    try {
      const photo = await piecePhotoDataUrl(file, cutout)
      const imageUri = await putImageDataUrl(photo.dataUrl, pieceName)
      if (!imageUri || imageUri.startsWith("data:")) {
        setNotice(photo.keptOriginal ? "Kept the original photo. Photo was not stored." : "Photo was not stored.")
        return
      }
      const id = addPiece({ name: pieceName, category, imageUri })
      if (!id) {
        setNotice("Photo was not stored.")
        return
      }
      setNotice(photo.keptOriginal ? "Kept the original photo." : "")
      clearDraft()
    } catch {
      setNotice("Photo was not stored.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="inv-phone-chips" role="group" aria-label="Piece categories">
        {chips.map((row) => (
          <button
            key={row.id}
            type="button"
            className="inv-phone-chip"
            aria-pressed={active === row.id}
            onClick={() => setChip(row.id)}
          >
            {row.label}
          </button>
        ))}
      </div>
      {notice ? (
        <p className="inv-phone-notice" role="status">
          {notice}
        </p>
      ) : null}
      {file ? (
        <form
          className="inv-phone-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {preview ? <img className="inv-phone-form-preview" src={preview} alt="" /> : null}
          <label className="inv-phone-field">
            Name
            <input value={name} aria-label="Name" onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="inv-phone-field">
            Category
            <select value={category} aria-label="Category" onChange={(event) => setCategory(event.target.value as PieceCategory)}>
              {PIECE_CATEGORIES.map((id) => (
                <option key={id} value={id}>
                  {PIECE_CATEGORY_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="inv-phone-check">
            <input type="checkbox" checked={cutout} onChange={(event) => setCutout(event.target.checked)} />
            Cut out the background
          </label>
          <div className="inv-phone-form-actions">
            <button type="submit" className="inv-phone-save" disabled={busy || !name.trim()}>
              {busy ? "Saving" : "Save piece"}
            </button>
            <button type="button" className="inv-phone-quiet-btn" onClick={clearDraft} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {visible.length === 0 ? <p className="inv-phone-quiet">No pieces.</p> : null}
      <ul className="inv-phone-grid">
        {visible.map((piece) => (
          <li key={piece.id} className="inv-phone-card">
            <ClosetPhoto uri={piece.imageUri} className="inv-phone-cutout" />
            <span className="inv-phone-card-name">{piece.name}</span>
          </li>
        ))}
      </ul>
      <div className="inv-phone-new-wrap">
        <button type="button" className="inv-phone-new" onClick={() => fileRef.current?.click()}>
          New Item
        </button>
      </div>
      <input
        ref={fileRef}
        className="inv-phone-file"
        type="file"
        accept="image/*"
        aria-label="Piece photo"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </div>
  )
}

function wearsNewestFirst(outfits: readonly Outfit[]): Outfit[] {
  return [...outfits].sort((a, b) => b.dayKey.localeCompare(a.dayKey) || b.startMin - a.startMin || b.id.localeCompare(a.id))
}

function pieceNames(ids: readonly string[], pieces: readonly Piece[]): string {
  const names = ids.map((id) => pieces.find((piece) => piece.id === id)?.name).filter((name): name is string => Boolean(name))
  return names.length ? names.join(", ") : "Untagged"
}

function unitPercent(unit: number): string {
  return `${Math.round(unit * 1000) / 10}%`
}

function clock(min: number): string {
  const hours = Math.floor(min / 60)
  const minutes = min % 60
  return `${hours}:${minutes.toString().padStart(2, "0")}`
}

function ClosetOutfits() {
  const pieces = useWardrobeStore((state) => state.pieces)
  const outfits = useWardrobeStore((state) => state.outfits)
  const compositions = useWardrobeStore((state) => state.compositions)
  const addComposition = useWardrobeStore((state) => state.addComposition)
  const [name, setName] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState("")
  const wears = wearsNewestFirst(outfits)
  const saved = [...compositions].sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name))

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((pieceId) => pieceId !== id) : [...current, id]))
    setNotice("")
  }

  function save() {
    const id = addComposition({ name, slots: phoneCompositionSlots(selected) })
    if (!id) {
      setNotice("Look was not saved.")
      return
    }
    setName("")
    setSelected([])
    setNotice("")
  }

  return (
    <div data-testid="closet-outfits">
      <h2 className="inv-phone-stack">Wears</h2>
      {wears.length === 0 ? <p className="inv-phone-quiet">No wears.</p> : null}
      <ul className="inv-phone-wears">
        {wears.map((wear) => (
          <li key={wear.id} className="inv-phone-wear">
            <ClosetPhoto uri={wear.photoUri} className="inv-phone-wear-photo" />
            <div>
              <p className="inv-phone-wear-when">
                {wear.dayKey} · {clock(wear.startMin)}
              </p>
              <p>{pieceNames(wear.pieceIds, pieces)}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="inv-phone-stack">Saved looks</h2>
      {saved.length === 0 ? <p className="inv-phone-quiet">No saved looks.</p> : null}
      {saved.map((look) => (
        <section key={look.id} className="inv-phone-look-block" aria-label={look.name}>
          <h3 className="inv-phone-look-name">{look.name}</h3>
          <div className="inv-phone-look">
            {look.slots.map((slot) => {
              const piece = pieces.find((row) => row.id === slot.pieceId)
              if (!piece) return null
              return (
                <div
                  key={slot.pieceId}
                  className="inv-phone-look-piece"
                  data-testid={`closet-look-slot-${look.id}-${slot.pieceId}`}
                  style={{ left: unitPercent(slot.x), top: unitPercent(slot.y) }}
                >
                  <ClosetPhoto uri={piece.imageUri} className="inv-phone-look-img" />
                  <span>{piece.name}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <h2 className="inv-phone-stack">New look</h2>
      <form
        className="inv-phone-form"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <label className="inv-phone-field">
          Name
          <input value={name} aria-label="Look name" onChange={(event) => setName(event.target.value)} />
        </label>
        {pieces.length === 0 ? <p className="inv-phone-quiet">No pieces to place.</p> : null}
        <div className="inv-phone-toggles">
          {pieces.map((piece) => (
            <button
              key={piece.id}
              type="button"
              className="inv-phone-toggle"
              aria-pressed={selected.includes(piece.id)}
              onClick={() => toggle(piece.id)}
            >
              {piece.name}
            </button>
          ))}
        </div>
        {notice ? (
          <p className="inv-phone-notice" role="status">
            {notice}
          </p>
        ) : null}
        <button type="submit" className="inv-phone-save">
          Save look
        </button>
      </form>
    </div>
  )
}

function ClosetSettings() {
  const tasks = useTaskStore((state) => state.tasks)
  const lists = useTaskStore((state) => state.lists)
  const rows = useMemo(
    () =>
      packingRows(
        tasks.map((task) => ({
          id: task.id,
          title: itemTitle(task) || "Untitled",
          lists: task.lists,
          packKind: typeof task.attributes?.packKind === "string" ? task.attributes.packKind : "",
        })),
        lists.map((list) => ({ id: list.id, name: list.name })),
      ),
    [tasks, lists],
  )

  return (
    <div data-testid="closet-settings">
      <h2 className="inv-phone-stack">Categories</h2>
      <p className="inv-phone-quiet">Uncategorized is Other with no subtype.</p>
      <ul className="inv-phone-legend">
        {PIECE_CATEGORIES.map((id) => (
          <li key={id}>{PIECE_CATEGORY_LABEL[id]}</li>
        ))}
      </ul>
      <h2 className="inv-phone-stack">Packing</h2>
      {rows.length === 0 ? <p className="inv-phone-quiet">No packing lists.</p> : null}
      <ul className="inv-phone-packing">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className="inv-phone-pack-row" onClick={() => openItemDetailPopup(row.id)}>
              {row.title}
              {row.kind ? <span className="inv-phone-quiet"> {row.kind}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
