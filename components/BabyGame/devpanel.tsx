/**
 * components/BabyGame/devpanel.tsx — Development mode: the ` plate, the corner readout, and the debug overlay
 *
 * Only shown while dev mode is on (Menu → Development mode). It plays on its own save, so every power here is safe.
 * The rules behind each key are pure functions in `lib/baby-game/dev.ts`; this file is only the keys.
 */
"use client"

import { useMemo, useState } from "react"
import { RESIDENTS, resident } from "@/lib/baby-game/cast"
import {
  DEV_SPEEDS, nextSpeed, devAllHearts, devGems, devEmptyBag, devFreshDay, devGive, devGiveAll, devPlaces, devQuestDone, devQuestReady, devQuestReset,
  devRefill, devRespawnNodes, devRipen, devSetAct, devSetDay, devSetHearts, devSetTime, devSetWeather, devSkills, devSkip, type DevFlags, type DevPlace,
} from "@/lib/baby-game/dev"
import { act as actOf, hearts, type GameState, type Weather } from "@/lib/baby-game/engine"
import { ECONOMIES, economyOf, type EconomySpec } from "@/lib/baby-game/economy"
import { ITEMS } from "@/lib/baby-game/items"
import { MINIGAME_IDS, MINIGAMES, type MinigameId } from "@/lib/baby-game/minigames"
import { QUESTS } from "@/lib/baby-game/quests"
import { ACTS } from "@/lib/baby-game/story"
import type { Sim } from "@/lib/baby-game/sim"
import { isSolidTile, MAP_H, MAP_W, TILE, zoneAt, ZONES, type World } from "@/lib/baby-game/world"
import { ItemIcon } from "./pixel"
import { EconomyNote, Plate, plateKey as key } from "./panels"
import { cameraOf, VIEW_H, VIEW_W } from "./render"

type Tab = "go" | "world" | "story" | "bag" | "friends" | "economy" | "powers"

/** A scene the story tab can play at once, whatever the save has reached. */
export type DevScene = { t: "intro" } | { t: "act"; act: number } | { t: "ending" } | { t: "council" } | { t: "inside" } | { t: "mini"; game: MinigameId }

const GROUPS: Array<[DevPlace["group"], string]> = [["zone", "Regions"], ["station", "Stations"], ["friend", "Friends"], ["prop", "Props"], ["gate", "Gates"]]
const WEATHERS: Weather[] = ["clear", "rain", "meteor", "fog"]
const KINDS = ["material", "trinket", "keepsake", "part", "seed", "crop"] as const

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`

export function DevPanel(p: {
  g: GameState
  world: World
  flags: DevFlags
  setFlags: (f: DevFlags) => void
  /** Apply a power to the game state. */
  edit: (fn: (s: GameState) => GameState) => void
  teleport: (tile: [number, number]) => void
  /** Play a story scene or mini game now. */
  onScene: (scene: DevScene) => void
  /** Copy the real village into the dev save, or start the dev save fresh. */
  onCopyReal: () => void
  onFresh: () => void
  /** Give the world another economy. */
  onEconomy: (spec: EconomySpec) => void
  /** An economy from the player's words: the model when it is up, else the keyword reading. */
  generate: (prompt: string) => Promise<{ spec: EconomySpec; by: "model" | "scripted" }>
  onClose: () => void
}) {
  const { g, flags, setFlags, edit } = p
  const [tab, setTab] = useState<Tab>("go")
  const [find, setFind] = useState("")
  const [coords, setCoords] = useState("")
  const [worldWords, setWorldWords] = useState("")
  const [made, setMade] = useState<{ spec: EconomySpec; by: "model" | "scripted" } | null>(null)
  const [busy, setBusy] = useState(false)
  const places = useMemo(() => devPlaces(p.world), [p.world])
  const q = find.trim().toLowerCase()
  const match = (label: string) => !q || label.toLowerCase().includes(q)
  // the game ignores keys while a box has focus, so Escape and ` close the plate from inside its inputs
  const closeKeys = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape" && e.key !== "`") return
    e.preventDefault()
    p.onClose()
  }
  const flag = (k: keyof DevFlags, label: string, hint: string) => (
    <label className="bg-check" key={k}>
      <input type="checkbox" checked={!!flags[k]} onChange={() => setFlags({ ...flags, [k]: !flags[k] })} onKeyDown={closeKeys} />
      <span>
        {label}
        <small>{hint}</small>
      </span>
    </label>
  )
  const go = (tile: [number, number]) => {
    p.teleport(tile)
    p.onClose()
  }

  return (
    <Plate title="Development mode" onClose={p.onClose} wide>
      <div className="bg-tabs" role="tablist">
        {(["go", "world", "story", "bag", "friends", "economy", "powers"] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={`friend-key bg-key${tab === x ? " is-on" : ""}`} data-no95="" onClick={() => setTab(x)}>
            {{ go: "Teleport", world: "Time", story: "Story & quests", bag: "Items", friends: "Friends", economy: "Economy", powers: "Powers" }[x]}
          </button>
        ))}
      </div>

      {tab === "go" ? (
        <div className="bg-dev">
          <div className="bg-dev-row">
            <input onKeyDown={closeKeys} className="bg-chat-input" placeholder="Find a place, friend or prop…" value={find} onChange={(e) => setFind(e.target.value)} autoFocus />
          </div>
          <form
            className="bg-dev-row"
            onSubmit={(e) => {
              e.preventDefault()
              const [x, y] = coords.split(/[\s,]+/).map(Number)
              if (Number.isFinite(x) && Number.isFinite(y)) go([Math.max(0, Math.min(MAP_W - 1, x!)), Math.max(0, Math.min(MAP_H - 1, y!))])
            }}
          >
            <input onKeyDown={closeKeys} className="bg-chat-input bg-dev-coords" placeholder={`Tile x, y (0–${MAP_W - 1}, 0–${MAP_H - 1})`} value={coords} onChange={(e) => setCoords(e.target.value)} />
            <button type="submit" className="friend-key bg-key" data-no95="">Go</button>
          </form>
          {GROUPS.map(([group, title]) => {
            const list = places.filter((pl) => pl.group === group && match(pl.label))
            if (!list.length) return null
            return (
              <section key={group}>
                <h4 className="bg-dev-h">{title}</h4>
                <div className="bg-dev-grid">
                  {list.map((pl) => (
                    <button key={pl.id} type="button" className="friend-key bg-key bg-dev-place" data-no95="" onClick={() => go(pl.tile)} title={`Tile ${pl.tile[0]}, ${pl.tile[1]}`}>
                      {pl.label}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          <p className="bg-faint">Also: click anywhere on the Map (M) to jump there, or Alt-click the world.</p>
        </div>
      ) : null}

      {tab === "world" ? (
        <div className="bg-dev">
          <h4 className="bg-dev-h">Clock · {clock(g.minutes)} · Day {g.day}</h4>
          <div className="bg-dev-row">
            <input type="range" min={0} max={24 * 60 - 1} step={10} value={g.minutes % (24 * 60)} onChange={(e) => edit((s) => devSetTime(s, Number(e.target.value)))} aria-label="Time of day" className="bg-dev-range" />
          </div>
          <div className="bg-keys">
            {key("Dawn 6:00", () => edit((s) => devSetTime(s, 6 * 60)), { k: "dawn" })}
            {key("Noon", () => edit((s) => devSetTime(s, 12 * 60)), { k: "noon" })}
            {key("Dusk 18:00", () => edit((s) => devSetTime(s, 18 * 60)), { k: "dusk" })}
            {key("Night 23:00", () => edit((s) => devSetTime(s, 23 * 60)), { k: "night" })}
            {key("+1 hour", () => edit((s) => devSkip(s, 60)), { k: "hour" })}
            {key("Day −1", () => edit((s) => devSetDay(s, s.day - 1)), { k: "dm" })}
            {key("Day +1", () => edit((s) => devSetDay(s, s.day + 1)), { k: "dp" })}
            {key("Day +7", () => edit((s) => devSetDay(s, s.day + 7)), { k: "dw" })}
          </div>
          <h4 className="bg-dev-h">Weather · {g.weather}</h4>
          <div className="bg-keys">
            {WEATHERS.map((w) => key(w, () => { if (flags.lockWeather) setFlags({ ...flags, lockWeather: w }); edit((s) => devSetWeather(s, w)) }, { k: w, primary: g.weather === w }))}
          </div>
          <label className="bg-check">
            <input type="checkbox" checked={!!flags.lockWeather} onChange={() => setFlags({ ...flags, lockWeather: flags.lockWeather ? undefined : g.weather })} onKeyDown={closeKeys} />
            <span>
              Hold this weather
              <small>{flags.lockWeather ? `Locked to ${flags.lockWeather}. Picking another weather moves the lock.` : "Keeps today's weather through new days."}</small>
            </span>
          </label>
          <h4 className="bg-dev-h">Farm and gathering</h4>
          <div className="bg-keys">
            {key("Ripen every crop", () => edit(devRipen), { k: "ripen" })}
            {key("Respawn nodes", () => edit(devRespawnNodes), { k: "nodes" })}
            {key("Fresh day (reset daily uses)", () => edit(devFreshDay), { k: "fresh" })}
          </div>
          <h4 className="bg-dev-h">Skills</h4>
          <div className="bg-keys">
            {[1, 2, 3, 4, 5].map((l) => key(`All level ${l}`, () => edit((s) => devSkills(s, l)), { k: `sk${l}` }))}
          </div>
        </div>
      ) : null}

      {tab === "story" ? (
        <div className="bg-dev">
          <h4 className="bg-dev-h">Story · act {actOf(g)}{g.ended ? " · lamp lit" : ""}</h4>
          <div className="bg-keys">
            {[1, 2, 3, 4, 5].map((a) => key(`Act ${a}`, () => edit((s) => devSetAct(s, a)), { k: `a${a}`, primary: !g.ended && actOf(g) === a }))}
            {key("Lamp lit (ending)", () => edit((s) => devSetAct(s, 6)), { k: "a6", primary: g.ended })}
          </div>
          <h4 className="bg-dev-h">Play a scene</h4>
          <div className="bg-keys">
            {key("Intro", () => p.onScene({ t: "intro" }), { k: "s-intro" })}
            {ACTS.map((a, i) => key(`Act ${i + 1} opens`, () => p.onScene({ t: "act", act: i + 1 }), { k: `s-a${i}`, title: a.title }))}
            {key("Ending", () => p.onScene({ t: "ending" }), { k: "s-end" })}
            {key("Council", () => p.onScene({ t: "council" }), { k: "s-council" })}
            {key("Inside the cottage", () => p.onScene({ t: "inside" }), { k: "s-inside" })}
          </div>
          <h4 className="bg-dev-h">Mini games</h4>
          <div className="bg-keys">
            {MINIGAME_IDS.map((id) => key(MINIGAMES[id].name, () => p.onScene({ t: "mini", game: id }), { k: `mg-${id}`, title: MINIGAMES[id].blurb }))}
          </div>
          <h4 className="bg-dev-h">Quests · {Object.keys(g.questsDone).length}/{QUESTS.length} done</h4>
          <div className="bg-dev-row">
            <input onKeyDown={closeKeys} className="bg-chat-input" placeholder="Find a quest or giver…" value={find} onChange={(e) => setFind(e.target.value)} />
          </div>
          <div className="bg-dev-items">
            {QUESTS.filter((qu) => match(qu.title) || match(resident(qu.giver)?.name ?? qu.giver)).map((qu) => (
              <div key={qu.id} className="bg-dev-item bg-dev-quest" title={qu.text}>
                <span>
                  <b>{qu.title}</b> <small className="bg-faint">{resident(qu.giver)?.name ?? qu.giver}{g.questsDone[qu.id] ? " · done" : ""}</small>
                </span>
                <button type="button" className="friend-key bg-key" data-no95="" onClick={() => edit((s) => devQuestReady(s, qu))} disabled={!!g.questsDone[qu.id]}>Ready</button>
                <button type="button" className="friend-key bg-key" data-no95="" onClick={() => edit((s) => devQuestDone(s, qu))} disabled={!!g.questsDone[qu.id]}>Done</button>
                <button type="button" className="friend-key bg-key" data-no95="" onClick={() => edit((s) => devQuestReset(s, qu.id))} disabled={!g.questsDone[qu.id]}>Reset</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "bag" ? (
        <div className="bg-dev">
          <div className="bg-keys">
            {key("+10 of everything", () => edit((s) => devGiveAll(s, 10)), { k: "all" })}
            {KINDS.map((kind) => key(`+5 ${kind}s`, () => edit((s) => devGiveAll(s, 5, kind)), { k: kind }))}
            {key("+10 gems", () => edit((s) => devGems(s, 10)), { k: "btn" })}
            {key("Empty the bag", () => edit(devEmptyBag), { k: "empty" })}
          </div>
          <div className="bg-dev-row">
            <input onKeyDown={closeKeys} className="bg-chat-input" placeholder="Find an item…" value={find} onChange={(e) => setFind(e.target.value)} />
          </div>
          <div className="bg-dev-items">
            {Object.values(ITEMS)
              .filter((d) => match(d.name) || match(d.id) || match(d.kind))
              .map((d) => (
                <div key={d.id} className="bg-dev-item" title={`${d.id} · ${d.kind}`}>
                  <ItemIcon id={d.id} scale={2} />
                  <span>{d.name}</span>
                  <em>{g.inv[d.id] ?? 0}</em>
                  <button type="button" className="friend-key bg-key" data-no95="" onClick={() => edit((s) => devGive(s, d.id, 1))}>+1</button>
                  <button type="button" className="friend-key bg-key" data-no95="" onClick={() => edit((s) => devGive(s, d.id, 10))}>+10</button>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {tab === "friends" ? (
        <div className="bg-dev">
          <div className="bg-keys">
            {[0, 3, 5, 10].map((h) => key(`Everyone ${h}♥`, () => edit((s) => devAllHearts(s, h)), { k: `h${h}` }))}
          </div>
          <div className="bg-dev-items">
            {RESIDENTS.map((r) => (
              <div key={r.id} className="bg-dev-item">
                <span>
                  <b>{r.name}</b> <small className="bg-faint">act {r.act}</small>
                </span>
                <input type="range" min={0} max={10} value={hearts(g, r.id)} onChange={(e) => edit((s) => devSetHearts(s, r.id, Number(e.target.value)))} aria-label={`${r.name} hearts`} />
                <em>{hearts(g, r.id)}♥</em>
                <button type="button" className="friend-key bg-key" data-no95="" onClick={() => go(places.find((pl) => pl.id === r.id)!.tile)}>Go</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "economy" ? (
        <div className="bg-dev">
          <EconomyNote g={g} />
          <h4 className="bg-dev-h">Baked in</h4>
          <div className="bg-keys">
            {Object.values(ECONOMIES).map((e) => key(e.name, () => p.onEconomy(e), { k: e.id, primary: economyOf(g).id === e.id, title: e.blurb }))}
          </div>
          <h4 className="bg-dev-h">From your words</h4>
          <form
            className="bg-dev-row"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!worldWords.trim() || busy) return
              setBusy(true)
              setMade(await p.generate(worldWords))
              setBusy(false)
            }}
          >
            <input
              onKeyDown={closeKeys}
              className="bg-chat-input"
              placeholder="A tiny hamlet where nobody keeps score and the festival is a giveaway…"
              value={worldWords}
              onChange={(e) => setWorldWords(e.target.value)}
            />
            <button type="submit" className="friend-key bg-key" data-no95="" disabled={busy}>{busy ? "Thinking…" : "Generate"}</button>
          </form>
          {made ? (
            <div className="bg-econ">
              <b>{made.spec.name}</b> <small className="bg-faint">{made.by === "model" ? "written by the local model" : "read from your words (no model)"}</small>
              <p>{made.spec.blurb}</p>
              <small className="bg-faint">
                market {made.spec.market} · thanks in {made.spec.rewards} · shelf {made.spec.shelf.share}+{made.spec.shelf.need} · {made.spec.shelf.mirrorGap === null ? "no score kept" : `mirror after ${made.spec.shelf.mirrorGap}`} · offerings {made.spec.offerings} · festival {made.spec.festival} · {made.spec.population.size} residents, {made.spec.population.labor}, {made.spec.population.decisions}
              </small>
              <div className="bg-keys">{key("Use this economy", () => p.onEconomy(made.spec), { k: "use", primary: true })}</div>
            </div>
          ) : null}
          <p className="bg-faint">Population (how many residents, how work and decisions are shared) is kept with the economy but does not reshape Valdivia&apos;s hand-made cast yet.</p>
        </div>
      ) : null}

      {tab === "powers" ? (
        <div className="bg-dev">
          {flag("noclip", "Walk through anything (N)", "Trees, walls, water and shut gates. The map edge still holds.")}
          {flag("freeze", "Freeze the clock (F)", "Time of day stands still until you let go.")}
          {flag("energy", "Endless energy", "Energy is topped up every second.")}
          {flag("gems", "Unlimited gems", "Your bag always holds 99 gems to give. Gems are a gift friends love, not money.")}
          {flag("reveal", "Show unmet friends (V)", "Friends from acts you have not reached are drawn, walk about, and show on the map. Talk to them to test.")}
          {flag("overlay", "Debug overlay (G)", "Tile grid, solid tiles in red, your tile in green.")}
          <h4 className="bg-dev-h">Walk speed · {flags.speed}×</h4>
          <div className="bg-keys">
            {DEV_SPEEDS.map((sp) => key(`${sp}×`, () => setFlags({ ...flags, speed: sp }), { k: `sp${sp}`, primary: flags.speed === sp }))}
            {key("Refill energy", () => edit(devRefill), { k: "refill" })}
          </div>
          <h4 className="bg-dev-h">The dev save</h4>
          <p className="bg-faint">Dev mode plays on its own village. Your real one is untouched until you leave dev mode in the Menu.</p>
          <div className="bg-keys">
            {key("Copy my real village in", p.onCopyReal, { k: "copy" })}
            {key("Fresh dev village", p.onFresh, { k: "freshsave" })}
          </div>
        </div>
      ) : null}
      <small className="bg-faint">` opens this · R speed · N walk through · V show friends · F freeze · G overlay · Alt-click teleport</small>
    </Plate>
  )
}

/** Tile, zone and act in the stage corner while dev mode is on. `tile` is "x,y". */
export function DevReadout({ tile, g, flags, onOpen }: { tile: string; g: GameState; flags: DevFlags; onOpen: () => void }) {
  const [tx, ty] = tile.split(",").map(Number)
  const z = tile ? zoneAt(tx!, ty!) : null
  const on = [flags.noclip && "noclip", flags.freeze && "frozen", flags.energy && "∞ energy", flags.gems && "∞ gems", flags.speed > 1 && `${flags.speed}×`, flags.reveal && "all friends"].filter(Boolean)
  return (
    <button type="button" className="bg-dev-readout" onClick={onOpen} title="Development mode (`)">
      <b>DEV</b> {tile || "…"} · {z ? ZONES[z].name : "wild"} · act {actOf(g)}
      {on.length ? <> · {on.join(" · ")}</> : null}
    </button>
  )
}

/** Grid, solid tiles and the player's tile over the 304×192 frame. Drawn after `drawFrame`, before the 2× pass. */
export function drawDevOverlay(ctx: CanvasRenderingContext2D, world: World, sim: Sim, act: number, shake?: { x: number; y: number }) {
  const { camX, camY } = cameraOf(sim, shake)
  ctx.save()
  const D = ctx.canvas.width / VIEW_W
  ctx.setTransform(D, 0, 0, D, -camX * D, -camY * D)
  const x0 = Math.floor(camX / TILE)
  const y0 = Math.floor(camY / TILE)
  for (let ty = y0; ty <= y0 + Math.ceil(VIEW_H / TILE); ty++) {
    for (let tx = x0; tx <= x0 + Math.ceil(VIEW_W / TILE); tx++) {
      if (tx >= MAP_W || ty >= MAP_H) continue
      if (isSolidTile(world, tx, ty, act)) {
        ctx.fillStyle = "rgba(232, 80, 106, 0.28)"
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE)
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)"
      ctx.fillRect(tx * TILE, ty * TILE, TILE, 1)
      ctx.fillRect(tx * TILE, ty * TILE, 1, TILE)
    }
  }
  const ptx = Math.floor(sim.px / TILE)
  const pty = Math.floor(sim.py / TILE)
  ctx.strokeStyle = "rgba(125, 255, 196, 0.95)"
  ctx.strokeRect(ptx * TILE + 0.5, pty * TILE + 0.5, TILE - 1, TILE - 1)
  ctx.restore()
}

/** The tile under a click on the world canvas, from its on-screen position. */
export function tileAtClick(sim: Sim, canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const rect = canvas.getBoundingClientRect()
  const { camX, camY } = cameraOf(sim)
  const wx = camX + ((clientX - rect.left) / rect.width) * VIEW_W
  const wy = camY + ((clientY - rect.top) / rect.height) * VIEW_H
  return [Math.max(0, Math.min(MAP_W - 1, Math.floor(wx / TILE))), Math.max(0, Math.min(MAP_H - 1, Math.floor(wy / TILE)))]
}

/** The powers you reach for most, always on the stage: a click each, lit while on. The same switches as the Powers tab. */
export function DevQuickBar({ flags, setFlags, onRefill }: { flags: DevFlags; setFlags: (f: DevFlags) => void; onRefill: () => void }) {
  const toggle = (k: "noclip" | "freeze" | "energy" | "reveal" | "overlay", label: string, hint: string) => (
    <button key={k} type="button" className={`bg-dev-quick${flags[k] ? " is-on" : ""}`} aria-pressed={flags[k]} title={hint} onClick={() => setFlags({ ...flags, [k]: !flags[k] })}>
      {label}
    </button>
  )
  return (
    <div className="bg-dev-quickbar" role="toolbar" aria-label="Development powers">
      <button type="button" className={`bg-dev-quick${flags.speed > 1 ? " is-on" : ""}`} title="Walk speed (R)" onClick={() => setFlags({ ...flags, speed: nextSpeed(flags.speed) })}>
        Speed {flags.speed}×
      </button>
      {toggle("noclip", "Noclip", "Walk through anything (N)")}
      {toggle("reveal", "Friends", "Show unmet friends (V)")}
      {toggle("freeze", "Freeze", "Freeze the clock (F)")}
      {toggle("energy", "∞ Energy", "Endless energy")}
      {toggle("overlay", "Grid", "Debug overlay (G)")}
      <button type="button" className="bg-dev-quick" title="Refill energy" onClick={onRefill}>Refill</button>
    </div>
  )
}
