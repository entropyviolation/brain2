/**
 * components/Lists/lib/list-icon-gravity-paint.ts — Gravity node chrome
 *
 * Glow / held / hot attributes on icon DOM nodes. Soft link cords live in
 * `list-icon-force-links` + `ListIconPhysicsJuice` (shared with PILE proximity).
 */

import {
  nodeGlowLevel,
  type GravityBody,
} from "@/components/Lists/lib/list-icon-gravity"

/** Stamp glow / held / hot attributes on icon nodes for CSS. */
export function paintGravityNodeChrome(
  root: HTMLElement,
  bodies: readonly GravityBody[],
  hotId: string | null,
  heldId: string | null,
): void {
  const nodes = root.querySelectorAll<HTMLElement>("[data-icon-entry][data-id]")
  const byId = new Map<string, HTMLElement>()
  for (const node of nodes) {
    const id = node.getAttribute("data-id")
    if (id) byId.set(id, node)
  }
  for (const body of bodies) {
    const node = byId.get(body.id)
    if (!node) continue
    const glow = nodeGlowLevel(body.mass)
    if (glow > 0) node.setAttribute("data-gravity-mass", String(glow))
    else node.removeAttribute("data-gravity-mass")
    if (heldId === body.id || body.held) node.setAttribute("data-gravity-held", "on")
    else node.removeAttribute("data-gravity-held")
    if (hotId === body.id) node.setAttribute("data-gravity-hot", "on")
    else node.removeAttribute("data-gravity-hot")
  }
}

export function clearGravityNodeChrome(root: HTMLElement | null): void {
  if (!root) return
  for (const node of root.querySelectorAll<HTMLElement>("[data-icon-entry]")) {
    node.removeAttribute("data-gravity-mass")
    node.removeAttribute("data-gravity-held")
    node.removeAttribute("data-gravity-hot")
  }
}
