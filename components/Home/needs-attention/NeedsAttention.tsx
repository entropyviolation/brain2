/**
 * components/Home/needs-attention/NeedsAttention.tsx — "Needs Attention" queue card (Phase 6b)
 *
 * Home furniture (not a new dashboard): surfaces slipped / stuck / neglected /
 * zombie items. Stale stays on the selector and is omitted here. DirectionReport
 * and the operation heatmap keep their own views — this card is the daily door.
 *
 * Split / delete use molecular helpers and the repository, and only when the
 * user clicks a key. Inbox captures stay in Inbox: this card does not list
 * them. The gem count waits for the task and goals persist snapshots so SSR
 * and hydration agree.
 *
 * Spec: §6b (Needs Attention). See components/Home/NeedsAttention.notes.md.
 */
"use client"

import { useDeferredValue, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { ChevronDown } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useGoalsStore } from "@/lib/goals-store"
import { taskRepository } from "@/lib/data/task-repository"
import {
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
import { readAliasedLocal } from "@/lib/storage-keys"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { cn } from "@/lib/utils"
import { IssueGem } from "@/components/Home/Habits/habit-gems"

function needsAttentionHasStoredPreference(): boolean {
  if (typeof window === "undefined") return false
  const stored = readAliasedLocal(APP_NAV_KEYS.homeNeedsAttention)
  return stored === "collapsed" || stored === "expanded"
}

/**
 * Reasons shown in the Home card. `stale` stays on the selector. `unclarified`
 * stays on the selector too — Inbox is that pile, so this card does not list it.
 */
type BoxReason = Exclude<NeedsAttentionReason, "stale" | "unclarified">
const BOX_REASONS: BoxReason[] = ["overdue", "blocked", "neglected", "zombie"]
const QUEUE_ACTION_REASONS: BoxReason[] = ["neglected", "zombie"]
const HIDDEN_REASONS_KEY = "cogs-needs-attention-hidden"

const REASON_BLURB: Record<BoxReason, string> = {
  overdue: "Past the deadline",
  blocked: "Waiting on something unfinished",
  neglected: "No recent linked work",
  zombie: "Pushed, or sitting too long",
}

function selectIds(
  prev: string[],
  order: string[],
  anchor: string | null,
  id: string,
  shift: boolean,
): { next: string[]; anchor: string | null } {
  if (shift && anchor) {
    const startAt = order.indexOf(anchor)
    const endAt = order.indexOf(id)
    if (startAt >= 0 && endAt >= 0) {
      const [start, end] = startAt < endAt ? [startAt, endAt] : [endAt, startAt]
      return { next: [...new Set([...prev, ...order.slice(start, end + 1)])], anchor }
    }
  }
  const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
  return { next, anchor: id }
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
  // Persist rehydrate finishes before React hydrates, so a live count (0 on
  // the server, the vault on the client) mismatches. `usePersistHydrated`
  // stays false for the server HTML and the hydration pass, then flips.
  // Call both hooks every render; `a() && b()` would skip the second one.
  const tasksHydrated = usePersistHydrated(useTaskStore.persist)
  const goalsHydrated = usePersistHydrated(useGoalsStore.persist)
  const vaultReady = tasksHydrated && goalsHydrated
  const fallback: HomeNeedsAttentionState = defaultCollapsed ? "collapsed" : "expanded"
  const [panelState, setPanelState] = usePersistedTab(
    APP_NAV_KEYS.homeNeedsAttention,
    HOME_NEEDS_ATTENTION_STATES,
    fallback,
  )
  const [hasStoredPreference, setHasStoredPreference] = useState(needsAttentionHasStoredPreference)
  const [hiddenReasons, setHiddenReasons] = useState<BoxReason[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const anchorRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    const stored = readHiddenReasons()
    setHiddenReasons((prev) => {
      if (prev.length === stored.length && prev.every((reason, index) => reason === stored[index])) return prev
      return stored
    })
  }, [])

  const deferredTasks = useDeferredValue(tasks)
  const deferredGoals = useDeferredValue(goals)
  const entries = useMemo(() => {
    if (!vaultReady) return []
    void deferredTasks
    void deferredGoals
    const requested = options?.reasons ?? BOX_REASONS
    return getNeedsAttention(taskRepository.getAll(), {
      ...options,
      goals: options?.goals ?? goals,
      reasons: requested.filter((reason) => reason !== "stale" && reason !== "unclarified"),
    }).filter((entry) => entry.item.stage !== "inbox")
  }, [vaultReady, deferredTasks, deferredGoals, options])

  const groups = useMemo(() => groupNeedsAttentionByReason(entries), [entries])
  const total = entries.length
  const visibleReasons = BOX_REASONS.filter((reason) => !hiddenReasons.includes(reason))
  const visibleCount = visibleReasons.reduce((sum, reason) => sum + groups[reason].length, 0)
  const flatIds = useMemo(() => {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const reason of visibleReasons) {
      for (const entry of groups[reason].slice(0, 40)) {
        if (seen.has(entry.item.id)) continue
        seen.add(entry.item.id)
        ids.push(entry.item.id)
      }
    }
    return ids
  }, [groups, visibleReasons])
  const selectedLive = selectedIds.filter((id) => entries.some((entry) => entry.item.id === id))

  const selectId = (id: string, shift: boolean) => {
    setSelectedIds((prev) => {
      const result = selectIds(prev, flatIds, anchorRef.current, id, shift)
      anchorRef.current = result.anchor
      return result.next
    })
  }

  const liveSelected = () => selectedLive.map((id) => taskRepository.getById(id)).filter((item) => !!item)

  const runDeleteSelected = () => {
    const live = liveSelected()
    if (live.length === 0) return
    const noun = live.length === 1 ? `"${itemTitleOrUntitled(live[0])}"` : `${live.length} items`
    if (!confirm(`Kill ${noun}? This cannot be undone.`)) return
    for (const item of live) taskRepository.remove(item.id)
    anchorRef.current = null
    setSelectedIds([])
  }

  const runSplitSelected = () => {
    const live = liveSelected()
    if (live.length === 0) return
    const text = window.prompt("Split into steps (one per line):")
    if (text == null) return
    for (const item of live) {
      const next = splitNeedsAttentionItem(item, text)
      if (next) taskRepository.update(next)
    }
  }

  // First visit with a real queue: open into the reading order. A stored
  // collapse still wins. Empty counters do not own the fold.
  const collapsed = hasStoredPreference
    ? panelState === "collapsed"
    : !(vaultReady && visibleCount > 0)

  const togglePanel = () => {
    // Flip the *effective* open state. Before a preference is stored,
    // `panelState` may still be the fallback while the queue is auto-open.
    const next: HomeNeedsAttentionState = collapsed ? "expanded" : "collapsed"
    setHasStoredPreference(true)
    setPanelState(next)
  }

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
          onClick={togglePanel}
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
          {selectedLive.length > 0 && (
            <div className="home-na-select" role="toolbar" aria-label="Selected items">
              <span className="home-na-select-count">{selectedLive.length} selected</span>
              <button type="button" className="todo-cap" aria-label="Split selected" onClick={runSplitSelected}>
                Split
              </button>
              <button type="button" className="todo-cap is-mod" aria-label="Delete selected" onClick={runDeleteSelected}>
                Delete
              </button>
              <button
                type="button"
                className="todo-cap"
                onClick={() => {
                  anchorRef.current = null
                  setSelectedIds([])
                }}
              >
                Clear
              </button>
            </div>
          )}
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
                    {group.slice(0, 40).map((entry) => (
                      <NeedsAttentionRow
                        key={`${reason}-${entry.item.id}`}
                        entry={entry}
                        selected={selectedLive.includes(entry.item.id)}
                        onOpenItem={onOpenItem}
                        onSelect={selectId}
                      />
                    ))}
                    {group.length > 40 ? (
                      <li className="home-na-more">{group.length - 40} more</li>
                    ) : null}
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
  selected,
  onOpenItem,
  onSelect,
}: {
  entry: NeedsAttentionEntry
  selected: boolean
  onOpenItem: (id: string) => void
  onSelect: (id: string, shift: boolean) => void
}) {
  const { item, reasons } = entry
  const title = itemTitleOrUntitled(item)
  const skipChange = useRef(false)
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

  const openRow = (event: MouseEvent) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      onSelect(item.id, event.shiftKey)
      return
    }
    onOpenItem(item.id)
  }

  return (
    <li className={cn("home-na-row", selected && "is-selected")}>
      <input
        type="checkbox"
        className="home-na-check"
        checked={selected}
        aria-label={`Select ${title}`}
        onClick={(event) => {
          event.stopPropagation()
          if (!event.shiftKey) return
          skipChange.current = true
          onSelect(item.id, true)
        }}
        onChange={() => {
          if (skipChange.current) {
            skipChange.current = false
            return
          }
          onSelect(item.id, false)
        }}
      />
      <button type="button" className="home-na-open" data-no95="" onClick={openRow}>
        {title}
      </button>
      {showActions && (
        <span className="home-na-actions">
          <button type="button" className="todo-cap" title="Break into steps, one per line" onClick={runSplit}>
            Split
          </button>
          <button type="button" className="todo-cap is-mod" title="Delete this item" onClick={runKill}>
            Delete
          </button>
        </span>
      )}
    </li>
  )
}
