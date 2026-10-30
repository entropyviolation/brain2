/**
 * components/Inventory/phone kitchen — Room list, no Three.js
 *
 * Pantry, fridge, freezer, and the spice cabinet when the store has that
 * room. Same living lots as the desktop scene. The add form writes a lot
 * with `putAway`. Large tap targets.
 */
"use client"

import { useMemo, useState } from "react"
import { useKitchenStore } from "@/lib/kitchen-store"
import type { KitchenRoom } from "@/lib/kitchen-types"
import { KitchenAddForm } from "./kitchen-add-form"
import {
  describeKitchenPick,
  filterShelfRows,
  groupShelfRows,
  plannedMealLine,
  stockToShelfRows,
  type KitchenPick,
} from "./kitchen-rows"
import "./kitchen.css"

export function KitchenPhone() {
  const stock = useKitchenStore((s) => s.stock)
  const foods = useKitchenStore((s) => s.foods)
  const planCount = useKitchenStore((s) => s.plan.length)
  const [query, setQuery] = useState("")
  const [pick, setPick] = useState<KitchenPick | null>(null)
  const [room, setRoom] = useState<KitchenRoom>("pantry")
  const allRows = useMemo(() => stockToShelfRows(stock, foods), [stock, foods])
  const rows = useMemo(() => filterShelfRows(allRows, query), [allRows, query])
  const groups = useMemo(() => groupShelfRows(rows), [rows])
  const detail = describeKitchenPick(pick, allRows)
  const meals = plannedMealLine(planCount)

  const chooseRoom = (next: KitchenRoom) => {
    setRoom(next)
    setPick({ kind: "room", room: next })
  }

  return (
    <div className="inv-kitchen-phone" data-testid="kitchen-phone">
      <p className="inv-kitchen-plan">{lotCount(allRows.length)}</p>
      {meals ? <p className="inv-kitchen-plan">{meals}</p> : null}
      <KitchenAddForm room={room} onRoom={chooseRoom} onAdded={chooseRoom} />
      <label className="inv-kitchen-search">
        <span>Filter</span>
        <input aria-label="Filter foods" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {detail ? (
        <p className="inv-kitchen-detail" data-testid="kitchen-detail">
          {detail}
        </p>
      ) : null}
      {allRows.length === 0 ? <p className="inv-kitchen-empty">The kitchen is empty.</p> : null}
      {allRows.length > 0 && rows.length === 0 ? <p className="inv-kitchen-empty">Nothing matches.</p> : null}
      {groups.map((group) => (
        <section key={group.room} className="inv-kitchen-room" aria-label={group.label}>
          <button
            type="button"
            className="inv-kitchen-room-name"
            aria-pressed={pick?.kind === "room" && pick.room === group.room}
            onClick={() => chooseRoom(group.room)}
          >
            {group.label}
          </button>
          <ul>
            {group.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="inv-kitchen-row"
                  aria-current={pick?.kind === "lot" && pick.id === row.id ? "true" : undefined}
                  onClick={() => {
                    setPick({ kind: "lot", id: row.id })
                    setRoom(row.room)
                  }}
                >
                  <span>{row.name}</span>
                  <span className="inv-kitchen-row-amt">{row.amountLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function lotCount(count: number): string {
  return `${count} ${count === 1 ? "lot" : "lots"}`
}
