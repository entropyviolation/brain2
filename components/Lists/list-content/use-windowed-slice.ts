"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Render a slice of a long list. The scroll parent is whatever actually scrolls
 * (the sunken Lists pane, or the window). Spacers keep the scrollbar honest.
 * A hidden desk (`display: none`) collapses to the overscan, so a big list
 * sitting under item detail does not keep thousands of rows mounted.
 * A pane that has stretched to fit every row is measured as the screen, so
 * the slice does not grow until the whole list is mounted.
 */
export function useWindowedSlice<T extends HTMLElement = HTMLDivElement>(count: number, rowPx: number) {
  const ref = useRef<T>(null)
  const [range, setRange] = useState(() => ({ start: 0, end: Math.min(count, 48) }))

  useEffect(() => {
    const node = ref.current
    if (!node || count === 0) return

    const scroller = findScrollParent(node)
    const onWindow = scroller === document.documentElement || scroller === document.body
    let timer = 0

    const update = () => {
      // A pane that grew with its rows (phone Lists, or a table taller than the
      // screen) is not a viewport. Measuring it would mount every row.
      const unbounded =
        !onWindow &&
        scroller.clientHeight > window.innerHeight * 1.5 &&
        scroller.scrollHeight <= scroller.clientHeight + 2
      const viewTop = onWindow || unbounded ? 0 : scroller.getBoundingClientRect().top
      const viewHeight = onWindow || unbounded ? window.innerHeight : scroller.clientHeight
      const listTop = node.getBoundingClientRect().top
      const scrolled = viewTop - listTop
      const start = Math.max(0, Math.floor(scrolled / rowPx) - 8)
      const visible = Math.max(1, Math.ceil(viewHeight / rowPx))
      const end = Math.min(count, start + visible + 16)
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }

    const onScroll = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(update, 0)
    }

    onScroll()
    const target: HTMLElement | Window = onWindow ? window : scroller
    target.addEventListener("scroll", onScroll, { passive: true })
    if (!onWindow) window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    const observed = typeof ResizeObserver === "function" ? new ResizeObserver(onScroll) : null
    observed?.observe(scroller)
    observed?.observe(node)

    return () => {
      window.clearTimeout(timer)
      target.removeEventListener("scroll", onScroll)
      if (!onWindow) window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      observed?.disconnect()
    }
  }, [count, rowPx])

  const start = Math.min(range.start, count)
  const end = Math.max(start, Math.min(range.end, count))
  return { ref, start, end }
}

function findScrollParent(node: HTMLElement): HTMLElement {
  let el: HTMLElement | null = node.parentElement
  while (el) {
    const style = getComputedStyle(el)
    const y = style.overflowY
    const both = style.overflow
    if (y === "auto" || y === "scroll" || both === "auto" || both === "scroll") return el
    el = el.parentElement
  }
  return document.documentElement
}
