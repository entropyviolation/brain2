/**
 * components/Home/NeedsAttention.tsx — "Needs Attention" queue card (Phase 6b)
 *
 * Home furniture (not a new dashboard): surfaces slipped / stuck / neglected /
 * zombie items. Stale stays on the selector and is omitted here. DirectionReport
 * and the operation heatmap keep their own views — this card is the daily door.
 *
 * Kill / split / clarify use inbox + molecular helpers. Mutations go through
 * `taskRepository` only when the user clicks an action.
 *
 * Spec: §6b (Needs Attention). See components/Home/NeedsAttention.notes.md.
 */
"use client"

import { useMemo, useState, type MouseEvent } from "react"
import { ChevronDown } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useGoalsStore } from "@/lib/goals-store"
import { taskRepository } from "@/lib/data/task-repository"
import {
  clarifyNeedsAttentionItem,
  getNeedsAttention,
  groupNeedsAttentionByReason,
  NEEDS_ATTENTION_REASON_LABELS,
  splitNeedsAttentionItem,
  type NeedsAttentionEntry,
  type NeedsAttentionOptions,
  type NeedsAttentionReason,
} from "@/lib/needs-attention"
import {
  APP_NAV_KEYS,
  HOME_NEEDS_ATTENTION_STATES,
  type HomeNeedsAttentionState,
} from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { cn } from "@/lib/utils"
import { IssueGem } from "@/components/Home/Habits/habit-gems"

/** Reasons shown in the Home card. `stale` is kept on the selector but not here. */
type BoxReason = Exclude<NeedsAttentionReason, "stale">
const BOX_REASONS: BoxReason[] = ["overdue", "blocked", "unclarified", "neglected", "zombie"]
const QUEUE_ACTION_REASONS: BoxReason[] = ["unclarified", "neglected", "zombie"]
const HIDDEN_REASONS_KEY = "cogs-needs-attention-hidden"

const REASON_BLURB: Record<BoxReason, string> = {
  overdue: "Past the deadline",
  blocked: "Waiting on something unfinished",
  unclarified: "Still sitting in the inbox",
  neglected: "No recent linked work",
  zombie: "Pushed, or sitting too long",
}

function readHiddenReasons(): BoxReason[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(window.localStorage.getItem(HIDDEN_REASONS_KEY) ?? "[]")
    if (!Array.isArray(raw)) return []
    return raw.filter((reason): reason is BoxReason => BOX_REASONS.includes(reason))
  } catch {
    return []
  }
}

export interface NeedsAttentionProps {
  /** Called when a flagged item is clicked; wire to the detail view. */
  onOpenItem: (id: string) => void
  /** Forwarded to the selector (e.g. `staleDays`, `reasons`, `goals`). */
  options?: NeedsAttentionOptions
  /** Fallback when nothing is stored. Defaults to `true` (collapsed). */
  defaultCollapsed?: boolean
  className?: string
}

export function NeedsAttention({
  onOpenItem,
  options,
  defaultCollapsed = true,
  className,
}: NeedsAttentionProps) {
  // Subscribe to the store so the card re-renders on task changes, but read
  // through the repository to stay on the canonical data-access seam.
  const tasks = useTaskStore((s) => s.tasks)
  const goals = useGoalsStore((s) => s.goals)
  const fallback: HomeNeedsAttentionState = defaultCollapsed ? "collapsed" : "expanded"
  const [panelState, setPanelState] = usePersistedTab(
    APP_NAV_KEYS.homeNeedsAttention,
    HOME_NEEDS_ATTENTION_STATES,
    fallback,
  )
  const collapsed = panelState === "collapsed"
  const [hiddenReasons, setHiddenReasons] = useState<BoxReason[]>(readHiddenReasons)

  const entries = useMemo(() => {
    void tasks
    void goals
    const requested = options?.reasons ?? BOX_REASONS
    return getNeedsAttention(taskRepository.getAll(), {
      ...options,
      goals: options?.goals ?? goals,
      reasons: requested.filter((reason) => reason !== "stale"),
    })
  }, [tasks, goals, options])

  const groups = useMemo(() => groupNeedsAttentionByReason(entries), [entries])
  const total = entries.length
  const visibleReasons = BOX_REASONS.filter((reason) => !hiddenReasons.includes(reason))
  const visibleCount = visibleReasons.reduce((sum, reason) => sum + groups[reason].length, 0)

  const toggleReason = (reason: BoxReason) => {
    setHiddenReasons((prev) => {
      const next = prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason]
      window.localStorage.setItem(HIDDEN_REASONS_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <section className={cn("home-na", className)} data-ui-name="Needs Attention" data-ui-docs="components/Home/README.md">
      <div className="home-na-bar">
        <button
          type="button"
          onClick={() =>
            setPanelState((s) => (s === "collapsed" ? "expanded" : "collapsed"))
          }
          aria-expanded={!collapsed}
          className="home-na-toggle"
        >
          <ChevronDown className={cn("home-na-chevron", collapsed && "is-shut")} aria-hidden />
          <span className="home-na-title">Needs Attention</span>
          <span className="home-na-count" aria-label={`${visibleCount} need attention`}>
            <IssueGem />
            <span>{visibleCount}</span>
          </span>
        </button>
      </div>
      {!collapsed && (
        <div className="home-na-body">
          <div className="home-na-reasons" role="group" aria-label="Categories">
            {BOX_REASONS.map((reason) => {
              const hidden = hiddenReasons.includes(reason)
              const count = groups[reason].length
              const label = NEEDS_ATTENTION_REASON_LABELS[reason]
              return (
                <button
                  key={reason}
                  type="button"
                  className={cn("home-na-reason", hidden && "is-hidden")}
                  aria-pressed={!hidden}
                  aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
                  title={hidden ? `Show ${label}` : `Hide ${label}`}
                  onClick={() => toggleReason(reason)}
                >
                  <span className="home-na-reason-lamp" aria-hidden />
                  <span>{label}</span>
                  <span className="home-na-reason-count">{count}</span>
                </button>
              )
            })}
          </div>
          {visibleCount === 0 ? (
            <p className="home-na-empty">
              {total === 0
                ? "Nothing needs attention right now."
                : "Those categories are hidden. Press one to bring it back."}
            </p>
          ) : (
            visibleReasons.map((reason) => {
              const group = groups[reason]
              if (group.length === 0) return null
              return (
                <section key={reason} className="home-na-group">
                  <h3>{NEEDS_ATTENTION_REASON_LABELS[reason]}</h3>
                  <p>{REASON_BLURB[reason]}</p>
                  <ul>
                    {group.map((entry) => (
                      <NeedsAttentionRow
                        key={`${reason}-${entry.item.id}`}
                        entry={entry}
                        onOpenItem={onOpenItem}
                      />
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}

function NeedsAttentionRow({
  entry,
  onOpenItem,
}: {
  entry: NeedsAttentionEntry
  onOpenItem: (id: string) => void
}) {
  const { item, reasons } = entry
  const title = itemTitleOrUntitled(item)
  const showActions =
    reasons.some((reason) => QUEUE_ACTION_REASONS.includes(reason as BoxReason)) &&
    !!taskRepository.getById(item.id)

  const runKill = (event: MouseEvent) => {
    event.stopPropagation()
    const live = taskRepository.getById(item.id)
    if (!live) return
    if (!confirm(`Kill "${itemTitleOrUntitled(live)}"? This cannot be undone.`)) return
    taskRepository.remove(live.id)
  }

  const runSplit = (event: MouseEvent) => {
    event.stopPropagation()
    const live = taskRepository.getById(item.id)
    if (!live) return
    const text = window.prompt("Split into steps (one per line):")
    if (text == null) return
    const next = splitNeedsAttentionItem(live, text)
    if (next) taskRepository.update(next)
  }

  const runClarify = (event: MouseEvent) => {
    event.stopPropagation()
    const live = taskRepository.getById(item.id)
    if (!live) return
    taskRepository.update(clarifyNeedsAttentionItem(live))
  }

  const showClarify = reasons.includes("unclarified")

  return (
    <li className="home-na-row">
      <button type="button" className="home-na-open" onClick={() => onOpenItem(item.id)}>
        {title}
      </button>
      {showActions && (
        <span className="home-na-actions">
          {showClarify && (
            <button type="button" className="home-na-key" title="Take this out of the inbox" onClick={runClarify}>
              Clarify
            </button>
          )}
          <button type="button" className="home-na-key" title="Break into steps, one per line" onClick={runSplit}>
            Split
          </button>
          <button type="button" className="home-na-key is-danger" title="Delete this item" onClick={runKill}>
            Delete
          </button>
        </span>
      )}
    </li>
  )
}
