/**
 * components/Reviews/morning/WalkStep.tsx — Go through the to-do list.
 *
 * Tier select plus six slots. Skip hides the grid. A blank field keeps the
 * stored placeholder.
 */
import { getTierFromTask } from "@/components/Home/ToDo/todo-utils"
import { NativeSelect } from "@/components/ui/native-select"
import { itemTitle } from "@/lib/item-utils"
import { TODO_WALK_TIERS, emptyTodoWalkForm, isTodoWalkFormBlank, type TodoWalkFormFields } from "@/lib/morning-todo-walk"
import type { Task } from "@/lib/types"
import { latestDayRating, latestResistance, WalkSlot } from "./WalkSlot"

export function WalkStep({
  todaysTasks,
  dayKey,
  todoWalkById,
  patchWalk,
}: {
  todaysTasks: Task[]
  dayKey: string
  todoWalkById: Record<string, TodoWalkFormFields>
  patchWalk: (id: string, patch: Partial<TodoWalkFormFields>) => void
}) {
  return (
    <>
      <p className="mr-lede">
        Tier, minutes, points, and today&apos;s importance, resistance, and excitement (0–10). A blank field keeps
        what is stored. Type to replace it.
      </p>
      <div className="mr-walk-legend" aria-hidden>
        <span>
          <i className="mr-swatch is-stored" /> stored earlier
        </span>
        <span>
          <i className="mr-swatch is-today" /> logged today
        </span>
        <span>
          <i className="mr-swatch is-new" /> changing now
        </span>
      </div>
      {todaysTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing on today&apos;s to-do list to walk through.</p>
      ) : (
        todaysTasks.map((t) => {
          const form = todoWalkById[t.id] ?? emptyTodoWalkForm()
          const changed = !isTodoWalkFormBlank(form)
          const storedTier = getTierFromTask(t)
          const ratedToday =
            t.dayRatings?.[dayKey] != null || latestResistance(t, dayKey)?.today === true
          return (
            <div key={t.id} className="mr-walk-row" data-skipped={form.skipped ? "true" : undefined}>
              <div className="mr-walk-head">
                <p className="mr-walk-title">{itemTitle(t)}</p>
                {changed && !form.skipped ? (
                  <span className="mr-walk-badge is-new">Updating</span>
                ) : ratedToday ? (
                  <span className="mr-walk-badge">Logged today</span>
                ) : null}
                <label className="flex items-center gap-1.5 text-xs shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.skipped}
                    onChange={(e) => patchWalk(t.id, { skipped: e.target.checked })}
                  />
                  Skip
                </label>
              </div>
              {!form.skipped && (
                <div className="mr-walk-grid">
                  <label className="mr-slot" data-state={form.tier ? "new" : storedTier ? "stored" : "empty"}>
                    <span className="mr-slot-label">
                      Tier
                      {form.tier ? (
                        <button type="button" className="mr-slot-revert" onClick={() => patchWalk(t.id, { tier: "" })}>
                          keep {storedTier}
                        </button>
                      ) : (
                        <span className="mr-slot-state">stored</span>
                      )}
                    </span>
                    <NativeSelect
                      className="mr-slot-field"
                      aria-label="Tier"
                      value={form.tier}
                      onChange={(e) => patchWalk(t.id, { tier: e.target.value })}
                    >
                      <option value="">{storedTier ? `${storedTier} (keep)` : "— keep"}</option>
                      {TODO_WALK_TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <WalkSlot
                    label="Minutes"
                    value={form.duration}
                    stored={t.estimatedDuration != null ? { value: String(t.estimatedDuration), today: false } : null}
                    onChange={(v) => patchWalk(t.id, { duration: v })}
                  />
                  <WalkSlot
                    label="Points"
                    value={form.points}
                    stored={t.rewardValue != null ? { value: String(t.rewardValue), today: false } : null}
                    onChange={(v) => patchWalk(t.id, { points: v })}
                  />
                  <WalkSlot
                    label="Importance"
                    value={form.importance}
                    stored={latestDayRating(t, dayKey, "importance")}
                    onChange={(v) => patchWalk(t.id, { importance: v })}
                  />
                  <WalkSlot
                    label="Resistance"
                    value={form.resistance}
                    stored={latestResistance(t, dayKey)}
                    onChange={(v) => patchWalk(t.id, { resistance: v })}
                  />
                  <WalkSlot
                    label="Excitement"
                    value={form.excitement}
                    stored={latestDayRating(t, dayKey, "excitement")}
                    onChange={(v) => patchWalk(t.id, { excitement: v })}
                  />
                </div>
              )}
            </div>
          )
        })
      )}
    </>
  )
}
