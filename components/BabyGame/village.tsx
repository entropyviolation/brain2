/**
 * components/BabyGame/village.tsx — Village life on screen: homes with bookshelves, minds, days, and overheard talks
 *
 * - `HomePanel`: inside a friend's home. A bookshelf you shelve PDFs on (click the empty slot or drop a file
 *   anywhere on the room), each book's bookmark and every sitting they read, and tabs for their mind, their day,
 *   their talks, and their memory.
 * - `VillagePanel` (V): everyone at once. What each friend is doing and where, every talk between friends, and the
 *   mind editor for any of them.
 * - `TalkBubbles`: speech bubbles over two friends talking on the map, placed each frame from the sim.
 * Presentational; the rules are `lib/baby-game/mind.ts`, `shelf.ts` and `chatter.ts`, the wiring is `BabyGame.tsx`.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { RESIDENTS, inValley, resident } from "@/lib/baby-game/cast"
import { mindFromCharacter, blockAt, BOND_MAX, BOND_MIN, inBlock, placeLabel, placeOptions, tidyMind, wakingHours, type Block, type Mind, type Place } from "@/lib/baby-game/mind"
import { finished, pageAt, SHELF_MAX, type Book } from "@/lib/baby-game/shelf"
import { whereOf, type Talk, type TalkLine } from "@/lib/baby-game/chatter"
import { act as actOf, isAsleep, type GameState } from "@/lib/baby-game/engine"
import { HOME_NOUN, homeDoor, HOMES } from "@/lib/baby-game/homes"
import { cameraOf, VIEW_H, VIEW_W } from "./render"
import { center, type Sim } from "@/lib/baby-game/sim"
import { TILE } from "@/lib/baby-game/world"
import { BOOK_ACCEPT } from "./shelf-io"
import { Plate } from "./panels"
import { PixelSprite } from "./pixel"

export const LINE_SECS = 2.6

const nameOf = (id: string) => resident(id)?.name ?? id

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.floor(minutes % 60)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
}
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`

const btn = (label: ReactNode, onClick: () => void, opts: { primary?: boolean; disabled?: boolean; title?: string; on?: boolean } = {}) => (
  <button type="button" className={`friend-key bg-key${opts.primary ? " is-primary" : ""}${opts.on ? " is-on" : ""}`} data-no95="" onClick={onClick} disabled={opts.disabled} title={opts.title}>
    {label}
  </button>
)

/** What kind of place, for color. */
const placeKind = (p: Place): "spot" | "home" | "fire" | "zone" | "friend" =>
  p === "spot" ? "spot" : p === "home" || p === "read" ? "home" : p === "fire" ? "fire" : p.startsWith("zone:") ? "zone" : "friend"

export type Status = { state: "asleep" | "reading" | "talking" | "home" | "out" | "away"; doing: string; where: string }

/** Where a friend is and what they are up to, from the sim. */
export function statusOf(g: GameState, sim: Sim | null, id: string): Status {
  const r = resident(id)
  const npc = sim?.npcs[id]
  if (!r) return { state: "away", doing: "", where: "" }
  if (!inValley(r, actOf(g))) return { state: "away", doing: "beyond a gate you have not opened", where: "" }
  if (isAsleep(r, g.minutes)) return { state: "asleep", doing: "asleep", where: HOMES[id]?.name ?? "home" }
  if (!npc) return { state: "out", doing: "", where: "" }
  const where = whereOf(npc.x, npc.y)
  if (npc.reading) return { state: "reading", doing: "reading at the bookshelf", where: HOMES[id]?.name ?? where }
  if (npc.talkUntil > (sim?.clock ?? 0)) return { state: "talking", doing: `talking with ${nameOf(npc.with)}`, where }
  const h = HOMES[id]
  if (h) {
    const [dx, dy] = homeDoor(h)
    if (Math.hypot(npc.x - center(dx), npc.y - center(dy)) < TILE * 1.6) return { state: "home", doing: npc.doing, where: h.name }
  }
  return { state: "out", doing: npc.doing, where }
}

/** Re-read the sim on a timer while a panel is open; reading and talks finish in the background. */
function useTick(ms = 700) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => set((n) => n + 1), ms)
    return () => window.clearInterval(t)
  }, [ms])
}

// ——— speech bubbles over the map ———

export type LiveTalk = { key: string; a: string; b: string; lines: TalkLine[] | null; started: number }

export function TalkBubbles({ live, getSim, canvas }: { live: LiveTalk[]; getSim: () => Sim | null; canvas: HTMLCanvasElement | null }) {
  const box = useRef<HTMLDivElement | null>(null)
  const [, setFrame] = useState(0)
  useEffect(() => {
    let raf = 0
    let lastLine = -1
    const loop = () => {
      const sim = getSim()
      const host = box.current
      if (sim && host && canvas) {
        const stage = host.getBoundingClientRect()
        const c = canvas.getBoundingClientRect()
        const scale = Math.min(c.width / VIEW_W, c.height / VIEW_H)
        const ox = c.left - stage.left + (c.width - VIEW_W * scale) / 2
        const oy = c.top - stage.top + (c.height - VIEW_H * scale) / 2
        const { camX, camY } = cameraOf(sim)
        host.querySelectorAll<HTMLElement>("[data-who]").forEach((el) => {
          const npc = sim.npcs[el.dataset.who!]
          if (!npc) return
          const x = (npc.x - camX) * scale + ox
          const y = (npc.y - 30 - camY) * scale + oy
          const shown = npc.x - camX > -20 && npc.x - camX < VIEW_W + 20 && npc.y - camY > 0 && npc.y - camY < VIEW_H + 30
          el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`
          el.style.visibility = shown ? "visible" : "hidden"
        })
      }
      // re-render when a line changes
      const now = performance.now() / 1000
      const line = live.reduce((n, t) => n + (t.lines ? Math.floor((now - t.started) / LINE_SECS) : 0), 0)
      if (line !== lastLine) {
        lastLine = line
        setFrame((f) => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [canvas, getSim, live])
  const now = performance.now() / 1000
  return (
    <div ref={box} className="bv-bubbles" aria-live="polite">
      {live.map((t) => {
        if (!t.lines) {
          return (
            <div key={t.key} data-who={t.a} className="bv-bubble is-thinking">
              <span className="bv-dots" aria-label={`${nameOf(t.a)} and ${nameOf(t.b)} are talking`}><i /><i /><i /></span>
            </div>
          )
        }
        const i = Math.floor((now - t.started) / LINE_SECS)
        const line = t.lines[Math.min(i, t.lines.length - 1)]
        if (!line || i >= t.lines.length) return null
        return (
          <div key={`${t.key}-${i}`} data-who={line.who} className={`bv-bubble${line.who === t.b ? " is-reply" : ""}`}>
            <b>{nameOf(line.who)}</b>
            {line.say}
          </div>
        )
      })}
    </div>
  )
}

// ——— the day: a 24-hour strip ———

function DayStrip({ id, mind, day, minutes, big }: { id: string; mind: Mind; day: number; minutes: number; big?: boolean }) {
  const r = resident(id)
  const awake = new Set(wakingHours(r?.sleeps ?? [22, 6]))
  const hour = Math.floor(minutes / 60) % 24
  return (
    <div className={`bv-strip${big ? " is-big" : ""}`} role="img" aria-label={`${nameOf(id)}'s day`}>
      {Array.from({ length: 24 }, (_, h) => {
        const b = blockAt(mind, day, h)
        const plan = !!b?.plan
        const kind = !awake.has(h) ? "sleep" : b ? placeKind(b.place) : "free"
        return (
          <span key={h} className={`bv-hour is-${kind}${plan ? " is-plan" : ""}${h === hour ? " is-now" : ""}`} title={`${hourLabel(h)}: ${!awake.has(h) ? "asleep" : b ? `${b.doing} · ${placeLabel(b.place)}${plan ? " (today only)" : ""}` : "free"}`}>
            {big && (h % 3 === 0) ? <em>{hourLabel(h)}</em> : null}
          </span>
        )
      })}
      <i className="bv-now" style={{ left: `${((minutes % (24 * 60)) / (24 * 60)) * 100}%` }} />
    </div>
  )
}

const LEGEND: Array<[string, string]> = [["spot", "their spot"], ["home", "home / reading"], ["zone", "out in a zone"], ["friend", "visiting"], ["fire", "the fire"], ["sleep", "asleep"]]

function Legend() {
  return (
    <div className="bv-legend">
      {LEGEND.map(([k, label]) => (
        <span key={k}><i className={`bv-hour is-${k}`} />{label}</span>
      ))}
      <span><i className="bv-hour is-spot is-plan" />today only</span>
    </div>
  )
}

// ——— the mind editor ———

function ListEdit({ label, hint, items, onChange, max = 10 }: { label: string; hint: string; items: string[]; onChange: (xs: string[]) => void; max?: number }) {
  const [draft, setDraft] = useState("")
  return (
    <div className="bv-field">
      <h4>{label} <small className="bg-faint">{hint}</small></h4>
      <ul className="bv-list">
        {items.map((x, i) => (
          <li key={i}>
            <input value={x} onChange={(e) => onChange(items.map((y, j) => (j === i ? e.target.value : y)))} aria-label={`${label} ${i + 1}`} />
            <button type="button" className="bv-x" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
          </li>
        ))}
      </ul>
      {items.length < max ? (
        <form
          className="bv-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            onChange([...items, draft.trim()])
            setDraft("")
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add to ${label.toLowerCase()}…`} />
          <button type="submit" className="friend-key bg-key" data-no95="" disabled={!draft.trim()}>Add</button>
        </form>
      ) : null}
    </div>
  )
}

/** A local copy to edit. When the saved mind changes underneath (a talk, a book), an untouched copy follows it. */
function useDraft(mind: Mind) {
  const [draft, setDraft] = useState<Mind>(mind)
  const base = useRef(mind)
  useEffect(() => {
    if (base.current === mind) return
    const prev = JSON.stringify(base.current)
    base.current = mind
    setDraft((d) => (JSON.stringify(d) === prev ? mind : d))
  }, [mind])
  const dirty = JSON.stringify(draft) !== JSON.stringify(mind)
  return { draft, setDraft, dirty, revert: () => setDraft(mind) }
}

function SaveBar({ dirty, onSave, onRevert, extra }: { dirty: boolean; onSave: () => void; onRevert: () => void; extra?: ReactNode }) {
  return (
    <div className={`bv-savebar${dirty ? " is-dirty" : ""}`}>
      <span>{dirty ? "Unsaved changes" : "Saved"}</span>
      {extra}
      {btn("Revert", onRevert, { disabled: !dirty })}
      {btn("Save", onSave, { primary: true, disabled: !dirty })}
    </div>
  )
}

export function MindEditor({ g, id, hasModel, onSave, onRebuild }: { g: GameState; id: string; hasModel: boolean; onSave: (m: Mind) => void; onRebuild: (description: string) => Promise<void> }) {
  const mind = g.minds[id]!
  const { draft, setDraft, dirty, revert } = useDraft(mind)
  const [busy, setBusy] = useState(false)
  const [showBonds, setShowBonds] = useState(false)
  const set = (patch: Partial<Mind>) => setDraft((d) => ({ ...d, ...patch }))
  const bonds = Object.entries(draft.bonds).filter(([k]) => resident(k)).sort((a, b) => b[1] - a[1])
  return (
    <div className="bv-mind">
      <div className="bv-field">
        <h4>Description <small className="bg-faint">a few plain sentences; everything below can be rewritten from it</small></h4>
        <textarea rows={4} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
        <div className="bg-keys">
          {btn(busy ? "Rewriting…" : "Rewrite the mind from this", async () => {
            setBusy(true)
            try {
              await onRebuild(draft.description)
            } finally {
              setBusy(false)
            }
          }, { disabled: busy || !draft.description.trim(), title: "Replaces beliefs, motivations, likes, dislikes and goals; keeps bonds" })}
          <span className="bg-chip">{hasModel ? "uses the local model" : "no model: reads keywords"}</span>
          <span className="bg-chip">last written by {mind.by === "you" ? "you" : mind.by === "model" ? "the model" : "the game"}</span>
        </div>
      </div>
      <div className="bv-cols">
        <ListEdit label="Beliefs" hint="what they hold true" items={draft.beliefs} onChange={(beliefs) => set({ beliefs })} max={8} />
        <ListEdit label="Motivations" hint="what drives them" items={draft.motivations} onChange={(motivations) => set({ motivations })} />
        <ListEdit label="Likes" hint="talk topics, who they warm to" items={draft.likes} onChange={(likes) => set({ likes })} />
        <ListEdit label="Dislikes" hint="" items={draft.dislikes} onChange={(dislikes) => set({ dislikes })} />
      </div>
      <div className="bv-field">
        <h4>Goals <small className="bg-faint">talks and books move them forward</small></h4>
        <ul className="bv-list bv-goals">
          {draft.goals.map((goal, i) => (
            <li key={goal.id + i}>
              <input value={goal.text} onChange={(e) => set({ goals: draft.goals.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} aria-label={`Goal ${i + 1}`} />
              <label className="bv-progress" title={`${goal.progress}%`}>
                <input type="range" min={0} max={100} step={5} value={goal.progress} onChange={(e) => set({ goals: draft.goals.map((x, j) => (j === i ? { ...x, progress: Number(e.target.value) } : x)) })} aria-label={`Progress on goal ${i + 1}`} />
                <em>{goal.progress >= 100 ? "done" : `${goal.progress}%`}</em>
              </label>
              <button type="button" className="bv-x" aria-label="Remove goal" onClick={() => set({ goals: draft.goals.filter((_, j) => j !== i) })}>×</button>
            </li>
          ))}
        </ul>
        {draft.goals.length < 6 ? btn("+ Goal", () => set({ goals: [...draft.goals, { id: `you${Date.now() % 1e6}`, text: "", progress: 0 }] })) : null}
      </div>
      <div className="bv-field">
        <h4>
          Bonds <small className="bg-faint">−10 to 10; shared likes and good talks raise them</small>{" "}
          {btn(showBonds ? "Hide" : `Show all ${bonds.length}`, () => setShowBonds(!showBonds))}
        </h4>
        <ul className="bv-bonds">
          {(showBonds ? bonds : [...bonds.slice(0, 3), ...bonds.slice(-2)].filter((x, i, a) => a.indexOf(x) === i)).map(([k, v]) => (
            <li key={k}>
              <PixelSprite id={k} scale={1} label={nameOf(k)} />
              <span>{nameOf(k)}</span>
              <span className="bv-bond" aria-hidden="true"><i className={v < 0 ? "is-neg" : ""} style={{ left: v < 0 ? `${50 + (v / -BOND_MIN) * 50}%` : "50%", width: `${(Math.abs(v) / BOND_MAX) * 50}%` }} /></span>
              <input type="range" min={BOND_MIN} max={BOND_MAX} value={v} onChange={(e) => set({ bonds: { ...draft.bonds, [k]: Number(e.target.value) } })} aria-label={`Bond with ${nameOf(k)}`} />
              <em>{v > 0 ? `+${v}` : v}</em>
            </li>
          ))}
        </ul>
      </div>
      <SaveBar
        dirty={dirty}
        onRevert={revert}
        onSave={() => onSave(tidyMind({ ...draft, by: "you" }))}
        extra={btn("Start over from the character", () => {
          const c = g.characters[id]
          if (c) setDraft({ ...mindFromCharacter(c), bonds: draft.bonds })
        }, { title: "The mind the game first wrote for them; bonds are kept" })}
      />
    </div>
  )
}

export function ScheduleEditor({ g, id, onSave }: { g: GameState; id: string; onSave: (m: Mind) => void }) {
  const mind = g.minds[id]!
  const { draft, setDraft, dirty, revert } = useDraft(mind)
  const places = useMemo(() => placeOptions(id), [id])
  const hour = Math.floor(g.minutes / 60) % 24
  const setBlock = (i: number, patch: Partial<Block>) => setDraft((d) => ({ ...d, schedule: d.schedule.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  const sorted = draft.schedule.map((b, i) => ({ b, i }))
  const plans = mind.plans.filter((p) => p.day === g.day)
  const r = resident(id)
  const [bed, wake] = r?.sleeps ?? [22, 6]
  return (
    <div className="bv-sched">
      <DayStrip id={id} mind={draft} day={g.day} minutes={g.minutes} big />
      <Legend />
      <p className="bg-faint">
        Awake {hourLabel(wake)} to {hourLabel(bed)}; the hour before bed they always walk home. A block named “at the bookshelf” is when they read. Later blocks lose to earlier ones where they overlap.
      </p>
      <table className="bv-table">
        <thead>
          <tr><th>From</th><th>To</th><th>Doing</th><th>Where</th><th /></tr>
        </thead>
        <tbody>
          {sorted.map(({ b, i }) => (
            <tr key={i} className={inBlock(b, hour) ? "is-now" : ""}>
              <td>
                <select value={b.from} onChange={(e) => setBlock(i, { from: Number(e.target.value) })} aria-label="From">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </td>
              <td>
                <select value={b.to} onChange={(e) => setBlock(i, { to: Number(e.target.value) })} aria-label="To">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </td>
              <td><input value={b.doing} onChange={(e) => setBlock(i, { doing: e.target.value })} aria-label="Doing" /></td>
              <td>
                <select value={b.place} onChange={(e) => setBlock(i, { place: e.target.value as Place })} aria-label="Where" className={`is-${placeKind(b.place)}`}>
                  {places.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </td>
              <td><button type="button" className="bv-x" aria-label="Remove block" onClick={() => setDraft((d) => ({ ...d, schedule: d.schedule.filter((_, j) => j !== i) }))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bg-keys">
        {btn("+ Block", () => setDraft((d) => ({ ...d, schedule: [...d.schedule, { from: (hour + 1) % 24, to: (hour + 2) % 24, doing: "something new", place: "spot" }] })))}
        {btn("+ Reading hour", () => setDraft((d) => ({ ...d, schedule: [{ from: (hour + 1) % 24, to: (hour + 2) % 24, doing: "reading from the bookshelf", place: "read" }, ...d.schedule] })), { title: "Added first, so it wins over the block it overlaps" })}
      </div>
      <h4>Today only</h4>
      {plans.length ? (
        <ul className="bv-plans">
          {plans.map((p, i) => (
            <li key={i}><b>{hourLabel(p.from)}–{hourLabel(p.to)}</b> {p.doing} · {placeLabel(p.place)} <small className="bg-faint">{p.why}</small></li>
          ))}
        </ul>
      ) : (
        <p className="bg-faint">No plans yet today. Friends make them in talks and after reading.</p>
      )}
      <SaveBar dirty={dirty} onRevert={revert} onSave={() => onSave(tidyMind({ ...draft, by: "you" }))} />
    </div>
  )
}

// ——— talks ———

const MOOD_LABEL = { warm: "warm", easy: "easy", prickly: "prickly" } as const

export function TalkCard({ t }: { t: Talk }) {
  return (
    <article className={`bv-talk is-${t.mood}`}>
      <header>
        <span className="bv-pair">
          <PixelSprite id={t.a} scale={1} label={nameOf(t.a)} />
          <PixelSprite id={t.b} scale={1} label={nameOf(t.b)} />
        </span>
        <b>{nameOf(t.a)} & {nameOf(t.b)}</b>
        <small>{t.where} · day {t.day}, {clock(t.minute)}</small>
        <span className={`bv-mood is-${t.mood}`}>{MOOD_LABEL[t.mood]}</span>
        <span className="bg-chip">{t.by === "model" ? "model" : "scripted"}</span>
      </header>
      <p className="bv-topic">About: {t.topic}</p>
      <ol className="bv-lines">
        {t.lines.map((l, i) => (
          <li key={i} className={l.who === t.b ? "is-b" : "is-a"}>
            <b>{nameOf(l.who)}</b>
            <span>{l.say}</span>
          </li>
        ))}
      </ol>
      {t.changed.length ? (
        <p className="bv-changed">{t.changed.map((c) => <span key={c} className="bg-chip">{c}</span>)}</p>
      ) : null}
    </article>
  )
}

function TalkLog({ g, who, onWho }: { g: GameState; who: string | null; onWho?: (id: string | null) => void }) {
  const [mood, setMood] = useState<Talk["mood"] | null>(null)
  const [limit, setLimit] = useState(30)
  const talks = useMemo(() => [...(g.chatter ?? [])].reverse().filter((t) => (!who || t.a === who || t.b === who) && (!mood || t.mood === mood)), [g.chatter, who, mood])
  const talkers = useMemo(() => RESIDENTS.filter((r) => (g.chatter ?? []).some((t) => t.a === r.id || t.b === r.id)), [g.chatter])
  return (
    <div className="bv-log">
      <div className="bv-filters">
        {onWho ? (
          <>
            <button type="button" className={`bv-who${!who ? " is-on" : ""}`} onClick={() => onWho(null)}>Everyone</button>
            {talkers.map((r) => (
              <button key={r.id} type="button" className={`bv-who${who === r.id ? " is-on" : ""}`} onClick={() => onWho(r.id)} title={r.name}>
                <PixelSprite id={r.id} scale={1} label={r.name} />
              </button>
            ))}
          </>
        ) : null}
        <span className="bv-moods">
          {(["warm", "easy", "prickly"] as const).map((m) => (
            <button key={m} type="button" className={`bv-mood is-${m}${mood === m ? " is-on" : ""}`} onClick={() => setMood(mood === m ? null : m)}>{m}</button>
          ))}
        </span>
      </div>
      {talks.length ? (
        <>
          <p className="bg-faint">{talks.length} talk{talks.length === 1 ? "" : "s"}{who ? ` with ${nameOf(who)}` : ""}, newest first.</p>
          {talks.slice(0, limit).map((t) => <TalkCard key={t.id} t={t} />)}
          {talks.length > limit ? btn(`Show ${Math.min(30, talks.length - limit)} more`, () => setLimit(limit + 30)) : null}
        </>
      ) : (
        <p className="bv-empty">No talks yet. When two friends walk close, they stop and talk; every word lands here.</p>
      )}
    </div>
  )
}

// ——— memory ———

const MEMORY_ICON: Record<string, string> = { met: "✦", gift: "❀", wish: "☁", keepsake: "◆", quest: "✓", chat: "✎", visit: "⌂", neighbor: "☺", read: "▤" }

function MemoryList({ g, id }: { g: GameState; id: string }) {
  const mem = [...(g.characters[id]?.memory ?? [])].reverse()
  return mem.length ? (
    <ul className="bv-memory">
      {mem.map((m, i) => (
        <li key={i} className={`is-${m.kind}`}>
          <i aria-hidden="true">{MEMORY_ICON[m.kind] ?? "·"}</i>
          <span><small>Day {m.day} · {m.kind === "neighbor" ? "a friend" : m.kind === "read" ? "reading" : m.kind}</small>{m.text}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="bv-empty">Nothing remembered yet.</p>
  )
}

// ——— the home ———

export type HomeActions = {
  saveMind: (id: string, m: Mind) => void
  rebuildMind: (id: string, description: string) => Promise<void>
  /** Resolves to an error message, or null when shelved. */
  shelve: (id: string, file: File) => Promise<string | null>
  unshelve: (id: string, book: Book) => void
  reread: (id: string, bookId: string) => void
  readNow: (id: string, bookId: string) => void
  openFile: (book: Book) => void
}

const SLOTS = 6

function Spine({ b, on, onClick }: { b: Book; on: boolean; onClick: () => void }) {
  const pages = b.pageStarts.length
  const h = 62 + Math.min(30, Math.round(Math.log2(pages + 1) * 6))
  const w = 20 + Math.min(14, Math.round(pages / 12))
  const frac = b.chars ? Math.min(1, b.at / b.chars) : 0
  return (
    <button type="button" className={`bv-spine is-c${b.spine}${on ? " is-on" : ""}${finished(b) ? " is-done" : ""}`} style={{ height: h, width: w }} onClick={onClick} title={`${b.title} · ${pages} page${pages === 1 ? "" : "s"} · ${Math.round(frac * 100)}% read`}>
      <span>{b.title}</span>
      <i style={{ height: `${frac * 100}%` }} aria-hidden="true" />
    </button>
  )
}

function BookDetail({ id, b, status, actions, onBack }: { id: string; b: Book; status: Status; actions: HomeActions; onBack: () => void }) {
  const pages = b.pageStarts.length
  const frac = b.chars ? Math.min(1, b.at / b.chars) : 0
  const page = pageAt(b, Math.max(0, b.at - 1))
  const canRead = status.state !== "asleep" && status.state !== "away" && status.state !== "reading" && !finished(b)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="bv-book">
      <button type="button" className="bv-back" onClick={onBack}>← All books</button>
      <h3 className={`bv-book-title is-c${b.spine}`}>{b.title}</h3>
      <p className="bg-faint">{pages} page{pages === 1 ? "" : "s"} · shelved day {b.addedDay} · {b.readings.length} sitting{b.readings.length === 1 ? "" : "s"}</p>
      <div className="bv-meter" role="progressbar" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="How far they have read">
        <i style={{ width: `${frac * 100}%` }} />
        <em>{finished(b) ? "Finished" : b.at === 0 ? "Not started" : `Up to page ${page} of ${pages} · ${Math.round(frac * 100)}%`}</em>
      </div>
      <div className="bg-keys">
        {btn(status.state === "reading" ? "Reading…" : "Read a little now", () => actions.readNow(id, b.id), { primary: true, disabled: !canRead, title: canRead ? "They sit down with it for one sitting" : status.state === "asleep" ? "Asleep" : finished(b) ? "Finished; start over to read again" : "Busy" })}
        {btn("Open the file", () => actions.openFile(b))}
        {btn("Start over", () => actions.reread(id, b.id), { disabled: b.at === 0 })}
        {confirm ? (
          <>
            {btn("Yes, take it off", () => actions.unshelve(id, b), { primary: true })}
            {btn("Keep it", () => setConfirm(false))}
          </>
        ) : btn("Take off the shelf", () => setConfirm(true), { title: "Removes the book and its words; sittings stay in their memory" })}
      </div>
      <h4>What {nameOf(id)} took from it</h4>
      {b.readings.length ? (
        <ol className="bv-sittings">
          {[...b.readings].reverse().map((r, i) => (
            <li key={i}>
              <header>
                <b>p. {r.pageFrom}{r.pageTo !== r.pageFrom ? `–${r.pageTo}` : ""}</b>
                <small>day {r.day}, {clock(r.minute)}</small>
                <span className="bv-feel">{r.feeling}</span>
                <span className="bg-chip">{r.by === "model" ? "model" : "scripted"}</span>
              </header>
              <p>{r.takeaway}</p>
              {r.quote ? <blockquote>“{r.quote}”</blockquote> : null}
              {r.changed.length ? <p className="bv-changed">{r.changed.map((c) => <span key={c} className="bg-chip is-change">{c}</span>)}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="bv-empty">Not opened yet. They read in the hours their day marks “at the bookshelf”, or when you ask.</p>
      )}
      <p className="bg-faint">The file stays in this browser. With the model on, only the pages being read go to the local model.</p>
    </div>
  )
}

type HomeTab = "shelf" | "mind" | "day" | "talks" | "memory"

export function HomePanel({ g, id, getSim, hasModel, actions, onClose }: { g: GameState; id: string; getSim: () => Sim | null; hasModel: boolean; actions: HomeActions; onClose: () => void }) {
  useTick()
  const r = resident(id)!
  const home = HOMES[id]
  const [tab, setTab] = useState<HomeTab>("shelf")
  const [bookId, setBookId] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement | null>(null)
  const books = g.shelves?.[id] ?? []
  const book = books.find((b) => b.id === bookId) ?? null
  const status = statusOf(g, getSim(), id)
  const hour = Math.floor(g.minutes / 60) % 24
  const sky = hour >= 21 || hour < 5 ? "night" : hour < 8 ? "dawn" : hour >= 18 ? "dusk" : "day"
  const now = blockAt(g.minds[id], g.day, hour)
  const reading = (g.shelves?.[id] ?? []).find((b) => !finished(b))

  const take = async (files: FileList | null) => {
    const list = [...(files ?? [])]
    if (!list.length) return
    setBusy(true)
    setNote({ text: `Shelving ${list.length === 1 ? list[0]!.name : `${list.length} files`}…` })
    let last: string | null = null
    for (const f of list) {
      const err = await actions.shelve(id, f)
      if (err) {
        setNote({ text: `${f.name}: ${err}`, bad: true })
        setBusy(false)
        return
      }
      last = f.name
    }
    setBusy(false)
    setTab("shelf")
    setNote({ text: `${last} is on ${r.name}'s shelf.` })
  }

  const rows = Math.max(3, Math.ceil((books.length + 1) / SLOTS))
  return (
    <Plate title={`${home?.name ?? `${r.name}'s home`} · ${r.name}'s ${home ? HOME_NOUN[home.kind] : "home"}`} onClose={onClose} full>
      <div
        className={`bv-home${drag ? " is-drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!drag) setDrag(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDrag(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          void take(e.dataTransfer.files)
        }}
      >
        <div className={`bv-room is-${sky}`}>
          <div className="bv-window" aria-hidden="true"><i /><i /></div>
          <div className="bv-shelf" role="list" aria-label={`${r.name}'s bookshelf`}>
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="bv-board" role="presentation">
                {Array.from({ length: SLOTS }, (_, k) => {
                  const i = row * SLOTS + k
                  const b = books[i]
                  if (b) return <Spine key={b.id} b={b} on={b.id === bookId} onClick={() => { setBookId(b.id); setTab("shelf") }} />
                  if (i === books.length && books.length < SHELF_MAX) {
                    return (
                      <button key="add" type="button" className="bv-slot is-add" onClick={() => file.current?.click()} disabled={busy} title="Shelve a PDF">
                        <span>+</span>
                      </button>
                    )
                  }
                  return <span key={`e${i}`} className="bv-slot" aria-hidden="true" />
                })}
              </div>
            ))}
          </div>
          <div className={`bv-who-home is-${status.state}`}>
            <div className="bv-portrait">
              {status.state === "home" || status.state === "reading" || status.state === "asleep" ? <PixelSprite id={id} scale={3} label={r.name} /> : <span className="bv-empty-chair" aria-hidden="true" />}
              {status.state === "reading" ? <i className="bv-open-book" aria-hidden="true" /> : null}
              {status.state === "asleep" ? <i className="bv-zz" aria-hidden="true">z z</i> : null}
            </div>
            <div className="bv-status">
              <b>{status.state === "home" ? `${r.name} is home` : status.state === "reading" ? `${r.name} is reading` : status.state === "asleep" ? `${r.name} is asleep` : status.state === "talking" ? `${r.name} is out talking` : `${r.name} is out`}</b>
              <small>{status.doing}{status.where && status.state !== "home" ? ` · ${status.where}` : ""}</small>
              {now ? <small className="bg-faint">Schedule now: {now.doing} ({placeLabel(now.place)}){now.plan ? " · today only" : ""}</small> : null}
            </div>
          </div>
          <div className="bv-rug" aria-hidden="true" />
          {drag ? <div className="bv-drop"><b>Drop to shelve it</b><small>PDF, .txt or .md</small></div> : null}
        </div>

        <div className="bv-side">
          <div className="bg-tabs" role="tablist">
            {(
              [
                ["shelf", `Shelf (${books.length})`],
                ["mind", "Mind"],
                ["day", "Day"],
                ["talks", `Talks (${(g.chatter ?? []).filter((t) => t.a === id || t.b === id).length})`],
                ["memory", "Memory"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`friend-key bg-key${tab === k ? " is-on" : ""}`} data-no95="" onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
          <input ref={file} type="file" accept={BOOK_ACCEPT} multiple hidden onChange={(e) => { void take(e.target.files); e.target.value = "" }} />
          {note ? <p className={`bv-note${note.bad ? " is-bad" : ""}`}>{note.text}</p> : null}
          <div className="bv-pane">
            {tab === "shelf" ? (
              book ? (
                <BookDetail id={id} b={book} status={status} actions={{ ...actions, unshelve: (i, b) => { actions.unshelve(i, b); setBookId(null) } }} onBack={() => setBookId(null)} />
              ) : (
                <div>
                  <button type="button" className="bv-dropzone" onClick={() => file.current?.click()} disabled={busy || books.length >= SHELF_MAX}>
                    <b>{busy ? "Reading the file…" : "Shelve a PDF for " + r.name}</b>
                    <small>Click, or drop a file anywhere on the room. PDF, .txt or .md. It stays in this browser.</small>
                  </button>
                  <p className="bg-faint">
                    {r.name} reads in the hours their day marks “at the bookshelf”, a few pages a sitting, oldest book first. What they take from it goes into their memory, may change a belief or a goal, and can send them somewhere the next hour. It comes up when they talk with friends and with you.
                  </p>
                  {reading ? <p>Next up: <b>{reading.title}</b>, from page {pageAt(reading, reading.at)}.</p> : null}
                  {books.length ? (
                    <ul className="bv-books">
                      {books.map((b) => (
                        <li key={b.id}>
                          <button type="button" onClick={() => setBookId(b.id)}>
                            <i className={`bv-dot is-c${b.spine}`} aria-hidden="true" />
                            <span>{b.title}</span>
                            <small>{finished(b) ? "finished" : b.at ? `${Math.round((b.at / b.chars) * 100)}%` : "unread"} · {b.readings.length} sitting{b.readings.length === 1 ? "" : "s"}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            ) : null}
            {tab === "mind" ? <MindEditor g={g} id={id} hasModel={hasModel} onSave={(m) => actions.saveMind(id, m)} onRebuild={(d) => actions.rebuildMind(id, d)} /> : null}
            {tab === "day" ? <ScheduleEditor g={g} id={id} onSave={(m) => actions.saveMind(id, m)} /> : null}
            {tab === "talks" ? <TalkLog g={g} who={id} /> : null}
            {tab === "memory" ? <MemoryList g={g} id={id} /> : null}
          </div>
        </div>
      </div>
    </Plate>
  )
}

// ——— the whole village ———

type VillageTab = "now" | "talks" | "minds"

export function VillagePanel({ g, getSim, hasModel, actions, onClose, initial }: { g: GameState; getSim: () => Sim | null; hasModel: boolean; actions: HomeActions; onClose: () => void; initial?: { tab?: VillageTab; id?: string } }) {
  useTick()
  const [tab, setTab] = useState<VillageTab>(initial?.tab ?? "now")
  const act = actOf(g)
  const here = RESIDENTS.filter((r) => inValley(r, act))
  const [pick, setPick] = useState<string>(initial?.id ?? here[0]?.id ?? "chick")
  const [who, setWho] = useState<string | null>(null)
  const [mindTab, setMindTab] = useState<"mind" | "day" | "memory">("mind")
  const sim = getSim()
  const lastTalk = (id: string) => [...(g.chatter ?? [])].reverse().find((t) => t.a === id || t.b === id)
  return (
    <Plate title="Village life" onClose={onClose} full>
      <div className="bg-tabs" role="tablist">
        {(
          [
            ["now", "Who's doing what"],
            ["talks", `Talks (${(g.chatter ?? []).length})`],
            ["minds", "Minds & days"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`friend-key bg-key${tab === k ? " is-on" : ""}`} data-no95="" onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
        <span className="bv-clockchip">Day {g.day} · {clock(g.minutes)}</span>
      </div>
      {tab === "now" ? (
        <div className="bv-grid">
          {here.map((r) => {
            const st = statusOf(g, sim, r.id)
            const t = lastTalk(r.id)
            const books = g.shelves?.[r.id] ?? []
            const goal = g.minds[r.id]?.goals.find((x) => x.progress < 100)
            return (
              <article key={r.id} className={`bv-card is-${st.state}`}>
                <header>
                  <PixelSprite id={r.id} scale={2} label={r.name} />
                  <div>
                    <b>{r.name}</b>
                    <small className={`bv-state is-${st.state}`}>{st.state === "out" ? "out" : st.state}</small>
                  </div>
                </header>
                <p className="bv-doing">{st.doing || "—"}</p>
                <p className="bv-where">{st.where}</p>
                {g.minds[r.id] ? <DayStrip id={r.id} mind={g.minds[r.id]!} day={g.day} minutes={g.minutes} /> : null}
                {goal ? <p className="bv-goal" title="Their first open goal"><span className="bv-mini" aria-hidden="true"><i style={{ width: `${goal.progress}%` }} /></span>{goal.text}</p> : null}
                {t ? <p className="bv-last"><small>Last talk, with {nameOf(t.a === r.id ? t.b : t.a)}:</small> “{t.lines[0]?.say}”</p> : null}
                <footer>
                  <small>{books.length ? `${books.length} book${books.length === 1 ? "" : "s"} on the shelf` : "Empty shelf"}</small>
                  {btn("Mind", () => { setPick(r.id); setMindTab("mind"); setTab("minds") })}
                  {btn("Talks", () => { setWho(r.id); setTab("talks") })}
                </footer>
              </article>
            )
          })}
        </div>
      ) : null}
      {tab === "talks" ? <TalkLog g={g} who={who} onWho={setWho} /> : null}
      {tab === "minds" ? (
        <div className="bv-minds">
          <nav className="bv-roster" aria-label="Friends">
            {here.map((r) => (
              <button key={r.id} type="button" className={`bv-rostered${pick === r.id ? " is-on" : ""}`} onClick={() => setPick(r.id)}>
                <PixelSprite id={r.id} scale={1} label={r.name} />
                <span>{r.name}</span>
                {g.minds[r.id]?.by === "you" ? <i title="Edited by you">✎</i> : null}
              </button>
            ))}
          </nav>
          <div className="bv-pane">
            <div className="bv-mind-head">
              <PixelSprite id={pick} scale={2} label={nameOf(pick)} />
              <div>
                <b>{nameOf(pick)}</b>
                <small>{statusOf(g, sim, pick).doing} · {statusOf(g, sim, pick).where}</small>
              </div>
              <div className="bg-tabs">
                {(["mind", "day", "memory"] as const).map((k) => btn(k === "mind" ? "Mind" : k === "day" ? "Day" : "Memory", () => setMindTab(k), { on: mindTab === k }))}
              </div>
            </div>
            {g.minds[pick] ? (
              mindTab === "mind" ? (
                <MindEditor key={pick} g={g} id={pick} hasModel={hasModel} onSave={(m) => actions.saveMind(pick, m)} onRebuild={(d) => actions.rebuildMind(pick, d)} />
              ) : mindTab === "day" ? (
                <ScheduleEditor key={pick} g={g} id={pick} onSave={(m) => actions.saveMind(pick, m)} />
              ) : (
                <MemoryList g={g} id={pick} />
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </Plate>
  )
}
