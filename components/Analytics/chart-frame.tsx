/**
 * components/Analytics/chart-frame.tsx — Honest empty / thin chart furniture
 *
 * Keep the frame. When there is no series, one sentence lives inside it —
 * no axes, blank heatmaps, or KPI cards performing precision. A thin window
 * is watermarked and the finding is withheld.
 */
"use client"

import { openItemsInLists } from "./open-in-lists"

export function ChartFrame({
  empty,
  emptySentence,
  thin,
  thinSentence,
  children,
}: {
  empty?: boolean
  emptySentence?: string
  thin?: boolean
  thinSentence?: string
  children?: React.ReactNode
}) {
  return (
    <div className="an-chart-frame">
      {empty ? (
        <p className="an-chart-empty">{emptySentence}</p>
      ) : thin ? (
        <p className="an-watermark">{thinSentence}</p>
      ) : (
        children
      )}
    </div>
  )
}

export function OpenInListsButton({
  taskIds,
  habits,
  label,
}: {
  taskIds?: string[]
  habits?: boolean
  label?: string
}) {
  const count = taskIds?.length ?? 0
  if (!habits && count === 0) return null
  return (
    <button
      type="button"
      className="an-open-lists"
      onClick={() => openItemsInLists({ taskIds, habits })}
    >
      {label ?? (habits ? "Open habits in Lists" : `Open ${count} item(s) in Lists`)}
    </button>
  )
}
