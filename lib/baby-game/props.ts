/**
 * lib/baby-game/props.ts — What the world's props do when you press E beside them.
 *
 * Each use is small and pure: it takes the state, returns a Result, and either gives something (energy, an item, a thank-you gem,
 * skill xp, friendship, a look at tomorrow) or says no. Most can be used once a day; the clock once a week. The mailbox,
 * the well and the rest are the everyday ones; the orb, prism, microscope, fossil and company come from what the player loves,
 * and the wasps and the clock from what they dread. The two that open a screen (collage desk, rowboat) are in `PROP_SCREEN`.
 */

import { RESIDENTS } from "./cast"
import { act as actOf, addXp, advance, animal, bag, DAY_START, done, hour, no, payOut, RESTORE, ripeCount, skillLevel, sweepLog, weatherFor, type GameState, type Msg, type Result } from "./engine"
import { collectMail } from "./bestie"
import { economyOf } from "./economy"
import { festivalOn, isRipe, SKILLS, SKILL_IDS } from "./farm"
import { item, ITEMS, SEEDS } from "./items"
import { cellOf, feedSlime, newSlime, slimeThought, moodOf } from "./slime"
import { PROPS, type PropKind } from "./world"

/** Props that open an existing screen instead of acting by themselves. */
export const PROP_SCREEN: Partial<Record<PropKind, "bench" | "fish">> = { collage: "bench", rowboat: "fish" }

type Ctx = { rand: () => number; msgs: Msg[]; before: GameState; /** The prop being used. */ at: { x: number; y: number } }
type Use = {
  label: string
  /** How often: once per `day` (default), once a `week`, or `any` time. */
  every?: "day" | "week" | "any"
  minutes?: number
  energy?: number
  /** Return a reason to refuse, or nothing when it worked. */
  run: (n: GameState, c: Ctx) => string | void
}

const good = (c: Ctx, text: string) => c.msgs.push({ text, tone: "good" })
const info = (c: Ctx, text: string) => c.msgs.push({ text, tone: "info" })
const bad = (c: Ctx, text: string) => c.msgs.push({ text, tone: "bad" })
const give = (n: GameState, c: Ctx, id: string, qty = 1) => {
  bag(n, id, qty)
  good(c, `+${qty} ${item(id).name}`)
}
const gain = (n: GameState, c: Ctx, e: number) => {
  const got = Math.min(n.maxEnergy - n.energy, e)
  n.energy += got
  good(c, `+${got} energy`)
}
const pick = <T,>(c: Ctx, list: readonly T[]) => list[Math.floor(c.rand() * list.length)]!
const isNight = (h: number) => h >= 19 || h < 5
const FOODS = Object.keys(RESTORE)

const USES: Partial<Record<PropKind, Use>> = {
  mailbox: {
    label: "Check the mail", minutes: 5,
    run: (n, c) => {
      const b = payOut(n, 3 * (1 + Math.floor(c.rand() * 3)))
      good(c, `+${b}, tucked in with letters from a better world`)
      if (c.rand() < 0.35) give(n, c, "postcard")
      // notes from best friends, and any gift they tucked in (`bestie.ts`)
      for (const m of collectMail(n)) c.msgs.push(m)
    },
  },
  firewood: {
    label: "Split firewood", energy: 3, minutes: 15,
    run: (n, c) => give(n, c, "kindling", 2),
  },
  well: {
    label: "Drink cold water", minutes: 5,
    run: (n, c) => {
      info(c, "Cold water, straight from the deep. Wow.")
      gain(n, c, 12)
      if (c.rand() < 0.1) give(n, c, "dewgem")
    },
  },
  signpost: {
    label: "Read the signpost", every: "any", minutes: 0,
    run: (n, c) => {
      const w = weatherFor(n.day + 1)
      info(c, `Tomorrow looks ${w === "clear" ? "clear" : w === "rain" ? "rainy" : w === "meteor" ? "like a meteor night" : "foggy"}.`)
      const ripe = ripeCount(n)
      info(c, ripe ? `${ripe} crop${ripe === 1 ? " is" : "s are"} ripe.` : "Nothing is ripe yet.")
      const fest = festivalOn(n.day) ?? festivalOn(n.day + 1)
      if (fest) info(c, `A festival is near: ${fest.name}.`)
    },
  },
  birdbath: {
    label: "Watch the bluebird", minutes: 10,
    run: (n, c) => {
      info(c, "It tilts its head at you. You tilt yours back.")
      gain(n, c, 3)
      give(n, c, "feather")
    },
  },
  blanket: {
    label: "Have a picnic", every: "day", minutes: 30,
    run: (n, c) => {
      const food = FOODS.filter((id) => (n.inv[id] ?? 0) > 0).sort((a, b) => RESTORE[b]! - RESTORE[a]!)[0]
      if (!food) return "Bring something to eat: berries, jam, pie."
      if (n.energy >= n.maxEnergy) return "You're not hungry."
      bag(n, food, -1)
      info(c, `You share ${item(food).name} with the sky.`)
      gain(n, c, Math.round(RESTORE[food]! * 1.5))
    },
  },
  beehive: {
    label: "Take some honey", minutes: 10,
    run: (n, c) => {
      if ((n.inv.kindling ?? 0) > 0) {
        bag(n, "kindling", -1)
        info(c, "A little smoke and they let you be.")
        give(n, c, "honey", 2)
      } else if (c.rand() < 0.3) {
        n.energy = Math.max(0, n.energy - 4)
        bad(c, "One of them objects. -4 energy.")
      } else give(n, c, "honey")
    },
  },
  scarecrow: {
    label: "Straighten the scarecrow", energy: 1, minutes: 10,
    run: (n, c) => {
      n.seen[`scarecrow${n.day}`] = true
      info(c, "The crow gives you a nod. Harvests are likelier to double today.")
      addXp(n, "farming", 1, c.msgs)
    },
  },
  wheelbarrow: {
    label: "Haul compost", energy: 3, minutes: 20,
    run: (n, c) => {
      addXp(n, "farming", 2, c.msgs)
      info(c, "Under the soil, a forgotten seed packet.")
      give(n, c, pick(c, SEEDS).id)
    },
  },
  haybale: {
    label: "Nap on the hay", minutes: 45,
    run: (n, c) => {
      info(c, "It smells like a whole summer.")
      gain(n, c, 8)
    },
  },
  orb: {
    label: "Hum to the orb", minutes: 5,
    run: (n, c) => {
      info(c, "The white orb brightens to match your note.")
      gain(n, c, 8)
      if (isNight(hour(c.before))) give(n, c, "starshard")
    },
  },
  puddle: {
    label: "Splash in the puddle", minutes: 10,
    run: (n, c) => {
      info(c, n.weather === "rain" ? "Playing in the rain: the best thing." : "Your reflection breaks into a hundred pieces and puts itself back.")
      gain(n, c, n.weather === "rain" ? 12 : 4)
    },
  },
  prism: {
    label: "Hold the prism to the light", minutes: 10,
    run: (n, c) => {
      const h = hour(c.before)
      if (h < 7 || h > 16 || n.weather !== "clear") return "It needs clear daylight to split."
      info(c, "A spectrum slides across your hands.")
      give(n, c, "rainbit")
    },
  },
  library: {
    label: "Read in the little library", minutes: 30,
    run: (n, c) => {
      const weak = [...SKILL_IDS].sort((a, b) => (n.skills[a] ?? 0) - (n.skills[b] ?? 0))[0]!
      info(c, pick(c, ["An old atlas folds out into a city that teaches.", "An index in the back lists every idea twice.", "A scanned page of someone's careful handwriting.", "A field guide to things that should not exist, and do."]))
      c.msgs.push({ text: `You learned about ${SKILLS[weak].name.toLowerCase()}.`, tone: "info" })
      addXp(n, weak, 2, c.msgs)
    },
  },
  thrift: {
    label: "Swap at the thrift rack", every: "any", minutes: 15,
    run: (n, c) => {
      const trinkets = Object.values(ITEMS).filter((d) => d.kind === "trinket")
      if (economyOf(n).market === "remnant") {
        // a world with a market remnant still sells here, for scrip
        if (n.buttons < 6) return "Six buttons for a find. Come back with more."
        n.buttons -= 6
      } else {
        // a swap rack: leave one thing you made, take one somebody else did
        const mine = trinkets.find((d) => (n.inv[d.id] ?? 0) > 0)
        if (!mine) return "Leave a trinket to take one. That is the rack's only rule."
        bag(n, mine.id, -1)
        info(c, `You hang up your ${mine.name} for whoever needs it next.`)
      }
      info(c, "You flip through the hangers: plaid, a seafoam scarf, a lilac something.")
      give(n, c, pick(c, trinkets).id)
    },
  },
  fireworks: {
    label: "Light a firework (1 kindling)", minutes: 15,
    run: (n, c) => {
      if (!isNight(hour(c.before))) return "Wait for dark."
      if ((n.inv.kindling ?? 0) < 1) return "A firework needs one kindling to light. Split some firewood."
      bag(n, "kindling", -1)
      let cheered = 0
      for (const r of RESIDENTS) {
        if (r.act > actOf(n)) continue
        const a = animal(n, r.id)
        n.animals[r.id] = { ...a, trust: Math.min(100, a.trust + 2) }
        cheered += 1
      }
      good(c, `BOOM, and gold, and wow! ${cheered} friends cheer. (+2 trust each)`)
    },
  },
  clock: {
    label: "Set the clock back an hour", every: "week", minutes: 0,
    run: (n, c) => {
      if (n.minutes < DAY_START + 60) return "It's too early to fall back."
      n.minutes -= 60
      good(c, "You gain an hour. The clock does not apologise.")
    },
  },
  pendulum: {
    label: "Match the pendulum", minutes: 15,
    run: (n, c) => {
      info(c, "Back, forth, back. You settle into its rhythm and everything balances.")
      addXp(n, "crafting", 2, c.msgs)
    },
  },
  ducklings: {
    label: "Follow the ducklings", minutes: 15,
    run: (n, c) => {
      info(c, "They walk in a line, in perfect order, and you join the end.")
      gain(n, c, 4)
      if (c.rand() < 0.3) give(n, c, "feather")
    },
  },
  sprinkler: {
    label: "Run through the sprinkler", minutes: 15,
    run: (n, c) => {
      let wet = 0
      for (const id of Object.keys(n.farm)) {
        const p = n.farm[id]!
        if (p.crop && !isRipe(p) && !p.watered) {
          n.farm[id] = { ...p, watered: true }
          wet += 1
        }
      }
      info(c, "You run through it, shrieking happily.")
      if (wet) good(c, `${wet} thirsty plot${wet === 1 ? "" : "s"} watered, free.`)
      gain(n, c, 3)
    },
  },
  microscope: {
    label: "Look through the microscope", minutes: 15,
    run: (n, c) => {
      info(c, "Wow. A glass house with one resident, and it is gorgeous.")
      give(n, c, "diatom")
    },
  },
  fossil: {
    label: "Brush the fossil bed", energy: 2, minutes: 20,
    run: (n, c) => give(n, c, "fossil"),
  },
  romanesco: {
    label: "Study the romanesco", energy: 1, minutes: 10,
    run: (n, c) => {
      info(c, "Spirals of spirals of spirals. You find one that comes off in your hand.")
      give(n, c, "romanesco", 1 + (skillLevel(n, "foraging") >= 3 ? 1 : 0))
      addXp(n, "foraging", 1, c.msgs)
    },
  },
  slime: {
    label: "Speak with the slime mold", minutes: 10,
    run: (n, c) => {
      let sl = n.slime ?? newSlime()
      const cell = cellOf(c.at.x, c.at.y)
      // it eats what you can spare of the sweet things, and remembers where
      const food = ["berry", "jam", "glowbean", "moonmelon", "pie", "sorbet"].find((id) => (n.inv[id] ?? 0) > 0)
      if (food) {
        bag(n, food, -1)
        sl = feedSlime(sl, cell, `a ${item(food).name.toLowerCase()}`, n.day)
        good(c, `It swells around the ${item(food).name.toLowerCase()} and glows.`)
      } else sl = { ...sl, thought: slimeThought(sl, { day: n.day, hour: n.minutes / 60, weather: n.weather, rand: c.rand }) }
      n.slime = sl
      info(c, `"${sl.thought}"`)
      const fed = moodOf(sl, n.day) === "content"
      good(c, `+${payOut(n, 6 + Math.floor(sl.size * 10) + (fed ? 3 : 0))} from the shortest path`)
      addXp(n, "crafting", 1, c.msgs)
    },
  },
  wasps: {
    label: "Poke the wasp nest", minutes: 10,
    run: (n, c) => {
      if ((n.inv.kindling ?? 0) > 0) {
        bag(n, "kindling", -1)
        info(c, "You smoke them quiet and lift out a comb.")
        give(n, c, "honey", 2)
        addXp(n, "foraging", 2, c.msgs)
      } else {
        n.energy = Math.max(0, n.energy - 8)
        bad(c, "Stung! The wasps are furious. -8 energy. (Smoke calms them: bring kindling.)")
      }
    },
  },
  kitten: {
    label: "Pet the kitten", minutes: 5,
    run: (n, c) => {
      gain(n, c, 5)
      if ((n.inv.fish ?? 0) > 0) {
        bag(n, "fish", -1)
        info(c, "You share a minnow. It leaves you something shiny on your boot.")
        good(c, `+${payOut(n, 6)}`)
      } else info(c, "It purrs like a very small engine.")
    },
  },
}

const keyOf = (s: GameState, index: number, every: Use["every"]) => (every === "week" ? `prop${index}w${Math.floor(s.day / 7)}` : `prop${index}d${s.day}`)

/** What E would do here, for the prompt. */
export function propLabel(s: GameState, index: number): string {
  const kind = PROPS[index]!.kind
  if (kind === "collage") return "Make a collage"
  if (kind === "rowboat") return "Row out and fish"
  const use = USES[kind]!
  const used = use.every !== "any" && s.seen[keyOf(s, index, use.every)]
  return used ? `${use.label} (done for now)` : use.label
}

/** Try the prop at `index` in `PROPS`. Screen props (`PROP_SCREEN`) are handled by the caller. */
export function tryProp(s: GameState, index: number, rand: () => number): Result {
  const kind = PROPS[index]?.kind
  const use = kind ? USES[kind] : undefined
  if (!use) return no(s, "Nothing to do here.")
  const key = keyOf(s, index, use.every)
  if (use.every !== "any" && s.seen[key]) return no(s, use.every === "week" ? "Not again this week." : "Nothing more here today.")
  if (use.energy && s.energy < use.energy) return no(s, "Too tired for that.")
  const n = advance(s, use.minutes ?? 0)
  n.energy -= use.energy ?? 0
  const c: Ctx = { rand, msgs: [], before: s, at: PROPS[index]! }
  const refused = use.run(n, c)
  if (refused) return no(s, refused)
  if (use.every !== "any") n.seen[key] = true
  sweepLog(n, c.msgs)
  return done(n, c.msgs)
}
