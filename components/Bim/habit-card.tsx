/**
 * components/Bim/habit-card.tsx — The Habits BIMBY's proposals, approved from BIM chat
 *
 * When BIM hands a line to the Habits BIMBY, its reply carries `habitLineId`. This draws that BIMBY line's
 * own table (`ProposalTable`) under BIM's reply, so the rows are accepted, edited or dismissed here without
 * opening the Habits chat. The proposals live only in the BIMBY's store (`useHabitsBimby`): this is a second
 * view of the same line, so the Habits chat shows the same rows in the same state, and the BIMBY keeps its
 * own record of what was said and decided. A line the BIMBY no longer keeps (its chat holds the last 60, or
 * it was cleared) draws nothing.
 */
"use client"

import { ProposalTable } from "@/components/Home/Habits/helper/proposal-table"
import { openHabitsBimby } from "@/lib/habit-helper/open"
import { useHabitsBimby } from "@/lib/habit-helper/store"
import "@/components/Home/Habits/helper/habit-helper.css"

export function HabitCard({ lineId }: { lineId: string }) {
  const line = useHabitsBimby((s) => s.lines.find((l) => l.id === lineId))
  if (!line) return null
  return (
    <div className="bim-habit-card" style={{ overflowX: "auto", maxWidth: "100%" }}>
      {/* Reasons live in the Habits chat; the key on a row opens it. */}
      <ProposalTable line={line} onReasons={() => openHabitsBimby()} />
    </div>
  )
}
