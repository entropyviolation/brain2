/**
 * Touch drag-and-drop polyfill for the mobile shell.
 *
 * iOS Safari does not support HTML5 DnD. This synthesizes dragstart / dragover /
 * drop / dragend from long-press + finger move, scoped to `.cogs-mobile-app`.
 * Desktop mouse DnD is left untouched.
 */

const LONG_PRESS_MS = 280
const MOVE_CANCEL_PX = 12

type FakeDataTransfer = {
  effectAllowed: string
  dropEffect: string
  files: FileList | null
  items: DataTransferItemList | null
  types: string[]
  setData: (format: string, data: string) => void
  getData: (format: string) => string
  clearData: () => void
  setDragImage: () => void
}

type DragSession = {
  source: HTMLElement
  dataTransfer: FakeDataTransfer
  ghost: HTMLElement
  lastTarget: Element | null
}

function createFakeDataTransfer(): FakeDataTransfer {
  const store = new Map<string, string>()
  try {
    // Prefer real DataTransfer when available (newer WebKit).
    const real = new DataTransfer()
    return real as unknown as FakeDataTransfer
  } catch {
    return {
      effectAllowed: "copyMove",
      dropEffect: "move",
      files: null,
      items: null,
      types: [],
      setData(format, data) {
        store.set(format, data)
        this.types = [...store.keys()]
      },
      getData(format) {
        return store.get(format) || ""
      },
      clearData() {
        store.clear()
        this.types = []
      },
      setDragImage() {},
    }
  }
}

function closestDraggable(el: Element | null): HTMLElement | null {
  let node: Element | null = el
  while (node && node instanceof HTMLElement) {
    if (node.getAttribute("draggable") === "true") return node
    node = node.parentElement
  }
  return null
}

function dispatch(target: EventTarget | null, type: string, dt: FakeDataTransfer, clientX: number, clientY: number) {
  if (!target) return
  let event: Event
  try {
    event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    })
    Object.defineProperty(event, "dataTransfer", { value: dt, configurable: true })
  } catch {
    event = new CustomEvent(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, "dataTransfer", { value: dt, configurable: true })
    Object.defineProperty(event, "clientX", { value: clientX })
    Object.defineProperty(event, "clientY", { value: clientY })
  }
  target.dispatchEvent(event)
}

export function installTouchDnD(root: HTMLElement): () => void {
  let pressTimer: number | null = null
  let startX = 0
  let startY = 0
  let session: DragSession | null = null

  const clearPress = () => {
    if (pressTimer != null) {
      window.clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  const endSession = (clientX: number, clientY: number, drop: boolean) => {
    if (!session) return
    const { source, dataTransfer, ghost, lastTarget } = session
    if (drop && lastTarget) {
      dispatch(lastTarget, "drop", dataTransfer, clientX, clientY)
    }
    dispatch(source, "dragend", dataTransfer, clientX, clientY)
    ghost.remove()
    root.classList.remove("cogs-mobile-dragging")
    session = null
  }

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const draggable = closestDraggable(document.elementFromPoint(touch.clientX, touch.clientY))
    if (!draggable || !root.contains(draggable)) return

    startX = touch.clientX
    startY = touch.clientY
    clearPress()

    pressTimer = window.setTimeout(() => {
      pressTimer = null
      const dt = createFakeDataTransfer()
      try {
        dt.effectAllowed = "copyMove"
        dt.setData("text/plain", draggable.getAttribute("data-id") || draggable.id || "drag")
      } catch {
        /* ignore */
      }

      const ghost = draggable.cloneNode(true) as HTMLElement
      ghost.classList.add("cogs-mobile-drag-ghost")
      ghost.style.width = `${draggable.offsetWidth}px`
      ghost.style.left = `${touch.clientX - 20}px`
      ghost.style.top = `${touch.clientY - 20}px`
      document.body.appendChild(ghost)

      session = { source: draggable, dataTransfer: dt, ghost, lastTarget: null }
      root.classList.add("cogs-mobile-dragging")
      dispatch(draggable, "dragstart", dt, touch.clientX, touch.clientY)
      if (navigator.vibrate) navigator.vibrate(12)
    }, LONG_PRESS_MS)
  }

  const onTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return

    if (!session) {
      if (pressTimer != null) {
        const dx = touch.clientX - startX
        const dy = touch.clientY - startY
        if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearPress()
      }
      return
    }

    e.preventDefault()
    session.ghost.style.left = `${touch.clientX - 20}px`
    session.ghost.style.top = `${touch.clientY - 20}px`

    session.ghost.style.pointerEvents = "none"
    const under = document.elementFromPoint(touch.clientX, touch.clientY)
    session.ghost.style.pointerEvents = "auto"

    if (under && under !== session.lastTarget) {
      if (session.lastTarget) {
        dispatch(session.lastTarget, "dragleave", session.dataTransfer, touch.clientX, touch.clientY)
      }
      session.lastTarget = under
      dispatch(under, "dragover", session.dataTransfer, touch.clientX, touch.clientY)
    } else if (under) {
      dispatch(under, "dragover", session.dataTransfer, touch.clientX, touch.clientY)
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    clearPress()
    const touch = e.changedTouches[0]
    if (!session || !touch) {
      session = null
      return
    }
    endSession(touch.clientX, touch.clientY, true)
  }

  const onTouchCancel = () => {
    clearPress()
    if (session) {
      endSession(startX, startY, false)
    }
  }

  root.addEventListener("touchstart", onTouchStart, { passive: true })
  root.addEventListener("touchmove", onTouchMove, { passive: false })
  root.addEventListener("touchend", onTouchEnd)
  root.addEventListener("touchcancel", onTouchCancel)

  return () => {
    clearPress()
    if (session) endSession(startX, startY, false)
    root.removeEventListener("touchstart", onTouchStart)
    root.removeEventListener("touchmove", onTouchMove)
    root.removeEventListener("touchend", onTouchEnd)
    root.removeEventListener("touchcancel", onTouchCancel)
  }
}
