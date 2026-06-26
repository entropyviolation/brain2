/**
 * components/Home/NeedsAttention.tsx — "Needs Attention" queue card (Phase 6b)
 *
 * A Home-dashboard card that surfaces tasks that have slipped or are stuck:
 * overdue, unclarified (inbox), blocked (waiting on an incomplete dependency),
 * or stale (unscheduled and aging). It reads the live task list from
 * `taskRepository.getAll()`, runs the PURE `getNeedsAttention` selector, and
 * renders the flagged items grouped by reason with reason badges.
 *
 * Clicking an item calls `onOpenItem(id)` so the parent can route to the detail
 * view. The component itself performs no mutations — surfacing only.
 *
 * Spec: §6b (Needs Attention). Mounting into the dashboard is intentionally left
 * to the parent — see components/Home/NeedsAttention.notes.md.
 */
"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Inbox,
  Ban,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { useTaskStore } from "@/lib/task-store"
import { taskRepository } from "@/lib/data/task-repository"
import {
  getNeedsAttention,
  groupNeedsAttentionByReason,
  NEEDS_ATTENTION_REASON_LABELS,
  type NeedsAttentionEntry,
  type NeedsAttentionOptions,
  type NeedsAttentionReason,
} from "@/lib/needs-attention"
import { cn } from "@/lib/utils"

const REASON_ORDER: NeedsAttentionReason[] = ["overdue", "blocked", "unclarified", "stale"]

const REASON_META: Record<
  NeedsAttentionReason,
  { icon: LucideIcon; badgeVariant: BadgeProps["variant"]; description: string }
> = {
  overdue: { icon: AlertTriangle, badgeVariant: "destructive", description: "Past their deadline" },
  blocked: { icon: Ban, badgeVariant: "secondary", description: "Waiting on an unfinished dependency" },
  unclarified: { icon: Inbox, badgeVariant: "outline", description: "Still in the inbox" },
  stale: { icon: Clock, badgeVariant: "outline", description: "Unscheduled and aging" },
}

export interface NeedsAttentionProps {
  /** Called when a flagged item is clicked; wire to the detail view. */
  onOpenItem: (id: string) => void
  /** Forwarded to the selector (e.g. `staleDays`, `reasons`). */
  options?: NeedsAttentionOptions
  /** Whether the card starts collapsed. Defaults to `false`. */
  defaultCollapsed?: boolean
  className?: string
}

export function NeedsAttention({
  onOpenItem,
  options,
  defaultCollapsed = false,
  className,
}: NeedsAttentionProps) {
  // Subscribe to the store so the card re-renders on task changes, but read
  // through the repository to stay on the canonical data-access seam.
  const tasks = useTaskStore((s) => s.tasks)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const entries = useMemo(() => {
    void tasks // dependency: recompute when the store's tasks change
    return getNeedsAttention(taskRepository.getAll(), options)
  }, [tasks, options])

  const groups = useMemo(() => groupNeedsAttentionByReason(entries), [entries])
  const total = entries.length

  return (
    <Card className={className}>
      <CardHeader>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          <CardTitle className="flex flex-1 items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Needs Attention
            {total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {total}
              </Badge>
            )}
          </CardTitle>
        </button>
      </CardHeader>
      {!collapsed && (
      <CardContent className="space-y-6">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm">Nothing needs attention right now.</p>
          </div>
        ) : (
          REASON_ORDER.map((reason) => {
            const group = groups[reason]
            if (group.length === 0) return null
            const meta = REASON_META[reason]
            const Icon = meta.icon
            return (
              <section key={reason} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">
                    {NEEDS_ATTENTION_REASON_LABELS[reason]}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {meta.description} · {group.length}
                  </span>
                </div>
                <ul className="space-y-1">
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
      </CardContent>
      )}
    </Card>
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
  const title = item.title || item.description || "Untitled"
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenItem(item.id)}
        className={cn(
          "group flex w-full items-center justify-between gap-2 rounded-md border border-transparent",
          "px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="flex flex-wrap gap-1">
            {reasons.map((reason) => (
              <Badge
                key={reason}
                variant={REASON_META[reason].badgeVariant}
                className="text-[10px]"
              >
                {NEEDS_ATTENTION_REASON_LABELS[reason]}
              </Badge>
            ))}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  )
}
