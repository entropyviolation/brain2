/**
 * lib/baby-game/minigames.ts — The four mini games' rules (pure; the animation is in `components/BabyGame/minigames.tsx`)
 *
 * Each game ends in a grade 0, 1 or 2, and the engine (`playMinigame`) turns the grade into a reward, once a day
 * per game. The settings here are the only place a game's difficulty lives, so a test can pin them.
 *
 *   glade  Firefly Glade   (night)  catch glowing fireflies in a jar before the timer runs out
 *   falls  Mossfall Hop            hop up a waterfall on moving stones; three falls end it
 *   echo   Echo Flower              repeat the petals the flower lights, a note longer each round
 *   stairs Stair Weave              turn every stair until the way from the start reaches the door
 */

export type MinigameId = "glade" | "falls" | "echo" | "stairs"
export const MINIGAME_IDS: readonly MinigameId[] = ["glade", "falls", "echo", "stairs"]

export const MINIGAMES: Record<MinigameId, { name: string; blurb: string; zone: string; cost: number; nightOnly?: boolean }> = {
  glade: { name: "Firefly Glade", blurb: "Fireflies only come out after dark. Catch the ones that are glowing.", zone: "orchard", cost: 4, nightOnly: true },
  falls: { name: "Mossfall Hop", blurb: "Hop the stones up the waterfall. Time each jump to a stone passing under you.", zone: "pond", cost: 5 },
  echo: { name: "Echo Flower", blurb: "The cave flower sings a little tune in light. Sing it back.", zone: "hill", cost: 3 },
  stairs: { name: "Stair Weave", blurb: "Each stair turns when tapped. Make a way from the first step to the door.", zone: "barn", cost: 4 },
}

/** The grade you get for a raw score, per game. */
export const GLADE = { seconds: 20, count: 10, good: 3, great: 6 }
export const FALLS = { rows: 4, lives: 3, greatFalls: 0 }
export const ECHO = { petals: 4, great: 6, good: 3, max: 8 }

export const gladeGrade = (caught: number): 0 | 1 | 2 => (caught >= GLADE.great ? 2 : caught >= GLADE.good ? 1 : 0)
export const fallsGrade = (reached: boolean, falls: number): 0 | 1 | 2 => (!reached ? 0 : falls <= FALLS.greatFalls ? 2 : 1)
export const echoGrade = (rounds: number): 0 | 1 | 2 => (rounds >= ECHO.great ? 2 : rounds >= ECHO.good ? 1 : 0)

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The petals the flower lights: one new petal each round, the same tune for the same seed. */
export function echoSequence(seed: number, length = ECHO.max): number[] {
  const r = rng(seed)
  return Array.from({ length }, () => Math.floor(r() * ECHO.petals))
}

// ─── Stair Weave ─────────────────────────────────────────────────────────

export const STAIR_N = 3
/** 0 up, 1 right, 2 down, 3 left. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]]
export type StairPuzzle = { arrows: number[]; start: number; goal: number }

const cellAt = (x: number, y: number) => y * STAIR_N + x

/** Follow the arrows from the start. `true` if they lead to the goal without leaving the grid or looping. */
export function stairSolved(p: StairPuzzle): boolean {
  const seen = new Set<number>()
  let at = p.start
  while (!seen.has(at)) {
    if (at === p.goal) return true
    seen.add(at)
    const [dx, dy] = DIRS[p.arrows[at]!]!
    const x = (at % STAIR_N) + dx
    const y = Math.floor(at / STAIR_N) + dy
    if (x < 0 || y < 0 || x >= STAIR_N || y >= STAIR_N) return false
    at = cellAt(x, y)
  }
  return false
}

export const rotateStair = (p: StairPuzzle, cell: number): StairPuzzle => ({ ...p, arrows: p.arrows.map((a, i) => (i === cell ? (a + 1) % 4 : a)) })

/**
 * Walk a random way from the top-left to the bottom-right, point every step on it at the next, fill the rest with
 * random arrows, then turn the stairs on the way until it no longer works. Always solvable, never solved at the start.
 * `par` is the fewest turns that fix it (each stair on the way needs (4 - turned) % 4).
 */
export function stairPuzzle(seed: number): StairPuzzle & { par: number } {
  const r = rng(seed)
  for (let attempt = 0; attempt < 50; attempt++) {
    const arrows = Array.from({ length: STAIR_N * STAIR_N }, () => Math.floor(r() * 4))
    const way = [0]
    const used = new Set([0])
    let at = 0
    while (at !== STAIR_N * STAIR_N - 1) {
      const options = DIRS.map((d, dir) => ({ dir, x: (at % STAIR_N) + d[0], y: Math.floor(at / STAIR_N) + d[1] })).filter(
        (o) => o.x >= 0 && o.y >= 0 && o.x < STAIR_N && o.y < STAIR_N && !used.has(cellAt(o.x, o.y)),
      )
      if (!options.length) break
      // lean toward the goal so the way is short enough to be fun
      const toward = options.filter((o) => o.dir === 1 || o.dir === 2)
      const pool = toward.length && r() < 0.75 ? toward : options
      const pick = pool[Math.floor(r() * pool.length)]!
      arrows[at] = pick.dir
      at = cellAt(pick.x, pick.y)
      used.add(at)
      way.push(at)
    }
    if (at !== STAIR_N * STAIR_N - 1 || way.length < 4) continue
    const solved: StairPuzzle = { arrows: [...arrows], start: 0, goal: STAIR_N * STAIR_N - 1 }
    let par = 0
    const scrambled = [...arrows]
    for (const cell of way.slice(0, -1)) {
      const turns = 1 + Math.floor(r() * 3)
      scrambled[cell] = (arrows[cell]! + turns) % 4
      par += 4 - turns
    }
    const puzzle = { ...solved, arrows: scrambled }
    if (!stairSolved(puzzle)) return { ...puzzle, par }
  }
  return { arrows: [1, 2, 0, 0, 1, 2, 0, 0, 0], start: 0, goal: 8, par: 3 }
}

export const stairGrade = (turns: number, par: number): 0 | 1 | 2 => (turns <= par ? 2 : turns <= par + 3 ? 1 : 0)

/** What a mini game pays, by grade. Items are ids from `items.ts`. */
export const REWARDS: Record<MinigameId, Array<{ item?: [string, number]; buttons: number }>> = {
  glade: [{ buttons: 0 }, { item: ["firefly", 2], buttons: 3 }, { item: ["firefly", 4], buttons: 8 }],
  falls: [{ buttons: 0 }, { item: ["dewgem", 1], buttons: 4 }, { item: ["dewgem", 2], buttons: 9 }],
  echo: [{ buttons: 0 }, { item: ["echopetal", 1], buttons: 4 }, { item: ["echopetal", 2], buttons: 9 }],
  stairs: [{ buttons: 0 }, { item: ["stairchip", 1], buttons: 4 }, { item: ["stairchip", 2], buttons: 9 }],
}
