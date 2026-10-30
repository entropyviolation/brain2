"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useWardrobeStore, withCompositionSlot, type CompositionSlot } from "@/lib/wardrobe"
import { ClosetPhoto } from "./closet-photo"

function pointOnBoard(board: HTMLElement, event: { clientX: number; clientY: number }): { x: number; y: number } | null {
  const rect = board.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
}

export function ClosetBoard() {
  const pieces = useWardrobeStore((state) => state.pieces)
  const compositions = useWardrobeStore((state) => state.compositions)
  const addComposition = useWardrobeStore((state) => state.addComposition)
  const updateComposition = useWardrobeStore((state) => state.updateComposition)
  const removeComposition = useWardrobeStore((state) => state.removeComposition)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragEnd = useRef<(() => void) | null>(null)
  const [name, setName] = useState("")
  const [slots, setSlots] = useState<CompositionSlot[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState("")

  useEffect(() => () => dragEnd.current?.(), [])

  function startDrag(pieceId: string, event: ReactPointerEvent) {
    event.preventDefault()
    dragEnd.current?.()
    const pointerId = event.pointerId
    let inside = false
    const place = (ev: PointerEvent) => {
      const board = boardRef.current
      if (!board) return
      const point = pointOnBoard(board, ev)
      if (!point) return
      const over = point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
      if (!over) {
        inside = false
        return
      }
      inside = true
      setSlots((current) => withCompositionSlot(current, pieceId, point.x, point.y))
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      place(ev)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      place(ev)
      if (!inside) setSlots((current) => current.filter((slot) => slot.pieceId !== pieceId))
      end()
    }
    const end = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      if (dragEnd.current === end) dragEnd.current = null
    }
    dragEnd.current = end
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  function load(id: string) {
    const row = compositions.find((item) => item.id === id)
    if (!row) return
    setEditingId(row.id)
    setName(row.name)
    setSlots(row.slots.map((slot) => ({ ...slot })))
    setNotice("")
  }

  function clearBoard() {
    setEditingId(null)
    setName("")
    setSlots([])
    setNotice("")
  }

  function save() {
    if (editingId) {
      const ok = updateComposition(editingId, { name, slots })
      setNotice(ok ? "" : "Look was not saved.")
      return
    }
    const id = addComposition({ name, slots })
    if (!id) {
      setNotice("Look was not saved.")
      return
    }
    setEditingId(id)
    setNotice("")
  }

  const saved = [...compositions].sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name))

  return (
    <div className="inv-closet-board-wrap" data-testid="closet-board">
      <div className="inv-closet-board-stage">
        <div ref={boardRef} className="inv-closet-board" data-testid="closet-board-surface" aria-label="Mix and match board">
          {slots.map((slot) => {
            const piece = pieces.find((row) => row.id === slot.pieceId)
            if (!piece) return null
            return (
              <button
                key={piece.id}
                type="button"
                className="inv-closet-placed"
                aria-label={piece.name}
                style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
                onPointerDown={(event) => startDrag(piece.id, event)}
              >
                <ClosetPhoto uri={piece.imageUri} className="inv-closet-cutout" />
                {piece.imageUri ? null : <span className="inv-closet-placed-name">{piece.name}</span>}
              </button>
            )
          })}
        </div>
        <div className="inv-closet-tray" data-testid="closet-tray" aria-label="Pieces to place">
          {pieces.length === 0 ? <p className="inv-closet-empty">No pieces.</p> : null}
          {pieces.map((piece) => (
            <button
              key={piece.id}
              type="button"
              className="inv-closet-tray-piece"
              aria-label={piece.name}
              aria-pressed={slots.some((slot) => slot.pieceId === piece.id)}
              onPointerDown={(event) => startDrag(piece.id, event)}
            >
              <ClosetPhoto uri={piece.imageUri} className="inv-closet-cutout" />
              <span>{piece.name}</span>
            </button>
          ))}
        </div>
      </div>
      <form
        className="inv-closet-form"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <label className="inv-closet-field">
          Name
          <input value={name} aria-label="Look name" onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="inv-closet-form-actions">
          <button type="submit" className="inv-closet-save" disabled={!name.trim() || slots.length === 0}>
            Save
          </button>
          <button type="button" className="inv-closet-quiet" onClick={clearBoard}>
            New board
          </button>
          {editingId ? (
            <button
              type="button"
              className="inv-closet-quiet"
              onClick={() => {
                removeComposition(editingId)
                clearBoard()
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
        {notice ? (
          <p className="inv-closet-notice" role="status">
            {notice}
          </p>
        ) : null}
      </form>
      {saved.length === 0 ? (
        <p className="inv-closet-empty">No saved looks.</p>
      ) : (
        <ul className="inv-closet-saved">
          {saved.map((row) => (
            <li key={row.id}>
              <button type="button" className="inv-closet-saved-btn" aria-current={editingId === row.id ? "true" : undefined} onClick={() => load(row.id)}>
                {row.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
