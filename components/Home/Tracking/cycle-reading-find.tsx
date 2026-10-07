/**
 * components/Home/Tracking/cycle-reading-find.tsx — Find in the cycle reading
 *
 * Cmd+F / Ctrl+F while Cycle detail is open. The dialog owns the shortcut.
 * This file splits text, paints marks, and stamps which match is current
 * after the reading has committed. Month day numbers are not marks.
 */
"use client"

import {
  createContext,
  Fragment,
  useContext,
  useLayoutEffect,
  type ReactNode,
  type RefObject,
} from "react"

export function isCycleFindChord(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}): boolean {
  if (event.altKey || event.shiftKey) return false
  if (!event.metaKey && !event.ctrlKey) return false
  return event.key === "f" || event.key === "F"
}

export function splitByQuery(text: string, query: string): Array<{ text: string; match: boolean }> {
  const needle = query.trim().toLowerCase()
  if (!needle) return [{ text, match: false }]
  const hay = text.toLowerCase()
  const parts: Array<{ text: string; match: boolean }> = []
  let cursor = 0
  while (cursor <= text.length - needle.length) {
    const at = hay.indexOf(needle, cursor)
    if (at < 0) break
    if (at > cursor) parts.push({ text: text.slice(cursor, at), match: false })
    parts.push({ text: text.slice(at, at + needle.length), match: true })
    cursor = at + needle.length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  if (parts.length === 0) parts.push({ text, match: false })
  return parts
}

const FindQueryContext = createContext("")
const RestampContext = createContext<(scroll?: boolean) => void>(() => {})

export function CycleFindProviders({
  query,
  restamp,
  children,
}: {
  query: string
  restamp: (scroll?: boolean) => void
  children: ReactNode
}) {
  return (
    <RestampContext.Provider value={restamp}>
      <FindQueryContext.Provider value={query}>{children}</FindQueryContext.Provider>
    </RestampContext.Provider>
  )
}

/** Re-number matches after this subtree commits. No-op outside the dialog. */
export function useCycleFindRestamp(): void {
  const restamp = useContext(RestampContext)
  useLayoutEffect(() => {
    restamp(false)
  })
}

export function FindText({ text }: { text: string }) {
  const query = useContext(FindQueryContext)
  const parts = splitByQuery(text, query)
  if (!query.trim() || parts.every((part) => !part.match)) return <>{text}</>
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className="trk-cycle-find-mark">
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  )
}

/** Number marks in document order. Scroll the current one only when `scroll` is set. */
export function stampCycleFindMarks(root: ParentNode | null, active: number, scroll = false): number {
  if (!root) return 0
  const marks = [...root.querySelectorAll<HTMLElement>("mark.trk-cycle-find-mark")]
  const current = marks.length === 0 ? -1 : Math.min(Math.max(active, 0), marks.length - 1)
  marks.forEach((mark, index) => {
    mark.setAttribute("data-find-index", String(index))
    if (index === current) mark.setAttribute("data-current", "true")
    else mark.removeAttribute("data-current")
  })
  const node = root.querySelector("mark[data-current='true']")
  if (scroll && node && typeof node.scrollIntoView === "function") {
    try {
      node.scrollIntoView({ block: "nearest", inline: "nearest" })
    } catch {
      /* jsdom */
    }
  }
  return marks.length
}

export function CycleFindBar({
  query,
  count,
  active,
  inputRef,
  onQuery,
  onNext,
  onPrev,
}: {
  query: string
  count: number
  active: number
  inputRef: RefObject<HTMLInputElement | null>
  onQuery: (value: string) => void
  onNext: () => void
  onPrev: () => void
}) {
  const trimmed = query.trim()
  const place = !trimmed || count === 0 ? 0 : Math.min(active, count - 1) + 1
  const label = !trimmed ? "" : count === 0 ? "0 of 0" : `${place} of ${count}`
  return (
    <div className="trk-cycle-find" role="search">
      <label className="trk-cycle-find-label">
        Find
        <input
          ref={inputRef}
          aria-label="Find in cycle reading"
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            if (event.shiftKey) onPrev()
            else onNext()
          }}
        />
      </label>
      <span className="trk-cycle-find-count" data-testid="cycle-find-count" aria-live="polite">
        {label}
      </span>
      <button type="button" className="trk-cycle-find-step" aria-label="Previous match" onClick={onPrev}>
        Prev
      </button>
      <button type="button" className="trk-cycle-find-step" aria-label="Next match" onClick={onNext}>
        Next
      </button>
    </div>
  )
}
