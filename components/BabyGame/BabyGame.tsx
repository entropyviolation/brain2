/**
 * components/BabyGame/BabyGame.tsx — "Baby animal game": a small farm-sim village for your friend
 *
 * Opened from a friend's detail page. The friend follows you around Mossmere Hollow, a hidden valley (a Stardew-shaped meadow,
 * farm, orchard, pond, cove, hill, yard, and wood, with a few impossible stairways) while you earn the trust of twenty baby
 * animals, trade them keepsakes, and light the
 * Hollow Lamp. The rules are `lib/baby-game/engine.ts`; this file is only the canvas loop, the keys, and the plates.
 * A friend can answer in their own words through the local model (`lib/baby-game/llm.ts`), with a script when none is there.
 * Nothing here writes to tasks, habits, or points. Progress is saved in this browser (`lib/baby-game/save.ts`).
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { speciesPersonality, type FriendTone } from "@/lib/baby-animal-personality"
import { RESIDENTS, resident, temper } from "@/lib/baby-game/cast"
import { perkFor, spriteFor } from "@/lib/baby-game/companion"
import {
  act as actOf, addDiary, advance, ask, approach, chat, collapsed, craft, deliverErrand, eat, enterFestival, favor, fish, fishCost, gather, gift, harvest, hearts, hour, buy, sell,
  placePart, plant, playMinigame, minigameBlock, till, addRealTask, claimQuest, completeRealTask, dropRealTask, setRealPlan, water, waterAll, readyToAsk, readyToTurnIn, sleep, spook, talk, turnIn, type GameState, type Msg, type Result, animal,
} from "@/lib/baby-game/engine"
import { askAnimal, councilTalk, gameModel, lineKind, llmEnabled, setLlmEnabled, voiceLine, writeDiary } from "@/lib/baby-game/llm"
import type { LifeContext } from "@/lib/baby-game/life"
import { crowdNear, center, nearest, newSim, stepSim, type Sim, type Target } from "@/lib/baby-game/sim"
import { loadGame, resetGame, saveGame } from "@/lib/baby-game/save"
import { ACTS, ENDING, AFTER, farewell, GATE_OPENED, INTRO, PART_PLACED, companionBark } from "@/lib/baby-game/story"
import { type MinigameId } from "@/lib/baby-game/minigames"
import { cycleName, dayOfCycle, festivalOn } from "@/lib/baby-game/farm"
import { buildWorld, FIRE_SLOTS, TILE, zoneAt, ZONES } from "@/lib/baby-game/world"
import { item, SEEDS } from "@/lib/baby-game/items"
import { CROP_BY_SEED, inSeason } from "@/lib/baby-game/farm"
import { PixelSprite, ToolIcon, type ToolId } from "./pixel"
import { buildMapCanvas, drawFrame, VIEW_H, VIEW_W, type Pop } from "./render"
import { MapPanel } from "./map"
import { MINIGAME_VIEWS } from "./minigames"
import {
  BagPanel, BenchPanel, BoardPanel, CouncilPanel, JournalPanel, LampPanel, MenuPanel, PlotPanel, StoryCard, StumpPanel, TalkPanel, TimingGame, type TalkView,
} from "./panels"
import "@/components/friend-details/friend-details.css"
import "./BabyGame.css"

export type GameFriend = {
  animalId: string
  name: string
  /** Bond level from `lib/friend-stats.ts`; each level past the first is +4 energy and +1 button a morning. */
  level: number
  /** A real mission this friend has open, shown on the Notice Board. Read-only. */
  realMission?: string | null
  /** Planned: plain sentences about the player's real tasks, habits and wishes, for friends to mention gently. Not passed yet. */
  life?: LifeContext
}

type Mode =
  | null
  | { t: "talk"; id: string; line: string; by?: "model" | "scripted"; view: TalkView; busy: boolean; crowd: number }
  | { t: "bag" | "bench" | "stump" | "board" | "lamp" | "journal" | "menu" }
  | { t: "map" }
  | { t: "council" }
  | { t: "plot"; id: string }
  | { t: "mini"; game: MinigameId }
  | { t: "timing"; kind: "favor"; id: string }
  | { t: "timing"; kind: "fish"; nodeId: string }
  | { t: "story"; title: string; paragraphs: string[]; button?: string; chip?: string; then?: () => void }

type Toast = { id: number; text: string; tone: Msg["tone"] }

const SECONDS_TO_MINUTES = 3
const WEATHER_LABEL = { clear: "clear", rain: "rain", meteor: "meteor shower", fog: "morning mist" } as const
const SPAWN: [number, number] = [21, 18]

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.floor(minutes % 60)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`
}

/** Is a plot within reach of the player right now? */
function nearPlot(sim: Sim | null, s: GameState): boolean {
  return !!sim && nearest(sim, s)?.kind === "plot"
}

export function BabyGame({ friend, onClose }: { friend: GameFriend; onClose: () => void }) {
  const [g, setG] = useState<GameState>(() => loadGame())
  const gRef = useRef(g)
  const [mode, setModeState] = useState<Mode>(() => (g.seen.intro ? null : { t: "story", title: "Mossmere Hollow", paragraphs: INTRO, button: "Begin" }))
  const modeRef = useRef<Mode>(mode)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [prompt, setPrompt] = useState<string | null>(null)
  const [llmOn, setLlmOn] = useState(() => (typeof window === "undefined" ? true : llmEnabled()))
  const [hasModel, setHasModel] = useState<boolean | null>(null)
  const [zoneName, setZoneName] = useState("")
  const [tool, setToolState] = useState<ToolId>("hand")
  const toolRef = useRef<ToolId>("hand")
  const [seedPick, setSeedPick] = useState<string | null>(null)
  const seedRef = useRef<string | null>(null)

  // The dialog portals its content after the first render, so the canvas arrives late: hold it in state.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const simRef = useRef<Sim | null>(null)
  const keys = useRef(new Set<string>())
  const pad = useRef({ dx: 0, dy: 0, run: false })
  const pops = useRef<Pop[]>([])
  const marked = useRef(new Set<string>())
  const focus = useRef<Target | null>(null)
  const pick = useRef(0)
  const sleeping = useRef(false)
  const talkReturn = useRef<{ id: string; line: string }>({ id: "", line: "" })

  const world = useMemo(() => buildWorld([...RESIDENTS.map((r) => r.day), ...FIRE_SLOTS]), [])
  const map = useMemo(() => (typeof document === "undefined" ? null : buildMapCanvas(world)), [world])
  const perk = useMemo(() => perkFor(friend.animalId), [friend.animalId])
  const petSprite = useMemo(() => spriteFor(friend.animalId), [friend.animalId])
  const tone = speciesPersonality(friend.animalId).tone as FriendTone

  const setMode = useCallback((next: Mode | ((m: Mode) => Mode)) => {
    const value = typeof next === "function" ? next(modeRef.current) : next
    modeRef.current = value
    keys.current.clear()
    setModeState(value)
  }, [])

  const commit = useCallback((next: GameState) => {
    gRef.current = next
    setG(next)
  }, [])

  const toast = useCallback((msgs: Msg[]) => {
    if (!msgs.length) return
    const stamped = msgs.map((m) => ({ ...m, id: Date.now() + Math.random() }))
    setToasts((t) => [...t, ...stamped].slice(-4))
    window.setTimeout(() => setToasts((t) => t.filter((x) => !stamped.some((s) => s.id === x.id))), 3600)
  }, [])

  useEffect(() => saveGame(g), [g])

  useEffect(() => {
    let live = true
    setHasModel(null)
    if (!llmOn) {
      setHasModel(false)
      return
    }
    void gameModel().then((m) => live && setHasModel(!!m))
    return () => {
      live = false
    }
  }, [llmOn])

  if (!simRef.current && typeof window !== "undefined") simRef.current = newSim(SPAWN, g)

  const pop = (x: number, y: number, kind: Pop["kind"]) => {
    pops.current.push({ x, y: y - 16, born: performance.now() / 1000, kind })
  }

  /** Apply a result; if the friend's trust moved, show a heart or a drop over them. */
  const apply = useCallback(
    (res: Result, who?: string) => {
      const before = who ? animal(gRef.current, who).trust : 0
      commit(res.s)
      toast(res.msgs)
      if (who) {
        const sim = simRef.current
        const npc = sim?.npcs[who]
        const delta = animal(res.s, who).trust - before
        if (npc && delta !== 0) pop(npc.x, npc.y, delta > 0 ? "heart" : "bad")
      }
    },
    [commit, toast],
  )

  const goSleep = useCallback(
    async (power: number) => {
      if (sleeping.current) return
      sleeping.current = true
      setMode({ t: "story", title: "Night", paragraphs: [`${friend.name} curls up by your boot, thinks about the day, and starts a diary page…`], button: "…" })
      const model = await gameModel()
      const page = await writeDiary(gRef.current, friend.name, tone, model, friend.life)
      const logged = addDiary(gRef.current, page.text, page.by)
      const next = sleep(logged, power, { level: friend.level, routine: perk.id === "routine" })
      commit(next)
      const sim = simRef.current
      if (sim) {
        sim.px = center(SPAWN[0])
        sim.py = center(SPAWN[1])
        sim.pet.x = sim.px - 12
        sim.pet.y = sim.py
      }
      sleeping.current = false
      setMode({
        t: "story",
        title: `Day ${next.day}`,
        paragraphs: [page.text, next.weather === "rain" ? "It's raining. Puddle people will be very pleased." : "It's a clear morning."],
        button: "Good morning",
        chip: page.by === "model" ? "diary written by the local model" : "diary written from the day's events",
        then: () => setMode(null),
      })
    },
    [commit, friend.level, friend.life, friend.name, perk.id, setMode, tone],
  )

  /** Re-voice a scripted line in the friend's own words when a model is up. The script shows first; the rewrite replaces it. */
  const voice = useCallback(
    async (id: string, script: string, kind: string) => {
      const r = resident(id)
      if (!llmOn || !r || !script) return
      const model = await gameModel()
      const out = await voiceLine(r, gRef.current, script, kind, model, friend.life)
      if (!out) return
      setMode((m) => (m && m.t === "talk" && m.id === id && m.line === script ? { ...m, line: out, by: "model" } : m))
    },
    [friend.life, llmOn, setMode],
  )

  const openTalk = useCallback(
    (id: string) => {
      const sim = simRef.current
      const r = resident(id)
      if (!sim || !r) return
      if (sim.npcs[id]!.asleep) {
        toast([{ text: `${r.name} is asleep. zzz…`, tone: "info" }])
        return
      }
      const crowd = crowdNear(sim, gRef.current, id)
      const res = talk(gRef.current, id, pick.current++)
      apply(res, id)
      talkReturn.current = { id, line: res.line ?? "" }
      setMode({ t: "talk", id, line: res.line ?? "", view: "menu", busy: false, crowd })
      void voice(id, res.line ?? "", lineKind(r, res.line ?? ""))
    },
    [apply, setMode, toast, voice],
  )

  const finishTimed = useCallback(
    (grade: 0 | 1 | 2) => {
      const m = modeRef.current
      if (!m || m.t !== "timing") return
      if (m.kind === "fish") {
        const res = fish(gRef.current, m.nodeId, grade, Math.random)
        apply(res)
        setMode(null)
        return
      }
      const res = favor(gRef.current, m.id, grade)
      apply(res, m.id)
      const sim = simRef.current
      setMode({ t: "talk", id: m.id, line: res.line ?? "", view: "menu", busy: false, crowd: sim ? crowdNear(sim, res.s, m.id) : 0 })
      void voice(m.id, res.line ?? "", "reacting after you did their favorite thing together")
    },
    [apply, setMode, voice],
  )

  const visitStation = useCallback(
    (id: string) => {
      const s = gRef.current
      if (id === "bed") {
        if (hour(s) < 18 && hour(s) >= 6 && s.energy > 30) {
          toast([{ text: "Not tired yet. Evening, or when you're worn out.", tone: "info" }])
          return
        }
        void goSleep(s.minutes < 24 * 60 ? 1 : 0.8)
      } else if (id === "glade" || id === "falls" || id === "echo" || id === "stairs") {
        const why = minigameBlock(s, id)
        if (why) toast([{ text: why, tone: "info" }])
        else setMode({ t: "mini", game: id })
      } else if (id === "bench") setMode({ t: "bench" })
      else if (id === "stump") setMode({ t: "stump" })
      else if (id === "board") setMode({ t: "board" })
      else if (id === "lamp") setMode({ t: "lamp" })
      else if (id === "fire") setMode({ t: "council" })
    },
    [goSleep, setMode, toast],
  )

  /** The seed the Seeds tool plants: your pick if you still have it, else the first in-season kind you own. */
  const currentSeed = (s: GameState): string | null => {
    const owned = SEEDS.filter((d) => (s.inv[d.id] ?? 0) > 0)
    const pick = seedRef.current
    if (pick && owned.some((d) => d.id === pick)) return pick
    return (owned.find((d) => CROP_BY_SEED[d.id] && inSeason(CROP_BY_SEED[d.id]!, s.day)) ?? owned[0])?.id ?? null
  }

  /** One tap of the active tool on a plot: till, plant, water, or harvest, without opening anything. */
  const applyTool = useCallback(
    (plotId: string) => {
      const s = gRef.current
      const t = toolRef.current
      const sim = simRef.current
      let res: Result | null = null
      if (t === "hoe") res = till(s, plotId)
      else if (t === "seeds") {
        const seed = currentSeed(s)
        res = seed ? plant(s, plotId, seed) : { s, msgs: [{ text: "No seeds. The Trade Stump sells them.", tone: "bad" }], ok: false }
      } else if (t === "can") res = water(s, plotId)
      else if (t === "scythe") res = harvest(s, plotId, Math.random)
      if (!res) return
      apply(res)
      if (res.ok && sim) pops.current.push({ x: sim.px, y: sim.py - 4, born: performance.now() / 1000, kind: "plus" })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apply],
  )

  const pickTool = useCallback(
    (next: ToolId) => {
      toolRef.current = next
      setToolState(next)
      // a tap with a tool in reach of a plot uses it straight away
      const sim = simRef.current
      const near = sim ? nearest(sim, gRef.current) : null
      if (next !== "hand" && near?.kind === "plot") applyTool(near.id)
    },
    [applyTool],
  )

  const cycleSeed = useCallback(() => {
    const s = gRef.current
    const owned = SEEDS.filter((d) => (s.inv[d.id] ?? 0) > 0)
    if (!owned.length) return
    const at = owned.findIndex((d) => d.id === currentSeed(s))
    const next = owned[(at + 1) % owned.length]!.id
    seedRef.current = next
    setSeedPick(next)
    toolRef.current = "seeds"
    setToolState("seeds")
    toast([{ text: `Seeds: ${item(next).name}`, tone: "info" }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  const warmUp = useCallback(() => {
    const s = gRef.current
    if (s.seen[`fire${s.day}`]) {
      toast([{ text: "The fire crackles. You're already warm.", tone: "info" }])
      return
    }
    commit(advance({ ...s, seen: { ...s.seen, [`fire${s.day}`]: true }, energy: Math.min(s.maxEnergy, s.energy + 10) }, 20))
    toast([{ text: "You sit by the fire. +10 energy.", tone: "good" }])
  }, [commit, toast])

  const interact = useCallback(() => {
    const sim = simRef.current
    if (!sim || modeRef.current) return
    const target = nearest(sim, gRef.current)
    if (!target) return
    if (target.kind === "npc") openTalk(target.id)
    else if (target.kind === "station") visitStation(target.id)
    else if (target.kind === "plot") {
      if (toolRef.current === "hand") setMode({ t: "plot", id: target.id })
      else applyTool(target.id)
    }
    else if (target.node.kind === "fish") {
      if (gRef.current.nodes[target.node.id] === gRef.current.day) toast([{ text: "The fish have gone elsewhere today.", tone: "info" }])
      else if (gRef.current.energy < fishCost(gRef.current)) toast([{ text: "Too tired to fish.", tone: "bad" }])
      else setMode({ t: "timing", kind: "fish", nodeId: target.node.id })
    } else {
      const res = gather(gRef.current, target.node.id, target.node.kind, Math.random, perk.id === "fetch" ? 0.3 : 0)
      apply(res)
      if (res.ok) pops.current.push({ x: target.x, y: target.y - 6, born: performance.now() / 1000, kind: "plus" })
    }
  }, [apply, openTalk, perk.id, setMode, toast, applyTool, visitStation])

  const interactRef = useRef(interact)
  interactRef.current = interact
  const pickToolRef = useRef(pickTool)
  pickToolRef.current = pickTool
  const cycleSeedRef = useRef(cycleSeed)
  cycleSeedRef.current = cycleSeed

  // keyboard
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return
      const k = e.key.toLowerCase()
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault()
      if (k === "m" && !e.repeat && (!modeRef.current || modeRef.current.t === "map")) {
        setMode(modeRef.current ? null : { t: "map" })
        return
      }
      if (modeRef.current) {
        if (k === "escape" && modeRef.current.t !== "story" && modeRef.current.t !== "timing") setMode(null)
        return
      }
      if (k === "e" || k === " " || k === "enter") {
        if (!e.repeat) interactRef.current()
        return
      }
      const slot = ["1", "2", "3", "4", "5"].indexOf(k)
      if (slot >= 0) return pickToolRef.current((["hand", "hoe", "seeds", "can", "scythe"] as const)[slot]!)
      if (k === "q") return cycleSeedRef.current()
      if (k === "i") return setMode({ t: "bag" })
      if (k === "j") return setMode({ t: "journal" })
      if (k === "escape") return setMode({ t: "menu" })
      keys.current.add(k)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [setMode])

  // the loop
  useEffect(() => {
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !map) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    let runAcc = 0
    const loop = (now: number) => {
      const real = Math.min(1, (now - last) / 1000)
      last = now
      const sim = simRef.current!
      const paused = !!modeRef.current
      if (!paused) {
        const k = keys.current
        const dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0) + pad.current.dx
        const dy = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0) + pad.current.dy
        // a slow frame is walked in small steps, so collisions and the clock agree at any frame rate
        for (let left = Math.min(0.5, real); left > 0; left -= 0.05) {
          const dt = Math.min(0.05, left)
          const startled = stepSim(sim, world, gRef.current, { dx: Math.sign(dx), dy: Math.sign(dy), run: k.has("shift") || pad.current.run }, dt, Math.random)
          for (const id of startled) {
            const res = spook(gRef.current, id)
            if (res.ok) {
              apply(res, id)
              const npc = sim.npcs[id]
              if (npc) pop(npc.x, npc.y, "bad")
            }
          }
        }
        acc += real
        if (sim.running) runAcc += real
        if (acc >= 1) {
          const secs = Math.floor(acc)
          acc -= secs
          let next = advance(gRef.current, secs * SECONDS_TO_MINUTES)
          if (runAcc >= 1) {
            next = { ...next, energy: Math.max(0, next.energy - Math.floor(runAcc)) }
            runAcc -= Math.floor(runAcc)
          }
          commit(next)
          if (perk.id === "nose") marked.current = new Set([...readyToAsk(next, { crowd: 0 }), ...readyToTurnIn(next)])
          if (collapsed(next)) void goSleep(0.6)
        }
      }
      const target = paused ? null : nearest(sim, gRef.current)
      focus.current = target
      const here = zoneAt(Math.floor(sim.px / TILE), Math.floor(sim.py / TILE))
      const hereName = here ? ZONES[here].name : "The wild wood"
      setZoneName((z) => (z === hereName ? z : hereName))
      const toolVerb = target?.kind === "plot" && toolRef.current !== "hand" ? { hoe: "Till the soil", seeds: "Plant seeds", can: "Water", scythe: "Harvest" }[toolRef.current] : null
      const label = toolVerb ?? (target ? (target.kind === "node" && gRef.current.nodes[target.node.id] === gRef.current.day ? `${target.label} (picked clean)` : target.label) : null)
      setPrompt((p) => (p === label ? p : label))
      const t = now / 1000
      pops.current = pops.current.filter((p) => t - p.born < 1.4)
      drawFrame(ctx, {
        s: gRef.current, sim, world, map, t, pops: pops.current, marked: marked.current, petSprite,
        focus: target && target.kind !== "station" ? { kind: target.kind, x: target.x, y: target.y } : null,
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [apply, canvas, commit, goSleep, map, perk.id, petSprite, world])

  const talkAction = (fn: (s: GameState) => Result, view: TalkView = "menu", kind?: string) => {
    const m = modeRef.current
    if (!m || m.t !== "talk") return
    const res = fn(gRef.current)
    apply(res, m.id)
    const line = res.line ?? m.line
    setMode({ ...m, line, by: undefined, view })
    const r = resident(m.id)
    if (res.line && r) void voice(m.id, res.line, kind ?? lineKind(r, res.line))
  }

  const sendChat = async (text: string) => {
    const m = modeRef.current
    if (!m || m.t !== "talk") return
    const r = resident(m.id)!
    setMode({ ...m, busy: true })
    const model = llmOn ? await gameModel() : null
    const reply = await askAnimal(r, gRef.current, text, model, pick.current++, friend.life)
    const res = chat(gRef.current, m.id, reply)
    apply(res, m.id)
    setMode({ ...m, busy: false, view: "chat", line: res.line ?? reply.say, by: reply.by })
  }

  const placeIt = (id: string) => {
    const res = placePart(gRef.current, id)
    apply(res)
    if (!res.ok) return
    const paragraphs = [PART_PLACED[id] ?? `${item(id).name} fits.`]
    const next = actOf(res.s)
    if (res.s.ended) {
      const close = [...RESIDENTS].sort((a, b) => hearts(res.s, b.id) - hearts(res.s, a.id)).slice(0, 5)
      paragraphs.push(...ENDING, ...close.map((r) => farewell(r, hearts(res.s, r.id))), AFTER)
      setMode({ t: "story", title: "The Festival of Small Lights", paragraphs, button: "Stay in the Hollow", then: () => setMode(null) })
    } else {
      if (GATE_OPENED[next]) paragraphs.push(GATE_OPENED[next]!)
      paragraphs.push(`${ACTS[next - 1]!.title}: ${ACTS[next - 1]!.blurb}`)
      setMode({ t: "story", title: "The Hollow Lamp", paragraphs, button: "Onward", then: () => setMode(null) })
    }
  }

  const startOver = () => {
    const fresh = resetGame()
    commit(fresh)
    const sim = simRef.current
    if (sim) {
      sim.px = center(SPAWN[0])
      sim.py = center(SPAWN[1])
    }
    setMode({ t: "story", title: "Mossmere Hollow", paragraphs: INTRO, button: "Begin" })
  }

  const finishStory = (m: Extract<NonNullable<Mode>, { t: "story" }>) => {
    if (!g.seen.intro) commit({ ...gRef.current, seen: { ...gRef.current.seen, intro: true } })
    if (m.then) m.then()
    else setMode(null)
  }

  const act = actOf(g)
  const energyPct = Math.round((g.energy / g.maxEnergy) * 100)
  const rainy = g.weather === "rain"

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className="fm98-dialog baby-game-dialog"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Baby animal game</DialogTitle>
        <DialogDescription className="sr-only">A small village to explore with your friend. Arrow keys or WASD to move, E to act.</DialogDescription>
        <div className="bg-root" data-ui-name="Baby animal game" data-ui-docs="components/BabyGame/README.md">
          <header className="bg-hud">
            <div className="bg-buddy" title={perk.blurb}>
              <PixelSprite id={petSprite} scale={3} label={friend.name} />
              <span>
                <b>{friend.name}</b>
                <small>
                  Bond {friend.level} · {perk.name}
                </small>
              </span>
            </div>
            <div className="bg-stats">
              <span className="bg-lcd">
                {cycleName(g.day)} {dayOfCycle(g.day)} · Day {g.day} · {clock(g.minutes)} · {WEATHER_LABEL[g.weather]}
              </span>
              <span className="bg-energy" role="progressbar" aria-label="Energy" aria-valuenow={g.energy} aria-valuemax={g.maxEnergy}>
                <i style={{ width: `${energyPct}%` }} className={energyPct < 25 ? "is-low" : ""} />
                <em>{g.energy}/{g.maxEnergy}</em>
              </span>
              <span className="bg-lcd">{g.buttons} buttons</span>
            </div>
            <div className="bg-menu-keys">
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "bag" })}>Bag</button>
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "journal" })}>Journal</button>
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "map" })}>Map</button>
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "menu" })}>Menu</button>
            </div>
          </header>

          <div className="bg-stage">
            <canvas ref={setCanvas} width={VIEW_W} height={VIEW_H} className="bg-canvas" aria-label="Mossmere Hollow" />
            {zoneName ? <div className="bg-zone">{zoneName}</div> : null}
            <div className="bg-act">{festivalOn(g.day)?.name ?? (g.ended ? "The lamp is lit" : ACTS[act - 1]!.title)}</div>
            <ul className="bg-toasts" aria-live="polite">
              {toasts.map((t) => (
                <li key={t.id} className={`is-${t.tone}`}>{t.text}</li>
              ))}
            </ul>
            {!mode ? (
              <div className="bg-toolbar" role="toolbar" aria-label="Tools">
                {(
                  [
                    ["hand", "Hand", "Talk, gather, open things"],
                    ["hoe", "Hoe", "Till the soil"],
                    ["seeds", "Seeds", "Plant the chosen seed (Q changes it)"],
                    ["can", "Can", "Water a crop"],
                    ["scythe", "Scythe", "Harvest a ripe crop"],
                  ] as const
                ).map(([id, label, hint], i) => {
                  const seed = id === "seeds" ? currentSeed(g) : null
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`bg-tool${tool === id ? " is-on" : ""}`}
                      title={`${label}: ${hint}`}
                      aria-pressed={tool === id}
                      onClick={() => (id === "seeds" && tool === "seeds" && !nearPlot(simRef.current, g) ? cycleSeed() : pickTool(id))}
                    >
                      <ToolIcon id={id} seed={seed} scale={3} />
                      <kbd>{i + 1}</kbd>
                      {id === "seeds" ? <em>{seed ? g.inv[seed] : 0}</em> : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {!mode && prompt ? <div className="bg-prompt"><kbd>E</kbd> {prompt}</div> : null}
            {!mode ? (
              <div className="bg-pad" aria-hidden="true">
                {(
                  [
                    ["▲", 0, -1],
                    ["◀", -1, 0],
                    ["▶", 1, 0],
                    ["▼", 0, 1],
                  ] as const
                ).map(([label, dx, dy]) => (
                  <button
                    key={label}
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => (pad.current = { ...pad.current, dx, dy })}
                    onPointerUp={() => (pad.current = { ...pad.current, dx: 0, dy: 0 })}
                    onPointerLeave={() => (pad.current = { ...pad.current, dx: 0, dy: 0 })}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" tabIndex={-1} className="is-act" onClick={() => interact()}>E</button>
              </div>
            ) : null}

            {mode ? (
              <div className="bg-overlay">
                {mode.t === "talk" ? (
                  <TalkPanel
                    g={g}
                    id={mode.id}
                    line={mode.line}
                    by={mode.by}
                    view={mode.view}
                    busy={mode.busy}
                    crowd={mode.crowd}
                    hasModel={!!hasModel && llmOn}
                    setView={(view) => setMode({ ...mode, view })}
                    onTalk={() => talkAction((s) => talk(s, mode.id, pick.current++))}
                    onGift={(id) => talkAction((s) => gift(s, mode.id, id), "menu", "reacting to a gift they just got")}
                    onApproach={(t) => talkAction((s) => approach(s, mode.id, t), "menu", "reacting to how they just approached you")}
                    onFavor={() => setMode({ t: "timing", kind: "favor", id: mode.id })}
                    onTurnIn={() => talkAction((s) => turnIn(s, mode.id))}
                    onAsk={() => talkAction((s) => ask(s, mode.id, { crowd: mode.crowd }))}
                    onChat={(text) => void sendChat(text)}
                    onClose={() => setMode(null)}
                  />
                ) : null}
                {mode.t === "bag" ? <BagPanel g={g} onEat={(id) => apply(eat(gRef.current, id))} onClose={() => setMode(null)} /> : null}
                {mode.t === "bench" ? <BenchPanel g={g} onCraft={(id) => apply(craft(gRef.current, id, Math.random))} onClose={() => setMode(null)} /> : null}
                {mode.t === "stump" ? <StumpPanel g={g} onBuy={(id) => apply(buy(gRef.current, id))} onSell={(id) => apply(sell(gRef.current, id))} onClose={() => setMode(null)} /> : null}
                {mode.t === "board" ? (
                  <BoardPanel g={g} name={friend.name} realMission={friend.realMission} onDeliver={(id) => apply(deliverErrand(gRef.current, id))} onEnter={(id) => apply(enterFestival(gRef.current, id))} onClose={() => setMode(null)} />
                ) : null}
                {mode.t === "council" ? (
                  <CouncilPanel
                    g={g}
                    hasModel={!!hasModel && llmOn}
                    onAdd={(text, urgent) => apply(addRealTask(gRef.current, text, urgent))}
                    onDone={(id) => apply(completeRealTask(gRef.current, id))}
                    onDrop={(id) => commit(dropRealTask(gRef.current, id))}
                    onWarm={warmUp}
                    onTalk={async (taskId, line) => {
                      const model = llmOn ? await gameModel() : null
                      const task = gRef.current.real.find((t) => t.id === taskId) ?? null
                      const reply = await councilTalk(gRef.current, task, line, model, pick.current++, friend.life)
                      if (task && reply.plan?.length) commit(setRealPlan(gRef.current, task.id, reply.plan))
                      return reply
                    }}
                    onClose={() => setMode(null)}
                  />
                ) : null}
                {mode.t === "map" ? <MapPanel world={world} act={act} getSim={() => simRef.current} onClose={() => setMode(null)} /> : null}
                {mode.t === "plot" ? (
                  <PlotPanel
                    g={g}
                    id={mode.id}
                    onTill={() => apply(till(gRef.current, mode.id))}
                    onPlant={(seed) => apply(plant(gRef.current, mode.id, seed))}
                    onWater={() => apply(water(gRef.current, mode.id))}
                    onWaterAll={() => apply(waterAll(gRef.current))}
                    onHarvest={() => apply(harvest(gRef.current, mode.id, Math.random))}
                    onClose={() => setMode(null)}
                  />
                ) : null}
                {mode.t === "mini"
                  ? (() => {
                      const View = MINIGAME_VIEWS[mode.game]
                      return (
                        <View
                          seed={g.day * 31 + mode.game.length * 7 + g.stats.keepsakes}
                          onLeave={() => setMode(null)}
                          onDone={(grade) => {
                            apply(playMinigame(gRef.current, mode.game, grade, Math.random))
                            setMode(null)
                          }}
                        />
                      )
                    })()
                  : null}
                {mode.t === "lamp" ? <LampPanel g={g} onPlace={placeIt} onClose={() => setMode(null)} /> : null}
                {mode.t === "journal" ? <JournalPanel g={g} companion={friend.name} perk={perk.name} level={friend.level} onClaim={(id) => apply(claimQuest(gRef.current, id))} onClose={() => setMode(null)} /> : null}
                {mode.t === "menu" ? (
                  <MenuPanel
                    llmOn={llmOn}
                    hasModel={hasModel}
                    canSleep={hour(g) >= 18 || hour(g) < 6 || g.energy <= 30}
                    onSleep={() => void goSleep(g.minutes < 24 * 60 ? 1 : 0.8)}
                    onToggleLlm={() => {
                      setLlmEnabled(!llmOn)
                      setLlmOn(!llmOn)
                    }}
                    onReset={startOver}
                    onExit={onClose}
                    onClose={() => setMode(null)}
                  />
                ) : null}
                {mode.t === "timing" ? (
                  <TimingGame
                    title={mode.kind === "fish" ? "Fishing" : `${temper(mode.id).whim} with ${resident(mode.id)!.name}`}
                    hint={mode.kind === "fish" ? "Stop the marker in the bright part when a fish nibbles." : "Stop the marker in the bright part. Keep their rhythm."}
                    speed={mode.kind === "fish" ? 1.15 : { quiet: 0.7, occasional: 0.9, chatty: 1.1, eager: 1.3 }[temper(mode.id).cadence]}
                    onDone={finishTimed}
                  />
                ) : null}
                {mode.t === "story" ? <StoryCard title={mode.title} paragraphs={mode.paragraphs} button={mode.button} chip={mode.chip} onDone={() => finishStory(mode)} /> : null}
              </div>
            ) : null}
          </div>

          <footer className="bg-foot">
            <span>{companionBark(g.ended ? "night" : rainy ? "rain" : "found", friend.name)}</span>
            <span className="bg-faint">Arrows / WASD move · Shift runs (shy friends jump!) · E acts · I bag · J journal · M map · 1–5 tools · Q seed</span>
            <button type="button" className="friend-key bg-key" data-no95="" onClick={onClose}>Back to {friend.name}</button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
