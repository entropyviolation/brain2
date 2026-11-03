/**
 * components/BabyGame/panels.tsx — The plates that slide over the world
 *
 * Presentational: each panel takes the `GameState` and callbacks, and holds only a little local UI state
 * (which submenu is open, the typed line). The rules live in `lib/baby-game/engine.ts`.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { approachDistance, APPROACHES, CONDITION_TEXT, RESIDENTS, resident, temper, type Resident } from "@/lib/baby-game/cast"
import {
  animal, askBlocks, canCraft, have, hearts, isAsleep, moodLabel, RESTORE, sellPrice, tasteFact, wantsMet, type GameState,
} from "@/lib/baby-game/engine"
import { item, ITEMS, LAMP_PARTS, RECIPES } from "@/lib/baby-game/items"
import { ACTS } from "@/lib/baby-game/story"
import type { FriendTone } from "@/lib/baby-animal-personality"
import { ItemIcon, PixelSprite } from "./pixel"

const key = (label: string, onClick: () => void, opts: { primary?: boolean; disabled?: boolean; title?: string; k?: string } = {}) => (
  <button key={opts.k} type="button" className={`friend-key bg-key${opts.primary ? " is-primary" : ""}`} data-no95="" onClick={onClick} disabled={opts.disabled} title={opts.title}>
    {label}
  </button>
)

export const Plate = ({ title, onClose, children, wide }: { title: string; onClose?: () => void; children: React.ReactNode; wide?: boolean }) => (
  <section className={`bg-plate${wide ? " is-wide" : ""}`} role="dialog" aria-label={title}>
    <header className="bg-plate-head">
      <h3>{title}</h3>
      {onClose ? key("Close", onClose) : null}
    </header>
    <div className="bg-plate-body">{children}</div>
  </section>
)

export function Hearts({ n, of = 10 }: { n: number; of?: number }) {
  return (
    <span className="bg-hearts" aria-label={`${n} of ${of} hearts`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? "is-on" : ""} />
      ))}
    </span>
  )
}

function Typewriter({ text, effect }: { text: string; effect: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(0)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length)
      return
    }
    const timer = window.setInterval(() => setShown((n) => (n >= text.length ? n : n + 2)), 22)
    return () => window.clearInterval(timer)
  }, [text])
  return (
    <p className={`bg-line bg-fx-${effect}`} aria-live="polite">
      {effect === "heart" ? "♥ " : ""}
      {text.slice(0, shown)}
      <span className="bg-line-rest" aria-hidden="true">{text.slice(shown)}</span>
    </p>
  )
}

export type TalkView = "menu" | "gift" | "approach" | "chat"

export function TalkPanel(p: {
  g: GameState
  id: string
  line: string
  by?: "model" | "scripted"
  view: TalkView
  setView: (v: TalkView) => void
  busy: boolean
  crowd: number
  hasModel: boolean
  onTalk: () => void
  onGift: (itemId: string) => void
  onApproach: (tone: FriendTone) => void
  onFavor: () => void
  onTurnIn: () => void
  onAsk: () => void
  onChat: (text: string) => void
  onClose: () => void
}) {
  const r = resident(p.id)!
  const a = animal(p.g, p.id)
  const t = temper(p.id)
  const h = hearts(p.g, p.id)
  const [typed, setTyped] = useState("")
  const asleep = isAsleep(r, p.g.minutes)
  const gifts = Object.keys(p.g.inv).filter((id) => ITEMS[id]?.kind === "material" || ITEMS[id]?.kind === "trinket")
  const blocks = askBlocks(p.g, p.id, { crowd: p.crowd })
  const wantsLine = r.wants.map((w) => ({ id: w, ok: have(p.g, w) > 0 }))
  const known = h >= 2

  return (
    <Plate title={`${r.name} · ${r.title}`} onClose={p.onClose} wide>
      <div className="bg-talk">
        <div className="bg-talk-who">
          <div className="bg-portrait"><PixelSprite id={p.id} scale={7} label={r.name} /></div>
          <Hearts n={h} />
          <small>{moodLabel(a.mood)} · {t.cadence} · {t.tone}</small>
          <small className="bg-faint">favor: {t.whim.toLowerCase()}</small>
        </div>
        <div className="bg-talk-main">
          <Typewriter text={p.busy ? "…" : p.line || r.hello} effect={t.effect} />
          {p.by ? <small className="bg-chip">{p.by === "model" ? "answered by the local model" : "scripted answer"}</small> : null}

          {known && a.stage === "new" ? (
            <ul className="bg-wants" aria-label="What they want">
              {wantsLine.map((w) => (
                <li key={w.id} className={w.ok ? "is-ok" : ""}>
                  <ItemIcon id={w.id} scale={2} /> {item(w.id).name}
                </li>
              ))}
            </ul>
          ) : null}
          {a.stage === "turned" ? <small className="bg-faint">Waiting on {r.gate} hearts{a.cluedAt ? `, and: ${CONDITION_TEXT[r.condition]}` : ""}.</small> : null}
          {a.stage === "gave" ? <small className="bg-faint">You hold their keepsake: {item(r.gives).name}.</small> : null}
          {a.cluedAt && a.stage !== "gave" ? <small className="bg-faint">Their secret: {CONDITION_TEXT[r.condition]}.</small> : null}

          {asleep ? (
            <p className="bg-faint">Fast asleep. Come back later.</p>
          ) : p.view === "menu" ? (
            <div className="bg-keys">
              {key("Talk", p.onTalk)}
              {key("Gift…", () => p.setView("gift"), { disabled: a.gifted || !gifts.length, title: a.gifted ? "Already gave a gift today" : undefined })}
              {key("Approach…", () => p.setView("approach"), { disabled: a.approached })}
              {key(`Favor: ${t.whim}`, p.onFavor, { disabled: a.favored || p.g.energy < 8, title: "8 energy" })}
              {key("Chat…", () => p.setView("chat"), { disabled: a.chats >= 6 })}
              {a.stage === "new" && known ? key("Give what they want", p.onTurnIn, { primary: true, disabled: !wantsMet(p.g, r) }) : null}
              {a.stage === "turned" ? key("Ask for their keepsake", p.onAsk, { primary: true, disabled: blocks.length > 0, title: blocks[0] }) : null}
            </div>
          ) : p.view === "gift" ? (
            <div className="bg-grid" role="list">
              {gifts.map((id) => (
                <button key={id} type="button" role="listitem" className="bg-cell" onClick={() => p.onGift(id)} title={item(id).blurb}>
                  <ItemIcon id={id} />
                  <span>{item(id).name}</span>
                  <b>×{have(p.g, id)}</b>
                </button>
              ))}
              {key("Back", () => p.setView("menu"))}
            </div>
          ) : p.view === "approach" ? (
            <div className="bg-keys">
              {APPROACHES.map((x) => key(`${x.label} — ${x.blurb}`, () => p.onApproach(x.tone), { k: x.tone, title: a.mood >= 0 ? undefined : "They are not at their best today" }))}
              {key("Back", () => p.setView("menu"))}
            </div>
          ) : (
            <form
              className="bg-chat"
              onSubmit={(e) => {
                e.preventDefault()
                if (typed.trim() && !p.busy) {
                  p.onChat(typed.trim())
                  setTyped("")
                }
              }}
            >
              <input
                className="bg-chat-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={p.hasModel ? `Say anything to ${r.name}…` : `Ask ${r.name} what they need, like, or when to visit…`}
                maxLength={200}
                autoFocus
                aria-label={`Say something to ${r.name}`}
              />
              {key(p.busy ? "…" : "Say", () => undefined, { disabled: p.busy || !typed.trim(), primary: true })}
              {key("Back", () => p.setView("menu"))}
              <small className="bg-faint">{p.hasModel ? "A local model gives the words. The game decides what is true." : "No local model found: short scripted answers."}</small>
            </form>
          )}
        </div>
      </div>
    </Plate>
  )
}

export function BagPanel({ g, onEat, onClose }: { g: GameState; onEat: (id: string) => void; onClose: () => void }) {
  const ids = Object.keys(g.inv).sort((a, b) => ITEMS[a]!.kind.localeCompare(ITEMS[b]!.kind) || a.localeCompare(b))
  return (
    <Plate title="Bag" onClose={onClose}>
      {ids.length ? (
        <div className="bg-grid" role="list">
          {ids.map((id) => (
            <div key={id} role="listitem" className="bg-cell is-still" title={item(id).blurb}>
              <ItemIcon id={id} />
              <span>{item(id).name}</span>
              <b>×{g.inv[id]}</b>
              <small>{item(id).tags.join(" · ") || item(id).kind}</small>
              {RESTORE[id] ? key(`Eat +${RESTORE[id]}`, () => onEat(id), { disabled: g.energy >= g.maxEnergy }) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="bg-faint">Nothing yet. Pick something up.</p>
      )}
    </Plate>
  )
}

export function BenchPanel({ g, onCraft, onClose }: { g: GameState; onCraft: (id: string) => void; onClose: () => void }) {
  return (
    <Plate title="Workbench" onClose={onClose} wide>
      <div className="bg-recipes">
        {RECIPES.map((def) => (
          <div key={def.id} className={`bg-recipe${canCraft(g, def.id) ? " is-ready" : ""}`}>
            <ItemIcon id={def.id} scale={4} />
            <div>
              <b>{def.name}</b>
              <small>{def.tags.join(" · ")}</small>
              <span className="bg-cost">
                {Object.entries(def.recipe!).map(([m, q]) => (
                  <em key={m} className={have(g, m) >= q ? "is-ok" : ""}>
                    {item(m).name} {have(g, m)}/{q}
                  </em>
                ))}
              </span>
            </div>
            {key("Make", () => onCraft(def.id), { primary: true, disabled: !canCraft(g, def.id) })}
          </div>
        ))}
      </div>
    </Plate>
  )
}

export function StumpPanel({ g, onBuy, onSell, onClose }: { g: GameState; onBuy: (id: string) => void; onSell: (id: string) => void; onClose: () => void }) {
  const wares = Object.values(ITEMS).filter((d) => d.kind === "material")
  const loose = Object.keys(g.inv).filter((id) => ITEMS[id] && ITEMS[id]!.kind !== "keepsake" && ITEMS[id]!.kind !== "part")
  return (
    <Plate title={`Trade Stump · ${g.buttons} buttons`} onClose={onClose} wide>
      <div className="bg-two">
        <div>
          <h4>Buy</h4>
          <div className="bg-grid" role="list">
            {wares.map((d) => (
              <button key={d.id} type="button" role="listitem" className="bg-cell" disabled={g.buttons < d.value * 2} onClick={() => onBuy(d.id)} title={d.blurb}>
                <ItemIcon id={d.id} />
                <span>{d.name}</span>
                <b>{d.value * 2}</b>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h4>Sell</h4>
          <div className="bg-grid" role="list">
            {loose.length ? (
              loose.map((id) => (
                <button key={id} type="button" role="listitem" className="bg-cell" onClick={() => onSell(id)}>
                  <ItemIcon id={id} />
                  <span>{item(id).name}</span>
                  <b>+{sellPrice(id)}</b>
                </button>
              ))
            ) : (
              <p className="bg-faint">Nothing to sell.</p>
            )}
          </div>
        </div>
      </div>
    </Plate>
  )
}

export function BoardPanel({ g, realMission, name, onDeliver, onClose }: { g: GameState; realMission?: string | null; name: string; onDeliver: (id: string) => void; onClose: () => void }) {
  return (
    <Plate title="Notice Board" onClose={onClose} wide>
      <h4>Today&apos;s errands</h4>
      {g.errands.map((e) => {
        const r = resident(e.who)!
        const ok = have(g, e.item) >= e.qty
        return (
          <div key={e.id} className={`bg-errand${e.done ? " is-done" : ""}`}>
            <PixelSprite id={e.who} scale={3} />
            <p>
              <b>{r.name}</b> would like {e.qty} × <ItemIcon id={e.item} scale={2} /> {item(e.item).name}.
              <small> {e.reward} buttons and a little trust.</small>
            </p>
            {e.done ? <small>Delivered</small> : key("Deliver", () => onDeliver(e.id), { primary: true, disabled: !ok })}
          </div>
        )
      })}
      <h4>Back home</h4>
      <p className="bg-faint">
        {realMission ? `${name} asked you for real: “${realMission}”. Nothing here finishes it. It's just on their mind.` : `${name} has not asked you for anything today.`}
      </p>
    </Plate>
  )
}

export function LampPanel({ g, onPlace, onClose }: { g: GameState; onPlace: (id: string) => void; onClose: () => void }) {
  const carrying = LAMP_PARTS.filter((id) => have(g, id) > 0)
  return (
    <Plate title="The Hollow Lamp" onClose={onClose}>
      <div className="bg-lamp">
        {LAMP_PARTS.map((id, i) => (
          <div key={id} className={`bg-lamp-slot${g.parts.includes(id) ? " is-set" : ""}`}>
            <ItemIcon id={id} scale={4} />
            <small>{ACTS[i]!.part}</small>
          </div>
        ))}
      </div>
      <p className="bg-faint">{g.ended ? "The lamp is whole and burning." : `${g.parts.length} of 5 parts are in. The friend who keeps each part will give it to someone they trust.`}</p>
      {carrying.map((id) => key(`Place ${item(id).name}`, () => onPlace(id), { primary: true, k: id }))}
    </Plate>
  )
}

export function JournalPanel({ g, companion, perk, level, onClose }: { g: GameState; companion: string; perk: string; level: number; onClose: () => void }) {
  const [tab, setTab] = useState<"story" | "friends" | "diary">("story")
  const act = Math.min(5, g.parts.length + 1)
  return (
    <Plate title="Journal" onClose={onClose} wide>
      <div className="bg-tabs" role="tablist">
        {(["story", "friends", "diary"] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={`friend-key bg-key${tab === x ? " is-on" : ""}`} data-no95="" onClick={() => setTab(x)}>
            {x === "story" ? "Story" : x === "friends" ? "Friends" : "Diary"}
          </button>
        ))}
      </div>
      {tab === "story" ? (
        <div>
          {ACTS.map((a, i) => (
            <p key={a.title} className={i + 1 > act ? "bg-faint" : i + 1 < act || g.ended ? "bg-done" : ""}>
              <b>{a.title}</b> · {i + 1 > act ? "Locked" : g.parts.length > i ? `${a.part} placed` : "Now"}
              <br />
              <small>{i + 1 > act ? "A gate holds this one." : a.blurb}</small>
            </p>
          ))}
          <p className="bg-faint">
            {companion} · bond level {level} · {perk}
          </p>
        </div>
      ) : null}
      {tab === "friends" ? (
        <div className="bg-friends">
          {RESIDENTS.filter((r) => r.act <= act).map((r) => {
            const a = animal(g, r.id)
            const h = hearts(g, r.id)
            return (
              <div key={r.id} className="bg-friend">
                <PixelSprite id={r.id} scale={3} />
                <div>
                  <b>{r.name}</b> <Hearts n={h} />
                  <small>
                    {a.stage === "gave" ? `Gave ${item(r.gives).name}` : a.stage === "turned" ? `Needs ${r.gate} hearts${a.cluedAt ? ` · ${CONDITION_TEXT[r.condition]}` : ""}` : h >= 2 ? `Wants ${r.wants.map((w) => item(w).name).join(" + ")}` : "Still getting to know you"}
                  </small>
                  {h >= 1 ? <small className="bg-faint">{tasteFact(r)}</small> : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
      {tab === "diary" ? (
        g.diary.length ? (
          [...g.diary].reverse().map((d) => (
            <p key={d.day}>
              <b>Day {d.day}</b> <small className="bg-chip">{d.by === "model" ? "written by the model" : "scripted"}</small>
              <br />
              {d.text}
            </p>
          ))
        ) : (
          <p className="bg-faint">Nothing yet. {companion} writes one page each night.</p>
        )
      ) : null}
    </Plate>
  )
}

export function StoryCard({ title, paragraphs, button = "Continue", onDone, chip }: { title: string; paragraphs: string[]; button?: string; onDone: () => void; chip?: string }) {
  const [page, setPage] = useState(0)
  const last = page >= paragraphs.length - 1
  return (
    <Plate title={title} wide>
      <p className="bg-story">{paragraphs[page]}</p>
      {chip ? <small className="bg-chip">{chip}</small> : null}
      <div className="bg-keys">{key(last ? button : "Next", () => (last ? onDone() : setPage(page + 1)), { primary: true })}</div>
    </Plate>
  )
}

/** A one-shot timing bar. Space, Enter, or a click stops it; the grade is 0 missed, 1 good, 2 perfect. */
export function TimingGame({ title, hint, speed, onDone }: { title: string; hint: string; speed: number; onDone: (grade: 0 | 1 | 2) => void }) {
  const [pos, setPos] = useState(0)
  const [result, setResult] = useState<null | 0 | 1 | 2>(null)
  const centerRef = useRef(0.25 + Math.random() * 0.5)
  const posRef = useRef(0)
  const stop = () => {
    if (result !== null) return
    const d = Math.abs(posRef.current - centerRef.current)
    setResult(d <= 0.04 ? 2 : d <= 0.13 ? 1 : 0)
  }
  useEffect(() => {
    if (result !== null) {
      const timer = window.setTimeout(() => onDone(result), 900)
      return () => window.clearTimeout(timer)
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const phase = (((now - t0) / 1000) * speed) % 2
      posRef.current = phase < 1 ? phase : 2 - phase
      setPos(posRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "e") {
        e.preventDefault()
        e.stopPropagation()
        stop()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, speed])
  return (
    <Plate title={title}>
      <p className="bg-faint">{hint}</p>
      <button type="button" className="bg-timing" onClick={stop} aria-label="Stop the marker">
        <span className="bg-timing-good" style={{ left: `${(centerRef.current - 0.13) * 100}%`, width: "26%" }} />
        <span className="bg-timing-perfect" style={{ left: `${(centerRef.current - 0.04) * 100}%`, width: "8%" }} />
        <span className="bg-timing-mark" style={{ left: `${pos * 100}%` }} />
      </button>
      <p className="bg-timing-result">{result === null ? "Space to stop" : ["Missed.", "Good!", "Perfect!"][result]}</p>
    </Plate>
  )
}

export function MenuPanel({ llmOn, hasModel, canSleep, onSleep, onToggleLlm, onReset, onExit, onClose }: { llmOn: boolean; hasModel: boolean | null; canSleep: boolean; onSleep: () => void; onToggleLlm: () => void; onReset: () => void; onExit: () => void; onClose: () => void }) {
  const [sure, setSure] = useState(false)
  return (
    <Plate title="Menu" onClose={onClose}>
      <label className="bg-check">
        <input type="checkbox" checked={llmOn} onChange={onToggleLlm} />
        <span>
          Friends may answer in their own words
          <small>{hasModel === null ? "Looking for a local model…" : hasModel ? "Local model found." : "No local model found. Short scripted answers instead."}</small>
        </span>
      </label>
      <div className="bg-keys">
        {key("Back to the game", onClose, { primary: true })}
        {key("Go to bed", onSleep, { disabled: !canSleep, title: canSleep ? undefined : "Evening, or when you're worn out" })}
        {key("Leave the hollow", onExit)}
        {sure ? key("Really start over?", onReset) : key("Start over…", () => setSure(true))}
      </div>
      <small className="bg-faint">Move: arrows or WASD · Run: Shift · Act: E or Space · Bag: I · Journal: J</small>
    </Plate>
  )
}

export { approachDistance }
export type { Resident }
