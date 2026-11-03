"use client"

/**
 * One-second clock for the session popup. Skips the tick while the document is hidden.
 */
import { useEffect, useState } from "react"

function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    const tick = () => {
      if (!document.hidden) setNow(new Date())
    }
    const id = window.setInterval(tick, 1000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [active])
  return now
}

export { useNow }
