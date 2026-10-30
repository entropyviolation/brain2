"use client"

import { useMemo } from "react"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import { itemTitle } from "@/lib/item-utils"
import { useWardrobeStore, type Outfit, type Piece } from "@/lib/wardrobe"
import { packingRows, type PackingRow } from "./packing-rows"
import { ClosetPhoto } from "./closet-photo"

function clock(min: number): string {
  const hours = Math.floor(min / 60)
  const minutes = min % 60
  return `${hours}:${minutes.toString().padStart(2, "0")}`
}

function wearsNewestFirst(outfits: readonly Outfit[]): Outfit[] {
  return [...outfits].sort((a, b) => b.dayKey.localeCompare(a.dayKey) || b.startMin - a.startMin || b.id.localeCompare(a.id))
}

function pieceNames(ids: readonly string[], pieces: readonly Piece[]): string {
  const names = ids.map((id) => pieces.find((piece) => piece.id === id)?.name).filter((name): name is string => Boolean(name))
  return names.length ? names.join(", ") : "Untagged"
}

export function ClosetWears() {
  const pieces = useWardrobeStore((state) => state.pieces)
  const outfits = useWardrobeStore((state) => state.outfits)
  const wears = wearsNewestFirst(outfits)
  if (wears.length === 0) return <p className="inv-closet-empty">No wears.</p>
  return (
    <ul className="inv-closet-wears" data-testid="closet-wears">
      {wears.map((wear) => (
        <li key={wear.id} className="inv-closet-wear">
          <ClosetPhoto uri={wear.photoUri} className="inv-closet-wear-photo" />
          <div>
            <p className="inv-closet-wear-when">
              {wear.dayKey} · {clock(wear.startMin)}
            </p>
            <p>{pieceNames(wear.pieceIds, pieces)}</p>
            {wear.note ? <p className="inv-closet-note">{wear.note}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

function groupRows(rows: readonly PackingRow[]): { listName: string; rows: PackingRow[] }[] {
  const groups: { listName: string; rows: PackingRow[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.listName === row.listName) last.rows.push(row)
    else groups.push({ listName: row.listName, rows: [row] })
  }
  return groups
}

export function ClosetPacking() {
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
  if (rows.length === 0) return <p className="inv-closet-empty">No packing lists.</p>
  const groups = groupRows(rows)
  return (
    <div className="inv-closet-packing" data-testid="closet-packing">
      {groups.map((group) => (
        <section key={group.listName} aria-label={group.listName}>
          <h3 className="inv-closet-pack-list">{group.listName}</h3>
          <ul className="inv-closet-pack-items">
            {group.rows.map((row) => (
              <li key={row.id}>
                <button type="button" className="inv-closet-pack-link" onClick={() => openItemDetailPopup(row.id)}>
                  {row.title}
                  {row.kind ? <span className="inv-closet-note"> {row.kind}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function ClosetPlanned({ line }: { line: string }) {
  return <p className="inv-closet-empty">{line}</p>
}
