"use client"

import { useMemo, useRef, useState } from "react"
import { putImageDataUrl } from "@/lib/attachments"
import { PIECE_CATEGORIES, PIECE_CATEGORY_LABEL, useWardrobeStore, type PieceCategory } from "@/lib/wardrobe"
import { pieceChipId, type PieceChipId } from "./piece-chip"
import { piecePhotoDataUrl } from "./piece-photo"
import { ClosetPhoto } from "./closet-photo"

type Chip = "all" | PieceChipId

function nameFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  return base || "Piece"
}

export function ClosetGrid() {
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
    <div className="inv-closet-pieces" data-testid="closet-grid">
      <div className="inv-closet-toolbar">
        <div className="inv-closet-chips" role="group" aria-label="Piece categories">
          {chips.map((row) => (
            <button
              key={row.id}
              type="button"
              className="inv-closet-chip"
              aria-pressed={active === row.id}
              data-testid={`closet-chip-${row.id}`}
              onClick={() => setChip(row.id)}
            >
              {row.label}
            </button>
          ))}
        </div>
        <button type="button" className="inv-closet-new" onClick={() => fileRef.current?.click()}>
          New Item
        </button>
        <input
          ref={fileRef}
          className="inv-closet-file"
          type="file"
          accept="image/*"
          aria-label="Piece photo"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
      </div>
      {notice ? (
        <p className="inv-closet-notice" role="status">
          {notice}
        </p>
      ) : null}
      {file ? (
        <form
          className="inv-closet-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {preview ? <img className="inv-closet-form-preview" src={preview} alt="" /> : null}
          <label className="inv-closet-field">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Name" />
          </label>
          <label className="inv-closet-field">
            Category
            <select value={category} aria-label="Category" onChange={(event) => setCategory(event.target.value as PieceCategory)}>
              {PIECE_CATEGORIES.map((id) => (
                <option key={id} value={id}>
                  {PIECE_CATEGORY_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="inv-closet-check">
            <input type="checkbox" checked={cutout} onChange={(event) => setCutout(event.target.checked)} />
            Cut out the background
          </label>
          <div className="inv-closet-form-actions">
            <button type="submit" className="inv-closet-save" disabled={busy || !name.trim()}>
              {busy ? "Saving" : "Save piece"}
            </button>
            <button type="button" className="inv-closet-quiet" onClick={clearDraft} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {visible.length === 0 ? (
        <p className="inv-closet-empty">No pieces.</p>
      ) : (
        <ul className="inv-closet-grid">
          {visible.map((piece) => (
            <li key={piece.id} className="inv-closet-card">
              <ClosetPhoto uri={piece.imageUri} className="inv-closet-cutout" />
              <span className="inv-closet-card-name">{piece.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
