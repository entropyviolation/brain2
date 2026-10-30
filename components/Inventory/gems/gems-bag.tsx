/**
 * components/Inventory/gems/gems-bag.tsx — Slot grid for earned gems and trinkets
 *
 * One photograph per stack. A count sits in the corner when the stack is more
 * than one. Empty slots fill the chest. The desk paints a dark game bag; the
 * phone paints the same grid with large targets.
 */
"use client"

import { useEffect, useState } from "react"
import { HabitGemImg } from "@/components/Home/Habits/habit-gems"
import { lootSlotCount, lootStackLabel, lootSummary, type LootStack } from "./earned-stacks"

export function GemsBag({
  stacks,
  columns,
  minSlots,
  surface,
}: {
  stacks: LootStack[]
  columns: number
  minSlots: number
  surface: "desk" | "phone"
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = stacks.find((stack) => stack.id === selectedId) ?? null
  const slots = lootSlotCount(stacks.length, columns, minSlots)

  useEffect(() => {
    if (selectedId && !stacks.some((stack) => stack.id === selectedId)) setSelectedId(null)
  }, [selectedId, stacks])

  return (
    <section
      className={surface === "phone" ? "inv-gems-phone" : "inv-gems"}
      aria-label="Gems and Trinkets"
      data-testid={surface === "phone" ? "gems-phone" : "gems-scene"}
      data-ui-name="Gems and Trinkets"
    >
      <header className="inv-gems-bar">
        <h2>Gems and Trinkets</h2>
        <p>{lootSummary(stacks)}</p>
      </header>
      {selected ? (
        <p className="inv-gems-detail">
          {lootStackLabel(selected)} · {selected.kind === "gem" ? "Gem" : "Trinket"} · {selected.count}
        </p>
      ) : null}
      <ul className="inv-gems-grid">
        {Array.from({ length: slots }, (_, index) => {
          const stack = stacks[index]
          if (!stack) {
            return (
              <li key={`empty-${index}`}>
                <div className="inv-gems-slot is-empty" aria-hidden />
              </li>
            )
          }
          const label = lootStackLabel(stack)
          const kind = stack.kind === "gem" ? "gem" : "trinket"
          return (
            <li key={stack.id}>
              <button
                type="button"
                data-no95=""
                className={`inv-gems-slot${selected?.id === stack.id ? " is-on" : ""}`}
                aria-pressed={selected?.id === stack.id}
                aria-label={`${label}, ${kind}, ${stack.count}`}
                onClick={() => setSelectedId(stack.id)}
              >
                <HabitGemImg src={stack.src} width={56} height={56} />
                {stack.count > 1 ? <span className="inv-gems-count">{stack.count}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
