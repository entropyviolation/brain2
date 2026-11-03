/**
 * components/Home/Tracking/settings/bim-commands-guide.tsx — BIM COMMANDS (TELEGRAM BOT)
 *
 * The Tracking settings bay for texting BIM, the Brain2 Telegram bot. Three
 * pages behind one key row:
 *
 * - **Guide** — the built-in tracking lines as doc cards: what to type, an
 *   example, and what it writes. Fixed; they ship with the bot.
 * - **Your commands** — everything a person added that the bot now answers to,
 *   with its controls: Log keywords (`brain2-log-keywords`), Event triggers
 *   (`discreteEventTriggers` on the ingest store), Habit keywords
 *   (`textTriggers` on each habit, edited in place through `updateTask`), and
 *   Shortcuts (first-word aliases on the ingest store).
 * - **Full reference** — every tracking-family row of `BIM_COMMAND_CATALOG`
 *   (the same list `all commands` replies with), searchable, retired rows out.
 */
"use client"

import { useMemo, useState, type ReactNode } from "react"
import { BIM_COMMAND_CATALOG, CATALOG_CATEGORY_LABELS, type CatalogCategory } from "@/lib/ingest/command-catalog"
import { sanitizeShortcutAlias } from "@/lib/ingest/expand"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { DEFAULT_DISCRETE_EVENT_TRIGGERS } from "@/lib/ingest/text-triggers"
import { useHabitsStore } from "@/lib/habits-store"
import { useLogKeywordsStore } from "@/lib/log-keywords-store"
import type { HabitTextTrigger } from "@/lib/types"
import { LogKeywordsSettings } from "@/components/Home/Tracking/settings/log-keywords-settings"

export const BIM_BOT_URL = "https://t.me/brain2_phone_bot"

type GuideCard = {
  id: string
  title: string
  /** One sentence: what this line is for. */
  lead: string
  /** What to type. `[ ]` is optional. */
  forms: string[]
  example: { say: string; does: string }[]
  rules: ReactNode[]
}

/** `a` → <code>a</code> inside running text. */
function Ticks({ text }: { text: string }) {
  const parts = text.split("`")
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>))}
    </>
  )
}

const GUIDE: GuideCard[] = [
  {
    id: "log",
    title: "Log an event",
    lead: "A moment that happened. Writes an Event on Activity with the Text log pen.",
    forms: ["log: [what] [time]", "log [what] [time]"],
    example: [
      { say: "log: went outside", does: "Event “went outside” at the minute you sent it" },
      { say: "log: dishes at 3:30", does: "Event at 3:30 on the day you sent it" },
      { say: "log: walk 2:00pm-2:40pm", does: "A block from 2:00 to 2:40" },
      { say: "log: walk 10m", does: "A 10 minute block that just finished" },
      { say: "log: coffee run loc: ralphs", does: "Event plus a Location instant at Ralphs (pen made if new)" },
    ],
    rules: [
      <>The colon after <code>log</code> is optional. A bare phrase with no <code>log</code> is not a log.</>,
      <>No time is the send time. <code>START</code> stays open until an <code>END</code> of the same name.</>,
      <>A second line under the event becomes its note; the clock stays on the first line.</>,
      <>Saved Log keywords (Your commands) match the longest phrase and keep it as the title.</>,
    ],
  },
  {
    id: "switch",
    title: "Switch",
    lead: "You stopped one thing and started another. Activity unless you name a view.",
    forms: ["switch: [view] [from: A] to: B", "switch: [view] B", "st: B", "so: B", "transit: B"],
    example: [
      { say: "switch: to cleaning", does: "Activity → started cleaning on the Switch pen" },
      { say: "switch: location from: home to: ralphs", does: "Paints Location: left home, now at Ralphs" },
      { say: "switch: company Elijah", does: "Paints the Company view with Elijah" },
      { say: "so: write the report", does: "Objective pen: objective write the report" },
    ],
    rules: [
      <>The colon sits right after <code>switch</code>. The next word is the view when it names one you have.</>,
      <><code>st:</code> and <code>switch task:</code> are Switch on Activity. <code>so:</code>, <code>switch objective:</code>, <code>switch goal:</code> write the Objective pen. <code>transit:</code> is the Transit pen.</>,
      <>On another view the tick color is the destination pen. <code>log categories</code> lists the view ids.</>,
    ],
  },
  {
    id: "intake",
    title: "Intake",
    lead: "Something you ate, drank, or took. A point in time on the Intake pen.",
    forms: ["intake: what [time]", "intake food: what", "intake drink: what", "intake drug: what"],
    example: [
      { say: "intake drink: black coffee", does: "Drink intake now" },
      { say: "intake drug: adderall x2 ~9:15", does: "Drug intake at about 9:15 (estimated)" },
    ],
    rules: [
      <>Food, drink, and drug set the class; the pen stays Intake. No duration.</>,
      <>A line under it is the note.</>,
    ],
  },
  {
    id: "note",
    title: "Note",
    lead: "A quick line for the Note row of the day.",
    forms: ["note: text", "n text", "jot: text", "memo: text", "day: text"],
    example: [{ say: "note: landlord called back", does: "Text log instant on the Note row, now" }],
    rules: [<><code>day:</code> is the day jot and does not read a clock.</>],
  },
  {
    id: "thought",
    title: "Thought process",
    lead: "Why you are doing this, what comes next, and how it lands.",
    forms: ["tp: first line", "thought process: first line", "log: tp: first line"],
    example: [
      {
        say: "tp: Opening the editor to fix the clock, then the dishes, relieved it is a small fix",
        does: "Text log instant with eventKind thought-process",
      },
    ],
    rules: [
      <>Not a general note, a one-word mood, or a short activity like brushed teeth.</>,
      <>The colon is required. The first line is the title; lines under it are the note.</>,
    ],
  },
  {
    id: "ask",
    title: "Ask BIM",
    lead: "Replies only. Nothing is written.",
    forms: ["log keywords", "log categories", "log info", "all commands"],
    example: [
      { say: "log keywords", does: "Numbered list of your saved Log keywords" },
      { say: "log categories", does: "Each view: name, the id after switch:, and depth" },
    ],
    rules: [<>The colon form works too: <code>log: keywords</code>.</>],
  },
]

const CLOCK_ROWS: { say: string; reads: string }[] = [
  { say: "1pm · 1:00 PM · 1:00 p.m.", reads: "13:00" },
  { say: "12:04", reads: "12:04 noon (bare clocks are military)" },
  { say: "18:37", reads: "6:37 pm" },
  { say: "1:00", reads: "1:00 am" },
  { say: "7/4/26 · 7/4/2026", reads: "July 4, 2026 (a date alone does not invent a clock)" },
  { say: "est · estimated · ~", reads: "Estimated time" },
  { say: "unknown", reads: "Time unknown (the minute is only for placement)" },
]

/** Catalog families that write or read Tracking. */
const TRACKING_CATEGORIES: CatalogCategory[] = ["log", "monitor", "track", "note", "sleep", "gps", "screen", "habits"]

type Page = "guide" | "mine" | "reference"

export function BimCommandsGuide() {
  const [page, setPage] = useState<Page>("guide")
  const logKeywordCount = useLogKeywordsStore((state) => state.keywords.length)
  const triggerCount = useIngestStore((state) => state.discreteEventTriggers.length)
  const shortcutCount = useIngestStore((state) => Object.keys(state.shortcuts).length)
  const habitTriggerCount = useHabitsStore((state) =>
    state.tasks.reduce((sum, task) => sum + (task.textTriggers?.length ?? 0), 0),
  )
  const mineCount = logKeywordCount + triggerCount + shortcutCount + habitTriggerCount

  return (
    <div className="trk-bim" data-testid="bim-commands">
      <div className="trk-bim-hero">
        <span className="trk-bim-lamp" aria-hidden />
        <div className="trk-bim-hero-copy">
          <p className="trk-bim-kicker">BIM commands (Telegram bot)</p>
          <p className="trk-bim-lead">
            Text these lines to BIM at{" "}
            <a href={BIM_BOT_URL} target="_blank" rel="noreferrer">
              t.me/brain2_phone_bot
            </a>
            . Each one lands on this Tracking desk. The guide is built in; <strong>Your commands</strong> are the
            phrases you taught it, and you can change them here.
          </p>
        </div>
      </div>

      <div className="trk-bim-pages" role="tablist" aria-label="BIM commands">
        {(
          [
            ["guide", "Guide"],
            ["mine", `Your commands · ${mineCount}`],
            ["reference", "Full reference"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-no95=""
            aria-selected={page === id}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {page === "guide" ? <GuidePage /> : page === "mine" ? <MinePage /> : <ReferencePage />}
    </div>
  )
}

function GuidePage() {
  return (
    <div className="trk-bim-guide" role="tabpanel" aria-label="Guide">
      {GUIDE.map((card) => (
        <article key={card.id} className="trk-bim-card" aria-labelledby={`bim-${card.id}`}>
          <header>
            <h4 id={`bim-${card.id}`}>{card.title}</h4>
            <p>{card.lead}</p>
          </header>
          <div className="trk-bim-forms" aria-label="Type">
            {card.forms.map((form) => (
              <code key={form}>{form}</code>
            ))}
          </div>
          <table className="trk-bim-examples">
            <thead>
              <tr>
                <th scope="col">You text</th>
                <th scope="col">BIM writes</th>
              </tr>
            </thead>
            <tbody>
              {card.example.map((row) => (
                <tr key={row.say}>
                  <td>
                    <code>{row.say}</code>
                  </td>
                  <td>{row.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="trk-bim-rules">
            {card.rules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </article>
      ))}
      <article className="trk-bim-card trk-bim-card-wide" aria-labelledby="bim-clocks">
        <header>
          <h4 id="bim-clocks">Times and dates</h4>
          <p>
            Log, switch, intake, note, and thought lines read clocks this way. Ordinary inbox text does not. A clock
            with no estimate word is exact.
          </p>
        </header>
        <table className="trk-bim-examples">
          <thead>
            <tr>
              <th scope="col">You text</th>
              <th scope="col">BIM reads</th>
            </tr>
          </thead>
          <tbody>
            {CLOCK_ROWS.map((row) => (
              <tr key={row.say}>
                <td>
                  <code>{row.say}</code>
                </td>
                <td>{row.reads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  )
}

function MinePage() {
  return (
    <div className="trk-bim-mine" role="tabpanel" aria-label="Your commands">
      <MineBlock
        title="Log keywords"
        how={<>Text <code>log: phrase</code> or <code>log phrase 12:04</code>. The phrase stays the title; the rest is the time.</>}
      >
        <LogKeywordsSettings />
      </MineBlock>
      <MineBlock
        title="Event triggers"
        how={<>The whole message is the trigger. <code>{"{slot}"}</code> fills from what you type: <code>ate {"{item}"}</code> takes <code>ate toast</code>.</>}
      >
        <EventTriggers />
      </MineBlock>
      <MineBlock
        title="Habit keywords"
        how={<>From your habits. The whole message checks the habit off, or adds an amount or a score.</>}
      >
        <HabitKeywords />
      </MineBlock>
      <MineBlock
        title="Shortcuts"
        how={<>A first word that BIM expands before reading the line: <code>shop</code> → <code>groc</code>.</>}
      >
        <Shortcuts />
      </MineBlock>
    </div>
  )
}

function MineBlock({ title, how, children }: { title: string; how: ReactNode; children: ReactNode }) {
  return (
    <section className="trk-bim-block" aria-label={title}>
      <header>
        <h4>{title}</h4>
        <p>{how}</p>
      </header>
      {children}
    </section>
  )
}

function EventTriggers() {
  const triggers = useIngestStore((state) => state.discreteEventTriggers)
  const upsert = useIngestStore((state) => state.upsertDiscreteEventTrigger)
  const remove = useIngestStore((state) => state.removeDiscreteEventTrigger)
  const [draft, setDraft] = useState("")
  const builtIn = new Set(DEFAULT_DISCRETE_EVENT_TRIGGERS.map((row) => row.id))

  const add = () => {
    const pattern = draft.trim()
    if (!pattern) return
    upsert({ id: `de-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, pattern })
    setDraft("")
  }

  return (
    <div className="trk-bim-rows">
      {triggers.length === 0 ? <p className="trk-bim-empty">No event triggers.</p> : null}
      {triggers.map((trigger) => (
        <EditableRow
          key={trigger.id}
          label={`Edit trigger ${trigger.pattern}`}
          value={trigger.pattern}
          badge={builtIn.has(trigger.id) ? "starter" : undefined}
          onCommit={(pattern) => upsert({ ...trigger, pattern })}
          onRemove={() => remove(trigger.id)}
        />
      ))}
      <AddRow placeholder="ate {item}" label="New event trigger" value={draft} onChange={setDraft} onAdd={add} />
    </div>
  )
}

function triggerExample(trigger: HabitTextTrigger): string {
  if (trigger.mode === "quantity") return `${trigger.keyword} 20${trigger.unitWords?.[0] ? ` ${trigger.unitWords[0]}` : ""}`
  if (trigger.mode === "score") return `${trigger.keyword} ${trigger.connector?.trim() || "score"} 7`
  return trigger.keyword
}

const TRIGGER_MODE_LABEL: Record<HabitTextTrigger["mode"], string> = {
  done: "checks off",
  quantity: "adds an amount",
  score: "records a score",
}

function HabitKeywords() {
  const tasks = useHabitsStore((state) => state.tasks)
  const updateTask = useHabitsStore((state) => state.updateTask)
  const rows = tasks.filter((task) => (task.textTriggers?.length ?? 0) > 0)

  if (rows.length === 0) {
    return (
      <p className="trk-bim-empty">
        No habit keywords yet. Edit a habit and add a BIM Keywords source.
      </p>
    )
  }

  return (
    <div className="trk-bim-rows">
      {rows.map((task) =>
        (task.textTriggers ?? []).map((trigger) => (
          <EditableRow
            key={`${task.id}-${trigger.id}`}
            label={`Edit habit keyword ${trigger.keyword}`}
            value={trigger.keyword}
            badge={task.name}
            hint={
              <>
                {TRIGGER_MODE_LABEL[trigger.mode]} · <code>{triggerExample(trigger)}</code>
              </>
            }
            onCommit={(keyword) =>
              updateTask({
                ...task,
                textTriggers: (task.textTriggers ?? []).map((row) => (row.id === trigger.id ? { ...row, keyword } : row)),
              })
            }
            onRemove={() =>
              updateTask({ ...task, textTriggers: (task.textTriggers ?? []).filter((row) => row.id !== trigger.id) })
            }
          />
        )),
      )}
    </div>
  )
}

function Shortcuts() {
  const shortcuts = useIngestStore((state) => state.shortcuts)
  const setShortcut = useIngestStore((state) => state.setShortcut)
  const removeShortcut = useIngestStore((state) => state.removeShortcut)
  const [alias, setAlias] = useState("")
  const [expansion, setExpansion] = useState("")
  const entries = Object.entries(shortcuts).sort(([a], [b]) => a.localeCompare(b))

  const add = () => {
    const key = sanitizeShortcutAlias(alias)
    if (!key || !expansion.trim()) return
    setShortcut(key, expansion.trim())
    setAlias("")
    setExpansion("")
  }

  return (
    <div className="trk-bim-rows">
      {entries.length === 0 ? <p className="trk-bim-empty">No shortcuts.</p> : null}
      {entries.map(([key, value]) => (
        <EditableRow
          key={key}
          label={`Edit shortcut ${key}`}
          prefix={
            <>
              <code>{key}</code> →
            </>
          }
          value={value}
          onCommit={(next) => setShortcut(key, next)}
          onRemove={() => removeShortcut(key)}
        />
      ))}
      <div className="trk-bim-row trk-bim-add">
        <input aria-label="Shortcut word" placeholder="shop" value={alias} onChange={(e) => setAlias(e.target.value)} />
        <span aria-hidden>→</span>
        <input
          aria-label="Shortcut expands to"
          placeholder="groc"
          value={expansion}
          onChange={(e) => setExpansion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" data-no95="" onClick={add} disabled={!sanitizeShortcutAlias(alias) || !expansion.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}

function EditableRow({
  label,
  value,
  prefix,
  badge,
  hint,
  onCommit,
  onRemove,
}: {
  label: string
  value: string
  prefix?: ReactNode
  badge?: string
  hint?: ReactNode
  onCommit: (next: string) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(value)
      return
    }
    if (next !== value) onCommit(next)
  }
  return (
    <div className="trk-bim-row">
      {prefix ? <span className="trk-bim-prefix">{prefix}</span> : null}
      <input
        aria-label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
          if (event.key === "Escape") setDraft(value)
        }}
      />
      {hint ? <span className="trk-bim-hint">{hint}</span> : null}
      {badge ? <span className="trk-bim-badge">{badge}</span> : null}
      <button type="button" data-no95="" className="trk-bim-remove" aria-label={`Remove ${value}`} onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}

function AddRow({
  placeholder,
  label,
  value,
  onChange,
  onAdd,
}: {
  placeholder: string
  label: string
  value: string
  onChange: (value: string) => void
  onAdd: () => void
}) {
  return (
    <div className="trk-bim-row trk-bim-add">
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onAdd()
          }
        }}
      />
      <button type="button" data-no95="" onClick={onAdd} disabled={!value.trim()}>
        Add
      </button>
    </div>
  )
}

function ReferencePage() {
  const [query, setQuery] = useState("")
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return TRACKING_CATEGORIES.map((category) => ({
      category,
      rows: BIM_COMMAND_CATALOG.filter((entry) => {
        if (entry.category !== category || entry.status !== "active") return false
        if (!needle) return true
        return [entry.primary, entry.format, entry.explanation, ...entry.forms].join(" ").toLowerCase().includes(needle)
      }),
    })).filter((group) => group.rows.length > 0)
  }, [query])

  return (
    <div className="trk-bim-reference" role="tabpanel" aria-label="Full reference">
      <input
        className="trk-bim-search"
        type="search"
        aria-label="Search BIM commands"
        placeholder="Search commands — switch, sleep, intake…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {groups.length === 0 ? <p className="trk-bim-empty">Nothing matches “{query}”.</p> : null}
      {groups.map((group) => (
        <section key={group.category} className="trk-bim-ref-group" aria-label={CATALOG_CATEGORY_LABELS[group.category]}>
          <h4>{CATALOG_CATEGORY_LABELS[group.category]}</h4>
          <dl>
            {group.rows.map((entry) => (
              <div key={entry.id} className="trk-bim-ref-row">
                <dt>
                  <Ticks text={entry.format} />
                </dt>
                <dd>
                  <Ticks text={entry.explanation} />
                  {entry.forms.length > 1 ? (
                    <span className="trk-bim-ref-forms">
                      Also: {entry.forms.filter((form) => form !== entry.primary).slice(0, 6).join(" · ")}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
