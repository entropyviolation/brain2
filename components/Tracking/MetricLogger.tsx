/**
 * components/Tracking/MetricLogger.tsx — Capture core wellbeing datapoints
 *
 * Self-contained capture surface for the five core wellbeing metrics (joy,
 * suffering, alignment, self-satisfaction, situational satisfaction). It reads
 * and writes the metrics-store directly:
 *  - record one timestamped *datapoint* with all five 0–100 metrics at once,
 *  - annotate it with a short `context` and longer `details`,
 *  - set the moment (`at`) to the minute — defaulting to now, but editable so
 *    readings can be **back-logged** for an earlier time,
 *  - review / delete recent datapoints.
 *
 * Two entry points are exported:
 *  - `MetricLogger` — the full panel (drop into a Tracking tab / page),
 *  - `MetricLoggerButton` — a header button that opens the panel in a dialog.
 */
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Activity, Trash2 } from "lucide-react"
import {
  useMetricsStore,
  METRIC_DEFINITIONS,
  type MetricKey,
  toLocalDateTimeValue,
  resolveMetricColor,
} from "@/lib/metrics-store"

/** Metric values are kept as raw input strings; "" means "not included". */
function blankValues(): Record<MetricKey, string> {
  return METRIC_DEFINITIONS.reduce(
    (acc, d) => {
      acc[d.key] = ""
      return acc
    },
    {} as Record<MetricKey, string>,
  )
}

function parseEntered(raw: string): number | null {
  if (raw.trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

function formatAt(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function MetricLogger() {
  const datapoints = useMetricsStore((s) => s.datapoints)
  const colors = useMetricsStore((s) => s.colors)
  const setMetricColor = useMetricsStore((s) => s.setMetricColor)
  const addDatapoint = useMetricsStore((s) => s.addDatapoint)
  const removeDatapoint = useMetricsStore((s) => s.removeDatapoint)

  const [values, setValues] = useState<Record<MetricKey, string>>(blankValues)
  const [at, setAt] = useState(() => toLocalDateTimeValue(new Date()))
  const [context, setContext] = useState("")
  const [details, setDetails] = useState("")

  const recent = useMemo(
    () =>
      datapoints
        .slice()
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
        .slice(0, 12),
    [datapoints],
  )

  const setMetric = (key: MetricKey, v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  const parsedValues = useMemo(() => {
    const out: Partial<Record<MetricKey, number>> = {}
    for (const d of METRIC_DEFINITIONS) {
      const n = parseEntered(values[d.key])
      if (n !== null) out[d.key] = n
    }
    return out
  }, [values])

  const canLog = Object.keys(parsedValues).length > 0 || context.trim() !== "" || details.trim() !== ""

  const submit = () => {
    if (!canLog) return
    addDatapoint({
      at,
      values: parsedValues,
      context: context.trim() || undefined,
      details: details.trim() || undefined,
    })
    setValues(blankValues())
    setAt(toLocalDateTimeValue(new Date()))
    setContext("")
    setDetails("")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Log a datapoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2.5">
            {METRIC_DEFINITIONS.map((d) => {
              const parsed = parseEntered(values[d.key])
              const color = resolveMetricColor(d.key, colors)
              return (
                <div key={d.key} className="grid grid-cols-[10rem_auto_1fr] items-center gap-3">
                  <Label className="text-xs flex items-center gap-2" htmlFor={`metric-${d.key}`}>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setMetricColor(d.key, e.target.value)}
                      className="w-3.5 h-3.5 rounded-sm border-0 bg-transparent p-0 cursor-pointer shrink-0"
                      style={{ appearance: "none" }}
                      title={`Pick a color for ${d.name}`}
                      aria-label={`Pick a color for ${d.name}`}
                    />
                    {d.name}
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={`metric-${d.key}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={values[d.key]}
                      onChange={(e) => setMetric(d.key, e.target.value)}
                      placeholder="—"
                      className="h-8 w-16 text-right tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    {parsed !== null && (
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${parsed}%`, background: color }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="metric-at">
                When (back-log earlier times)
              </Label>
              <Input
                id="metric-at"
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="metric-context">
                Context
              </Label>
              <Input
                id="metric-context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="what was happening"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor="metric-details">
              Details
            </Label>
            <Textarea
              id="metric-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="anything worth noting about this datapoint"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={!canLog}>
              Log datapoint
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent datapoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No datapoints logged yet.</p>
          ) : (
            recent.map((dp) => (
              <div key={dp.id} className="border rounded-md p-2.5 text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{formatAt(dp.at)}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeDatapoint(dp.id)}
                    aria-label="Delete datapoint"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {METRIC_DEFINITIONS.map((d) =>
                    dp.values[d.key] === undefined ? null : (
                      <Badge key={d.key} variant="secondary" className="font-normal gap-1">
                        <span
                          className="inline-block w-2 h-2 rounded-sm"
                          style={{ background: resolveMetricColor(d.key, colors) }}
                        />
                        {d.name}: {dp.values[d.key]}
                      </Badge>
                    ),
                  )}
                </div>
                {dp.context && <p className="text-xs text-muted-foreground">Context: {dp.context}</p>}
                {dp.details && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{dp.details}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Header / Tracking entry: a button that opens the logger in a dialog. */
export function MetricLoggerButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Activity className="h-4 w-4 mr-1" />
          Metrics
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wellbeing metrics</DialogTitle>
        </DialogHeader>
        <MetricLogger />
      </DialogContent>
    </Dialog>
  )
}

export default MetricLogger
