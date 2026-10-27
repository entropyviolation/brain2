/**
 * components/People/person-detail.tsx — Biography on a person
 *
 * Reads top to bottom (3.1, `docs/PERSON_DETAIL_REDESIGN.md` §2):
 * 1. Identity bay: the person's orb on a velvet well (click → orb picker,
 *    writes `icon` on the draft) beside the birthday plaque, then one phosphor
 *    readout strip: Known for · Last seen · Last called · Last texted · the Close lamp key.
 *    View text analytics ↗ joins the strip when the texts report has a card
 *    for one of their numbers (`lib/texts-report.ts`).
 * 2. Biography grid: Full name, Nicknames (chips, `person-nicknames.tsx`),
 *    Phone numbers (the Phone Number attribute, every number they have had),
 *    Emails,
 *    Relation, Date met + Est., Instagram, Address.
 * 3. Time together. 4. The host's `pipelines` slot (Company pens).
 * 5. Interactions (`person-log.tsx`; feeds Last seen).
 * 6. The Gift ideas key → a small popup with the list and quick notes
 *    (`person-gift-ideas.tsx`).
 *
 * Standing and dated notes live in the Notes tab (`person-notes.tsx`). Close,
 * when on, makes a Gift ideas list in the Gift ideas folder. The cake is drawn
 * here (milled silver, phosphor candle) so the plaque matches the house.
 * Text fields are isolated: each key goes to `onLive` (the host's
 * `touchDraft`, no render) and blur / Enter commits through `onChange`. Every
 * write merges from `readDraft()` so a second field keeps the first one's
 * unrendered keys.
 */
"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { openInstagramFor } from "@/lib/instagram-report"
import { openTextsFor, readTextsIndex, subscribeTextsIndex, textsCardFor } from "@/lib/texts-report"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { AddressSuggestInput } from "@/components/ui/address-suggest-input"
import { iconFor } from "@/components/Icons/Icon"
import { OrbPickerDialog } from "@/components/Icons/OrbPicker"
import { GiftIdeasKey } from "@/components/People/person-gift-ideas"
import { Log } from "@/components/People/person-log"
import { NicknameField } from "@/components/People/person-nicknames"
import { splitHandles, unlinkedPhoneHandles } from "@/lib/phone-sync/person-links"
import { phonePeople } from "@/lib/phone-sync/write"
import { syncPhonePersonLinks, takeHandlesFromOthers } from "@/lib/phone-person-links"
import { ensureGiftIdeasForPerson } from "@/lib/gift-ideas"
import { RELATION_WORD_KEYS } from "@/lib/person-relations"
import { PERSON_ATTR } from "@/lib/person-types"
import { COMPANY_SCOPE_ID, personPhoneNumbers, personTimePenIds } from "@/lib/people-i-know"
import { formatHandle } from "@/lib/phone-sync/handles"
import { personMinuteMasks } from "@/lib/person-time"
import { contactSentence, personContact } from "@/lib/person-contact"
import { PersonTimeTogether } from "@/components/People/person-time-together"
import {
  addressPlaceholder,
  addressPrecisionLabel,
  addressTextForPick,
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
  type PersonInteraction,
  type PersonProfile,
} from "@/lib/person-profile"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { AttributeValue, Task } from "@/lib/types"
import "./person-detail.css"
import { NativeSelect } from "@/components/ui/native-select"

const PRECISIONS: AddressPrecision[] = ["mailing", "neighborhood", "state", "country"]

export interface PersonDetailPatch {
  personProfile?: PersonProfile
  attributes?: Record<string, AttributeValue>
  /** Orb image; `undefined` with the key present resets to the default orb. */
  icon?: string
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
  onLive,
  readDraft,
  pipelines,
  onNavigateToList,
  today = new Date(),
}: {
  person: Task
  onChange: (patch: PersonDetailPatch) => void
  /** Per-key draft write with no render (host `touchDraft`). */
  onLive?: (patch: PersonDetailPatch) => void
  /** Latest draft, including keys that have not rendered (host `getDraft`). */
  readDraft?: () => Task | null
  /** The host's Company pens editor, shown after Time together. */
  pipelines?: ReactNode
  /** The host's guarded list navigation, for the gift popup's Open list key. */
  onNavigateToList?: (listId: string) => void
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
  const scopes = useTimeTrackingStore((s) => s.scopes)
  // Extra pens, ticked details, and Social · "Who with?" ticks count too (`lib/person-time.ts`).
  const trackedLast = useMemo(() => {
    const masks = personMinuteMasks(entries, scopes, personTimePenIds(person))
    return [...masks.keys()].sort().at(-1) ?? null
  }, [entries, scopes, person])
  const storedLast = lastTogetherDate(profile, person.personPipelines, companyEntries)
  const lastSaw = [storedLast, trackedLast].filter(Boolean).sort().at(-1) as typeof storedLast
  const contact = useMemo(() => personContact(entries, scopes, person), [entries, scopes, person])
  const [precision, setPrecision] = useState<AddressPrecision>(profile?.address?.precision ?? "mailing")
  const shownPrecision = profile?.address?.precision ?? precision
  const [orbOpen, setOrbOpen] = useState(false)
  const [orbHost, setOrbHost] = useState<HTMLElement | null>(null)
  const close = profile?.close === true
  const address = profile?.address
  const pin =
    address && Number.isFinite(address.lat) && Number.isFinite(address.lng)
      ? { lat: address.lat as number, lng: address.lng as number }
      : null

  // The draft ref, not the prop: the prop misses keys typed since the last render.
  const latest = (): Task => {
    const draft = readDraft?.()
    return draft && draft.id === person.id ? draft : person
  }
  const current = (): PersonProfile | undefined => latest().personProfile

  const writeProfile = (next: PersonProfile) => {
    onChange({ personProfile: presentPersonProfile(next) })
  }

  const liveProfile = (next: PersonProfile) => {
    onLive?.({ personProfile: presentPersonProfile(next) })
  }

  const attributesWith = (id: string, value: string) => {
    const attributes = { ...(latest().attributes ?? {}) }
    if (value) attributes[id] = value
    else delete attributes[id]
    return attributes
  }

  const writeAttribute = (id: string, value: string) => {
    onChange({ attributes: attributesWith(id, value) })
  }

  // A number or email belongs to one person: take it off anyone else, then rename the phone pens.
  const linkDraft = (next: PersonProfile, phones: string[]) => {
    takeHandlesFromOthers(person.id, [...phones, ...(next.emails ?? [])])
    const draft = latest()
    syncPhonePersonLinks({
      id: person.id,
      name: draft.title || draft.description || person.id,
      nicknames: next.nicknames,
      phones,
      emails: next.emails,
    })
  }

  // "View text analytics" shows once the texts report has a card for one of their numbers.
  const handles = useMemo(() => [...personPhoneNumbers(person), ...(profile?.emails ?? [])], [person, profile?.emails])
  const [textsIndex, setTextsIndex] = useState(readTextsIndex)
  useEffect(() => subscribeTextsIndex(() => setTextsIndex(readTextsIndex())), [])
  const textsCard = useMemo(() => textsCardFor(handles, textsIndex), [handles, textsIndex])

  // Numbers texts and calls came from that no one has yet, offered as you type.
  const unlinkedNumbers = useMemo(() => unlinkedPhoneHandles(scopes, phonePeople()), [scopes])

  const interactions = profile?.interactions ?? []
  const gifts = profile?.giftIdeas ?? []

  return (
    <section className="person-detail" data-testid="person-detail" aria-label="Person">
      <div className="person-identity">
        <button
          type="button"
          className="person-orb"
          data-orb
          data-no95
          aria-label="Change orb"
          title="Change orb"
          onClick={(event) => {
            // Inside item detail, portal the picker into that dialog so it stacks on top.
            const host = event.currentTarget.closest('[role="dialog"]')
            setOrbHost(host instanceof HTMLElement ? host : null)
            setOrbOpen(true)
          }}
        >
          <img src={iconFor(person.id, person.icon)} alt="" draggable={false} />
        </button>
        <div className="person-birthday">
          <PersonCake />
          <div className="person-birthday-copy">
            <p className="person-birthday-count">{birthdaySentence(days)}</p>
            <label className="person-field">
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
      </div>

      <div className="person-readout-strip" role="group" aria-label="Readouts">
        <span className="person-readout">
          Known for {knownForSentence(profile?.dateMet, profile?.dateMetEstimated, todayIso)}
        </span>
        <span
          className="person-readout"
          title="Interactions marked Saw them, plus tracked time with a pen joined to this person. Calls and texts are not counted."
        >
          Last seen {lastSawSentence(lastSaw, todayIso)}
        </span>
        <span
          className="person-readout"
          data-testid="person-last-called"
          title="Synced iPhone calls. Calls are contact, not time together."
        >
          Last called {contactSentence(contact.call, todayIso)}
          {contact.callBack ? <strong className="person-readout-owe"> Call them back.</strong> : null}
        </span>
        <span
          className="person-readout"
          data-testid="person-last-texted"
          title="Synced iPhone texts. Texts are contact, not time together."
        >
          Last texted {contactSentence(contact.text, todayIso)}
          {contact.textBack ? <strong className="person-readout-owe"> Text them back.</strong> : null}
        </span>
        {profile?.instagram ? (
          <button
            type="button"
            className="person-readout person-readout-link"
            data-testid="person-view-instagram"
            title={`Open @${profile.instagram} in Data → Sources → Instagram`}
            onClick={() => openInstagramFor(profile.instagram!)}
          >
            View Instagram analytics ↗
          </button>
        ) : null}
        {textsCard ? (
          <button
            type="button"
            className="person-readout person-readout-link"
            data-testid="person-view-texts"
            title={`Open ${textsCard.name} in Data → Texts`}
            onClick={() => openTextsFor(handles)}
          >
            View text analytics ↗
          </button>
        ) : null}
        <button
          type="button"
          role="switch"
          className="person-lamp"
          aria-label="Close"
          aria-checked={close}
          data-on={close ? "true" : "false"}
          title="Close makes a Gift ideas list. Turning it off leaves the list."
          onClick={() => {
            const next = !close
            writeProfile({ ...current(), close: next ? true : undefined })
            if (next) ensureGiftIdeasForPerson(person)
          }}
        >
          <span className="person-lamp-bulb" aria-hidden />
          Close
        </button>
      </div>

      <div className="person-grid">
        <label className="person-field">
          Full name
          <IsolatedInput
            type="text"
            aria-label="Full name"
            value={profile?.fullName ?? ""}
            onLiveChange={(value) => liveProfile({ ...current(), fullName: value })}
            onCommit={(value) => writeProfile({ ...current(), fullName: value.trim() })}
          />
        </label>
        <NicknameField
          nicknames={profile?.nicknames ?? []}
          onChange={(nicknames) => writeProfile({ ...current(), nicknames })}
        />
        <NicknameField
          label="Phone numbers"
          itemLabel="phone number"
          nicknames={personPhoneNumbers(person)}
          format={formatHandle}
          suggestions={unlinkedNumbers}
          onChange={(typed) => {
            // Every number they have had. Texts and calls from any of them show this person.
            const phones = splitHandles(typed).phones
            const attributes = { ...(latest().attributes ?? {}) }
            if (phones.length) attributes[PERSON_ATTR.phone] = phones
            else delete attributes[PERSON_ATTR.phone]
            const next = { ...current(), phones }
            onChange({ personProfile: presentPersonProfile(next), attributes })
            linkDraft(next, phones)
          }}
        />
        <NicknameField
          label="Emails"
          itemLabel="email"
          nicknames={profile?.emails ?? []}
          onChange={(typed) => {
            const emails = splitHandles(typed).emails
            const next = { ...current(), emails }
            writeProfile(next)
            linkDraft(next, personPhoneNumbers(latest()))
          }}
        />
        <label className="person-field">
          Relation
          <IsolatedInput
            type="text"
            aria-label="Relation"
            list={`person-relation-${person.id}`}
            placeholder="friend, sister, boyfriend…"
            value={profile?.relation ?? ""}
            onLiveChange={(value) => liveProfile({ ...current(), relation: value })}
            onCommit={(value) => writeProfile({ ...current(), relation: value.trim() })}
          />
          <datalist id={`person-relation-${person.id}`}>
            {RELATION_WORD_KEYS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
        <div className="person-date-met">
          <label className="person-field">
            Date met
            <input
              type="date"
              aria-label="Date met"
              value={profile?.dateMet ?? ""}
              onChange={(event) =>
                writeProfile({
                  ...current(),
                  dateMet: event.target.value || undefined,
                  dateMetEstimated: event.target.value ? current()?.dateMetEstimated : undefined,
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
              onChange={(event) => writeProfile({ ...current(), dateMetEstimated: event.target.checked || undefined })}
            />
            Est.
          </label>
        </div>
        <label className="person-field">
          Instagram
          <span className="person-adorned">
            <span className="person-adorn" aria-hidden>
              @
            </span>
            <IsolatedInput
              type="text"
              aria-label="Instagram"
              placeholder="handle"
              value={profile?.instagram ?? ""}
              onLiveChange={(value) => liveProfile({ ...current(), instagram: value })}
              onCommit={(value) => writeProfile({ ...current(), instagram: normalizeInstagram(value) })}
            />
            {profile?.instagram ? (
              <a
                className="person-adorn-link"
                href={`https://instagram.com/${encodeURIComponent(profile.instagram)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open @${profile.instagram} on Instagram`}
                title="Open profile"
              >
                ↗
              </a>
            ) : null}
          </span>
        </label>
        <div className="person-field person-address">
          <span>Address</span>
          <div className="person-address-row">
            <NativeSelect
              aria-label="Address precision"
              value={shownPrecision}
              onChange={(event) => {
                const next = event.target.value as AddressPrecision
                setPrecision(next)
                const address = current()?.address
                if (address?.text) writeProfile({ ...current(), address: { ...address, precision: next } })
              }}
            >
              {PRECISIONS.map((item) => (
                <option key={item} value={item}>
                  {addressPrecisionLabel(item)}
                </option>
              ))}
            </NativeSelect>
            <AddressSuggestInput
              type="text"
              aria-label="Address"
              placeholder={addressPlaceholder(shownPrecision)}
              value={profile?.address?.text ?? ""}
              onLive={(value) => liveProfile({ ...current(), address: { precision: shownPrecision, text: value } })}
              onCommit={(value) =>
                writeProfile({ ...current(), address: { precision: shownPrecision, text: value } })
              }
              onPick={(full) => {
                const text = addressTextForPick(full, shownPrecision)
                writeProfile({
                  ...current(),
                  address: {
                    precision: shownPrecision,
                    text,
                    lat: full.lat,
                    lng: full.lng,
                    parts: full.parts,
                    source: full.source,
                  },
                })
                return text
              }}
            />
            {pin ? (
              <a
                className="person-address-pin"
                href={`https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}#map=15/${pin.lat}/${pin.lng}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open on the map"
                title="Open on the map"
                data-testid="person-address-pin"
              >
                <svg viewBox="0 0 12 16" width="12" height="16" aria-hidden>
                  <path d="M6 15s5-5.6 5-9A5 5 0 0 0 1 6c0 3.4 5 9 5 9Z" fill="#050807" />
                  <circle cx="6" cy="6" r="2" fill="#7dffc4" />
                </svg>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <PersonTimeTogether person={person} todayIso={todayIso} />

      {pipelines}

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
            ...current(),
            interactions: [
              saw ? { id: newRowId("pi"), date, text, saw: true } : { id: newRowId("pi"), date, text },
              ...interactions,
            ],
          })
        }
        onRemove={(id) =>
          writeProfile({ ...current(), interactions: interactions.filter((row) => row.id !== id) })
        }
        onFlag={(id, saw) =>
          writeProfile({
            ...current(),
            interactions: interactions.map((row) =>
              row.id === id ? (saw ? { ...row, saw: true } : { id: row.id, date: row.date, text: row.text }) : row,
            ) as PersonInteraction[],
          })
        }
        today={todayIso}
      />

      <GiftIdeasKey
        person={person}
        gifts={gifts}
        onGiftsChange={(giftIdeas) => writeProfile({ ...current(), giftIdeas })}
        onOpenList={onNavigateToList}
      />

      <OrbPickerDialog
        open={orbOpen}
        current={person.icon}
        container={orbHost}
        onClose={() => setOrbOpen(false)}
        onSelect={(icon) => {
          onChange({ icon })
          setOrbOpen(false)
        }}
      />
    </section>
  )
}
