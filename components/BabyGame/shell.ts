/**
 * components/BabyGame/shell.ts — paints the shells (abalone, cone, cowrie, ...) as gather nodes and as item icons
 *
 * Sprites are the snapped ComfyUI pictures in `lib/baby-game/shell-sprites.ts`, one canvas per kind, drawn without smoothing.
 * A shell node shows the kind its id fixes (`shellKindOf`), so the shell you see is the shell you pick up.
 */

import { SHELL_SPRITES } from "@/lib/baby-game/shell-sprites"

const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz"
const INK = "#2b1d2e"
const canvases = new Map<string, HTMLCanvasElement>()

/** The sprite for a kind (`"cowrie"`), as a canvas at its own pixel size, or null for an unknown kind. */
export function shellCanvas(kind: string): HTMLCanvasElement | null {
  const hit = canvases.get(kind)
  if (hit) return hit
  const sp = SHELL_SPRITES[kind]
  if (!sp || typeof document === "undefined") return null
  const c = document.createElement("canvas")
  c.width = sp.w
  c.height = sp.h
  const ctx = c.getContext("2d")!
  sp.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ".") continue
      const ci = CHARS.indexOf(row[x]!)
      ctx.fillStyle = ci === sp.pal.length - 1 ? INK : sp.pal[ci]!
      ctx.fillRect(x, y, 1, 1)
    }
  })
  canvases.set(kind, c)
  return c
}

/** A shell lying on the ground, its feet at the middle of the tile whose top-left is (x, y). */
export function drawShellNode(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number): boolean {
  const c = shellCanvas(kind)
  if (!c) return false
  ctx.fillStyle = "rgba(30,60,90,0.2)"
  ctx.fillRect(Math.round(x + 8 - c.width / 2), Math.round(y + 14), c.width, 2)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(c, Math.round(x + 8 - c.width / 2), Math.round(y + 15 - c.height))
  return true
}

/** An item icon: the shell fitted into a square of `size` canvas pixels. */
export function paintShellIcon(ctx: CanvasRenderingContext2D, kind: string, size: number) {
  const c = shellCanvas(kind)
  if (!c) return
  const k = Math.min(size / c.width, size / c.height)
  const w = c.width * k, h = c.height * k
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(c, (size - w) / 2, (size - h) / 2, w, h)
}
