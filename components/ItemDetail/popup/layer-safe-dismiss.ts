/**
 * components/ItemDetail/popup/layer-safe-dismiss.ts
 *
 * Private to TaskDetailPopup. Not for the page, the To do drawer, or the task card.
 * A click or focus inside a stacked item layer is not outside this popup.
 */

/**
 * Phase 11: a click or focus inside an item layer stacked on top
 * (`StepItemStack`) is not "outside" this popup, so the popup underneath keeps
 * its place instead of closing. Escape closes the top dialog. Radix already
 * gives that key only to the highest dialog.
 */
export function layerSafeDismiss(handlers: {
  onOutside: (event: Event) => void
  onEscape: (event: KeyboardEvent) => void
}) {
  const inLayer = (event: Event) => {
    const target = ((event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target ?? event.target) as
      | Element
      | null
    return !!target?.closest?.("[data-item-layer]")
  }
  return {
    onPointerDownOutside: (event: Event) => (inLayer(event) ? event.preventDefault() : handlers.onOutside(event)),
    onInteractOutside: (event: Event) => (inLayer(event) ? event.preventDefault() : handlers.onOutside(event)),
    onEscapeKeyDown: (event: KeyboardEvent) => {
      event.preventDefault()
      const target = event.target instanceof Element ? event.target : null
      const layer = target?.closest("[data-item-layer]")
      const dialog = target?.closest('[role="dialog"]')
      // Escape reaches only the highest dialog. That dialog closes. A different
      // item-layer node (not this dialog) is left alone, same as a click there.
      if (layer && layer !== dialog) return
      handlers.onEscape(event)
    },
  }
}
