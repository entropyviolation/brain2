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
  animal, askBlocks, canCraft, have, hearts, isAsleep, moodLabel, questProgress, REAL_MAX, RESTORE, sellPrice, skillLevel, starlogCount, starlogTotal, STARLOG_STEP, tasteFact, visibleQuests, wantsMet, type GameState,
} from "@/lib/baby-game/engine"
import { CROPS, CYCLE_LEN, cycleName, dayOfCycle, festivalOn, inSeason, isRipe, levelProgress, SKILLS, SKILL_IDS } from "@/lib/baby-game/farm"
import { item, ITEMS, LAMP_PARTS, RECIPES, SEEDS } from "@/lib/baby-game/items"
import type { CouncilLine } from "@/lib/baby-game/llm"
import { ACTS } from "@/lib/baby-game/story"
import type { FriendTone } from "@/lib/baby-animal-personality"
import { ItemIcon, PixelSprite } from "./pixel"

const key = (label: string, onClick: () => void, opts: { primary?: boolean; disabled?: boolean; title?: string; k?: string } = {}) => (
  <button key={opts.k} type="button" className={`friend-key bg-key${opts.primary ? " is-primary" : ""}`} data-no95="" onClick={onClick} disabled={opts.disabled} title={opts.title}>
    {label}
  </button>
)

const submitKey = (label: string, opts: { primary?: boolean; disabled?: boolean } = {}) => (
  <button type="submit" className={`friend-key bg-key${opts.primary ? " is-primary" : ""}`} data-no95="" disabled={opts.disabled}>
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
  const wares = Object.values(ITEMS).filter((d) => d.kind === "material" || d.kind === "seed")
  const loose = Object.keys(g.inv).filter((id) => ITEMS[id] && ITEMS[id]!.kind !== "keepsake" && ITEMS[id]!.kind !== "part")
  return (
    <Plate title={`Trade Stump · ${g.buttons} buttons${festivalOn(g.day) ? " · festival prices" : ""}`} onClose={onClose} wide>
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
                  <b>+{sellPrice(id, g.day)}</b>
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

export function BoardPanel({ g, realMission, name, onDeliver, onEnter, onClose }: { g: GameState; realMission?: string | null; name: string; onDeliver: (id: string) => void; onEnter: (id: string) => void; onClose: () => void }) {
  const fest = festivalOn(g.day)
  const entries = Object.keys(g.inv).filter((id) => ITEMS[id] && (ITEMS[id]!.kind === "trinket" || ITEMS[id]!.kind === "crop"))
  return (
    <Plate title="Notice Board" onClose={onClose} wide>
      <h4>{fest ? `Today: ${fest.name}` : `${cycleName(g.day)}, day ${dayOfCycle(g.day)} of ${CYCLE_LEN}`}</h4>
      {fest ? (
        <>
          <p>{fest.blurb} Sell prices are up half again, friends you&apos;re close to will dance with you tonight, and the judges take one entry.</p>
          {g.seen[`entry${g.day}`] ? (
            <p className="bg-faint">You&apos;ve entered today.</p>
          ) : entries.length ? (
            <div className="bg-grid" role="list">
              {entries.map((id) => (
                <button key={id} type="button" role="listitem" className="bg-cell" onClick={() => onEnter(id)}>
                  <ItemIcon id={id} />
                  <span>{item(id).name}</span>
                  <b>enter</b>
                </button>
              ))}
            </div>
          ) : (
            <p className="bg-faint">Bring something you made or grew to enter.</p>
          )}
        </>
      ) : (
        <p className="bg-faint">The festival is on day {CYCLE_LEN} of each cycle ({CYCLE_LEN - dayOfCycle(g.day)} more day{CYCLE_LEN - dayOfCycle(g.day) === 1 ? "" : "s"}).</p>
      )}
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

export function JournalPanel({ g, companion, perk, level, onClaim, onClose }: { g: GameState; companion: string; perk: string; level: number; onClaim: (id: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"story" | "quests" | "friends" | "skills" | "log" | "diary">("story")
  const act = Math.min(5, g.parts.length + 1)
  return (
    <Plate title="Journal" onClose={onClose} wide>
      <div className="bg-tabs" role="tablist">
        {(["story", "quests", "friends", "skills", "log", "diary"] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={`friend-key bg-key${tab === x ? " is-on" : ""}`} data-no95="" onClick={() => setTab(x)}>
            {x === "story" ? "Story" : x === "quests" ? "Quests" : x === "friends" ? "Friends" : x === "skills" ? "Skills" : x === "log" ? "Starlog" : "Diary"}
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
      {tab === "quests" ? (
        <div>
          {visibleQuests(g).length ? (
            visibleQuests(g).map((q) => {
              const p = questProgress(g, q)
              const done = !!g.questsDone[q.id]
              return (
                <div key={q.id} className={`bg-errand${done ? " is-done" : ""}`}>
                  <PixelSprite id={q.giver} scale={2} />
                  <p>
                    <b>{q.title}</b> · {resident(q.giver)?.name}
                    <br />
                    <small>{done ? q.thanks : q.text}</small>
                    {!done ? (
                      <small>
                        {" "}
                        {p.have}/{p.need} {p.label}. Reward: {q.reward.buttons} buttons{q.reward.items?.length ? ` + ${q.reward.items.map(([id, n]) => `${n} ${item(id).name}`).join(", ")}` : ""}.
                      </small>
                    ) : null}
                  </p>
                  {done ? <small>Done</small> : key("Hand in", () => onClaim(q.id), { primary: true, disabled: !p.ready })}
                </div>
              )
            })
          ) : (
            <p className="bg-faint">Friends start asking for things once they like you (two hearts).</p>
          )}
          {g.real.length ? <p className="bg-faint">Things from real life live at the campfire, not here.</p> : null}
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
      {tab === "skills" ? (
        <div>
          {SKILL_IDS.map((id) => {
            const xp = g.skills[id] ?? 0
            const lp = levelProgress(xp)
            return (
              <div key={id} className="bg-skill">
                <b>{SKILLS[id].name}</b> · level {lp.level}
                <span className="bg-meter" aria-hidden="true"><i style={{ width: lp.size ? `${Math.round((lp.into / lp.size) * 100)}%` : "100%" }} /></span>
                <small>{SKILLS[id].blurb} {lp.size ? `${lp.size - lp.into} xp to level ${lp.level + 1}: ${SKILLS[id].perks[lp.level - 1]}.` : "Mastered."}</small>
              </div>
            )
          })}
        </div>
      ) : null}
      {tab === "log" ? (
        <div>
          <p>
            <b>{starlogCount(g)}</b> of {starlogTotal()} things found. Every {STARLOG_STEP}th discovery pays 8 buttons.
          </p>
          <div className="bg-grid" role="list">
            {Object.keys(ITEMS).map((id) => (
              <div key={id} role="listitem" className={`bg-cell is-still${g.found[id] ? "" : " is-unknown"}`} title={g.found[id] ? item(id).blurb : "Not found yet"}>
                <ItemIcon id={id} />
                <span>{g.found[id] ? item(id).name : "???"}</span>
              </div>
            ))}
          </div>
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

export function PlotPanel(p: {
  g: GameState
  id: string
  onTill: () => void
  onPlant: (seed: string) => void
  onWater: () => void
  onWaterAll: () => void
  onHarvest: () => void
  onClose: () => void
}) {
  const plot = p.g.farm[p.id]
  const crop = plot?.crop ? CROPS[plot.crop] : null
  const ripe = isRipe(plot)
  const seeds = SEEDS.filter((d) => have(p.g, d.id) > 0)
  const farming = skillLevel(p.g, "farming")
  return (
    <Plate title={`The soil · ${cycleName(p.g.day)}, day ${dayOfCycle(p.g.day)}`} onClose={p.onClose}>
      {!plot?.tilled ? (
        <>
          <p>Bare ground. A little digging would do it good.</p>
          {key("Till the soil", p.onTill, { primary: true })}
        </>
      ) : !crop ? (
        <>
          <p>Soft, turned soil. What should grow here?</p>
          {seeds.length ? (
            <div className="bg-grid" role="list">
              {seeds.map((d) => {
                const c = Object.values(CROPS).find((x) => x.seed === d.id)!
                const ok = inSeason(c, p.g.day)
                return (
                  <button key={d.id} type="button" role="listitem" className="bg-cell" disabled={!ok} onClick={() => p.onPlant(d.id)} title={d.blurb}>
                    <ItemIcon id={d.id} />
                    <span>{d.name}</span>
                    <b>×{have(p.g, d.id)}</b>
                    <small>{ok ? `${c.days} nights` : "wrong cycle"}</small>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="bg-faint">No seeds. The Trade Stump sells them.</p>
          )}
        </>
      ) : (
        <>
          <div className="bg-crop">
            <ItemIcon id={crop.id} scale={4} />
            <p>
              <b>{item(crop.id).name}</b>
              <br />
              {ripe ? "Ripe and wiggling. Pick it!" : `${plot!.grown} of ${crop.days} nights${plot!.watered ? ", watered today" : ", thirsty"}.`}
            </p>
          </div>
          {ripe ? key("Harvest", p.onHarvest, { primary: true }) : key(plot!.watered ? "Watered" : "Water", p.onWater, { primary: !plot!.watered, disabled: plot!.watered })}
        </>
      )}
      {key("Water everything thirsty", p.onWaterAll)}
      <p className="bg-faint">
        Farming level {farming}. {SKILLS.farming.perks[farming - 1] ? `Next: ${SKILLS.farming.perks[farming - 1]}.` : "Mastered."}
      </p>
    </Plate>
  )
}

/** The campfire council: tell the friends what is on your mind in real life, and they band together over it. */
export function CouncilPanel(p: {
  g: GameState
  onAdd: (text: string, urgent: boolean) => void
  onDone: (id: string) => void
  onDrop: (id: string) => void
  onTalk: (taskId: string | null, line: string) => Promise<{ lines: CouncilLine[]; plan?: string[] }>
  onWarm: () => void
  onClose: () => void
  hasModel: boolean
}) {
  const [text, setText] = useState("")
  const [urgent, setUrgent] = useState(false)
  const [line, setLine] = useState("")
  const [focus, setFocus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [talk, setTalk] = useState<CouncilLine[]>([])
  const open = p.g.real.filter((t) => !t.done)
  const target = focus && open.some((t) => t.id === focus) ? focus : (open.find((t) => t.urgent) ?? open[0])?.id ?? null

  const say = async (what: string) => {
    setBusy(true)
    const res = await p.onTalk(target, what)
    setTalk((prev) => [...(what ? [{ who: "you", name: "You", say: what, by: "scripted" as const }] : []), ...res.lines, ...prev].slice(0, 14))
    setBusy(false)
  }

  return (
    <Plate title="The Campfire Council" onClose={p.onClose} wide>
      <p className="bg-faint">
        Tell the friends what is weighing on you in real life. Anything urgent pulls them to the fire. They can talk it over in plain text and help you find the first small step. Nothing here changes your real lists: you mark it done yourself.
      </p>
      <form
        className="bg-council-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          p.onAdd(text, urgent)
          setText("")
          setUrgent(false)
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. book flights to New York, finish the CD designs" aria-label="Something real to tell the friends" maxLength={140} />
        <label>
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> urgent
        </label>
        {submitKey("Tell the friends", { primary: true, disabled: !text.trim() || open.length >= REAL_MAX })}
      </form>
      {open.length ? (
        <div className="bg-council-tasks">
          {open.map((t) => (
            <div key={t.id} className={`bg-errand${t.id === target ? " is-focus" : ""}`}>
              <p>
                <b>{t.urgent ? "URGENT · " : ""}{t.text}</b>
                {t.plan?.length ? (
                  <small>
                    {" "}
                    First steps: {t.plan.map((x, i) => `${i + 1}. ${x}`).join("  ")}
                  </small>
                ) : null}
              </p>
              {key("Ask the friends", () => { setFocus(t.id); void say("") })}
              {key("Done in real life", () => p.onDone(t.id), { primary: true })}
              {key("Let go", () => p.onDrop(t.id))}
            </div>
          ))}
        </div>
      ) : (
        <p className="bg-faint">Nothing on your mind that the friends know about.</p>
      )}
      <form
        className="bg-council-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!line.trim() || busy) return
          const what = line
          setLine("")
          void say(what)
        }}
      >
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Say something to everyone around the fire…" aria-label="Talk to the friends" maxLength={240} />
        {submitKey(busy ? "…" : "Say", { disabled: busy || !line.trim() })}
      </form>
      <div className="bg-council-talk" aria-live="polite">
        {talk.map((l, i) => (
          <p key={`${i}-${l.who}`} className={l.who === "you" ? "is-you" : ""}>
            {l.who !== "you" ? <PixelSprite id={l.who} scale={1} /> : null}
            <b>{l.name}:</b> {l.say}
          </p>
        ))}
        {talk.length ? <small className="bg-faint">{talk.some((l) => l.by === "model") ? "voiced by the local model" : "scripted answers (no model reachable)"}</small> : null}
      </div>
      {key("Warm up by the fire (+10 energy, once a day)", p.onWarm)}
    </Plate>
  )
}
