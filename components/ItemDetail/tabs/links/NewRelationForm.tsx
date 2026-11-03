/**
 * components/ItemDetail/tabs/links/NewRelationForm.tsx — Make a new relation word
 * inline, from the composer's Create row (PD 6.2).
 *
 * Phrase, reverse phrase (first guess from `guessReversePhrase`, editable),
 * **Same both ways**, from type (default this item's type) and to type
 * (default any). Create writes `useItemTypeStore.addRelations` at once:
 * relations are vocabulary, not item data, so Save and the unsaved guard do
 * not cover them. Then `onCreated(id)` selects the new forward relation.
 */
"use client"

import { useState } from "react"
import { NativeSelect } from "@/components/ui/native-select"
import { guessReversePhrase } from "@/components/ItemDetail/tabs/links/relation-phrase"
import { createRelationPair } from "@/lib/relation-registry"
import { useItemTypeStore } from "@/lib/item-type-store"

export function NewRelationForm({
  phrase: initial,
  fromTypeId,
  onCreated,
  onCancel,
}: {
  phrase: string
  fromTypeId?: string
  onCreated: (relationId: string) => void
  onCancel: () => void
}) {
  const types = useItemTypeStore((s) => s.types)
  const addRelations = useItemTypeStore((s) => s.addRelations)
  const guess = guessReversePhrase(initial)
  const [label, setLabel] = useState(initial.trim())
  const [inverseLabel, setInverseLabel] = useState(guess.inverseLabel)
  const [symmetric, setSymmetric] = useState(guess.symmetric)
  const [fromType, setFromType] = useState(fromTypeId ?? "")
  const [toType, setToType] = useState("")
  const ready = label.trim().length > 0 && (symmetric || inverseLabel.trim().length > 0)

  return (
    <form
      className="rl-new"
      aria-label="New relation"
      onSubmit={(event) => {
        event.preventDefault()
        if (!ready) return
        const defs = createRelationPair({
          label,
          inverseLabel: symmetric ? undefined : inverseLabel,
          symmetric,
          fromTypes: fromType ? [fromType] : undefined,
          toTypes: toType ? [toType] : undefined,
        })
        addRelations(defs)
        if (defs[0]) onCreated(defs[0].id)
      }}
    >
      <label className="rl-new-field">
        Phrase
        <input
          type="text"
          className="rl-field"
          aria-label="Phrase"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value)
            const next = guessReversePhrase(event.target.value)
            setInverseLabel(next.inverseLabel)
            setSymmetric(next.symmetric)
          }}
        />
      </label>
      <label className="rl-new-field">
        Reverse phrase
        <input
          type="text"
          className="rl-field"
          aria-label="Reverse phrase"
          value={symmetric ? label : inverseLabel}
          disabled={symmetric}
          onChange={(event) => setInverseLabel(event.target.value)}
        />
      </label>
      <button
        type="button"
        role="switch"
        aria-checked={symmetric}
        className="rl-key rl-switch"
        data-on={symmetric ? "true" : "false"}
        onClick={() => setSymmetric((on) => !on)}
      >
        <span className="rl-lamp" aria-hidden />
        Same both ways
      </button>
      <label className="rl-new-field">
        From
        <NativeSelect className="rl-field" aria-label="From type" value={fromType} onChange={(e) => setFromType(e.target.value)}>
          <option value="">Any type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="rl-new-field">
        To
        <NativeSelect className="rl-field" aria-label="To type" value={toType} onChange={(e) => setToType(e.target.value)}>
          <option value="">Any type</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <div className="rl-new-foot">
        <button type="button" className="rl-key" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="rl-key" disabled={!ready}>
          Create
        </button>
      </div>
    </form>
  )
}
