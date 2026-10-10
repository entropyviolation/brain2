/**
 * components/People/person-detail.tsx — Biography on a person
 *
 * Full name, nicknames, date met (with Est.), how long known, time since last
 * seen, an optional relation, Instagram, an address at the precision that is
 * known, standing notes, a dated notes log, an interaction log, and gift
 * notes. Close, when on, has a Gift ideas list in the Gift ideas folder.
 * That list is what "gift ideas" means. The notes stay on the person and are
 * not cleared. The birthday plaque
 * reads the birthday attribute and says how many days remain. The cake is
 * drawn here (milled silver, phosphor candle) so the plaque matches the house.
 * A later folder of cute PNGs, the same idea as habit gemstones and list orbs,
 * is a later step. This plaque does not load images.
 */
"use client"

import { useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { addGiftIdeaOnList, ensureGiftIdeasForPerson, findGiftIdeasList } from "@/lib/gift-ideas"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { PERSON_ATTR } from "@/lib/person-types"
import { COMPANY_SCOPE_ID } from "@/lib/people-i-know"
import {
  addressPlaceholder,
  addressPrecisionLabel,
  birthdaySentence,
  daysUntilBirthday,
  knownForSentence,
  lastSawSentence,
  lastTogetherDate,
  localIsoDate,
  normalizeInstagram,
  presentPersonProfile,
  ymdFromDate,
  type AddressPrecision,
  type PersonGiftIdea,
  type PersonInteraction,
  type PersonProfile,
} from "@/lib/person-profile"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { AttributeValue, Task } from "@/lib/types"
import "./person-detail.css"

const PRECISIONS: AddressPrecision[] = ["mailing", "neighborhood", "state", "country"]
const RELATION_SUGGESTIONS = ["friend", "sister", "boyfriend"]

export interface PersonDetailPatch {
  personProfile?: PersonProfile
  attributes?: Record<string, AttributeValue>
}

function newRowId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

function attributeText(value: AttributeValue | undefined): string {
  return typeof value === "string" ? value : ""
}

function birthdayValue(value: AttributeValue | undefined): string {
  const text = attributeText(value)
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ""
}

function newestFirst<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

function PersonCake() {
  return (
    <svg className="person-cake" viewBox="0 0 16 16" width="36" height="36" aria-hidden="true">
      <rect x="1" y="12" width="14" height="3" fill="#111" />
      <rect x="2" y="12" width="12" height="2" fill="#f4f4f4" />
      <rect x="2" y="13" width="12" height="1" fill="#9a9a9a" />
      <rect x="3" y="6" width="10" height="6" fill="#111" />
      <rect x="4" y="7" width="8" height="4" fill="#d0d0d0" />
      <rect x="10" y="7" width="2" height="4" fill="#8d8d8d" />
      <rect x="3" y="5" width="10" height="3" fill="#111" />
      <rect x="4" y="5" width="8" height="2" fill="#ffffff" />
      <rect x="4" y="6" width="8" height="1" fill="#e4e4e4" />
      <rect x="4" y="7" width="1" height="1" fill="#ffffff" />
      <rect x="7" y="7" width="1" height="2" fill="#ffffff" />
      <rect x="7" y="2" width="2" height="3" fill="#111" />
      <rect x="7" y="3" width="2" height="2" fill="#2a2c2e" />
      <rect x="7" y="0" width="2" height="2" fill="#7dffc4" />
      <rect x="7" y="0" width="1" height="1" fill="#e9fff6" />
    </svg>
  )
}

export function PersonDetail({
  person,
  onChange,
  today = new Date(),
}: {
  person: Task
  onChange: (patch: PersonDetailPatch) => void
  today?: Date
}) {
  const todayIso = localIsoDate(today)
  const todayYmd = ymdFromDate(today)
  const entries = useTimeTrackingStore((s) => s.entries)
  const companyEntries = useMemo(
    () => entries.filter((entry) => entry.scopeId === COMPANY_SCOPE_ID),
    [entries],
  )
  const profile = person.personProfile
  const birthday = birthdayValue(person.attributes?.[PERSON_ATTR.birthday])
  const days = daysUntilBirthday(birthday || undefined, todayYmd)
  const lastSaw = lastTogetherDate(profile, person.personPipelines, companyEntries)
  const [precision, setPrecision] = useState<AddressPrecision>(profile?.address?.precision ?? "mailing")
  const shownPrecision = profile?.address?.precision ?? precision

  const writeProfile = (next: PersonProfile) => {
    onChange({ personProfile: presentPersonProfile(next) })
  }

  const writeAttribute = (id: string, value: string) => {
    const attributes = { ...(person.attributes ?? {}) }
    if (value) attributes[id] = value
    else delete attributes[id]
    onChange({ attributes })
  }

  const notes = profile?.noteLog ?? []
  const interactions = profile?.interactions ?? []
  const gifts = profile?.giftIdeas ?? []

  return (
    <section className="person-detail" data-testid="person-detail" aria-label="Person">
      <Label>Person</Label>
      <div className="person-birthday">
        <PersonCake />
        <div className="person-birthday-copy">
          <p className="person-birthday-count">{birthdaySentence(days)}</p>
          <label>
            Birthday
            <input
              type="date"
              aria-label="Birthday"
              value={birthday}
              onChange={(event) => writeAttribute(PERSON_ATTR.birthday, event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="person-grid">
        <label>
          Full name
          <input
            type="text"
            aria-label="Full name"
            value={profile?.fullName ?? ""}
            onChange={(event) => writeProfile({ ...profile, fullName: event.target.value })}
            onBlur={(event) => writeProfile({ ...profile, fullName: event.target.value.trim() })}
          />
        </label>
        <NicknameField
          nicknames={profile?.nicknames ?? []}
          onChange={(nicknames) => writeProfile({ ...profile, nicknames })}
        />
        <label>
          Relation
          <input
            type="text"
            aria-label="Relation"
            list={`person-relation-${person.id}`}
            placeholder="friend, sister, boyfriend…"
            value={profile?.relation ?? ""}
            onChange={(event) => writeProfile({ ...profile, relation: event.target.value })}
            onBlur={(event) => writeProfile({ ...profile, relation: event.target.value.trim() })}
          />
          <datalist id={`person-relation-${person.id}`}>
            {RELATION_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
        <div className="person-date-met">
          <label>
            Date met
            <input
              type="date"
              aria-label="Date met"
              value={profile?.dateMet ?? ""}
              onChange={(event) =>
                writeProfile({
                  ...profile,
                  dateMet: event.target.value || undefined,
                  dateMetEstimated: event.target.value ? profile?.dateMetEstimated : undefined,
                })
              }
            />
          </label>
          <label className="person-est">
            <input
              type="checkbox"
              aria-label="Date met is estimated"
              checked={profile?.dateMetEstimated === true}
              disabled={!profile?.dateMet}
              onChange={(event) => writeProfile({ ...profile, dateMetEstimated: event.target.checked || undefined })}
            />
            Est.
          </label>
        </div>
        <label>
          Instagram
          <input
            type="text"
            aria-label="Instagram"
            placeholder="handle"
            value={profile?.instagram ?? ""}
            onChange={(event) => writeProfile({ ...profile, instagram: event.target.value })}
            onBlur={(event) => writeProfile({ ...profile, instagram: normalizeInstagram(event.target.value) })}
          />
        </label>
        <div className="person-address">
          <span>Address</span>
          <select
            aria-label="Address precision"
            value={shownPrecision}
            onChange={(event) => {
              const next = event.target.value as AddressPrecision
              setPrecision(next)
              if (profile?.address?.text) {
                writeProfile({ ...profile, address: { precision: next, text: profile.address.text } })
              }
            }}
          >
            {PRECISIONS.map((item) => (
              <option key={item} value={item}>
                {addressPrecisionLabel(item)}
              </option>
            ))}
          </select>
          <input
            type="text"
            aria-label="Address"
            placeholder={addressPlaceholder(shownPrecision)}
            value={profile?.address?.text ?? ""}
            onChange={(event) =>
              writeProfile({
                ...profile,
                address: { precision: shownPrecision, text: event.target.value },
              })
            }
          />
        </div>
      </div>

      <label className="person-check">
        <input
          type="checkbox"
          aria-label="Close"
          checked={profile?.close === true}
          onChange={(event) => {
            const close = event.target.checked
            writeProfile({ ...profile, close: close ? true : undefined })
            if (close) ensureGiftIdeasForPerson(person)
          }}
        />
        Close
      </label>
      <p className="person-detail-help">
        Close makes a Gift ideas list for this person. Turning it off leaves that list in place.
      </p>

      <p className="person-readout">
        Known for {knownForSentence(profile?.dateMet, profile?.dateMetEstimated, todayIso)}
      </p>
      <p className="person-readout">Last saw {lastSawSentence(lastSaw, todayIso)}</p>
      <p className="person-detail-help">
        Last saw reads interactions marked Saw them, plus Company blocks painted with a pen joined to this person. A stored block join from before still counts.
      </p>

      <label>
        Notes
        <textarea
          aria-label="Notes"
          value={attributeText(person.attributes?.[PERSON_ATTR.notes])}
          onChange={(event) => writeAttribute(PERSON_ATTR.notes, event.target.value)}
        />
      </label>

      <Log
        title="Dated notes"
        rows={newestFirst(notes).map((note) => ({
          id: note.id,
          date: note.date,
          text: note.text,
        }))}
        addLabel="Add note"
        textLabel="Dated note"
        onAdd={(date, text) =>
          writeProfile({ ...profile, noteLog: [{ id: newRowId("pn"), date, text }, ...notes] })
        }
        onRemove={(id) => writeProfile({ ...profile, noteLog: notes.filter((note) => note.id !== id) })}
        today={todayIso}
      />

      <Log
        title="Interactions"
        rows={newestFirst(interactions).map((row) => ({
          id: row.id,
          date: row.date,
          text: row.text,
          flag: row.saw === true,
          flagLabel: "Saw them",
        }))}
        addLabel="Add interaction"
        textLabel="Interaction"
        flagLabel="Saw them"
        onAdd={(date, text, saw) =>
          writeProfile({
            ...profile,
            interactions: [
              saw ? { id: newRowId("pi"), date, text, saw: true } : { id: newRowId("pi"), date, text },
              ...interactions,
            ],
          })
        }
        onRemove={(id) =>
          writeProfile({ ...profile, interactions: interactions.filter((row) => row.id !== id) })
        }
        onFlag={(id, saw) =>
          writeProfile({
            ...profile,
            interactions: interactions.map((row) =>
              row.id === id ? (saw ? { ...row, saw: true } : { id: row.id, date: row.date, text: row.text }) : row,
            ) as PersonInteraction[],
          })
        }
        today={todayIso}
      />

      <GiftIdeasList personId={person.id} />

      <GiftLog
        gifts={gifts}
        onAdd={(text) => writeProfile({ ...profile, giftIdeas: [...gifts, { id: newRowId("pg"), text }] })}
        onRemove={(id) => writeProfile({ ...profile, giftIdeas: gifts.filter((gift) => gift.id !== id) })}
        onGiven={(id, given) =>
          writeProfile({
            ...profile,
            giftIdeas: gifts.map((gift) =>
              gift.id === id ? (given ? { ...gift, given: true } : { id: gift.id, text: gift.text }) : gift,
            ),
          })
        }
      />
    </section>
  )
}

function NicknameField({
  nicknames,
  onChange,
}: {
  nicknames: string[]
  onChange: (nicknames: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const name = draft.trim()
    if (!name || nicknames.some((other) => other.toLowerCase() === name.toLowerCase())) return
    onChange([...nicknames, name])
    setDraft("")
  }
  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <label>
          Nickname
          <input
            type="text"
            aria-label="Nickname"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button type="submit">Add nickname</button>
      </form>
      {nicknames.length > 0 ? (
        <ul className="person-nicknames">
          {nicknames.map((name) => (
            <li key={name} className="person-nickname">
              {name}
              <button type="button" aria-label={`Remove nickname ${name}`} onClick={() => onChange(nicknames.filter((other) => other !== name))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Log({
  title,
  rows,
  addLabel,
  textLabel,
  flagLabel,
  onAdd,
  onRemove,
  onFlag,
  today,
}: {
  title: string
  rows: { id: string; date: string; text: string; flag?: boolean; flagLabel?: string }[]
  addLabel: string
  textLabel: string
  flagLabel?: string
  onAdd: (date: string, text: string, flag?: boolean) => void
  onRemove: (id: string) => void
  onFlag?: (id: string, flag: boolean) => void
  today: string
}) {
  const [date, setDate] = useState(today)
  const [text, setText] = useState("")
  const [flag, setFlag] = useState(false)
  return (
    <section className="person-log" aria-label={title}>
      <h3>{title}</h3>
      {rows.length > 0 ? (
        <ul className="person-log-list">
          {rows.map((row) => (
            <li key={row.id} className="person-log-row">
              <span className="person-log-date">{row.date}</span>
              <span className="person-log-text">{row.text}</span>
              {row.flagLabel && onFlag ? (
                <label className="person-check">
                  <input
                    type="checkbox"
                    aria-label={`${row.flagLabel} ${row.text}`}
                    checked={row.flag === true}
                    onChange={(event) => onFlag(row.id, event.target.checked)}
                  />
                  {row.flagLabel}
                </label>
              ) : null}
              <button type="button" aria-label={`Remove ${textLabel.toLowerCase()} ${row.text}`} onClick={() => onRemove(row.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="person-log-add"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          onAdd(date || today, trimmed, flagLabel ? flag : undefined)
          setText("")
          setFlag(false)
        }}
      >
        <label>
          Date
          <input type="date" aria-label={`${title} date`} value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          {textLabel}
          <input
            type="text"
            aria-label={textLabel}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        {flagLabel ? (
          <label className="person-check">
            <input type="checkbox" aria-label={flagLabel} checked={flag} onChange={(event) => setFlag(event.target.checked)} />
            {flagLabel}
          </label>
        ) : null}
        <button type="submit">{addLabel}</button>
      </form>
    </section>
  )
}

function GiftIdeasList({ personId }: { personId: string }) {
  const lists = useTaskStore((s) => s.lists)
  const tasks = useTaskStore((s) => s.tasks)
  const list = findGiftIdeasList(lists, personId)
  const [text, setText] = useState("")
  if (!list) return null
  const items = tasks.filter((task) => task.id !== personId && (task.lists ?? []).includes(list.id))
  return (
    <section className="person-log" aria-label="Gift ideas">
      <h3>Gift ideas</h3>
      <p className="person-detail-help">
        {list.name}. This is the list in the Gift ideas folder. A rename of this person updates that name.
      </p>
      {items.length > 0 ? (
        <ul className="person-log-list">
          {items.map((item) => (
            <li key={item.id} className="person-log-row" data-testid="gift-ideas-item">
              <span className="person-log-text">{itemTitleOrUntitled(item, "Gift")}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="person-log-add"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          addGiftIdeaOnList(personId, trimmed)
          setText("")
        }}
      >
        <label>
          Gift idea
          <input type="text" aria-label="Gift idea" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <button type="submit">Add to gift ideas</button>
      </form>
    </section>
  )
}

function GiftLog({
  gifts,
  onAdd,
  onRemove,
  onGiven,
}: {
  gifts: PersonGiftIdea[]
  onAdd: (text: string) => void
  onRemove: (id: string) => void
  onGiven: (id: string, given: boolean) => void
}) {
  const [text, setText] = useState("")
  return (
    <section className="person-log" aria-label="Gift notes">
      <h3>Gift notes</h3>
      <p className="person-detail-help">
        Quick notes kept on this person. They stay here when a Gift ideas list exists, and they are not that list.
      </p>
      {gifts.length > 0 ? (
        <ul className="person-log-list">
          {gifts.map((gift) => (
            <li key={gift.id} className="person-log-row">
              <span className="person-log-text">{gift.text}</span>
              <label className="person-check">
                <input
                  type="checkbox"
                  aria-label={`Given ${gift.text}`}
                  checked={gift.given === true}
                  onChange={(event) => onGiven(gift.id, event.target.checked)}
                />
                Given
              </label>
              <button type="button" aria-label={`Remove gift note ${gift.text}`} onClick={() => onRemove(gift.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="person-log-add"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          onAdd(trimmed)
          setText("")
        }}
      >
        <label>
          Gift note
          <input type="text" aria-label="Gift note" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <button type="submit">Add gift note</button>
      </form>
    </section>
  )
}
