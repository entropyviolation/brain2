/**
 * components/Home/Tracking/time-grid.tsx — TimeGrid life tracker
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Plus, Trash2, Eraser, Pencil } from "lucide-react"
import {
  useTimeTrackingStore,
  SLOT_MINUTES,
  SLOTS_PER_DAY,
  slotToLabel,
  timeStringToSlot,
  type TrackPen,
  type TimeBlockDetail,
} from "@/lib/time-tracking-store"

const COLS_PER_HOUR = 60 / SLOT_MINUTES

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function findBlockRange(slots: (string | null)[], slot: number): { start: number; end: number; penId: string } | null {
  const penId = slots[slot]
  if (!penId) return null
  let start = slot
  let end = slot
  while (start > 0 && slots[start - 1] === penId) start--
  while (end < SLOTS_PER_DAY - 1 && slots[end + 1] === penId) end++
  return { start, end, penId }
}

export function TimeGrid({ compact = false }: { compact?: boolean }) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const data = useTimeTrackingStore((s) => s.data)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const setActiveScope = useTimeTrackingStore((s) => s.setActiveScope)
  const setSelectedPen = useTimeTrackingStore((s) => s.setSelectedPen)
  const addScope = useTimeTrackingStore((s) => s.addScope)
  const removeScope = useTimeTrackingStore((s) => s.removeScope)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const updatePen = useTimeTrackingStore((s) => s.updatePen)
  const removePen = useTimeTrackingStore((s) => s.removePen)
  const paintRange = useTimeTrackingStore((s) => s.paintRange)
  const paintSlotInStore = useTimeTrackingStore((s) => s.paintSlot)
  const clearDay = useTimeTrackingStore((s) => s.clearDay)
  const setBlockDetail = useTimeTrackingStore((s) => s.setBlockDetail)
  const getBlockDetail = useTimeTrackingStore((s) => s.getBlockDetail)

  const [date, setDate] = useState(() => new Date())
  const dk = dateKey(date)
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const slots = (scope && data[dk]?.[scope.id]) || new Array(SLOTS_PER_DAY).fill(null)

  const draggingRef = useRef(false)
  const paintedRef = useRef(false)
  const dragStartSlot = useRef<number | null>(null)
  const [rangeFrom, setRangeFrom] = useState("09:00")
  const [rangeTo, setRangeTo] = useState("10:00")
  const [manage, setManage] = useState(false)
  const [newPenName, setNewPenName] = useState("")
  const [newPenColor, setNewPenColor] = useState("#3b82f6")
  const [editingPen, setEditingPen] = useState<TrackPen | null>(null)
  const [blockDetail, setBlockDetailState] = useState<TimeBlockDetail | null>(null)

  useEffect(() => {
    const up = () => {
      draggingRef.current = false
      paintedRef.current = false
      dragStartSlot.current = null
    }
    window.addEventListener("mouseup", up)
    window.addEventListener("touchend", up)
    window.addEventListener("touchcancel", up)
    return () => {
      window.removeEventListener("mouseup", up)
      window.removeEventListener("touchend", up)
      window.removeEventListener("touchcancel", up)
    }
  }, [])

  const penById = useCallback(
    (id: string | null) => (id ? scope?.pens.find((p) => p.id === id) || null : null),
    [scope],
  )

  const paintSlot = useCallback(
    (slot: number) => {
      if (!scope || selectedPenId === null) return
      paintedRef.current = true
      paintSlotInStore(dk, scope.id, slot, selectedPenId === "ERASE" ? null : selectedPenId)
    },
    [scope, selectedPenId, paintSlotInStore, dk],
  )

  const openBlockDetail = (slot: number) => {
    if (!scope) return
    const range = findBlockRange(slots, slot)
    if (!range) return
    const existing =
      getBlockDetail(dk, scope.id, range.penId, range.start, range.end) ||
      useTimeTrackingStore
        .getState()
        .blockDetails.find(
          (b) =>
            b.date === dk &&
            b.scopeId === scope.id &&
            b.penId === range.penId &&
            b.startSlot <= range.end &&
            b.endSlot >= range.start,
        ) ||
      ({
        date: dk,
        scopeId: scope.id,
        penId: range.penId,
        startSlot: range.start,
        endSlot: range.end,
      } as TimeBlockDetail)
    setBlockDetailState({ ...existing, startSlot: range.start, endSlot: range.end })
  }

  const effectivePenId = selectedPenId === "ERASE" ? null : selectedPenId

  const handleSlotMouseUp = (slot: number) => {
    const isClick = dragStartSlot.current === slot && !paintedRef.current
    const cellPenId = slots[slot]

    if (isClick && scope) {
      if (cellPenId) {
        if (selectedPenId === cellPenId) {
          openBlockDetail(slot)
        } else if (selectedPenId !== null) {
          paintSlot(slot)
        }
      } else if (selectedPenId !== null && selectedPenId !== "ERASE") {
        paintSlot(slot)
      }
    }

    draggingRef.current = false
    dragStartSlot.current = null
    paintedRef.current = false
  }

  const applyTypedRange = () => {
    if (!scope) return
    if (selectedPenId === null) {
      alert("Select a pen (or Erase) first.")
      return
    }
    const from = timeStringToSlot(rangeFrom)
    const to = timeStringToSlot(rangeTo)
    if (from === null || to === null) return
    const endSlot = to <= from ? to : to - 1
    paintRange(dk, scope.id, from, Math.max(from, endSlot), selectedPenId === "ERASE" ? null : selectedPenId)
  }

  const totals: Record<string, number> = {}
  slots.forEach((id) => {
    if (id) totals[id] = (totals[id] || 0) + SLOT_MINUTES
  })
  const untracked = slots.filter((s) => !s).length * SLOT_MINUTES

  const fmtMins = (m: number) => {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return h > 0 ? `${h}h${mm ? ` ${mm}m` : ""}` : `${mm}m`
  }

  if (!scope) return <div className="text-sm text-muted-foreground">No tracking scopes.</div>

  const pen = blockDetail ? penById(blockDetail.penId) : null

  return (
    <div className="space-y-4 select-none">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(new Date(date.getTime() - 864e5))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
          Today
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDate(new Date(date.getTime() + 864e5))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="font-semibold ml-1">
          {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => clearDay(dk, scope.id)}>
          Clear day
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {scopes.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveScope(s.id)}
            className={`px-3 py-1 text-sm border rounded ${
              s.id === scope.id ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            }`}
          >
            {s.name}
          </button>
        ))}
        <button
          onClick={() => {
            const name = prompt("New tracking scope (e.g. Frame, Company):")
            if (name?.trim()) addScope(name.trim())
          }}
          className="px-2 py-1 text-sm border rounded bg-background hover:bg-muted"
          title="Add scope"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {scopes.length > 1 && (
          <button
            onClick={() => {
              if (confirm(`Remove scope "${scope.name}"?`)) removeScope(scope.id)
            }}
            className="px-2 py-1 text-sm border rounded bg-background hover:bg-muted text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {scope.pens.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPen(p.id)}
            className={`flex items-center gap-1.5 px-2 py-1 text-sm border rounded ${
              selectedPenId === p.id ? "ring-2 ring-offset-1 ring-primary" : ""
            }`}
            style={{ background: p.color, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.4)" }}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setSelectedPen("ERASE")}
          className={`flex items-center gap-1 px-2 py-1 text-sm border rounded bg-background hover:bg-muted ${
            selectedPenId === "ERASE" ? "ring-2 ring-primary" : ""
          }`}
        >
          <Eraser className="h-3.5 w-3.5" /> Erase
        </button>
        <button onClick={() => setManage((m) => !m)} className="px-2 py-1 text-sm border rounded bg-background hover:bg-muted">
          {manage ? "Done" : "Edit pens"}
        </button>
      </div>

      {manage && (
        <div className="border rounded p-3 space-y-3 bg-muted/40">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={newPenName} onChange={(e) => setNewPenName(e.target.value)} placeholder="Pen name" className="h-8 w-40" />
            <input type="color" value={newPenColor} onChange={(e) => setNewPenColor(e.target.value)} className="h-8 w-12" />
            <Button
              size="sm"
              onClick={() => {
                if (newPenName.trim()) {
                  addPen(scope.id, { name: newPenName.trim(), color: newPenColor })
                  setNewPenName("")
                }
              }}
            >
              Add pen
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {scope.pens.map((p) => (
              <span key={p.id} className="flex items-center gap-1 text-xs border rounded px-2 py-1 bg-background">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: p.color }} />
                {p.name}
                <button onClick={() => setEditingPen({ ...p })} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => removePen(scope.id, p.id)} className="text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {editingPen && (
        <Dialog open onOpenChange={() => setEditingPen(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit pen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editingPen.name} onChange={(e) => setEditingPen({ ...editingPen, name: e.target.value })} />
              </div>
              <div>
                <Label>Color</Label>
                <input type="color" value={editingPen.color} onChange={(e) => setEditingPen({ ...editingPen, color: e.target.value })} className="h-10 w-full" />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  updatePen(scope.id, editingPen)
                  setEditingPen(null)
                }}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-[10px]">From</Label>
          <Input type="time" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="h-8 w-28" />
        </div>
        <div>
          <Label className="text-[10px]">To</Label>
          <Input type="time" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="h-8 w-28" />
        </div>
        <Button size="sm" variant="outline" onClick={applyTypedRange}>
          Fill range with {selectedPenId === "ERASE" ? "erase" : penById(effectivePenId)?.name || "selected pen"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag (or finger-drag) to paint one slot at a time. Tap a block with the same pen selected to add details; another pen or Erase changes only that slot.
      </p>

      <div className="overflow-auto border rounded bg-white" style={{ maxHeight: compact ? 360 : "none" }}>
        <div className="inline-block min-w-full">
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="flex items-stretch border-b last:border-b-0" style={{ height: 22 }}>
              <div className="w-16 shrink-0 text-[10px] text-muted-foreground flex items-center justify-end pr-2 border-r">
                {slotToLabel(hour * COLS_PER_HOUR)}
              </div>
              <div className="flex flex-1">
                {Array.from({ length: COLS_PER_HOUR }, (_, c) => {
                  const slot = hour * COLS_PER_HOUR + c
                  const cellPen = penById(slots[slot])
                  return (
                    <div
                      key={c}
                      title={`${slotToLabel(slot)}${cellPen ? ` · ${cellPen.name}` : ""}`}
                      onMouseDown={() => {
                        dragStartSlot.current = slot
                        draggingRef.current = true
                      }}
                      onMouseEnter={() => {
                        if (draggingRef.current && dragStartSlot.current !== null) {
                          paintedRef.current = true
                          paintSlot(slot)
                        }
                      }}
                      onMouseUp={() => handleSlotMouseUp(slot)}
                      onTouchStart={(e) => {
                        // Paint via touch without blocking page scroll unless a pen is selected.
                        if (selectedPenId === null) return
                        e.preventDefault()
                        dragStartSlot.current = slot
                        draggingRef.current = true
                        paintSlot(slot)
                      }}
                      onTouchMove={(e) => {
                        if (!draggingRef.current || selectedPenId === null) return
                        e.preventDefault()
                        const t = e.touches[0]
                        if (!t) return
                        const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
                        const slotAttr = el?.dataset?.timeslot
                        if (slotAttr == null) return
                        const next = Number(slotAttr)
                        if (!Number.isFinite(next)) return
                        paintedRef.current = true
                        paintSlot(next)
                      }}
                      onTouchEnd={() => handleSlotMouseUp(slot)}
                      data-timeslot={slot}
                      className="flex-1 border-r last:border-r-0 cursor-pointer touch-none"
                      style={{ background: cellPen?.color || "transparent" }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {scope.pens
          .filter((p) => totals[p.id])
          .map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: p.color }} />
              {p.name}: <span className="font-medium">{fmtMins(totals[p.id])}</span>
            </span>
          ))}
        <span className="text-muted-foreground">Untracked: {fmtMins(untracked)}</span>
      </div>

      {blockDetail && pen && (
        <Dialog open onOpenChange={() => setBlockDetailState(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ color: pen.color }}>
                {pen.name} · {slotToLabel(blockDetail.startSlot)} – {slotToLabel(blockDetail.endSlot + 1)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>What specifically?</Label>
                <Input
                  value={blockDetail.title || ""}
                  onChange={(e) => setBlockDetailState({ ...blockDetail, title: e.target.value })}
                  placeholder={scope.id === "activity" ? "e.g. Reading, Coding project X" : "Details"}
                />
              </div>
              {scope.id === "activity" && (
                <>
                  <div>
                    <Label>Project / context</Label>
                    <Input
                      value={blockDetail.project || ""}
                      onChange={(e) => setBlockDetailState({ ...blockDetail, project: e.target.value })}
                      placeholder="Which project or area"
                    />
                  </div>
                  <div>
                    <Label>Book(s)</Label>
                    <Input
                      value={blockDetail.books || ""}
                      onChange={(e) => setBlockDetailState({ ...blockDetail, books: e.target.value })}
                      placeholder="Title(s)"
                    />
                  </div>
                  <div>
                    <Label>Pages read</Label>
                    <Input
                      type="number"
                      value={blockDetail.pages ?? ""}
                      onChange={(e) =>
                        setBlockDetailState({ ...blockDetail, pages: Number.parseInt(e.target.value) || undefined })
                      }
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={blockDetail.notes || ""}
                  onChange={(e) => setBlockDetailState({ ...blockDetail, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setBlockDetail(blockDetail)
                  setBlockDetailState(null)
                }}
              >
                Save details
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
