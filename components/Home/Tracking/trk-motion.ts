/**
 * components/Home/Tracking/trk-motion.ts — One motion per real verb on the plot
 *
 * docs/TRACKING_REDESIGN.md, Motion: cells flicker on when painted (strike),
 * fade through afterglow when erased (decay), a bright trace runs the cut
 * (scissors), and a scope-trace sweeps a filled range (fill). Each is a short
 * overlay laid over the affected cells inside the grid's scroller; it never
 * catches a click and removes itself. Nothing here touches stored time.
 * Cut by `prefers-reduced-motion`.
 */

export type TrkMotion = "paint" | "erase" | "cut" | "fill"

const DURATION: Record<TrkMotion, number> = { paint: 300, erase: 480, cut: 280, fill: 560 }

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : true
}

/**
 * Play `kind` over the cells of `root` whose `data-minute` is in [lo, hi).
 * `day` narrows to one week column (`data-day`). `axis` is the direction time
 * runs inside a run of cells: "x" in the day grid (left → right in an hour
 * row), "y" in the week grid (down a column).
 */
export function playTrkMotion(
  root: HTMLElement | null,
  kind: TrkMotion,
  lo: number,
  hi: number,
  opts: { day?: string; axis?: "x" | "y"; color?: string } = {},
): void {
  if (!root || reducedMotion() || hi <= lo) return
  const axis = opts.axis ?? "x"
  const run = () => {
    const selector = opts.day ? `[data-day="${opts.day}"][data-minute]` : `[data-minute]`
    const cells = [...root.querySelectorAll<HTMLElement>(selector)].filter((cell) => {
      const minute = Number(cell.dataset.minute)
      return Number.isFinite(minute) && minute >= lo && minute < hi
    })
    if (!cells.length) return
    // One box per row (day grid) or one per column (week grid).
    const groups = new Map<Element, DOMRect[]>()
    for (const cell of cells) {
      const key = axis === "x" ? (cell.parentElement ?? cell) : root
      const list = groups.get(key) ?? []
      list.push(cell.getBoundingClientRect())
      groups.set(key, list)
    }
    const base = root.getBoundingClientRect()
    const boxes = [...groups.values()].map((rects) => {
      const left = Math.min(...rects.map((r) => r.left))
      const top = Math.min(...rects.map((r) => r.top))
      const right = Math.max(...rects.map((r) => r.right))
      const bottom = Math.max(...rects.map((r) => r.bottom))
      return {
        left: left - base.left + root.scrollLeft,
        top: top - base.top + root.scrollTop,
        width: right - left,
        height: bottom - top,
      }
    })
    const cutAt = kind === "cut" ? boxes[0] : null
    for (const box of kind === "cut" ? boxes.slice(0, 1) : boxes) {
      const el = document.createElement("span")
      el.className = `trk-motion trk-motion-${kind}`
      el.dataset.axis = axis
      el.setAttribute("aria-hidden", "true")
      if (opts.color) el.style.setProperty("--motion-color", opts.color)
      if (cutAt) {
        // The cut is a line at the minute you clicked, across the block.
        if (axis === "x") Object.assign(el.style, { left: `${box.left}px`, top: `${box.top}px`, width: "2px", height: `${box.height}px` })
        else Object.assign(el.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: "2px" })
      } else {
        Object.assign(el.style, {
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
        })
      }
      root.appendChild(el)
      window.setTimeout(() => el.remove(), DURATION[kind] + 60)
    }
  }
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run)
  else run()
}
