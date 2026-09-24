/**
 * components/Home/Tracking/tracking-tools-tray.tsx — Paint tools, not pens
 *
 * Draw / Erase / Scissors live in `.trk-tools-tray` on the far-right
 * `.trk-tools-rail` of `TrkPenToolsRow`. They are radios: selected = inset mill
 * + jewel lamp on a fixed-size key, never a growing banner and never Lucide.
 * Compact `ToolDetail` (jewel + silkscreen how-to) sits under those throws so
 * copy survives Draw-off.
 *
 * Hide / View / Tags are independent latches in `TrackingViewLatches`, mounted
 * in `TrkLatchesWell` on the top SHOW AS / SORT row — not stacked on the paint
 * rail. Same milled throw + lamp family; they are not paint radios.
 */
"use client"

import { ToolDetail } from "./tool-detail"
import type { TrackingPaintTool } from "./tracking-tool-mode"

function ToolJewel() {
  return (
    <span className="trk-jewel" aria-hidden>
      <span className="trk-jewel-glass">
        <span className="trk-jewel-die" />
        <span className="trk-jewel-spec" />
      </span>
    </span>
  )
}

function ToolKey({
  pressed,
  title,
  label,
  onClick,
  bank,
}: {
  pressed?: boolean
  title: string
  label: string
  onClick: () => void
  bank: "paint" | "latch"
}) {
  return (
    <button
      type="button"
      className="trk-tool-key"
      data-bank={bank}
      data-no95=""
      onClick={onClick}
      aria-pressed={pressed}
      title={title}
    >
      <ToolJewel />
      <span className="trk-tool-caption">{label}</span>
    </button>
  )
}

export function TrackingViewLatches({
  hiding,
  manage,
  onToggleHiding,
  onOpenViewSettings,
  onToggleManage,
}: {
  hiding: boolean
  manage: boolean
  onToggleHiding: () => void
  onOpenViewSettings: () => void
  onToggleManage: () => void
}) {
  return (
    <div
      className="trk-tools trk-tools-latches"
      role="group"
      aria-label="View latches"
      data-ui-name="View latches"
      data-ui-docs="components/Home/Tracking/README.md"
    >
      <ToolKey
        bank="latch"
        pressed={hiding}
        onClick={onToggleHiding}
        title="Hide pens from this view's well"
        label="Hide"
      />
      <ToolKey
        bank="latch"
        onClick={onOpenViewSettings}
        title="View settings — cell size, fill range, hidden pens"
        label="View"
      />
      <ToolKey
        bank="latch"
        pressed={manage}
        onClick={onToggleManage}
        title="Tag library"
        label="Tags"
      />
    </div>
  )
}

export function TrackingToolsTray({
  paintTool,
  onSelectPaintTool,
}: {
  paintTool: TrackingPaintTool
  onSelectPaintTool: (tool: TrackingPaintTool) => void
}) {
  return (
    <div
      className="trk-tools-tray"
      role="group"
      aria-label="Paint tools"
      data-ui-name="Paint tools"
      data-ui-docs="components/Home/Tracking/README.md"
    >
      <span className="trk-silk">Tools</span>
      <div className="trk-tools trk-tools-paint" role="group" aria-label="Paint mode">
        <ToolKey
          bank="paint"
          pressed={paintTool === "draw"}
          onClick={() => onSelectPaintTool("draw")}
          title="Paint with the selected pen"
          label="Draw"
        />
        <ToolKey
          bank="paint"
          pressed={paintTool === "erase"}
          onClick={() => onSelectPaintTool("erase")}
          title="Drag to clear minutes"
          label="Erase"
        />
        <ToolKey
          bank="paint"
          pressed={paintTool === "scissors"}
          onClick={() => onSelectPaintTool("scissors")}
          title="Split a block at the minute you click"
          label="Scissors"
        />
      </div>
      <ToolDetail paintTool={paintTool} />
    </div>
  )
}
