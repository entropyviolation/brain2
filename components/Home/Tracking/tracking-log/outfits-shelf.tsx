/**
 * components/Home/Tracking/tracking-log/outfits-shelf.tsx — Looks on the Tracking log day
 *
 * After Notes. The heading opens the closet: a month of looks and the piece
 * grid. A photo is one `idb:` URI on the outfit. Pieces are not Tasks.
 */
"use client"

import { useMemo, useState } from "react"
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns"
import { LogShelfDialog } from "@/components/Home/Tracking/tracking-log/log-shelf-dialog"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { putImageDataUrl } from "@/lib/attachments"
import { formatLocalDateKey } from "@/lib/date-utils"
import { minutesToLabel } from "@/lib/time-entries"
import {
  PIECE_CATEGORIES,
  PIECE_CATEGORY_LABEL,
  latestOutfit,
  outfitsOnDay,
  useWardrobeStore,
  type Piece,
  type PieceCategory,
} from "@/lib/wardrobe"
import { calendarDaysBetween } from "@/components/Analytics/time/shower-stats"

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"))
    reader.readAsDataURL(file)
  })
}

function LookThumb({ uri, alt }: { uri: string; alt: string }) {
  const src = useAttachmentSrc(uri)
  if (!src) return <span className="trk-outfit-thumb" aria-hidden />
  return <img className="trk-outfit-thumb" src={src} alt={alt} width={48} height={48} />
}

function pieceNames(ids: string[], pieces: Piece[]): string {
  const names = ids.map((id) => pieces.find((piece) => piece.id === id)?.name).filter(Boolean)
  return names.length ? names.join(", ") : "Untagged"
}

export function OutfitsShelf({
  dayKey,
  day,
  onOpenDay,
}: {
  dayKey: string
  day: Date
  onOpenDay: (date: Date) => void
}) {
  const pieces = useWardrobeStore((state) => state.pieces)
  const outfits = useWardrobeStore((state) => state.outfits)
  const addOutfit = useWardrobeStore((state) => state.addOutfit)
  const [open, setOpen] = useState(false)
  const [tagging, setTagging] = useState<string | null>(null)
  const looks = outfitsOnDay(outfits, dayKey)

  async function onFile(file: File | undefined) {
    if (!file) return
    const dataUrl = await readFile(file)
    const uri = await putImageDataUrl(dataUrl, file.name || "look.jpg")
    if (!uri || uri.startsWith("data:")) return
    const now = new Date()
    const id = addOutfit({
      dayKey,
      startMin: now.getHours() * 60 + now.getMinutes(),
      photoUri: uri,
      source: "desk",
    })
    if (id) setTagging(id)
  }

  return (
    <section className="trk-aside-well" data-face="steel" data-empty={looks.length ? "false" : "true"} aria-label="Outfits">
      <button type="button" className="trk-logbook-heading trk-logbook-heading-open" onClick={() => setOpen(true)}>
        <span>Outfits</span>
        <span className="trk-logbook-count">{looks.length}</span>
      </button>
      {looks.length === 0 ? (
        <p className="trk-shelf-empty">Nothing worn this day.</p>
      ) : (
        <ul className="trk-outfit-day" aria-label="Looks this day">
          {looks.map((look) => (
            <li key={look.id}>
              <LookThumb uri={look.photoUri} alt="" />
              <span>{minutesToLabel(look.startMin)}</span>
              <span>{pieceNames(look.pieceIds, pieces)}</span>
            </li>
          ))}
        </ul>
      )}
      <label className="trk-keycap" data-no95="">
        +
        <input
          type="file"
          accept="image/*"
          aria-label="Add outfit"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            void onFile(file)
          }}
        />
      </label>
      {tagging ? <Tagger outfitId={tagging} onClose={() => setTagging(null)} /> : null}
      <LogShelfDialog open={open} onOpenChange={setOpen} title="Outfits" description="Looks and the closet.">
        <Closet anchor={day} onOpenDay={onOpenDay} />
      </LogShelfDialog>
    </section>
  )
}

function Tagger({ outfitId, onClose }: { outfitId: string; onClose: () => void }) {
  const pieces = useWardrobeStore((state) => state.pieces)
  const outfit = useWardrobeStore((state) => state.outfits.find((row) => row.id === outfitId))
  const addPiece = useWardrobeStore((state) => state.addPiece)
  const updateOutfit = useWardrobeStore((state) => state.updateOutfit)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<PieceCategory | null>(null)
  const [subtype, setSubtype] = useState("")
  if (!outfit) return null
  const needle = query.trim().toLowerCase()
  const matches = needle ? pieces.filter((piece) => piece.name.toLowerCase().includes(needle)) : pieces
  const exact = pieces.find((piece) => piece.name.toLowerCase() === needle)

  function toggle(id: string) {
    const next = outfit!.pieceIds.includes(id) ? outfit!.pieceIds.filter((pieceId) => pieceId !== id) : [...outfit!.pieceIds, id]
    updateOutfit(outfitId, { pieceIds: next })
  }

  function create() {
    if (!category || !query.trim()) return
    const id = addPiece({ name: query.trim(), category, subtype: subtype.trim() || undefined })
    if (!id) return
    updateOutfit(outfitId, { pieceIds: [...outfit!.pieceIds, id] })
    setQuery("")
    setCategory(null)
    setSubtype("")
  }

  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <div className="trk-outfit-tagger" aria-label="Tag pieces">
      <input
        type="time"
        aria-label="Look clock"
        value={`${pad(Math.floor(outfit.startMin / 60))}:${pad(outfit.startMin % 60)}`}
        onChange={(event) => {
          const [h, m] = event.target.value.split(":").map(Number)
          if (Number.isFinite(h) && Number.isFinite(m)) updateOutfit(outfitId, { startMin: h! * 60 + m! })
        }}
      />
      <input
        aria-label="Piece name"
        value={query}
        placeholder="Piece"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          if (exact) toggle(exact.id)
          else if (query.trim()) setCategory((current) => current ?? "top")
        }}
      />
      <ul>
        {matches.map((piece) => (
          <li key={piece.id}>
            <button type="button" aria-pressed={outfit.pieceIds.includes(piece.id)} onClick={() => toggle(piece.id)}>
              {piece.name}
            </button>
          </li>
        ))}
      </ul>
      {query.trim() && !exact ? (
        <div className="trk-span-switch" role="toolbar" aria-label="New piece category">
          {PIECE_CATEGORIES.map((id) => (
            <button
              key={id}
              type="button"
              className="trk-keycap"
              data-no95=""
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
            >
              {PIECE_CATEGORY_LABEL[id]}
            </button>
          ))}
          <input aria-label="Subtype" value={subtype} placeholder="Subtype" onChange={(event) => setSubtype(event.target.value)} />
          <button type="button" onClick={create} disabled={!category}>
            Add piece
          </button>
        </div>
      ) : null}
      <button type="button" onClick={onClose}>
        Done
      </button>
    </div>
  )
}

function Closet({ anchor, onOpenDay }: { anchor: Date; onOpenDay: (date: Date) => void }) {
  const pieces = useWardrobeStore((state) => state.pieces)
  const outfits = useWardrobeStore((state) => state.outfits)
  const [cursor, setCursor] = useState(() => startOfMonth(anchor))
  const [category, setCategory] = useState<PieceCategory | "all">("all")
  const [subtype, setSubtype] = useState<string | null>(null)
  const [openPiece, setOpenPiece] = useState<string | null>(null)
  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) })
  const lead = (days[0]!.getDay() + 6) % 7
  const subtypes = useMemo(() => {
    const pool = pieces.filter((piece) => category === "all" || piece.category === category)
    const counts = new Map<string, number>()
    for (const piece of pool) {
      if (!piece.subtype) continue
      counts.set(piece.subtype, (counts.get(piece.subtype) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [pieces, category])
  const shown = pieces.filter((piece) => {
    if (category !== "all" && piece.category !== category) return false
    if (subtype && piece.subtype !== subtype) return false
    return true
  })
  const detail = pieces.find((piece) => piece.id === openPiece) ?? null
  const today = formatLocalDateKey(new Date())

  return (
    <div className="trk-closet">
      <div className="trk-closet-month">
        <button type="button" aria-label="Previous month" onClick={() => setCursor((month) => addMonths(month, -1))}>
          Prev
        </button>
        <p>{format(cursor, "MMMM yyyy")}</p>
        <button type="button" aria-label="Next month" onClick={() => setCursor((month) => addMonths(month, 1))}>
          Next
        </button>
      </div>
      <div className="trk-outfit-month" aria-label="Looks">
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} />
        ))}
        {days.map((date) => {
          const key = formatLocalDateKey(date)
          const dayLooks = outfitsOnDay(outfits, key)
          const look = latestOutfit(dayLooks)
          return (
            <button key={key} type="button" className="trk-outfit-cell" onClick={() => onOpenDay(date)}>
              <span>{format(date, "d")}</span>
              {look ? <LookThumb uri={look.photoUri} alt="" /> : null}
              {dayLooks.length > 1 ? <span>{dayLooks.length}</span> : null}
            </button>
          )
        })}
      </div>
      <div className="trk-span-switch" role="toolbar" aria-label="Piece categories">
        <button type="button" className="trk-keycap" data-no95="" aria-pressed={category === "all"} onClick={() => { setCategory("all"); setSubtype(null) }}>
          All
        </button>
        {PIECE_CATEGORIES.map((id) => (
          <button
            key={id}
            type="button"
            className="trk-keycap"
            data-no95=""
            aria-pressed={category === id}
            onClick={() => { setCategory(id); setSubtype(null) }}
          >
            {PIECE_CATEGORY_LABEL[id]}
          </button>
        ))}
      </div>
      {subtypes.length ? (
        <div className="trk-span-switch" role="toolbar" aria-label="Subtypes">
          {subtypes.map(([name, count]) => (
            <button key={name} type="button" className="trk-keycap" data-no95="" aria-pressed={subtype === name} onClick={() => setSubtype(subtype === name ? null : name)}>
              {name} {count}
            </button>
          ))}
        </div>
      ) : null}
      <ul className="trk-piece-grid" aria-label="Pieces">
        {shown.map((piece) => (
          <li key={piece.id}>
            <button type="button" onClick={() => setOpenPiece(piece.id)}>
              {piece.name}
            </button>
          </li>
        ))}
      </ul>
      {detail ? <PieceDetail piece={detail} outfits={outfits} today={today} /> : null}
    </div>
  )
}

function PieceDetail({
  piece,
  outfits,
  today,
}: {
  piece: Piece
  outfits: { dayKey: string; pieceIds: string[]; photoUri: string }[]
  today: string
}) {
  const worn = outfits.filter((outfit) => outfit.pieceIds.includes(piece.id))
  const days = [...new Set(worn.map((outfit) => outfit.dayKey))].sort()
  const last = days[days.length - 1] ?? null
  return (
    <div aria-label={piece.name}>
      {piece.imageUri ? <LookThumb uri={piece.imageUri} alt={piece.name} /> : null}
      <p>
        {worn.length} worn · last {last ?? "never"}
        {last ? ` · ${calendarDaysBetween(last, today)} days` : ""}
      </p>
      <p>{days.join(", ")}</p>
    </div>
  )
}
