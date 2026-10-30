/**
 * components/Home/Habits/habit-form/keywords.tsx — BIM keyword row and phrase list.
 *
 * `KeywordSourceFields` is the pipeline-row config (`row.kind === "keywords"`).
 * `HabitFormKeywords` is the BIM Keywords fieldset. It mounts only while
 * `sourceOrder` includes `"keywords"`. Those two gates stay separate.
 * Phrase state and the trigger editors stay in `TaskForm`.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Habit95Select } from "@/components/Home/Habits/habit-sources-field"
import { KEYWORD_USE_OPTIONS } from "@/lib/habit-keyword-source"
import { NativeSelect } from "@/components/ui/native-select"
import type {
  HabitCompletionPipeline,
  HabitKeywordSource,
  HabitKeywordUse,
  HabitTextTrigger,
} from "@/lib/types"
import { TRIGGER_MODES } from "./model"

export function KeywordSourceFields({
  row,
  onChange,
}: {
  row: HabitCompletionPipeline
  onChange: (keyword: HabitKeywordSource) => void
}) {
  const use = row.keyword?.use ?? "received"
  const count = row.keyword?.count ?? 2
  const pattern = row.keyword?.pattern ?? ""
  const label = KEYWORD_USE_OPTIONS.find((option) => option.id === use)?.label ?? "True if received"
  const setKeyword = (next: Partial<HabitKeywordSource>) => {
    const nextUse = next.use ?? use
    const nextCount = next.count ?? count
    const nextPattern = next.pattern !== undefined ? next.pattern : pattern
    onChange({
      use: nextUse,
      ...(nextCount != null ? { count: nextCount } : {}),
      ...(nextPattern ? { pattern: nextPattern } : {}),
    })
  }
  return (
    <>
      <Habit95Select
        label="How the count is used"
        ariaLabel="How the count is used"
        valueLabel={label}
        options={KEYWORD_USE_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
        onChange={(id) => setKeyword({ use: id as HabitKeywordUse })}
      />
      {use === "after" ? (
        <label className="habit95-field">
          Times in this period
          <input
            className="habit95-input"
            type="number"
            min={1}
            step={1}
            aria-label="Times in this period"
            value={count}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10)
              if (!Number.isFinite(next)) return
              setKeyword({ count: Math.max(1, next) })
            }}
          />
        </label>
      ) : null}
      {use === "logged" ? (
        <label className="habit95-field">
          Pattern
          <input
            className="habit95-input"
            aria-label="Logged phrase pattern"
            value={pattern}
            placeholder="read {n} pages of {bookname}"
            onChange={(event) => setKeyword({ pattern: event.target.value })}
          />
        </label>
      ) : null}
      <p className="habit95-hint">
        {use === "logged"
          ? "The whole BIM message must match this pattern. {n}, {x}, and {minutes} are the amount written on the period. A name in braces, such as {bookname}, is kept with it. If the pattern says minutes or hours, that message also logs the prior stretch on this habit’s tracking activity. No clock ends the stretch at the message time and marks it estimated. A clock at the end, such as 1:11, is when it finished. The phrase list under BIM Keywords can still hold the words."
          : "Counts BIM messages whose whole text is the phrase. “drank water” counts. “drank water please” does not. Add the phrase under BIM Keywords."}
        {use === "after" ? " The habit is done only after this many exact messages in the period." : null}
      </p>
    </>
  )
}

export function HabitFormKeywords({
  sourceOrder,
  hadStoredTriggers,
  triggers,
  phrase,
  setPhrase,
  phrasePreview,
  patchTrigger,
  addTrigger,
  removeTrigger,
}: {
  sourceOrder: readonly string[]
  hadStoredTriggers: boolean
  triggers: HabitTextTrigger[]
  phrase: string
  setPhrase: Dispatch<SetStateAction<string>>
  phrasePreview: { text: string }
  patchTrigger: (id: string, patch: Partial<HabitTextTrigger>) => void
  addTrigger: () => void
  removeTrigger: (id: string) => void
}) {
  if (!sourceOrder.includes("keywords")) return null
  return (
      <fieldset id="habit95-sec-keywords" tabIndex={-1} className="habit95-group habit95-sec-keywords">
        <legend>BIM Keywords</legend>
        <p className="habit95-hint">
          Each phrase is a whole BIM message. “drank water” counts only when that is the entire message, not when
          those words sit inside a longer line. The source row sets how the count is used: true if one arrives, true
          after a set number, or a logged phrase such as <code>read {"{n}"} pages of {"{bookname}"}</code> or{" "}
          <code>cleaned for {"{x}"} minutes</code>, which writes the amount on that period. A minutes or hours
          pattern also logs the prior stretch on the tracking activity. This list still holds the phrases. Examples:{" "}
          <code>hemisync</code>, <code>read 30 pages</code>, <code>exercise 15 min</code>, <code>chess score 355</code>.
          {!hadStoredTriggers && triggers.length > 0 ? " Presets for this name are shown; save to keep them editable." : null}
        </p>
        {triggers.length === 0 ? (
          <p className="habit95-hint">No keywords yet. Add one, or name the habit hemisync / read / exercise / chess for a preset.</p>
        ) : (
          triggers.map((trigger, index) => (
            <div key={trigger.id} className="habit95-goal-grid" style={{ marginTop: index === 0 ? 0 : 8, alignItems: "end" }}>
              <div className="habit95-field">
                <label htmlFor={`trigger-kw-${trigger.id}`}>Keyword</label>
                <input
                  id={`trigger-kw-${trigger.id}`}
                  className="habit95-input"
                  value={trigger.keyword}
                  onChange={(e) => patchTrigger(trigger.id, { keyword: e.target.value })}
                  placeholder="read"
                />
              </div>
              <div className="habit95-field">
                <label htmlFor={`trigger-mode-${trigger.id}`}>Mode</label>
                <NativeSelect
                  id={`trigger-mode-${trigger.id}`}
                  className="habit95-input"
                  value={trigger.mode}
                  onChange={(e) =>
                    patchTrigger(trigger.id, { mode: e.target.value as HabitTextTrigger["mode"] })
                  }
                >
                  {TRIGGER_MODES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {(trigger.mode === "quantity" || trigger.mode === "score") && (
                <div className="habit95-field">
                  <label htmlFor={`trigger-units-${trigger.id}`}>Unit words</label>
                  <input
                    id={`trigger-units-${trigger.id}`}
                    className="habit95-input"
                    value={(trigger.unitWords ?? []).join(", ")}
                    onChange={(e) =>
                      patchTrigger(trigger.id, {
                        unitWords: e.target.value
                          .split(",")
                          .map((u) => u.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="pages, page"
                  />
                </div>
              )}
              {trigger.mode === "score" && (
                <div className="habit95-field">
                  <label htmlFor={`trigger-conn-${trigger.id}`}>Connector</label>
                  <input
                    id={`trigger-conn-${trigger.id}`}
                    className="habit95-input"
                    value={trigger.connector ?? ""}
                    onChange={(e) => patchTrigger(trigger.id, { connector: e.target.value })}
                    placeholder="score"
                  />
                </div>
              )}
              <div className="habit95-field">
                <label htmlFor={`trigger-rm-${trigger.id}`} className="sr-only">
                  Remove keyword
                </label>
                <button
                  id={`trigger-rm-${trigger.id}`}
                  type="button"
                  className="habit95-btn"
                  onClick={() => removeTrigger(trigger.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
        <button type="button" className="habit95-btn" style={{ marginTop: 8 }} onClick={addTrigger}>
          Add keyword
        </button>
        <div className="habit95-keyword-test">
          <label className="habit95-field" htmlFor="keyword-try">
            Try a phrase
            <input
              id="keyword-try"
              className="habit95-input"
              value={phrase}
              placeholder="studied for 20 min"
              aria-label="Try a phrase"
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault()
              }}
            />
          </label>
          <p className="habit95-hint habit95-keyword-result" role="status">
            {phrasePreview.text}
          </p>
        </div>
      </fieldset>
  )
}
