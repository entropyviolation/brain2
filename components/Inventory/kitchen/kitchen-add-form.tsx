/**
 * components/Inventory/kitchen/kitchen-add-form.tsx — Add a lot to one room
 *
 * Name, section, and amount. `putAway` resolves the name the way the food
 * desk does (catalog, a saved food, or a new custom food) and writes a
 * living lot. The name clears. The section stays.
 */
"use client"

import { useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useKitchenStore } from "@/lib/kitchen-store"
import { ROOM_LABEL, type KitchenRoom } from "@/lib/kitchen-types"
import { addedToRoomLine, SHELF_ROOMS, stockAddDraft } from "./kitchen-rows"

export function KitchenAddForm({
  room,
  onRoom,
  onAdded,
}: {
  room: KitchenRoom
  onRoom: (room: KitchenRoom) => void
  onAdded?: (room: KitchenRoom) => void
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("1")
  const [status, setStatus] = useState<string | null>(null)
  const ready = stockAddDraft(name, room, amount, "2000-01-01") != null

  const submit = () => {
    const draft = stockAddDraft(name, room, amount, formatLocalDateKey(new Date()))
    if (!draft) return
    const lot = useKitchenStore.getState().putAway(draft)
    if (!lot) return
    setStatus(addedToRoomLine(draft.name, room))
    setName("")
    setAmount("1")
    onAdded?.(room)
  }

  return (
    <form
      className="inv-kitchen-add"
      aria-label="Add food"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="inv-kitchen-add-line">
        <label className="inv-kitchen-add-field">
          <span>Name</span>
          <input aria-label="Food name" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="inv-kitchen-add-field inv-kitchen-add-amount">
          <span>Amount</span>
          <input
            aria-label="Amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <button type="submit" className="inv-kitchen-add-go" disabled={!ready}>
          Add
        </button>
      </div>
      <div className="inv-kitchen-sections" role="group" aria-label="Section">
        {SHELF_ROOMS.map((id) => (
          <button
            key={id}
            type="button"
            className="inv-kitchen-section"
            aria-pressed={room === id}
            onClick={() => onRoom(id)}
          >
            {ROOM_LABEL[id]}
          </button>
        ))}
      </div>
      {status ? (
        <p className="inv-kitchen-added" data-testid="kitchen-added" role="status">
          {status}
        </p>
      ) : null}
    </form>
  )
}
