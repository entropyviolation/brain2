"use client"

/**
 * components/Lists/dialogs/ListHabitRoutes.tsx — Habits that read this list
 *
 * Read-only. The rows come from each habit’s saved list source
 * (`lib/list-habit-routes.ts`). Closing or saving the list does not copy them.
 */
import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { listHabitRoutes } from "@/lib/list-habit-routes"
import { useHabitsStore } from "@/lib/habits-store"

export function ListHabitRoutes({ listId, listName }: { listId: string; listName: string }) {
  const tasks = useHabitsStore((s) => s.tasks)
  const routes = useMemo(() => listHabitRoutes({ id: listId, name: listName }, tasks), [listId, listName, tasks])

  return (
    <div className="space-y-1" data-testid="list-habit-routes">
      {routes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No habit reads this list.</p>
      ) : (
        <>
          <Label>Habits</Label>
          <ul className="space-y-1" aria-label="Habits that read this list">
            {routes.map((route) => (
              <li key={route.habitId} className="text-sm leading-snug">
                {route.title}
                <span className="text-muted-foreground"> — {route.role}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
