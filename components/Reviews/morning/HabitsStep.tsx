/**
 * components/Reviews/morning/HabitsStep.tsx — Daily habit priorities.
 *
 * Checking a habit calls `toggleHabitPriority`, which writes the priority log
 * immediately. Unchecking only drops it from this form.
 */
export function HabitsStep({
  dailyHabits,
  priorityHabitIds,
  toggleHabitPriority,
}: {
  dailyHabits: { id: string; name?: string }[]
  priorityHabitIds: string[]
  toggleHabitPriority: (id: string) => void
}) {
  return (
    <>
      <p className="mr-lede">
        Optionally pick 1–3 habits to prioritize for the day (shown on Home → Habits). Leave blank for none.
      </p>
      {dailyHabits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No daily habits yet.</p>
      ) : (
        <div className="space-y-1">
          {dailyHabits.map((h) => (
            <label key={h.id} className="flex items-center gap-2 border bg-white/70 rounded-md p-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={priorityHabitIds.includes(h.id)}
                onChange={() => toggleHabitPriority(h.id)}
              />
              <span className="truncate flex-1">{h.name}</span>
              {priorityHabitIds.includes(h.id) && (
                <span className="text-xs text-muted-foreground shrink-0">#{priorityHabitIds.indexOf(h.id) + 1}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </>
  )
}
