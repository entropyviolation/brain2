/**
 * components/friend-details/FriendDetailsEqualizer.tsx — Vertical mix faders
 *
 * Eight weights, one shared 0–100 scale. A curve over Habits, To Do, and Next
 * shows the mix those three actually produce. Suggest stays dim: it is saved
 * for the later clock. Title loves and list marks are beads.
 */
"use client"

import { useState } from "react"
import { sanitizeFriendPersonality, type FriendPersonality } from "@/lib/baby-animal-personality"
import { friendRewardPoints } from "@/lib/friend-reward"
import { sourceMixPercents, titleLoveMatchCount } from "@/lib/friend-stats"
import { FRIEND_PRESETS } from "@/components/friend-details/useFriendDraft"
import type { List } from "@/lib/types"

type FaderKey = "habitWeight" | "todoWeight" | "nextActionsWeight" | "urgencyBias" | "loveYouRate" | "whimRate" | "rewardScale" | "suggestionRate"

const FADERS: { key: FaderKey; label: string; job: string; hint: string; group?: "apart" | "saved" }[] = [
  { key: "habitWeight", label: "Habits", job: "daily habits", hint: "How often a click draws an open daily habit." },
  { key: "todoWeight", label: "To Do", job: "today's list", hint: "How often a click draws today's To Do." },
  { key: "nextActionsWeight", label: "Next", job: "next actions", hint: "How often a click draws an open Next Action." },
  { key: "urgencyBias", label: "Urgency", job: "overdue first", hint: "Prefer overdue work as this rises." },
  { key: "loveYouRate", label: "Love", job: "I love you", hint: "Chance a click is affection instead of a task.", group: "apart" },
  { key: "whimRate", label: "Whims", job: "soft ask", hint: "Chance a click is a soft real-world ask." },
  { key: "rewardScale", label: "Reward", job: "friend points", hint: "How many points an on-time finish pays." },
  { key: "suggestionRate", label: "Suggest", job: "saved for later", hint: "Saved for the later clock. A click still always speaks.", group: "saved" },
]

function MixCurve({ habit, todo, next }: { habit: number; todo: number; next: number }) {
  const y = (value: number) => 4 + ((100 - Math.max(0, Math.min(100, value))) / 100) * 28
  const points = `10,${y(habit)} 50,${y(todo)} 90,${y(next)}`
  return (
    <svg className="friend-eq-curve" viewBox="0 0 100 36" aria-hidden="true">
      <polyline className="is-fill" points={`10,36 ${points} 90,36`} />
      <polyline className="is-line" points={points} />
    </svg>
  )
}

function Fader({
  label,
  job,
  hint,
  value,
  group,
  onChange,
}: {
  label: string
  job: string
  hint: string
  value: number
  group?: "apart" | "saved"
  onChange: (value: number) => void
}) {
  const setFromY = (el: HTMLElement, clientY: number) => {
    const rect = el.getBoundingClientRect()
    const ratio = 1 - (clientY - rect.top) / rect.height
    onChange(Math.round(Math.max(0, Math.min(1, ratio)) * 100))
  }

  return (
    <div className={`friend-fader${group === "apart" ? " is-apart" : ""}${group === "saved" ? " is-saved" : ""}`}>
      <span className="friend-fader-lcd" aria-hidden="true">{value}</span>
      <div
        className="friend-fader-well"
        role="slider"
        tabIndex={0}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={label}
        title={hint}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setFromY(event.currentTarget, event.clientY)
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          setFromY(event.currentTarget, event.clientY)
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 1
          if (event.key === "ArrowUp" || event.key === "ArrowRight") onChange(Math.min(100, value + step))
          if (event.key === "ArrowDown" || event.key === "ArrowLeft") onChange(Math.max(0, value - step))
        }}
      >
        <span className="friend-fader-fill" style={{ ["--fader" as string]: String(value) }} />
        <span className="friend-fader-cap" style={{ ["--fader" as string]: String(value) }} />
      </div>
      <span className="friend-fader-name">{label}</span>
      <span className="friend-fader-job">{job}</span>
    </div>
  )
}

export function FriendDetailsEqualizer({
  draft,
  titles,
  lists,
  onChange,
  onPreset,
}: {
  draft: FriendPersonality
  titles: string[]
  lists: List[]
  onChange: (partial: Partial<FriendPersonality>) => void
  onPreset: (partial: Partial<FriendPersonality>) => void
}) {
  const [loveDraft, setLoveDraft] = useState("")
  const mix = sourceMixPercents(draft)
  const pay = friendRewardPoints(draft.rewardScale)
  const matched = titleLoveMatchCount(titles, draft.titleLoves)
  const sources = FADERS.slice(0, 3)
  const rest = FADERS.slice(3)

  const addLove = (raw: string) => {
    const next = sanitizeFriendPersonality({ ...draft, titleLoves: [...draft.titleLoves, raw] })
    if (next.titleLoves.length === draft.titleLoves.length) return
    onChange({ titleLoves: next.titleLoves })
    setLoveDraft("")
  }

  const addList = (id: string) => {
    if (!id || draft.listBias[id] != null) return
    onChange({ listBias: { ...draft.listBias, [id]: 50 } })
  }

  return (
    <fieldset className="friend-eq">
      <legend className="friend-bay-title">Equalizer</legend>
      <details className="friend-presets-fold">
        <summary>Presets</summary>
        <div className="friend-presets" role="group" aria-label="Presets">
          {FRIEND_PRESETS.map((preset) => (
            <button key={preset.id} type="button" className="friend-key" onClick={() => onPreset(preset.patch)}>
              {preset.label}
            </button>
          ))}
        </div>
      </details>
      <div className="friend-eq-deck">
      <div className="friend-eq-db" aria-hidden="true">
        <span>+12</span>
        <span>0</span>
        <span>−12</span>
      </div>
      <div className="friend-eq-main">
      <div className="friend-eq-scale" aria-hidden="true">
        <span>0</span>
        <span>100</span>
      </div>
      <div className="friend-eq-row">
        <div className="friend-eq-sources">
          <MixCurve habit={draft.habitWeight} todo={draft.todoWeight} next={draft.nextActionsWeight} />
          <div className="friend-eq-source-faders">
            {sources.map((fader) => (
              <Fader
                key={fader.key}
                label={fader.label}
                job={fader.job}
                hint={fader.hint}
                value={draft[fader.key]}
                onChange={(value) => onChange({ [fader.key]: value })}
              />
            ))}
          </div>
        </div>
        {rest.map((fader) => (
          <Fader
            key={fader.key}
            label={fader.label}
            job={fader.job}
            hint={fader.hint}
            group={fader.group}
            value={draft[fader.key]}
            onChange={(value) => onChange({ [fader.key]: value })}
          />
        ))}
      </div>
      </div>
      </div>
      <p className="friend-eq-mix">
        Habits {mix.habit}% · To Do {mix.todo}% · Next {mix.next}%
        <span className="friend-eq-pay">
          Finishing on time pays {pay}
          <span className="friend-gems" aria-hidden="true">
            {Array.from({ length: Math.min(pay, 12) }, (_, index) => (
              <i key={index} className="friend-gem" />
            ))}
          </span>
        </span>
      </p>
      <form
        className="friend-tray"
        onSubmit={(event) => {
          event.preventDefault()
          addLove(loveDraft)
        }}
      >
        <span className="friend-tray-label">Title loves</span>
        <ul className="friend-beads">
          {draft.titleLoves.map((word) => (
            <li key={word}>
              <span className="friend-bead">{word}</span>
              <button type="button" className="friend-bead-x" aria-label={`Remove ${word}`} onClick={() => onChange({ titleLoves: draft.titleLoves.filter((row) => row !== word) })}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          className="friend-bead-input"
          aria-label="Add a title love"
          value={loveDraft}
          placeholder="Add a word"
          onChange={(event) => setLoveDraft(event.target.value)}
        />
        <button type="submit" className="friend-key">
          Add
        </button>
        <p className="friend-tray-note">
          Titles containing these words are more likely to be offered.
          {draft.titleLoves.length ? ` ${matched} of your tasks match.` : ""}
        </p>
      </form>
      <div className="friend-tray">
        <span className="friend-tray-label">Favorite lists</span>
        <ul className="friend-beads">
          {Object.entries(draft.listBias).map(([id, mark]) => {
            const list = lists.find((row) => row.id === id)
            const name = list?.name || id
            return (
              <li key={id} className="is-list">
                <span className="friend-bead">{name}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  aria-label={`${name} mark`}
                  value={mark}
                  onChange={(event) => onChange({ listBias: { ...draft.listBias, [id]: Number(event.target.value) } })}
                />
                <span className="friend-fader-lcd is-bead">{mark}</span>
                <button
                  type="button"
                  className="friend-bead-x"
                  aria-label={`Remove ${name}`}
                  onClick={() => {
                    const next = { ...draft.listBias }
                    delete next[id]
                    onChange({ listBias: next })
                  }}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
        <select aria-label="Add a favorite list" value="" onChange={(event) => addList(event.target.value)}>
          <option value="">{lists.length ? "Add a list…" : "No lists yet"}</option>
          {lists
            .filter((list) => draft.listBias[list.id] == null)
            .map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
        </select>
        <p className="friend-tray-note">Each list has a 0–100 mark. Higher marks are offered more often.</p>
      </div>
    </fieldset>
  )
}
