/**
 * components/Home/Tracking/tool-detail.tsx — Selected-tool silkscreen
 *
 * Quick display for the paint tool: jewel lamp (icon) + name + how-to copy.
 * Lives on `.trk-tools-rail` under the Draw / Erase / Scissors throws (inside
 * `.trk-tools-tray`) so hiding `.trk-pen-tray` cannot take it with the beads.
 * Keys stay 96×22; this plate does not grow them. No Lucide.
 */
import type { TrackingPaintTool } from "./tracking-tool-mode"

export const TRACKING_TOOL_DETAIL: Record<
  TrackingPaintTool,
  { name: string; howTo: string }
> = {
  draw: { name: "Draw", howTo: "Paint with the selected pen" },
  erase: { name: "Erase", howTo: "Drag to clear minutes" },
  scissors: { name: "Scissors", howTo: "Click a minute to split" },
}

export function ToolDetail({ paintTool }: { paintTool: TrackingPaintTool }) {
  const detail = TRACKING_TOOL_DETAIL[paintTool]
  return (
    <div
      className="trk-tool-detail"
      data-ui-name="Tool detail"
      data-ui-docs="components/Home/Tracking/README.md"
      data-paint-tool={paintTool}
    >
      <div className="trk-tool-detail-head">
        <span className="trk-jewel trk-jewel-on" aria-hidden>
          <span className="trk-jewel-glass">
            <span className="trk-jewel-die" />
            <span className="trk-jewel-spec" />
          </span>
        </span>
        <span className="trk-silk">{detail.name}</span>
      </div>
      <p className="trk-tool-howto">{detail.howTo}</p>
    </div>
  )
}
