/**
 * components/Home/award-detail.tsx — One points award, opened
 *
 * The breakdown under a ledger row: what kind of award it was, the item,
 * habit, or goal it belongs to, the multipliers on that item for that day,
 * the points rules that paid it (with today's number and the rule's own
 * explanation), and the other rows the same thing earned that day. Pure
 * reading is `explainPointAward` (`lib/points-award-explain.ts`). Used by the
 * Home Latest award detail and the Analytics Points ledger.
 */
"use client"

import { useMemo } from "react"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { awardReason, formatAwardPoints, type LedgerAward } from "@/lib/habit-points"
import { explainPointAward } from "@/lib/points-award-explain"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import "./award-detail.css"

function signed(points: number): string {
  return points < 0 ? `−${formatAwardPoints(-points).slice(1)}` : formatAwardPoints(points)
}

export function AwardDetail({
  entry,
  onOpenItem,
}: {
  entry: LedgerAward
  /** Open the item this award belongs to. */
  onOpenItem?: (itemId: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const habits = useHabitsStore((s) => s.tasks)
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const history = usePointsStore((s) => s.pointsHistory)

  const info = useMemo(
    () => explainPointAward(entry, { tasks, lists, folders, habits, goals, objectives, history }),
    [entry, tasks, lists, folders, habits, goals, objectives, history],
  )

  return (
    <div className="award-detail" data-testid="award-detail" data-kind={info.kind}>
      <p className="award-detail-head">
        <span className="award-detail-kind">{info.kindLabel}</span>
        <strong>{signed(info.points)}</strong>
      </p>

      {info.item ? (
        <div className="award-detail-block">
          <span className="award-detail-label">Item</span>
          {onOpenItem ? (
            <button type="button" className="award-detail-link" onClick={() => onOpenItem(info.item!.id)}>
              {info.item.title} ›
            </button>
          ) : (
            <span>{info.item.title}</span>
          )}
          {info.item.lists.length > 0 ? <span className="award-detail-muted">in {info.item.lists.join(", ")}</span> : null}
        </div>
      ) : null}
      {info.habit ? (
        <div className="award-detail-block">
          <span className="award-detail-label">Habit</span>
          <span>{info.habit.name}</span>
        </div>
      ) : null}
      {info.goal ? (
        <div className="award-detail-block">
          <span className="award-detail-label">Goal</span>
          <span>{info.goal.title}</span>
        </div>
      ) : null}

      {info.lines.length > 0 ? (
        <dl className="award-detail-lines">
          {info.lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {info.multipliers.length > 0 ? (
        <div className="award-detail-block is-stack">
          <span className="award-detail-label">Multipliers that period</span>
          <ul>
            {info.multipliers.map((m) => (
              <li key={m.label}>
                <span>{m.label}</span>
                <strong>×{Math.round(m.value * 100) / 100}</strong>
                {m.note ? <em>{m.note}</em> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {info.rules.length > 0 ? (
        <div className="award-detail-block is-stack">
          <span className="award-detail-label">Rules (Settings → Points rules, now)</span>
          <ul>
            {info.rules.map((r) => (
              <li key={r.id}>
                <details>
                  <summary>
                    <span>{r.label}</span>
                    <strong>{r.value}</strong>
                  </summary>
                  <p>{r.explanation}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {info.related.length > 0 ? (
        <div className="award-detail-block is-stack">
          <span className="award-detail-label">Also that day</span>
          <ul>
            {info.related.map((e, i) => (
              <li key={`${e.taskId}:${i}`}>
                <span>{awardReason(e)}</span>
                <strong>{signed(e.points)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="award-detail-muted">
        The ledger keeps the points paid that day. Rule numbers and multipliers shown are today&apos;s.
      </p>
    </div>
  )
}
