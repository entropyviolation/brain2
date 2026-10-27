/**
 * components/Home/Plan/phone/use-plan-swipe.ts — Horizontal period swipe
 *
 * A sideways flick changes day, week, month, or season. A vertical move is
 * left to the scroller (`touch-action: pan-y` on the phone body). The click
 * that would follow a flick is swallowed so a day cell does not also open.
 */
"use client"

import { useEffect, useRef } from "react"

const SWIPE_PX = 56

export function usePeriodSwipe(onSwipe: (direction: 1 | -1) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const onSwipeRef = useRef(onSwipe)
  onSwipeRef.current = onSwipe

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let swallow = false

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      const x0 = event.clientX
      const y0 = event.clientY
      let dx = 0
      let dy = 0
      const move = (ev: PointerEvent) => {
        dx = ev.clientX - x0
        dy = ev.clientY - y0
      }
      const up = () => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        window.removeEventListener("pointercancel", up)
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.25) {
          swallow = true
          onSwipeRef.current(dx < 0 ? 1 : -1)
        }
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      window.addEventListener("pointercancel", up)
    }

    const onClick = (event: MouseEvent) => {
      if (!swallow) return
      swallow = false
      event.preventDefault()
      event.stopPropagation()
    }

    el.addEventListener("pointerdown", down)
    el.addEventListener("click", onClick, true)
    return () => {
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("click", onClick, true)
    }
  }, [])

  return ref
}
