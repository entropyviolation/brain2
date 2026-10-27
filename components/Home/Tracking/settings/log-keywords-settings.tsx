/**
 * components/Home/Tracking/log-keywords-settings.tsx — Phrases for `log` / `log:`
 *
 * Lives in Tracking view settings. Add, rename, and remove.
 * The row does not wrap a lone control. Empty until the person saves a phrase.
 * Also count starts a tally for that phrase.
 */
"use client"

import { useState } from "react"
import { ensureCountForKeyword, useCountStatusesStore } from "@/lib/count-statuses"
import { normalizeLogKeyword } from "@/lib/log-keywords"
import { logKeywordPhrase, useLogKeywordsStore } from "@/lib/log-keywords-store"

export function LogKeywordsSettings() {
  const keywords = useLogKeywordsStore((state) => state.keywords)
  const addKeyword = useLogKeywordsStore((state) => state.addKeyword)
  const renameKeyword = useLogKeywordsStore((state) => state.renameKeyword)
  const removeKeyword = useLogKeywordsStore((state) => state.removeKeyword)
  const [draft, setDraft] = useState("")

  function add() {
    if (addKeyword(draft)) setDraft("")
  }

  return (
    <section className="trk-log-keywords" aria-label="Log keywords" data-testid="log-keywords">
      <div className="trk-log-keywords-row">
        <span className="trk-logbook-heading">Log keywords</span>
        <input
          aria-label="New log keyword"
          placeholder="went outside"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <button type="button" onClick={add} disabled={!draft.trim()}>
          Add keyword
        </button>
      </div>
      {keywords.map((row) => {
        const phrase = logKeywordPhrase(row)
        if (!phrase) return null
        return (
          <KeywordRow
            key={phrase}
            phrase={phrase}
            onRename={(next) => renameKeyword(phrase, next)}
            onRemove={() => removeKeyword(phrase)}
          />
        )
      })}
    </section>
  )
}

function KeywordRow({
  phrase,
  onRename,
  onRemove,
}: {
  phrase: string
  onRename: (next: string) => boolean
  onRemove: () => void
}) {
  const [value, setValue] = useState(phrase)
  const key = normalizeLogKeyword(phrase).toLowerCase()
  const counted = useCountStatusesStore((state) =>
    state.counts.some((row) => normalizeLogKeyword(row.keyword ?? "").toLowerCase() === key) ||
    state.counts.some((row) => {
      const linked = useLogKeywordsStore
        .getState()
        .keywords.find((item) => logKeywordPhrase(item).toLowerCase() === key)
      return typeof linked === "object" && linked?.countId === row.id
    }),
  )

  function commit() {
    const next = value.trim()
    if (next === phrase) return
    if (!onRename(value)) setValue(phrase)
  }

  return (
    <div className="trk-log-keywords-row">
      <input
        aria-label={`Edit ${phrase}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
        }}
      />
      {counted ? null : (
        <button type="button" onClick={() => ensureCountForKeyword(phrase)}>
          Also count
        </button>
      )}
      <button type="button" onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}
