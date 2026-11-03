/**
 * components/Inventory/kitchen/kitchen-scene.tsx — Desktop kitchen scene
 *
 * Mounts the tracking `KitchenStage`. Stock is the kitchen store. A click
 * selects a lot or a room and names where it sits. The add form writes a
 * living lot into that room with `putAway`. The list under the stage is the
 * same lots, so the shelf still reads if WebGL does not.
 */
"use client"

import { useMemo, useState } from "react"
import { KitchenStage } from "@/components/Home/Tracking/tracking-log/food/kitchen-stage"
import { useKitchenStore } from "@/lib/kitchen-store"
import type { KitchenRoom } from "@/lib/kitchen-types"
import { KitchenAddForm } from "./kitchen-add-form"
import {
  activeRoomForPick,
  describeKitchenPick,
  filterShelfRows,
  plannedMealLine,
  shelfRowsToDioramaLots,
  stockToShelfRows,
  type KitchenPick,
} from "./kitchen-rows"
import "./kitchen.css"

export function KitchenScene() {
  const stock = useKitchenStore((s) => s.stock)
  const foods = useKitchenStore((s) => s.foods)
  const planCount = useKitchenStore((s) => s.plan.length)
  const [query, setQuery] = useState("")
  const [pick, setPick] = useState<KitchenPick | null>(null)
  const [room, setRoom] = useState<KitchenRoom>("pantry")
  const allRows = useMemo(() => stockToShelfRows(stock, foods), [stock, foods])
  const rows = useMemo(() => filterShelfRows(allRows, query), [allRows, query])
  const lots = useMemo(() => shelfRowsToDioramaLots(rows), [rows])
  const detail = describeKitchenPick(pick, allRows)
  const meals = plannedMealLine(planCount)

  const chooseRoom = (next: KitchenRoom) => {
    setRoom(next)
    setPick({ kind: "room", room: next })
  }

  return (
    <section className="inv-stage inv-kitchen" aria-label="Kitchen" data-testid="kitchen-scene">
      <p className="inv-stage-count">{lotCount(allRows.length)}</p>
      {meals ? <p className="inv-kitchen-plan">{meals}</p> : null}
      <KitchenAddForm room={room} onRoom={chooseRoom} onAdded={chooseRoom} />
      <div className="inv-kitchen-window">
        <KitchenStage
          lots={lots}
          active={activeRoomForPick(pick, allRows)}
          onRoom={chooseRoom}
          onLot={(id) => {
            setPick({ kind: "lot", id })
            const found = allRows.find((row) => row.id === id)
            if (found) setRoom(found.room)
          }}
        />
      </div>
      {detail ? (
        <p className="inv-kitchen-detail" data-testid="kitchen-detail">
          {detail}
        </p>
      ) : null}
      <label className="inv-kitchen-filter">
        Filter
        <input aria-label="Filter foods" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {allRows.length === 0 ? <p className="inv-kitchen-empty">The kitchen is empty.</p> : null}
      {allRows.length > 0 && rows.length === 0 ? <p className="inv-kitchen-empty">Nothing matches.</p> : null}
      {rows.length > 0 ? (
        <ul className="inv-kitchen-lots">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="inv-kitchen-lot"
                aria-current={pick?.kind === "lot" && pick.id === row.id ? "true" : undefined}
                onClick={() => {
                  setPick({ kind: "lot", id: row.id })
                  setRoom(row.room)
                }}
              >
                <span className="inv-kitchen-lot-name">{row.name}</span>
                <span className="inv-kitchen-lot-room">{row.roomLabel}</span>
                <span className="inv-kitchen-lot-amt">{row.amountLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function lotCount(count: number): string {
  return `${count} ${count === 1 ? "lot" : "lots"}`
}
