/**
 * components/Analytics/CalibrationView.tsx — Estimate-vs-actual calibration view
 *
 * Renders estimation accuracy over completed tasks using the pure helpers in
 * `lib/calibration.ts`:
 *  - a scatter of estimated vs actual minutes with a y = x "perfect" reference,
 *  - a ratio-distribution histogram, and
 *  - a headline insight ("you typically underestimate by N%").
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target } from "lucide-react"
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts"
import {
  getCalibrationPoints,
  summarizeCalibration,
  ratioDistribution,
  calibrationTrend,
} from "@/lib/calibration"

export function CalibrationView() {
  const tasks = useTaskStore((s) => s.tasks)

  const points = useMemo(() => getCalibrationPoints(tasks), [tasks])
  const summary = useMemo(() => summarizeCalibration(points), [points])
  const distribution = useMemo(() => ratioDistribution(points), [points])
  const trend = useMemo(() => calibrationTrend(points, "week"), [points])

  const scatterData = points.map((p) => ({
    x: p.estimated,
    y: p.actual,
    name: p.description,
    ratio: p.ratio,
  }))

  const maxAxis = points.reduce((m, p) => Math.max(m, p.estimated, p.actual), 0) || 60
  const referenceLine = [
    { x: 0, y: 0 },
    { x: maxAxis, y: maxAxis },
  ]

  if (points.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Complete tasks that have both an estimated duration and a recorded actual time to see your estimation
            calibration.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">{summary.insight}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{summary.count} tasks</Badge>
                <Badge variant="outline">{Math.round(summary.accurateRate * 100)}% accurate (±10%)</Badge>
                <Badge variant="outline">{Math.round(summary.underestimateRate * 100)}% ran long</Badge>
                <Badge variant="outline">{Math.round(summary.overestimateRate * 100)}% ran short</Badge>
                <Badge variant="outline">median ratio {summary.medianRatio.toFixed(2)}×</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Estimated vs actual (minutes)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Estimated"
                unit="m"
                domain={[0, maxAxis]}
                fontSize={11}
                label={{ value: "Estimated", position: "insideBottom", offset: -2, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Actual"
                unit="m"
                domain={[0, maxAxis]}
                fontSize={11}
                label={{ value: "Actual", angle: -90, position: "insideLeft", fontSize: 11 }}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number, key: string) => [`${value}m`, key === "y" ? "Actual" : "Estimated"]}
                labelFormatter={() => ""}
              />
              <Scatter data={scatterData} fill="#2563eb" />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            Points above the diagonal took longer than estimated; points below finished faster.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ratio distribution (actual ÷ estimated)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distribution} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={10} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {distribution.map((b, i) => (
                  <Cell key={i} fill={b.label.includes("accurate") ? "#30a14e" : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {trend.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Calibration trend (median ratio by week)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodKey" fontSize={9} tickFormatter={(k: string) => k.slice(5, 10)} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}×`} />
                <Line type="monotone" dataKey="medianRatio" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">A ratio of 1.0× means estimates matched reality.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CalibrationView
