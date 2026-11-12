/**
 * components/Inventory/pharmacy/pharmacy-board.tsx — Add, list, and manage bottles
 *
 * One board for the desk and the phone. The desk puts the 3D shelf above it
 * (`PharmacyScene`). A dose from the Take key is an Intake line in Tracking,
 * so it shows on the day and the bottle follows it. Linking a daily habit or
 * an NFC tag happens here, on the bottle.
 */
"use client"

import { useMemo, useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { applyIntake } from "@/lib/ingest/apply-discrete-event"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { nfcSlug } from "@/lib/ingest/nfc-tag"
import {
  PHARMACY_FORMS,
  PHARMACY_FORM_LABEL,
  PHARMACY_FORM_UNIT,
  PHARMACY_KINDS,
  PHARMACY_KIND_LABEL,
  trimNumber,
  type PharmacyForm,
  type PharmacyItem,
  type PharmacyKind,
} from "@/lib/pharmacy-math"
import { usePharmacyStore } from "@/lib/pharmacy-store"
import { drawIntakeEntry } from "@/lib/pharmacy-sync"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { filterPharmacyRows, pharmacyRows } from "./pharmacy-rows"

/** Hand dose: an Intake line first, then the bottle takes it. Same key as a name match, so once. */
export function takeDose(item: PharmacyItem, doses: number, now = new Date()): string {
  const result = applyIntake(`${doses} ${item.name}`, now, "drug")
  const entryId = result.status === "ok" ? result.itemIds?.[0] : undefined
  const entry = entryId ? useTimeTrackingStore.getState().entries.find((row) => row.id === entryId) : undefined
  if (entry) drawIntakeEntry(entry, item.id, doses)
  const left = usePharmacyStore.getState().items.find((row) => row.id === item.id)?.count ?? item.count
  return `${doses} ${doses === 1 ? "dose" : "doses"} taken. ${trimNumber(left)} ${PHARMACY_FORM_UNIT[item.form]} left.`
}

export function PharmacyBoard({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const items = usePharmacyStore((s) => s.items)
  const log = usePharmacyStore((s) => s.log)
  const [query, setQuery] = useState("")
  const rows = useMemo(() => pharmacyRows(items, log), [items, log])
  const shown = useMemo(() => filterPharmacyRows(rows, query), [rows, query])
  const selected = items.find((row) => row.id === selectedId) ?? null

  return (
    <div className="inv-rx-board">
      <PharmacyAddForm onAdded={(id) => onSelect(id)} />
      {selected ? <PharmacyItemPanel key={selected.id} item={selected} onGone={() => onSelect(null)} /> : null}
      {items.length > 4 ? (
        <label className="inv-rx-field inv-rx-filter">
          <span>Filter</span>
          <input aria-label="Filter bottles" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      ) : null}
      {items.length === 0 ? <p className="inv-rx-empty">Add a medicine or supplement to start the shelf.</p> : null}
      {items.length > 0 && shown.length === 0 ? <p className="inv-rx-empty">Nothing matches.</p> : null}
      {shown.length > 0 ? (
        <ul className="inv-rx-list">
          {shown.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="inv-rx-row"
                data-level={row.level}
                aria-current={row.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(row.id === selectedId ? null : row.id)}
              >
                <span className="inv-rx-swatch" style={{ background: row.color }} aria-hidden="true" />
                <span className="inv-rx-row-name">
                  {row.name}
                  {row.strength ? <small> {row.strength}</small> : null}
                </span>
                <span className="inv-rx-row-amt">{row.amountLabel}</span>
                <span className="inv-rx-meter" aria-hidden="true">
                  <span style={{ width: `${Math.round(row.fill * 100)}%` }} />
                </span>
                <span className="inv-rx-row-note">
                  {row.level === "empty" ? "Empty" : row.level === "low" ? "Low" : row.runway}
                  {row.level !== "ok" && row.runway ? ` · ${row.runway}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function PharmacyAddForm({ onAdded }: { onAdded: (id: string) => void }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<PharmacyKind>("supplement")
  const [form, setForm] = useState<PharmacyForm>("pill")
  const [size, setSize] = useState("60")
  const [status, setStatus] = useState<string | null>(null)
  const ready = name.trim().length > 0 && Number(size) > 0

  const submit = () => {
    if (!ready) return
    const capacity = Number(size)
    const item = usePharmacyStore.getState().addItem({ name, kind, form, capacity, count: capacity })
    if (!item) return
    setStatus(`${item.name} is on the shelf.`)
    setName("")
    onAdded(item.id)
  }

  return (
    <form
      className="inv-rx-add"
      aria-label="Add bottle"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="inv-rx-line">
        <label className="inv-rx-field inv-rx-grow">
          <span>Name</span>
          <input aria-label="Bottle name" value={name} placeholder="Adderall, chlorophyll…" onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="inv-rx-field">
          <span>Kind</span>
          <select aria-label="Kind" value={kind} onChange={(event) => setKind(event.target.value as PharmacyKind)}>
            {PHARMACY_KINDS.map((id) => (
              <option key={id} value={id}>
                {PHARMACY_KIND_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="inv-rx-field">
          <span>Form</span>
          <select aria-label="Form" value={form} onChange={(event) => setForm(event.target.value as PharmacyForm)}>
            {PHARMACY_FORMS.map((id) => (
              <option key={id} value={id}>
                {PHARMACY_FORM_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="inv-rx-field inv-rx-narrow">
          <span>Full bottle</span>
          <input aria-label="Full bottle" inputMode="decimal" value={size} onChange={(event) => setSize(event.target.value)} />
        </label>
        <button type="submit" className="inv-rx-go" disabled={!ready}>
          Add
        </button>
      </div>
      {status ? (
        <p className="inv-rx-status" role="status" data-testid="pharmacy-added">
          {status}
        </p>
      ) : null}
    </form>
  )
}

function PharmacyItemPanel({ item, onGone }: { item: PharmacyItem; onGone: () => void }) {
  const store = usePharmacyStore.getState
  const habits = useHabitsStore((s) => s.tasks)
  const tags = useIngestStore((s) => s.nfcTags)
  const log = usePharmacyStore((s) => s.log)
  const [status, setStatus] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const dailyHabits = useMemo(() => habits.filter((row) => !row.frequency || row.frequency === "daily"), [habits])
  const mine = tags.filter((tag) => tag.pharmacyId === item.id)
  const spare = tags.filter((tag) => tag.kind === "instant" && !tag.pharmacyId)
  const recent = useMemo(() => log.filter((row) => row.itemId === item.id).slice(-4).reverse(), [log, item.id])
  const unit = PHARMACY_FORM_UNIT[item.form]
  const habit = dailyHabits.find((row) => row.id === item.habitId)

  const patch = (next: Partial<PharmacyItem>) => store().updateItem(item.id, next)
  const num = (value: string, fallback: number) => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }

  const makeTag = () => {
    const taken = new Set(tags.map((tag) => tag.id))
    let id = nfcSlug(item.name) || "bottle"
    if (taken.has(id)) id = `${id}-rx`
    useIngestStore.getState().upsertNfcTag({
      id,
      name: item.name,
      title: item.name,
      kind: "instant",
      intakeClass: "drug",
      quantity: 1,
      habitCredit: "done",
      pharmacyId: item.id,
    })
    setStatus(`Tag nfc:${id} made. Download its shortcut in Settings → NFC tags.`)
  }

  return (
    <section className="inv-rx-panel" aria-label={`${item.name} details`} data-testid="pharmacy-panel">
      <div className="inv-rx-panel-head">
        <h3>
          {item.name}
          {item.strength ? <small> {item.strength}</small> : null}
        </h3>
        <p className="inv-rx-count" data-testid="pharmacy-count">
          {trimNumber(item.count)} <span>of {item.capacity} {unit}</span>
        </p>
      </div>
      <div className="inv-rx-actions">
        <button type="button" className="inv-rx-go" onClick={() => setStatus(takeDose(item, 1))}>
          Take 1
        </button>
        {item.perDose !== 1 ? (
          <button type="button" className="inv-rx-key" onClick={() => setStatus(takeDose(item, item.perDose))}>
            Take {trimNumber(item.perDose)}
          </button>
        ) : null}
        <button
          type="button"
          className="inv-rx-key"
          onClick={() => {
            store().refill(item.id)
            setStatus("Full bottle.")
          }}
        >
          Refilled
        </button>
      </div>
      {status ? (
        <p className="inv-rx-status" role="status" data-testid="pharmacy-status">
          {status}
        </p>
      ) : null}

      <div className="inv-rx-grid">
        <label className="inv-rx-field">
          <span>I have</span>
          <input
            aria-label="Units on hand"
            inputMode="decimal"
            defaultValue={trimNumber(item.count)}
            key={`count-${item.count}`}
            onBlur={(event) => {
              const next = num(event.target.value, item.count)
              if (next !== item.count) store().setCount(item.id, next)
            }}
          />
        </label>
        <label className="inv-rx-field">
          <span>Full bottle</span>
          <input
            aria-label="Full bottle size"
            inputMode="decimal"
            defaultValue={trimNumber(item.capacity)}
            onBlur={(event) => patch({ capacity: num(event.target.value, item.capacity) || item.capacity })}
          />
        </label>
        <label className="inv-rx-field">
          <span>Units per dose</span>
          <input
            aria-label="Units per dose"
            inputMode="decimal"
            defaultValue={trimNumber(item.perDose)}
            onBlur={(event) => patch({ perDose: num(event.target.value, item.perDose) || item.perDose })}
          />
        </label>
        <label className="inv-rx-field">
          <span>Warn at</span>
          <input
            aria-label="Warn at"
            inputMode="decimal"
            defaultValue={item.lowAt != null ? trimNumber(item.lowAt) : ""}
            placeholder="20%"
            onBlur={(event) => {
              const text = event.target.value.trim()
              patch({ lowAt: text === "" ? undefined : num(text, item.lowAt ?? 0) })
            }}
          />
        </label>
        <label className="inv-rx-field">
          <span>Strength</span>
          <input aria-label="Strength" defaultValue={item.strength ?? ""} placeholder="10 mg" onBlur={(event) => patch({ strength: event.target.value })} />
        </label>
        <label className="inv-rx-field">
          <span>Also called</span>
          <input
            aria-label="Also called"
            defaultValue={item.aliases.join(", ")}
            placeholder="addy, amphetamine"
            onBlur={(event) =>
              patch({ aliases: event.target.value.split(",").map((part) => part.trim()).filter(Boolean) })
            }
          />
        </label>
      </div>

      <div className="inv-rx-link">
        <h4>Daily habit</h4>
        <p className="inv-rx-hint">
          Marking it done takes from this bottle. A count habit takes that many each. Giving a day back gives the units back.
        </p>
        <div className="inv-rx-line">
          <label className="inv-rx-field inv-rx-grow">
            <span>Habit</span>
            <select
              aria-label="Linked habit"
              value={item.habitId ?? ""}
              onChange={(event) => patch({ habitId: event.target.value || undefined })}
            >
              <option value="">None</option>
              {dailyHabits.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {item.habitId ? (
            <label className="inv-rx-field inv-rx-narrow">
              <span>{habit && habit.type !== "BOOLEAN" ? "Per counted unit" : "Per done"}</span>
              <input
                aria-label="Units per habit completion"
                inputMode="decimal"
                defaultValue={trimNumber(item.habitPer)}
                onBlur={(event) => patch({ habitPer: num(event.target.value, item.habitPer) || item.habitPer })}
              />
            </label>
          ) : null}
        </div>
        {item.habitId && item.habitSince ? <p className="inv-rx-hint">Counting from {item.habitSince}.</p> : null}
      </div>

      <div className="inv-rx-link">
        <h4>NFC tap</h4>
        {mine.length ? (
          <ul className="inv-rx-tags">
            {mine.map((tag) => (
              <li key={tag.id}>
                <code>nfc:{tag.id}</code>
                <button
                  type="button"
                  className="inv-rx-key"
                  onClick={() => useIngestStore.getState().upsertNfcTag({ ...tag, pharmacyId: undefined })}
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inv-rx-hint">A tap logs the dose in Tracking and takes it from this bottle.</p>
        )}
        <div className="inv-rx-line">
          <button type="button" className="inv-rx-key" onClick={makeTag}>
            Make an NFC tag
          </button>
          {spare.length ? (
            <label className="inv-rx-field">
              <span>Or use</span>
              <select
                aria-label="Link an existing tag"
                value=""
                onChange={(event) => {
                  const tag = spare.find((row) => row.id === event.target.value)
                  if (tag) useIngestStore.getState().upsertNfcTag({ ...tag, pharmacyId: item.id })
                }}
              >
                <option value="">A saved tag…</option>
                {spare.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {recent.length ? (
        <ul className="inv-rx-log" aria-label="Recent changes">
          {recent.map((row) => (
            <li key={row.id}>
              <span>{new Date(row.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              <span>{row.delta > 0 ? `+${trimNumber(row.delta)}` : trimNumber(row.delta)}</span>
              <span>{row.source}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="inv-rx-actions">
        {confirm ? (
          <>
            <button
              type="button"
              className="inv-rx-key inv-rx-danger"
              onClick={() => {
                store().removeItem(item.id)
                for (const tag of mine) useIngestStore.getState().upsertNfcTag({ ...tag, pharmacyId: undefined })
                onGone()
              }}
            >
              Remove for good
            </button>
            <button type="button" className="inv-rx-key" onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className="inv-rx-key" onClick={() => setConfirm(true)}>
            Remove bottle
          </button>
        )}
      </div>
    </section>
  )
}

