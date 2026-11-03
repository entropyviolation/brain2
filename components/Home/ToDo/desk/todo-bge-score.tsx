/**
 * components/Home/ToDo/desk/todo-bge-score.tsx — B/G/E score strip
 *
 * Same numbers and title. Rites are already dropped before this renders.
 */
import type { BgeEntry } from "@/lib/bge-score"

export function TodoBgeScore({
  period,
  bge,
  bgeEntries,
}: {
  period: string
  bge: {
    points: number
    bonus: number
    min: { done: number; total: number }
    goal: { done: number; total: number }
    exceptional: { done: number; total: number }
  }
  bgeEntries: BgeEntry[]
}) {
  return (
    <div
      className="todo-bge-score"
      data-ui-name="B/G/E score"
      data-ui-help="Bare minimum 70%, Goal 30%, Exceptional done adds what a Goal task is worth."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="bge-tiers"
    >
      <span className="todo-bge-score-num" title="Bare minimum is 70%, Goal 30%. Each Exceptional done adds one Goal task's share on top.">
        {Math.round(bge.points)}
        <small>%</small>
      </span>
      <span className="todo-bge-score-label">B/G/E {period} score</span>
      <span className="todo-bge-score-parts">
        B {bge.min.done}/{bge.min.total} · G {bge.goal.done}/{bge.goal.total} · E {bge.exceptional.done}/{bge.exceptional.total}
        {bge.bonus > 0 ? ` · +${Math.round(bge.bonus)} bonus` : ""}
      </span>
      <span className="todo-bge-score-plain">
        {bgeEntries.filter((e) => e.done).length} of {bgeEntries.length} tasks done
      </span>
    </div>
  )
}
