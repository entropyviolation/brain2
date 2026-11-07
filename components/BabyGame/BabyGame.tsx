/**
 * components/BabyGame/BabyGame.tsx — "Baby animal game": a small farm-sim village for your friend
 *
 * Opened from a friend's detail page. The friend follows you around Valdivia, a hidden valley (a Stardew-shaped meadow,
 * farm, orchard, pond, cove, hill, yard, and wood, with a few impossible stairways) while you earn the trust of twenty baby
 * animals, trade them keepsakes, and light the
 * Orb Lamp. The rules are `lib/baby-game/engine.ts`; this file is only the canvas loop, the keys, and the plates.
 * A friend can answer in their own words through the local model (`lib/baby-game/llm.ts`), with a script when none is there.
 * Nothing here writes to tasks, habits, or points. Progress is saved in this browser (`lib/baby-game/save.ts`).
 * Development mode (Menu, then the ` key) swaps to a sandbox save with powers: `lib/baby-game/dev.ts`, `./devpanel.tsx`.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { speciesPersonality, type FriendTone } from "@/lib/baby-animal-personality"
import { RESIDENTS, resident, temper } from "@/lib/baby-game/cast"
import { perkFor, spriteFor } from "@/lib/baby-game/companion"
import {
  act as actOf, addDiary, advance, ask, approach, chat, collapsed, craft, deliverErrand, eat, enterFestival, favor, fish, fishCost, gather, gift, giftGemHoard, harvest, hearts, hour, buy, sell, take, contribute,
  chop, clearStump, knock, placePart, plant, playMinigame, setEconomy, minigameBlock, till, addRealTask, claimQuest, completeRealTask, dropRealTask, setRealPlan, water, waterAll, readyToAsk, readyToTurnIn, sleep, spook, talk, turnIn, type GameState, type Msg, type Result, animal,
} from "@/lib/baby-game/engine"
import { askAnimal, councilTalk, gameModel, thinkingModel, generateEconomy, lineKind, llmEnabled, setLlmEnabled, voiceLine, writeDiary } from "@/lib/baby-game/llm"
import type { LifeContext } from "@/lib/baby-game/life"
import { PROP_SCREEN, tryProp } from "@/lib/baby-game/props"
import { groundOf, nearestSlime, newSlime, tickSlime } from "@/lib/baby-game/slime"
import { crowdNear, center, holdTalk, knockLine, nearest, newSim, stepSim, teleport as teleportSim, type Sim, type Target } from "@/lib/baby-game/sim"
import { blockAt, type Mind } from "@/lib/baby-game/mind"
import { postLetters } from "@/lib/baby-game/bestie"
import { applyLetterPatch, penLetter } from "@/lib/baby-game/letters"
import { applyTalk, describeWithModel, mindWithModel, pitchWithModel, readWithModel, talkWithModel, whereOf } from "@/lib/baby-game/chatter"
import { adoptTopic, activeManifesto, announceManifestos, applyOutline, applySection, applyStudy, canWrite, nextSection, pitchTarget, shelfActivity, studyOf, topicDue } from "@/lib/baby-game/study"
import { embedWithOllama, outlineWithModel, runStudySession, sectionWithModel, topicWithModel } from "@/lib/baby-game/study-llm"
import type { Library } from "@/lib/baby-game/passages"
import { applyReading, finished, nextBook, replaceReading, rereadBook, setReadStyle, shelveBook, unshelveBook, type Book, type ReadStyle, type SittingEdit } from "@/lib/baby-game/shelf"
import { growTrees, syncTrees } from "@/lib/baby-game/trees"
import { hasSave, loadGame, resetGame, saveGame, type SaveSlot } from "@/lib/baby-game/save"
import { applyFlags, DEV_GEMS, devRefill, devSetWeather, loadFlags, nextSpeed, saveFlags, type DevFlags } from "@/lib/baby-game/dev"
import { economyOf } from "@/lib/baby-game/economy"
import { ACTS, ENDING, AFTER, farewell, GATE_OPENED, INTRO, PART_PLACED, companionBark } from "@/lib/baby-game/story"
import { type MinigameId } from "@/lib/baby-game/minigames"
import { cycleName, dayOfCycle, festivalOn } from "@/lib/baby-game/farm"
import { buildWorld, FIRE_SLOTS, PLOTS, TILE, zoneAt, ZONES } from "@/lib/baby-game/world"
import { item, LAMP_PARTS, SEEDS } from "@/lib/baby-game/items"
import { CROP_BY_SEED, inSeason } from "@/lib/baby-game/farm"
import { PixelSprite, ToolIcon, type ToolId } from "./pixel"
import { Juice } from "./juice"
import { Shake } from "./shake"
import { DETAIL, HI, HiRes } from "./hires"
import { buildMapCanvas, drawFrame, VIEW_H, VIEW_W, type Pop } from "./render"
import { MapPanel } from "./map"
import { HomePanel, LINE_SECS, TalkBubbles, VillagePanel, type HomeActions, type LiveTalk } from "./village"
import { bookFromFile, bookText, dropBookFiles, openBookFile } from "./shelf-io"
import { DevPanel, DevQuickBar, DevReadout, type DevScene, drawDevOverlay, tileAtClick } from "./devpanel"
import { Casa } from "./Casa"
import { MINIGAME_VIEWS } from "./minigames"
import {
  BagPanel, BenchPanel, BoardPanel, CouncilPanel, JournalPanel, LampPanel, MenuPanel, PlotPanel, StoryCard, StumpPanel, TalkPanel, TimingGame, type TalkView,
} from "./panels"
import "@/components/friend-details/friend-details.css"
import "./BabyGame.css"
import "./pixel-skin.css"
import "./village.css"
import { DotGothic16 } from "next/font/google"

export type GameFriend = {
  animalId: string
  name: string
  /** Bond level from `lib/friend-stats.ts`; each level past the first is +4 energy and +1 gem a morning. */
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
  | { t: "dev" }
  | { t: "inside" }
  | { t: "council" }
  | { t: "home"; id: string }
  | { t: "village"; tab?: "now" | "talks" | "minds"; id?: string }
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

// The game's own pixel face: DotGothic16, a clean one-weight pixel gothic. Hierarchy comes from size, colour and spacing, never fake bold.
const pixelFont = DotGothic16({ subsets: ["latin"], weight: "400", variable: "--font-px-body", display: "swap" })

/** Key hints in the footer, as keycaps: [key, what it does]. */
const HINTS: Array<[string, string]> = [["WASD", "move"], ["Shift", "run"], ["E", "act"], ["I", "bag"], ["J", "journal"], ["M", "map"], ["1–5", "tools"], ["Q", "seed"]]
const DEV_HINTS: Array<[string, string]> = [["`", "dev"], ["R", "speed"], ["N", "noclip"], ["V", "friends"], ["F", "freeze"], ["G", "grid"], ["Alt+click", "teleport"]]

export function BabyGame({ friend, onClose }: { friend: GameFriend; onClose: () => void }) {
  const [dev, setDevState] = useState<DevFlags>(() => {
    const f = loadFlags()
    applyFlags(f)
    return f
  })
  const devRef = useRef(dev)
  const slot: SaveSlot = dev.on ? "dev" : "play"
  const [g, setG] = useState<GameState>(() => loadGame(dev.on ? "dev" : "play"))
  const gRef = useRef(g)
  const [mode, setModeState] = useState<Mode>(() => (g.seen.intro || dev.on ? null : { t: "story", title: "Valdivia", paragraphs: INTRO, button: "Begin" }))
  const modeRef = useRef<Mode>(mode)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [prompt, setPrompt] = useState<string | null>(null)
  /** What the slime mold is thinking while you stand near it. */
  const [slimeSays, setSlimeSays] = useState<string | null>(null)
  const [llmOn, setLlmOn] = useState(() => (typeof window === "undefined" ? true : llmEnabled()))
  const [hasModel, setHasModel] = useState<boolean | null>(null)
  const [zoneName, setZoneName] = useState("")
  /** The player's tile as "x,y", for the dev readout; only set while dev mode is on. */
  const [devTile, setDevTile] = useState("")
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
  const juice = useRef(new Juice())
  const shake = useRef(new Shake())
  const marked = useRef(new Set<string>())
  const focus = useRef<Target | null>(null)
  const pick = useRef(0)
  const sleeping = useRef(false)
  const talkReturn = useRef<{ id: string; line: string }>({ id: "", line: "" })

  const world = useMemo(() => buildWorld([...RESIDENTS.map((r) => r.day), ...FIRE_SLOTS]), [])
  const slimeGround = useMemo(() => groundOf(world), [world])
  const map = useMemo(() => (typeof document === "undefined" ? null : buildMapCanvas(world)), [world])
  const perk = useMemo(() => perkFor(friend.animalId), [friend.animalId])
  const petSprite = useMemo(() => spriteFor(friend.animalId, friend.name), [friend.animalId, friend.name])
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

  useEffect(() => saveGame(g, slot), [g, slot])
  // young and mature trees block the way; felled and fresh ones do not
  useEffect(() => syncTrees(world, g), [world, g])

  const setDev = useCallback((next: DevFlags) => {
    devRef.current = next
    applyFlags(next)
    saveFlags(next)
    setDevState(next)
  }, [])

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

  if (!simRef.current && typeof window !== "undefined") simRef.current = newSim(SPAWN, g, world)

  const pop = (x: number, y: number, kind: Pop["kind"]) => {
    pops.current.push({ x, y: y - 16, born: performance.now() / 1000, kind })
    if (kind === "heart") juice.current.hearts(performance.now() / 1000, x, y, 4)
    if (kind === "bad") shake.current.kick(performance.now() / 1000, 1)
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
      const slept = growTrees(world, sleep(logged, power, { level: friend.level, routine: perk.id === "routine" }))
      // best friends leave notes overnight; a model then rewrites each in their voice and may invent a gift (`bestie.ts`, `letters.ts`)
      // a manifesto decided yesterday is announced this morning (`study.ts`)
      const { s: announced, news } = announceManifestos(slept)
      const { s: next, posted } = postLetters(announced, Math.random)
      commit(next)
      if (news.length) toast(news.map((text) => ({ text, tone: "info" as const })))
      if (posted.length && model) {
        void (async () => {
          for (const l of posted) {
            const patch = await penLetter(next, l, model)
            if (patch) commit(applyLetterPatch(gRef.current, l.id, patch))
          }
        })()
      }
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
        paragraphs: [page.text, next.weather === "rain" ? "It's raining. Puddle people will be very pleased." : "It's a clear morning.", ...news],
        button: "Good morning",
        chip: page.by === "model" ? "diary written by the local model" : "diary written from the day's events",
        then: () => setMode(null),
      })
    },
    [commit, friend.level, friend.life, friend.name, perk.id, setMode, toast, tone, world],
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

  /** The bed in the Loft: sleep if it is evening or you are worn out. */
  const bedSleep = useCallback(() => {
    const s = gRef.current
    if (hour(s) < 18 && hour(s) >= 6 && s.energy > 30) {
      toast([{ text: "Not tired yet. Evening, or when you're worn out.", tone: "info" }])
      return
    }
    void goSleep(s.minutes < 24 * 60 ? 1 : 0.8)
  }, [goSleep, toast])

  const visitStation = useCallback(
    (id: string) => {
      const s = gRef.current
      if (id === "bed") setMode({ t: "inside" })
      else if (id === "glade" || id === "falls" || id === "echo" || id === "stairs") {
        const why = minigameBlock(s, id)
        if (why) toast([{ text: why, tone: "info" }])
        else setMode({ t: "mini", game: id })
      } else if (id === "bench") setMode({ t: "bench" })
      else if (id === "stump") setMode({ t: "stump" })
      else if (id === "board") setMode({ t: "board" })
      else if (id === "lamp") setMode({ t: "lamp" })
      else if (id === "fire") setMode({ t: "council" })
    },
    [setMode],
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
        res = seed ? plant(s, plotId, seed) : { s, msgs: [{ text: "No seeds. The Swap Stump sells them.", tone: "bad" }], ok: false }
      } else if (t === "can") res = water(s, plotId)
      else if (t === "scythe") res = harvest(s, plotId, Math.random)
      if (!res) return
      apply(res)
      if (res.ok && sim) {
        const now = performance.now() / 1000
        pops.current.push({ x: sim.px, y: sim.py - 4, born: now, kind: "plus" })
        const plot = PLOTS.find((p) => p.id === plotId)
        const fx = plot ? plot.x * TILE + TILE / 2 : sim.px
        const fy = plot ? plot.y * TILE + TILE - 2 : sim.py
        if (t === "hoe") juice.current.till(now, fx, fy)
        else if (t === "can") juice.current.water(now, fx, fy)
        else if (t === "scythe") juice.current.harvest(now, fx, fy)
        else juice.current.gather(now, fx, fy)
      }
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
    const target = nearest(sim, gRef.current, world)
    if (!target) return
    if (target.kind === "npc") openTalk(target.id)
    else if (target.kind === "tree") {
      const res = target.stage === "mature" ? chop(gRef.current, target.idx, Math.random) : clearStump(gRef.current, target.idx)
      apply(res)
      if (res.ok) {
        pops.current.push({ x: target.x, y: target.y - 10, born: performance.now() / 1000, kind: "plus" })
        juice.current.gather(performance.now() / 1000, target.x, target.y)
      }
    }
    else if (target.kind === "station") visitStation(target.id)
    else if (target.kind === "plot") {
      if (toolRef.current === "hand") setMode({ t: "plot", id: target.id })
      else applyTool(target.id)
    }
    else if (target.kind === "home") {
      toast([{ text: knockLine(sim, gRef.current, target.id), tone: "info" }])
      commit(knock(gRef.current, target.id))
      setMode({ t: "home", id: target.id })
    }
    else if (target.kind === "prop") {
      const screen = PROP_SCREEN[target.prop]
      if (screen === "bench") setMode({ t: "bench" })
      else if (screen === "fish") {
        const nodeId = `prop-${target.index}`
        if (gRef.current.nodes[nodeId] === gRef.current.day) toast([{ text: "You've already fished from the boat today.", tone: "info" }])
        else if (gRef.current.energy < fishCost(gRef.current)) toast([{ text: "Too tired to row out.", tone: "bad" }])
        else setMode({ t: "timing", kind: "fish", nodeId })
      } else {
        const res = tryProp(gRef.current, target.index, Math.random)
        apply(res)
        if (res.ok) pops.current.push({ x: target.x, y: target.y - 6, born: performance.now() / 1000, kind: "plus" })
      }
    } else if (target.node.kind === "fish") {
      if (gRef.current.nodes[target.node.id] === gRef.current.day) toast([{ text: "The fish have gone elsewhere today.", tone: "info" }])
      else if (gRef.current.energy < fishCost(gRef.current)) toast([{ text: "Too tired to fish.", tone: "bad" }])
      else setMode({ t: "timing", kind: "fish", nodeId: target.node.id })
    } else {
      const res = gather(gRef.current, target.node.id, target.node.kind, Math.random, perk.id === "fetch" ? 0.3 : 0)
      apply(res)
      if (res.ok) {
        pops.current.push({ x: target.x, y: target.y - 6, born: performance.now() / 1000, kind: "plus" })
        juice.current.gather(performance.now() / 1000, target.x, target.y)
      }
    }
  }, [apply, commit, openTalk, perk.id, setMode, toast, applyTool, visitStation, world])

  const interactRef = useRef(interact)
  interactRef.current = interact
  const pickToolRef = useRef(pickTool)
  pickToolRef.current = pickTool
  const cycleSeedRef = useRef(cycleSeed)
  cycleSeedRef.current = cycleSeed
  const setDevRef = useRef(setDev)
  setDevRef.current = setDev
  const toastRef = useRef(toast)
  toastRef.current = toast

  // ——— village life: friends talking to each other, reading from their shelves (`village.tsx`, `chatter.ts`, `shelf.ts`) ———
  const [liveTalks, setLiveTalks] = useState<LiveTalk[]>([])
  /** Model jobs running for talks; more than one at a time and the rest are scripted, so a slow model never piles up. */
  const talkJobs = useRef(0)
  /** `id:day:hour` of reading sittings already started, so each scheduled hour reads once. */
  const readKeys = useRef(new Set<string>())

  /** Two friends met on the map: write their talk (model or script), show it over their heads if in view, and save it. */
  const startTalk = useCallback(
    (a: string, b: string) => {
      const sim = simRef.current
      const pa = sim?.npcs[a]
      if (!sim || !pa) return
      const s = gRef.current
      const where = whereOf(pa.x, pa.y)
      const inView = Math.abs(pa.x - sim.px) < VIEW_W * 0.7 && Math.abs(pa.y - sim.py) < VIEW_H * 0.7
      const key = `${a}|${b}|${Math.round(sim.clock * 10)}`
      const useModel = llmOn && hasModel !== false && talkJobs.current < 1
      // an author with a manifesto outline asks the friend they met to read it (`study.ts`, `chatter.ts` `pitchWithModel`)
      const pitch = pitchTarget(s, a, b, pick.current)
      const write = (st: GameState, call: Parameters<typeof talkWithModel>[4]) =>
        pitch ? pitchWithModel(st, pitch.author, pitch.reader, where, call, pick.current++) : talkWithModel(st, a, b, where, call, pick.current++)
      if (inView) setLiveTalks((t) => [...t.filter((x) => x.a !== a && x.b !== a && x.a !== b && x.b !== b), { key, a, b, lines: null, started: 0 }].slice(-4))
      const finish = (t: Awaited<ReturnType<typeof talkWithModel>>) => {
        commit(applyTalk(gRef.current, t))
        const secs = t.lines.length * LINE_SECS + 0.6
        holdTalk(sim, a, b, secs)
        if (!inView) return
        setLiveTalks((x) => x.map((v) => (v.key === key ? { ...v, lines: t.lines, started: performance.now() / 1000 } : v)))
        window.setTimeout(() => setLiveTalks((x) => x.filter((v) => v.key !== key)), secs * 1000 + 400)
      }
      if (!useModel) {
        void write(s, null).then(finish)
        return
      }
      talkJobs.current += 1
      holdTalk(sim, a, b, 120)
      void thinkingModel()
        .then((call) => write(gRef.current, call))
        .then(finish)
        .finally(() => (talkJobs.current -= 1))
    },
    [commit, hasModel, llmOn],
  )

  /** Friends reading a whole book until stopped (`readStyle` "allatonce"); lives here so it goes on whatever screen is open. */
  const readAlls = useRef(new Map<string, { bookId: string; stop: boolean; sittings: number }>())

  /**
   * One sitting at the bookshelf: the friend stays home with a book until the model (or the script) has written it.
   * `how` is "scheduled" (their day), "manual" (asked for) or "all" (part of a read-through: a model that fails is
   * not papered over with the script; the run stops instead). Returns whether a sitting was saved.
   */
  const runReading = useCallback(
    async (id: string, bookId: string, how: "scheduled" | "manual" | "all" = "scheduled"): Promise<boolean> => {
      const sim = simRef.current
      const npc = sim?.npcs[id]
      const book = gRef.current.shelves?.[id]?.find((b) => b.id === bookId)
      const r = resident(id)
      if (!npc || !book || !r || npc.reading) return false
      npc.reading = true
      try {
        const text = await bookText(book)
        if (!text) {
          toast([{ text: `${r.name} can't find the pages of "${book.title}". Shelve it again?`, tone: "bad" }])
          return false
        }
        const call = llmOn ? await thinkingModel() : null
        if (how === "all" && !call) {
          toast([{ text: `${r.name} won't read "${book.title}" straight through without the model: ${llmOn ? "no model answered" : "the model is switched off"}. Turn it on and start again.`, tone: "bad" }])
          return false
        }
        const write = () => readWithModel(gRef.current, id, book, text, actOf(gRef.current), call)
        let sitting = (await Promise.all([write(), new Promise((ok) => window.setTimeout(ok, how === "scheduled" ? 5000 : 400))]))[0]
        if (how === "all" && sitting.by === "scripted") sitting = await write()
        if (how === "all" && sitting.by === "scripted") {
          toast([{ text: `${r.name} stopped reading "${book.title}": the model did not answer. Start again when it is back.`, tone: "bad" }])
          return false
        }
        commit(applyReading(gRef.current, id, bookId, sitting))
        const near = Math.hypot(npc.x - sim!.px, npc.y - sim!.py) < VIEW_W
        if (how === "manual" || (how === "scheduled" && near)) toast([{ text: `${r.name} read p. ${sitting.pageFrom}${sitting.pageTo !== sitting.pageFrom ? `–${sitting.pageTo}` : ""} of "${book.title}".`, tone: "info" }])
        return true
      } finally {
        npc.reading = false
      }
    },
    [commit, llmOn, toast],
  )

  /** Sit with a book, sitting after sitting, until it is finished or `stopReading` is called. Survives closing the home screen. */
  const runReadAll = useCallback(
    async (id: string, bookId: string) => {
      if (readAlls.current.has(id)) return
      const run = { bookId, stop: false, sittings: 0 }
      readAlls.current.set(id, run)
      const title = gRef.current.shelves?.[id]?.find((b) => b.id === bookId)?.title ?? "the book"
      try {
        while (!run.stop) {
          const book = gRef.current.shelves?.[id]?.find((b) => b.id === bookId)
          if (!book || finished(book)) break
          if (!(await runReading(id, bookId, "all"))) break
          run.sittings++
        }
      } finally {
        readAlls.current.delete(id)
        const done = gRef.current.shelves?.[id]?.find((b) => b.id === bookId)
        toast([{ text: `${resident(id)?.name ?? id} ${done && finished(done) ? "finished" : "put down"} "${title}" after ${run.sittings} sitting${run.sittings === 1 ? "" : "s"}.`, tone: "info" }])
      }
    },
    [runReading, toast],
  )

  /**
   * A study session at the bookshelf (`study.ts`, `study-llm.ts`): the friend searches their shelf and keeps only the
   * notes they can stand behind, caps the session off, and after enough sessions a manifesto topic is drawn out of them.
   */
  const runStudy = useCallback(
    async (id: string, how: "scheduled" | "manual" = "scheduled"): Promise<boolean> => {
      const sim = simRef.current
      const npc = sim?.npcs[id]
      const r = resident(id)
      const books = gRef.current.shelves?.[id] ?? []
      if (!npc || !r || npc.reading || !books.length) return false
      npc.reading = true
      npc.shelfDoing = activeManifesto(gRef.current, id) ? "studying for their manifesto" : "studying at the bookshelf"
      try {
        const call = llmOn ? await thinkingModel() : null
        const lib: Library = { books, text: bookText, embed: llmOn ? embedWithOllama : undefined }
        const res = (await Promise.all([runStudySession(gRef.current, id, lib, call), new Promise((ok) => window.setTimeout(ok, how === "scheduled" ? 5000 : 400))]))[0]
        if (!res) {
          if (how === "manual") toast([{ text: `${r.name} can't find any pages to study.`, tone: "bad" }])
          return false
        }
        commit(applyStudy(gRef.current, id, res))
        if (topicDue(gRef.current, id)) commit(adoptTopic(gRef.current, id, await topicWithModel(gRef.current, id, call)))
        const near = Math.hypot(npc.x - sim!.px, npc.y - sim!.py) < VIEW_W
        if (how === "manual" || near) toast([{ text: `${r.name} studied "${res.session.theme}" and kept ${res.notes.length} note${res.notes.length === 1 ? "" : "s"}.`, tone: "info" }])
        return true
      } finally {
        npc.reading = false
        npc.shelfDoing = undefined
      }
    },
    [commit, llmOn, toast],
  )

  /** Working on the manifesto: first the outline, then one section at a time (`study.ts` `canWrite`). */
  const runWrite = useCallback(
    async (id: string, how: "scheduled" | "manual" = "scheduled"): Promise<boolean> => {
      const sim = simRef.current
      const npc = sim?.npcs[id]
      const r = resident(id)
      if (!npc || !r || npc.reading || !canWrite(gRef.current, id)) return false
      npc.reading = true
      npc.shelfDoing = "working on their manifesto"
      try {
        const call = llmOn ? await thinkingModel() : null
        const m = studyOf(gRef.current, id).manifesto!
        const near = Math.hypot(npc.x - sim!.px, npc.y - sim!.py) < VIEW_W
        const wait = new Promise((ok) => window.setTimeout(ok, how === "scheduled" ? 5000 : 400))
        if (!m.outline.length) {
          const [outline] = await Promise.all([outlineWithModel(gRef.current, id, call), wait])
          commit(applyOutline(gRef.current, id, outline))
          if (how === "manual" || near) toast([{ text: `${r.name} outlined their manifesto "${outline.title ?? m.title}" in ${outline.sections.length} parts.`, tone: "info" }])
        } else {
          const at = nextSection(m)
          const [body] = await Promise.all([sectionWithModel(gRef.current, id, at, call), wait])
          commit(applySection(gRef.current, id, at, body))
          if (how === "manual" || near) toast([{ text: `${r.name} wrote "${m.outline[at]!.title}" for their manifesto.`, tone: "info" }])
        }
        return true
      } finally {
        npc.reading = false
        npc.shelfDoing = undefined
      }
    },
    [commit, llmOn, toast],
  )

  /** Every game tick: a friend whose schedule says "at the bookshelf", who is home and has an unread book, sits down to read. */
  const readOnSchedule = useCallback(
    (s: GameState) => {
      const sim = simRef.current
      if (!sim) return
      const h = hour(s)
      for (const r of RESIDENTS) {
        const npc = sim.npcs[r.id]
        if (!npc || npc.asleep || npc.reading || npc.goal !== "read" || npc.path.length) continue
        if (blockAt(s.minds?.[r.id], s.day, h)?.place !== "read") continue
        const key = `${r.id}:${s.day}:${h}`
        if (readKeys.current.has(key)) continue
        // the same hour is for reading, studying, or (once there is a manifesto to write) writing it
        const act = shelfActivity(s, r.id, h)
        if (act !== "read") {
          readKeys.current.add(key)
          void (act === "write" ? runWrite(r.id) : runStudy(r.id))
          continue
        }
        const book = nextBook(s, r.id)
        if (!book) continue
        readKeys.current.add(key)
        if (s.readStyle?.[r.id] === "allatonce") void runReadAll(r.id, book.id)
        else void runReading(r.id, book.id)
      }
    },
    [runReading, runReadAll, runStudy, runWrite],
  )

  const lifeRef = useRef({ startTalk, readOnSchedule })
  lifeRef.current = { startTalk, readOnSchedule }

  const homeActions: HomeActions = useMemo(
    () => ({
      saveMind: (id: string, m: Mind) => {
        commit({ ...gRef.current, minds: { ...gRef.current.minds, [id]: m } })
        toast([{ text: `${resident(id)?.name ?? id}'s mind is saved.`, tone: "good" }])
      },
      rebuildMind: async (id: string, description: string) => {
        const c = gRef.current.characters[id]
        const prev = gRef.current.minds[id]
        if (!c || !prev) return
        const call = llmOn ? await gameModel() : null
        const m = await mindWithModel(c, prev, description, call)
        commit({ ...gRef.current, minds: { ...gRef.current.minds, [id]: m } })
        toast([{ text: `${c.name}'s mind was rewritten ${m.by === "model" ? "by the model" : "from keywords"}.`, tone: "good" }])
      },
      describeMind: async (id: string, mind: Mind) => {
        const c = gRef.current.characters[id]
        if (!c) return mind.description
        return describeWithModel(c, mind, llmOn ? await gameModel() : null)
      },
      shelve: async (id: string, file: File) => {
        try {
          const book = await bookFromFile(file)
          commit(shelveBook(gRef.current, id, book))
          return null
        } catch (e) {
          return e instanceof Error ? e.message : "That file could not be read."
        }
      },
      unshelve: (id: string, book: Book) => {
        commit(unshelveBook(gRef.current, id, book.id))
        void dropBookFiles(book)
      },
      reread: (id: string, bookId: string) => commit(rereadBook(gRef.current, id, bookId)),
      readNow: (id: string, bookId: string) => void runReading(id, bookId, "manual"),
      studyNow: (id: string) => void runStudy(id, "manual"),
      writeNow: (id: string) => void runWrite(id, "manual"),
      readAll: (id: string, bookId: string) => void runReadAll(id, bookId),
      stopReading: (id: string) => {
        const run = readAlls.current.get(id)
        if (run) run.stop = true
      },
      readingAll: (id: string) => {
        const run = readAlls.current.get(id)
        return run ? { bookId: run.bookId, sittings: run.sittings, stopping: run.stop } : null
      },
      setStyle: (id: string, style: ReadStyle) => commit(setReadStyle(gRef.current, id, style)),
      saveSitting: (id: string, bookId: string, index: number, edit: SittingEdit, passage: string, note?: string) => {
        commit(replaceReading(gRef.current, id, bookId, index, edit, passage, note))
        toast([{ text: note !== undefined ? `${resident(id)?.name ?? id}'s reading was replaced and kept as a gold example.` : `${resident(id)?.name ?? id}'s reading was replaced.`, tone: "good" }])
      },
      openFile: (book: Book) => void openBookFile(book),
    }),
    [commit, llmOn, runReadAll, runReading, runStudy, runWrite, toast],
  )
  const getSim = useCallback(() => simRef.current, [])

  /** Development mode's jump: put the player on a tile and say where. */
  const teleport = useCallback(
    (tile: [number, number]) => {
      const sim = simRef.current
      if (!sim) return
      teleportSim(sim, tile)
      const z = zoneAt(tile[0], tile[1])
      toast([{ text: `Teleported to ${tile[0]}, ${tile[1]}${z ? ` · ${ZONES[z].name}` : ""}`, tone: "info" }])
    },
    [toast],
  )

  /** Swap between the real village and the dev sandbox. The first time in, the sandbox starts as a copy of the real save. */
  const toggleDev = useCallback(() => {
    const on = !devRef.current.on
    const next = on ? loadGame(hasSave("dev") ? "dev" : "play") : loadGame("play")
    setDev({ ...devRef.current, on })
    commit(next)
    simRef.current = newSim(SPAWN, next, world)
    setMode(null)
    toast([{ text: on ? "Development mode on: a sandbox village. Press ` for powers." : "Back in your real village.", tone: "info" }])
  }, [commit, setDev, setMode, toast])

  /** Replace the dev sandbox with a copy of the real village, or a fresh one. */
  const reseedDev = useCallback(
    (fresh: boolean) => {
      const next = fresh ? { ...resetGame("dev"), seen: { intro: true } } : loadGame("play")
      commit(next)
      simRef.current = newSim(SPAWN, next, world)
      toast([{ text: fresh ? "Fresh dev village." : "Dev village is now a copy of your real one.", tone: "info" }])
    },
    [commit, toast],
  )

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
      if (k === "`" && devRef.current.on && !e.repeat && (!modeRef.current || modeRef.current.t === "dev")) {
        // the plate focuses its search box at once; keep the backtick out of it
        e.preventDefault()
        setMode(modeRef.current ? null : { t: "dev" })
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
      if (devRef.current.on && !e.repeat && k === "r") {
        const speed = nextSpeed(devRef.current.speed)
        setDevRef.current({ ...devRef.current, speed })
        toastRef.current([{ text: `Dev: walk speed ${speed}×`, tone: "info" }])
        return
      }
      if (devRef.current.on && !e.repeat && (k === "n" || k === "f" || k === "g" || k === "v")) {
        const flag = ({ n: "noclip", f: "freeze", g: "overlay", v: "reveal" } as const)[k]
        const next = { ...devRef.current, [flag]: !devRef.current[flag] }
        setDevRef.current(next)
        toastRef.current([{ text: `Dev: ${{ noclip: "walk through anything", freeze: "clock frozen", overlay: "debug overlay", reveal: "unmet friends shown" }[flag]} ${next[flag] ? "on" : "off"}`, tone: "info" }])
        return
      }
      if (k === "i") return setMode({ t: "bag" })
      if (k === "j") return setMode({ t: "journal" })
      if (k === "v") return setMode({ t: "village" })
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
    const display = canvas?.getContext("2d")
    if (!canvas || !display || !map) return
    const hi = new HiRes(VIEW_W, VIEW_H, DETAIL)
    const ctx = hi.lowCtx
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
        const d = devRef.current
        const powers = d.on ? { noclip: d.noclip, speed: d.speed } : {}
        // a slow frame is walked in small steps, so collisions and the clock agree at any frame rate (and at dev speeds)
        const stepLen = 0.05 / (d.on ? d.speed : 1)
        for (let left = Math.min(0.5, real); left > 0; left -= stepLen) {
          const dt = Math.min(stepLen, left)
          const startled = stepSim(sim, world, gRef.current, { dx: Math.sign(dx), dy: Math.sign(dy), run: k.has("shift") || pad.current.run, ...powers }, dt, Math.random)
          for (const id of startled) {
            const res = spook(gRef.current, id)
            if (res.ok) {
              apply(res, id)
              const npc = sim.npcs[id]
              if (npc) pop(npc.x, npc.y, "bad")
            }
          }
        }
        while (sim.met.length) {
          const [a, b] = sim.met.shift()!
          lifeRef.current.startTalk(a, b)
        }
        acc += real
        if (sim.running) runAcc += real
        if (acc >= 1) {
          const secs = Math.floor(acc)
          acc -= secs
          let next = d.on && d.freeze ? gRef.current : advance(gRef.current, secs * SECONDS_TO_MINUTES)
          if (runAcc >= 1) {
            next = { ...next, energy: Math.max(0, next.energy - Math.floor(runAcc)) }
            runAcc -= Math.floor(runAcc)
          }
          if (!(d.on && d.freeze)) {
            // the slime mold spreads, draws back and remembers: one tick a second, and a dream when the day turns
            const hr = next.minutes / 60
            const walkers = Object.entries(sim.npcs).filter(([, n]) => !n.asleep).map(([id, n]) => ({ id, name: resident(id)?.name ?? id, tx: Math.floor(n.x / TILE), ty: Math.floor(n.y / TILE) }))
            next = { ...next, slime: tickSlime(next.slime ?? newSlime(), { day: next.day, hour: hr, weather: next.weather, player: { tx: Math.floor(sim.px / TILE), ty: Math.floor(sim.py / TILE) }, walkers, fireLit: next.parts.length >= 1 && (hr >= 18 || hr < 6), ground: slimeGround, rand: Math.random }) }
          }
          if (d.on && d.energy && next.energy < next.maxEnergy) next = { ...next, energy: next.maxEnergy }
          if (d.on && d.gems && (next.inv.gem ?? 0) < DEV_GEMS) next = { ...next, inv: { ...next.inv, gem: DEV_GEMS }, found: { ...next.found, gem: true } }
          if (d.on && d.lockWeather && next.weather !== d.lockWeather) next = devSetWeather(next, d.lockWeather)
          commit(next)
          if (perk.id === "nose") marked.current = new Set([...readyToAsk(next, { crowd: 0 }), ...readyToTurnIn(next)])
          if (collapsed(next)) void goSleep(0.6)
          lifeRef.current.readOnSchedule(next)
        }
      }
      const target = paused ? null : nearest(sim, gRef.current, world)
      focus.current = target
      const here = zoneAt(Math.floor(sim.px / TILE), Math.floor(sim.py / TILE))
      const hereName = here ? ZONES[here].name : "The wild wood"
      setZoneName((z) => (z === hereName ? z : hereName))
      if (devRef.current.on) {
        const tileKey = `${Math.floor(sim.px / TILE)},${Math.floor(sim.py / TILE)}`
        setDevTile((v) => (v === tileKey ? v : tileKey))
      }
      const toolVerb = target?.kind === "plot" && toolRef.current !== "hand" ? { hoe: "Till the soil", seeds: "Plant seeds", can: "Water", scythe: "Harvest" }[toolRef.current] : null
      const label = toolVerb ?? (target ? (target.kind === "node" && gRef.current.nodes[target.node.id] === gRef.current.day ? `${target.label} (picked clean)` : target.label) : null)
      setPrompt((p) => (p === label ? p : label))
      const near = !paused && gRef.current.slime ? nearestSlime(gRef.current.slime, sim.px, sim.py) : null
      const says = near && near.d < 70 ? gRef.current.slime!.thought : null
      setSlimeSays((v) => (v === says ? v : says))
      const t = now / 1000
      pops.current = pops.current.filter((p) => t - p.born < 1.4)
      drawFrame(ctx, {
        s: gRef.current, sim, world, map, t, pops: pops.current, marked: marked.current, petSprite, juice: juice.current, shake: shake.current.offset(t),
        focus: target && target.kind !== "station" ? { kind: target.kind, x: target.x, y: target.y } : null,
      })
      if (devRef.current.on && devRef.current.overlay) drawDevOverlay(ctx, world, sim, actOf(gRef.current), shake.current.offset(t))
      hi.present(display)
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
    const res = chat(gRef.current, m.id, reply, text)
    apply(res, m.id)
    setMode({ ...m, busy: false, view: "chat", line: res.line ?? reply.say, by: reply.by })
  }

  const placeIt = (id: string) => {
    const res = placePart(gRef.current, id)
    apply(res)
    if (!res.ok) return
    shake.current.kick(performance.now() / 1000, 3, 2 / 60)
    const paragraphs = [PART_PLACED[id] ?? `${item(id).name} fits.`]
    const next = actOf(res.s)
    if (res.s.ended) {
      const close = [...RESIDENTS].sort((a, b) => hearts(res.s, b.id) - hearts(res.s, a.id)).slice(0, 5)
      paragraphs.push(...ENDING, ...close.map((r) => farewell(r, hearts(res.s, r.id))), AFTER)
      setMode({ t: "story", title: "The Festival of Orb Lights", paragraphs, button: "Stay in Valdivia", then: () => setMode(null) })
    } else {
      if (GATE_OPENED[next]) paragraphs.push(GATE_OPENED[next]!)
      paragraphs.push(`${ACTS[next - 1]!.title}: ${ACTS[next - 1]!.blurb}`)
      setMode({ t: "story", title: "The Orb Lamp", paragraphs, button: "Onward", then: () => setMode(null) })
    }
  }

  /** Development mode: play any story scene or mini game now. */
  const playScene = (scene: DevScene) => {
    if (scene.t === "intro") return setMode({ t: "story", title: "Valdivia", paragraphs: INTRO, button: "Begin", then: () => setMode(null) })
    if (scene.t === "act") {
      const a = ACTS[scene.act - 1]!
      const part = ACTS[scene.act - 2] ? PART_PLACED[LAMP_PARTS[scene.act - 2]!] : undefined
      const paragraphs = [...(part ? [part] : []), ...(GATE_OPENED[scene.act] ? [GATE_OPENED[scene.act]!] : []), `${a.title}: ${a.blurb}`]
      return setMode({ t: "story", title: "The Orb Lamp", paragraphs, button: "Onward", then: () => setMode(null) })
    }
    if (scene.t === "ending") {
      const s = gRef.current
      const close = [...RESIDENTS].sort((a, b) => hearts(s, b.id) - hearts(s, a.id)).slice(0, 5)
      return setMode({ t: "story", title: "The Festival of Orb Lights", paragraphs: [...ENDING, ...close.map((r) => farewell(r, hearts(s, r.id))), AFTER], button: "Back", then: () => setMode(null) })
    }
    setMode(scene)
  }

  const startOver = () => {
    const fresh = resetGame(slot)
    commit(fresh)
    const sim = simRef.current
    if (sim) {
      sim.px = center(SPAWN[0])
      sim.py = center(SPAWN[1])
    }
    setMode({ t: "story", title: "Valdivia", paragraphs: INTRO, button: "Begin" })
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
        <div className={`bg-root ${pixelFont.variable}`} data-ui-name="Baby animal game" data-ui-docs="components/BabyGame/README.md">
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
              <span className="bg-lcd" title={economyOf(g).blurb}>{economyOf(g).market === "remnant" ? `${g.buttons} buttons` : economyOf(g).name}</span>
            </div>
            <div className="bg-menu-keys">
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "bag" })}>Bag</button>
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "journal" })}>Journal</button>
              <button type="button" className="friend-key bg-key" data-no95="" title="What everyone is doing, every talk between friends, and their minds (V)" onClick={() => setMode({ t: "village" })}>Village</button>
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "map" })}>Map</button>
              {dev.on ? <button type="button" className="friend-key bg-key bg-dev-key" data-no95="" title="Development mode powers (`)" onClick={() => setMode({ t: "dev" })}>Dev</button> : null}
              <button type="button" className="friend-key bg-key" data-no95="" onClick={() => setMode({ t: "menu" })}>Menu</button>
            </div>
          </header>

          <div className="bg-stage">
            <canvas
              ref={setCanvas}
              width={VIEW_W * HI * DETAIL}
              height={VIEW_H * HI * DETAIL}
              className="bg-canvas"
              aria-label="Valdivia"
              onClick={(e) => {
                const sim = simRef.current
                if (dev.on && e.altKey && !mode && sim) teleport(tileAtClick(sim, e.currentTarget, e.clientX, e.clientY))
              }}
            />
            {dev.on ? <DevReadout tile={devTile} g={g} flags={dev} onOpen={() => setMode({ t: "dev" })} /> : null}
            {dev.on && !mode ? <DevQuickBar flags={dev} setFlags={setDev} onRefill={() => commit(devRefill(gRef.current))} /> : null}
            {mode?.t === "inside" ? (
              <Casa
                night={hour(g) >= 19 || hour(g) < 6}
                petSprite={petSprite}
                onExit={() => setMode(null)}
                onBed={bedSleep}
                onLook={(text) => toast([{ text, tone: "info" }])}
              />
            ) : zoneName ? (
              <div className="bg-zone">{zoneName}</div>
            ) : null}
            <div className="bg-act">{festivalOn(g.day)?.name ?? (g.ended ? "The lamp is lit" : ACTS[act - 1]!.title)}</div>
            {!mode && liveTalks.length ? <TalkBubbles live={liveTalks} getSim={getSim} canvas={canvas} /> : null}
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
            {!mode && slimeSays ? <div className="bg-slime-voice"><b>slime mold</b> {slimeSays}</div> : null}
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

            {mode && mode.t !== "inside" ? (
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
                    onGiftHoard={() => talkAction((s) => giftGemHoard(s, mode.id), "menu", "being given a hundred gems at once and bonding with the player for life")}
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
                {mode.t === "stump" ? <StumpPanel g={g} onBuy={(id) => apply(buy(gRef.current, id))} onSell={(id) => apply(sell(gRef.current, id))} onTake={(id) => apply(take(gRef.current, id))} onLeave={(id) => apply(contribute(gRef.current, id))} onClose={() => setMode(null)} /> : null}
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
                {mode.t === "map" ? (
                  <MapPanel
                    world={world}
                    act={act}
                    getSim={() => simRef.current}
                    onClose={() => setMode(null)}
                    onPick={dev.on ? (tile) => (teleport(tile), setMode(null)) : undefined}
                  />
                ) : null}
                {mode.t === "dev" ? (
                  <DevPanel
                    g={g}
                    world={world}
                    flags={dev}
                    setFlags={setDev}
                    edit={(fn) => commit(fn(gRef.current))}
                    teleport={teleport}
                    onScene={playScene}
                    onCopyReal={() => reseedDev(false)}
                    onFresh={() => reseedDev(true)}
                    onEconomy={(spec) => {
                      commit(setEconomy(gRef.current, spec))
                      toast([{ text: `This world now shares as: ${spec.name}.`, tone: "info" }])
                    }}
                    generate={async (prompt) => generateEconomy(prompt, llmOn ? await gameModel() : null)}
                    onClose={() => setMode(null)}
                  />
                ) : null}
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
                {mode.t === "home" ? <HomePanel g={g} id={mode.id} getSim={getSim} hasModel={!!hasModel && llmOn} actions={homeActions} onClose={() => setMode(null)} /> : null}
                {mode.t === "village" ? <VillagePanel g={g} getSim={getSim} hasModel={!!hasModel && llmOn} actions={homeActions} initial={{ tab: mode.tab, id: mode.id }} onClose={() => setMode(null)} /> : null}
                {mode.t === "journal" ? <JournalPanel g={g} companion={friend.name} perk={perk.name} level={friend.level} onClaim={(id) => apply(claimQuest(gRef.current, id))} onClose={() => setMode(null)} /> : null}
                {mode.t === "menu" ? (
                  <MenuPanel
                    llmOn={llmOn}
                    hasModel={hasModel}
                    canSleep={hour(g) >= 18 || hour(g) < 6 || g.energy <= 30}
                    dev={dev.on}
                    onToggleDev={toggleDev}
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
            <span className="bg-hints" aria-label="Keys">
              {[...HINTS, ...(dev.on ? DEV_HINTS : [])].map(([k, what]) => (
                <span key={k}>
                  <kbd>{k}</kbd> {what}
                </span>
              ))}
            </span>
            <button type="button" className="friend-key bg-key" data-no95="" onClick={onClose}>Back to {friend.name}</button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
