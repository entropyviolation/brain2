/**
 * components/Home/Habits/helper/reasons-view.tsx — Every reason recorded on one habit
 *
 * The reasons with their days, newest first, then the most common words and themes, counted in code
 * (`reasonsOf`, `lib/habit-helper/history.ts`). Read only.
 */
"use client"

import { useMemo } from "react"
import { buildContext } from "@/lib/habit-helper/accept"
import { reasonsOf } from "@/lib/habit-helper/history"
import { displayName } from "@/lib/habit-helper/words"

export function ReasonsView({ habitId, onClose }: { habitId: string; onClose: () => void }) {
  const habit = useMemo(() => buildContext(new Date(), 365).habits.find((h) => h.id === habitId), [habitId])
  const r = useMemo(() => (habit ? reasonsOf(habit) : null), [habit])
  if (!habit || !r) return null
  return (
    <section className="hh-reasons" aria-label={`Reasons for ${displayName(habit)}`}>
      <header>
        <b>Reasons · {displayName(habit)}</b>
        <button type="button" className="hh-cap" data-no95="" onClick={onClose}>Close</button>
      </header>
      {r.list.length ? (
        <>
          <p className="hh-tally">
            {r.themes.length ? <>Themes: {r.themes.map((t) => `${t.theme} ×${t.n}`).join(" · ")}. </> : null}
            {r.words.length ? <>Words: {r.words.map((w) => `${w.word} ×${w.n}`).join(" · ")}.</> : null}
          </p>
          <ol>
            {r.list.map((x, i) => (
              <li key={`${x.day}-${i}`}>
                <time>{x.day}</time> “{x.reason}”
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="hh-tally">No reasons recorded in the last year.</p>
      )}
    </section>
  )
}
