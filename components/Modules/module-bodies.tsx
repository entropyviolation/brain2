/**
 * components/Modules/module-bodies.tsx — Module card bodies
 *
 * The per-type render bodies for the Modules dashboard (analytics stat, list
 * summary, writing prompt, list explorer, random task, rules) plus the shared
 * `ModuleCard` wrapper and the `ModuleBody` switch.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, X, Settings, Shuffle } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import type { ModuleInstance, AttrRule } from "@/lib/modules-store"
import { mergeListAttributes } from "@/components/Lists/attribute-editor"
import { formatDateKey } from "@/lib/date-utils"
import {
  MODULE_META,
  WRITING_FORMS,
  WRITING_TOPICS,
  WRITING_CONSTRAINTS,
  rand,
  randN,
  ruleMatches,
  tasksInList,
} from "./module-helpers"

export function ModuleCard({
  module,
  onConfigure,
  onRemove,
  onTaskSelect,
}: {
  module: ModuleInstance
  onConfigure: () => void
  onRemove: () => void
  onTaskSelect?: (taskId: string) => void
}) {
  const Meta = MODULE_META[module.type]
  const Icon = Meta.icon
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{module.title}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onConfigure} title="Configure">
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} title="Remove">
              <X className="h-3.5 w-3.5" />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <ModuleBody module={module} onTaskSelect={onTaskSelect} />
      </CardContent>
    </Card>
  )
}

function ModuleBody({ module, onTaskSelect }: { module: ModuleInstance; onTaskSelect?: (taskId: string) => void }) {
  switch (module.type) {
    case "analytics-stat":
      return <AnalyticsStat stat={module.config.stat || "points-week"} />
    case "list-summary":
      return <ListSummary categoryId={module.config.categoryId} />
    case "writing-prompt":
      return <WritingPrompt categoryId={module.config.categoryId} />
    case "list-explorer":
      return (
        <ListExplorer
          categoryId={module.config.categoryId}
          framing={module.config.framing}
          pickCount={module.config.pickCount ?? 1}
          onTaskSelect={onTaskSelect}
        />
      )
    case "random-task":
      return <RandomTask categoryId={module.config.categoryId} onTaskSelect={onTaskSelect} />
    case "rules":
      return <RulesModule categoryId={module.config.categoryId} rules={module.config.rules} onTaskSelect={onTaskSelect} />
    default:
      return null
  }
}

function RulesModule({
  categoryId,
  rules,
  onTaskSelect,
}: {
  categoryId?: string
  rules?: AttrRule[]
  onTaskSelect?: (taskId: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.lists)
  const items = useMemo(() => tasksInList(tasks, categoryId), [tasks, categoryId])
  const defs = useMemo(() => mergeListAttributes(categories, categoryId ? [categoryId] : []), [categories, categoryId])

  if (!categoryId) return <p className="text-sm text-muted-foreground">Configure a list and rules.</p>
  if (!rules || rules.length === 0) return <p className="text-sm text-muted-foreground">No rules yet — configure this module.</p>
  if (items.length === 0) return <p className="text-sm text-muted-foreground">This list is empty.</p>

  return (
    <div className="space-y-2 max-h-72 overflow-auto">
      {items.map((item) => {
        const matched = rules.find((r) => ruleMatches(r, item.attributes?.[r.attrId]))
        return (
          <button
            key={item.id}
            className="w-full text-left flex items-center justify-between gap-2 border rounded px-2 py-1.5 hover:bg-muted/50"
            onClick={() => onTaskSelect?.(item.id)}
          >
            <span className="text-sm truncate flex-1">{item.description}</span>
            {matched ? (
              <Badge style={{ background: matched.color, color: "#fff" }} className="shrink-0">
                {matched.label}
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground shrink-0">—</span>
            )}
          </button>
        )
      })}
      <div className="pt-1 text-[10px] text-muted-foreground">
        {defs.length} attributes · {rules.length} rules
      </div>
    </div>
  )
}

export function AnalyticsStat({ stat }: { stat: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const getTotalPoints = usePointsStore((s) => s.getTotalPoints)
  const getWeekPoints = usePointsStore((s) => s.getWeekPoints)
  const getDayPoints = usePointsStore((s) => s.getDayPoints)
  const weeklyData = useHabitsStore((s) => s.weeklyData)

  const { value, label } = useMemo(() => {
    const today = new Date()
    switch (stat) {
      case "points-total":
        return { value: getTotalPoints(), label: "points all-time" }
      case "points-today":
        return { value: getDayPoints(today), label: "points today" }
      case "tasks-open":
        return { value: tasks.filter((t) => !t.completed).length, label: "open tasks" }
      case "tasks-done":
        return { value: tasks.filter((t) => t.completed).length, label: "completed tasks" }
      case "habits-today": {
        const day = weeklyData[formatDateKey(today)] || {}
        const n = Object.values(day).filter(
          (c) => c && (c.completed || c.value !== undefined || c.text || c.incrementalValues),
        ).length
        return { value: n, label: "habits logged today" }
      }
      case "points-week":
      default:
        return { value: getWeekPoints(today), label: "points this week" }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stat, tasks, pointsHistory, weeklyData])

  return (
    <div className="py-4 text-center">
      <div className="text-4xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

function ListSummary({ categoryId }: { categoryId?: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const categories = useTaskStore((s) => s.lists)
  const cat = categories.find((c) => c.id === categoryId)
  const items = tasksInList(tasks, categoryId)
  const done = items.filter((t) => t.completed).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0

  if (!categoryId) return <p className="text-sm text-muted-foreground">Configure a list to summarize.</p>
  return (
    <div className="space-y-2">
      {cat && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
          {cat.name}
        </div>
      )}
      <div className="text-3xl font-bold">
        {done}/{items.length}
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">{pct}% complete · {items.length - done} remaining</p>
    </div>
  )
}

function WritingPrompt({ categoryId }: { categoryId?: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const [nonce, setNonce] = useState(0)

  const prompt = useMemo(() => {
    const form = rand(WRITING_FORMS) || "a short piece"
    const sourceItems = categoryId ? tasksInList(tasks, categoryId).map((t) => t.description) : []
    const topic = (sourceItems.length ? rand(sourceItems) : rand(WRITING_TOPICS)) || "anything"
    const constraint = rand(WRITING_CONSTRAINTS) || ""
    return { form, topic, constraint }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, categoryId, tasks])

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">
        Write <span className="font-semibold">{prompt.form}</span> about{" "}
        <span className="font-semibold">{prompt.topic}</span>, {prompt.constraint}.
      </p>
      <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)}>
        <RefreshCw className="h-3.5 w-3.5 mr-2" />
        New prompt
      </Button>
    </div>
  )
}

function ListExplorer({
  categoryId,
  framing,
  pickCount = 1,
  onTaskSelect,
}: {
  categoryId?: string
  framing?: string
  pickCount?: number
  onTaskSelect?: (taskId: string) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const items = useMemo(() => tasksInList(tasks, categoryId).filter((t) => !t.completed), [tasks, categoryId])
  const [pickIds, setPickIds] = useState<string[]>([])

  const repick = () => {
    setPickIds(randN(items, pickCount).map((i) => i.id))
  }

  useEffect(() => {
    setPickIds((prev) => {
      const valid = prev.filter((id) => items.some((i) => i.id === id))
      if (valid.length >= Math.min(pickCount, items.length)) return valid.slice(0, pickCount)
      return randN(items, pickCount).map((i) => i.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, items.length, pickCount])

  const picks = pickIds.map((id) => items.find((i) => i.id === id)).filter(Boolean)

  if (!categoryId) return <p className="text-sm text-muted-foreground">Configure a list to explore.</p>
  if (items.length === 0) return <p className="text-sm text-muted-foreground">This list is empty.</p>

  return (
    <div className="space-y-3">
      {picks.length > 0 ? (
        <div className="space-y-2">
          {picks.map((pick) =>
            pick ? (
              <button key={pick.id} className="text-left w-full" onClick={() => onTaskSelect?.(pick.id)} title="Open item">
                <p className="text-sm font-semibold leading-snug hover:underline">
                  {framing ? `${framing}: ` : ""}
                  {pick.description}
                </p>
                {pick.attributes && Object.keys(pick.attributes).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(pick.attributes).map(([k, v]) =>
                      v === undefined || v === null || v === "" ? null : (
                        <Badge key={k} variant="secondary" className="text-[10px]">
                          {String(v)}
                        </Badge>
                      ),
                    )}
                  </div>
                )}
              </button>
            ) : null,
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Tap below to pick.</p>
      )}
      <Button variant="outline" size="sm" onClick={repick}>
        <RefreshCw className="h-3.5 w-3.5 mr-2" />
        Surprise me{pickCount > 1 ? ` (${pickCount})` : ""}
      </Button>
    </div>
  )
}

function RandomTask({ categoryId, onTaskSelect }: { categoryId?: string; onTaskSelect?: (taskId: string) => void }) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const open = useMemo(() => tasksInList(tasks, categoryId).filter((t) => !t.completed), [tasks, categoryId])
  const [pickId, setPickId] = useState<string | null>(null)

  useEffect(() => {
    setPickId((prev) => (prev && open.some((i) => i.id === prev) ? prev : rand(open)?.id ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, open.length])

  const pick = open.find((i) => i.id === pickId)

  if (open.length === 0) return <p className="text-sm text-muted-foreground">No open tasks. All clear!</p>

  return (
    <div className="space-y-3">
      {pick && (
        <button className="text-left w-full" onClick={() => onTaskSelect?.(pick.id)} title="Open task">
          <p className="text-sm font-semibold hover:underline">{pick.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pick.estimatedDuration}m · importance {pick.importance}
          </p>
        </button>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPickId(rand(open)?.id ?? null)}>
          <Shuffle className="h-3.5 w-3.5 mr-2" />
          Another
        </Button>
        {pick && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateTask({ ...pick, completed: true })
              setPickId(null)
            }}
          >
            Mark done
          </Button>
        )}
      </div>
    </div>
  )
}
