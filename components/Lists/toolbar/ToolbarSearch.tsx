"use client"

import { useLayoutEffect, useRef, useState } from "react"

export interface ToolbarSearchProps {
  /** Increment to wipe the field (Clear, opening a search hit). Never pass the typed string. */
  resetKey: number
  onChange: (value: string) => void
}

/**
 * The field is the source of truth for keystrokes. Filter state is pushed
 * outward and never written back into the input (write-back skipped letters).
 */
export function ToolbarSearch({ resetKey, onChange }: ToolbarSearchProps) {
  const [text, setText] = useState("")
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const skipReset = useRef(true)

  useLayoutEffect(() => {
    if (skipReset.current) {
      skipReset.current = false
      return
    }
    setText("")
  }, [resetKey])

  const commit = (next: string) => {
    setText(next)
    onChangeRef.current(next)
  }

  return (
    <span className="fm-search">
      <input
        className="fm-input"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search folders, lists, items…"
        aria-label="Search folders, lists, and items"
        value={text}
        onChange={(e) => commit(e.target.value)}
      />
      {text ? (
        <button
          type="button"
          className="fm-search-clear"
          aria-label="Clear search"
          title="Clear"
          onClick={() => commit("")}
        >
          ×
        </button>
      ) : null}
    </span>
  )
}
