/**
 * components/Home/Tracking/depth-control.tsx — How coarse this view reads
 *
 * A painted pen is always the leaf ("Balboa Park"). These buttons pick which
 * ancestor's color and name you see: Country, Area, Place, or Exact. Hidden
 * when the palette is flat — there is nothing to zoom. Same control on the
 * Time Grid and on the Analytics Tracking tab so they cannot disagree about
 * what the rungs are called.
 */
"use client"

import { depthOptions, maxTreeDepth, type DisplayDepth, type TreePen } from "@/lib/pen-tree"
import "./tracking-chrome.css"

export function DepthControl({
  pens,
  labels,
  value,
  onChange,
  ariaLabel = "Detail level",
}: {
  pens: TreePen[]
  labels?: string[]
  value: DisplayDepth
  onChange: (depth: DisplayDepth) => void
  ariaLabel?: string
}) {
  if (maxTreeDepth(pens) === 0) return null
  const options = depthOptions(pens, labels)
  return (
    <div className="trk-module trk-module-show" role="group" aria-label={ariaLabel}>
      <span className="trk-silk">Show as</span>
      <div className="trk-depth">
        {options.map((option) => (
          <button
            key={String(option.depth)}
            type="button"
            aria-pressed={value === option.depth}
            onClick={() => onChange(option.depth)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
