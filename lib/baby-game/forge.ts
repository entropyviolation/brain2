/**
 * lib/baby-game/forge.ts — The Item Forge BIMBY: from a friend's description to an item you can hold
 *
 * A best friend (`bestie.ts`) may *invent* a gift by calling the `invent_item` tool with a name, a description, a kind of
 * thing, tags and a colour. The model never makes an item directly. This one small process turns the description into the best
 * item it can, in stages, each with a script behind it so it never fails:
 *  1. **Clean** the spec: a short name, a closed list of tags, a colour word mapped to one of the game's tone sets, a value.
 *  2. **Draw.** Ask the model for a few 8×8 pictures in the game's own letters (`k` outline, `L` light, `M` main, `D` dark, `w`
 *     shine, `G` leaf) and score each: all rows legal, a closed outline, a sensible fill, one blob, a lit and a shaded side,
 *     a little symmetry. The best score wins.
 *  3. **Fall back.** If no picture scores well (or no model is up), take the existing shape the description names best
 *     (`nearestShape`), so a "lantern of folded moonlight" still gets a bulb, not a blank.
 * **Planned:** a fourth stage that sends the description to the ComfyUI item graph (`scripts/baby-nature-ref.mts` `items`) and snaps the
 * liked result in place of the 8×8, the way shells and plants are made.
 * Pure but for the model call. Items are kept in the save (`GameState.custom`) and registered into `ITEMS` (`registerCustom`).
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { ITEMS, SHAPES, TAGS, type ItemDef, type ItemKind, type Tag } from "./items"

export type ItemSpec = { name: string; description: string; kind?: string; tags?: string[]; color?: string }

/** Colour words to the game's (light, main, dark) tone letters. No yellow. */
export const COLORS: Record<string, ItemDef["tones"]> = {
  red: ["r", "R", "q"], pink: ["p", "P", "q"], brown: ["t", "T", "u"], green: ["g", "G", "h"], blue: ["b", "B", "n"],
  violet: ["v", "V", "x"], purple: ["v", "V", "x"], white: ["w", "s", "S"], grey: ["s", "S", "d"], gray: ["s", "S", "d"], night: ["A", "z", "y"],
}

const LETTERS = new Set(["k", "L", "M", "D", "w", "G", "."])
const SHAPE_WORDS: Record<string, string[]> = {
  round: ["ball", "orb", "berry", "bead", "pearl", "marble", "bubble"], acorn: ["nut", "seed", "acorn"], stalk: ["stem", "reed", "stick", "flute", "twig"],
  clover: ["leaf", "clover", "herb", "plant"], stone: ["stone", "rock", "pebble", "fossil"], button: ["button", "coin", "token", "disc"],
  shroom: ["mushroom", "cap", "toadstool"], fish: ["fish", "minnow"], shell: ["shell", "conch", "snail"], feather: ["feather", "quill", "wing"],
  jar: ["jar", "bottle", "pot", "potion", "honey"], tube: ["tube", "whistle", "pipe", "scroll", "telescope"], basket: ["basket", "bowl", "nest", "bag"],
  ring: ["ring", "hoop", "wreath", "loop"], gem: ["gem", "crystal", "jewel", "diamond", "star"], bulb: ["lamp", "lantern", "bulb", "light", "glow"],
  pie: ["pie", "cake", "bread", "tart"], bell: ["bell", "chime", "charm"], stack: ["book", "stack", "letter", "pages", "map"], heart: ["heart", "love", "valentine"],
}

/** The existing shape a description names best, `round` when it names none. */
export function nearestShape(text: string): string {
  const low = text.toLowerCase()
  let best = "round", score = 0
  for (const [shape, words] of Object.entries(SHAPE_WORDS)) {
    const n = words.filter((w) => low.includes(w)).length
    if (n > score && SHAPES[shape]) [best, score] = [shape, n]
  }
  return best
}

export function toneOf(color: string | undefined, text: string): ItemDef["tones"] {
  const hay = `${color ?? ""} ${text}`.toLowerCase()
  for (const [word, tones] of Object.entries(COLORS)) if (new RegExp(`\\b${word}\\b`).test(hay)) return tones
  return COLORS.violet!
}

/** How good an 8×8 picture is, 0..1, or 0 when it is not a legal picture at all. */
export function scoreRows(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length !== 8) return 0
  const g = rows.map((r) => (typeof r === "string" ? r : ""))
  if (g.some((r) => r.length !== 8 || [...r].some((ch) => !LETTERS.has(ch)))) return 0
  const cells = g.flatMap((r, y) => [...r].map((ch, x) => ({ ch, x, y }))).filter((c) => c.ch !== ".")
  const fill = cells.length / 64
  if (fill < 0.25 || fill > 0.85) return 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x > 7 || y > 7 ? "." : g[y]![x]!)
  // outline: every filled cell that touches the empty must be an outline cell
  const open = cells.filter((c) => c.ch !== "k" && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(c.x + dx!, c.y + dy!) === ".")).length
  const outline = 1 - Math.min(1, open / Math.max(4, cells.length * 0.25))
  // one blob
  const seen = new Set<number>()
  const stack = [cells[0]!]
  while (stack.length) {
    const c = stack.pop()!
    const k = c.y * 8 + c.x
    if (seen.has(k) || at(c.x, c.y) === ".") continue
    seen.add(k)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) stack.push({ ch: "", x: c.x + dx!, y: c.y + dy! })
  }
  const one = seen.size === cells.length ? 1 : 0.2
  const tones = ["L", "M", "D"].filter((t) => cells.some((c) => c.ch === t)).length / 3
  const mirrored = cells.filter((c) => at(7 - c.x, c.y) !== ".").length / cells.length
  return Math.max(0, 0.35 * outline + 0.25 * one + 0.25 * tones + 0.15 * mirrored)
}

const SCHEMA = {
  type: "object",
  properties: { rows: { type: "array", items: { type: "string", maxLength: 8 }, minItems: 8, maxItems: 8 } },
  required: ["rows"],
}

const DRAW_TRIES = 3
const GOOD_ENOUGH = 0.7

/** Clamp a model's (or anyone's) spec to the closed shape. Never throws. */
export function cleanSpec(spec: ItemSpec): { name: string; description: string; kind: ItemKind; tags: Tag[]; color?: string } {
  const name = String(spec.name ?? "").replace(/[^\p{L}\p{N} '’-]/gu, "").trim().slice(0, 28) || "Little Gift"
  const description = String(spec.description ?? "").trim().slice(0, 160)
  const tags = [...new Set((spec.tags ?? []).map((t) => String(t).toLowerCase()).filter((t): t is Tag => (TAGS as readonly string[]).includes(t)))].slice(0, 3)
  return { name, description, kind: spec.kind === "trinket" ? "trinket" : "material", tags: tags.length ? tags : ["soft"], color: spec.color }
}

/** Make the item. `id` must be unique in the save. Returns the item and how it was drawn. */
export async function forgeItem(spec: ItemSpec, id: string, call: ModelCall | null): Promise<{ def: ItemDef; drawn: "model" | "nearest" }> {
  const c = cleanSpec(spec)
  const tones = toneOf(c.color, `${c.name} ${c.description}`)
  const shape = nearestShape(`${c.name} ${c.description}`)
  const base: ItemDef = { id, name: c.name, kind: c.kind, shape, tones, tags: c.tags, value: c.kind === "trinket" ? 12 : 6, blurb: c.description || c.name }
  if (call) {
    let best: { rows: string[]; score: number } | null = null
    for (let i = 0; i < DRAW_TRIES; i++) {
      try {
        const raw = (await call({
          system: [
            "You draw one tiny item icon on an 8 by 8 grid for a cozy pixel game. Answer with exactly 8 strings of exactly 8 characters.",
            "Letters: k = dark outline, L = light side, M = main color, D = shaded side, w = shine, G = green leaf, . = empty.",
            "Put a closed k outline around one single connected object. Light from the top left. Use L, M and D. Leave empty corners.",
            `Try ${i + 1} of ${DRAW_TRIES}: ${["a plain, centred silhouette", "a more characterful silhouette", "the same idea, simplified"][i]}.`,
          ].join("\n"),
          user: `Draw: ${c.name}. ${c.description}`,
          schema: SCHEMA,
          maxTokens: 160,
        })) as { rows?: unknown } | null
        const score = scoreRows(raw?.rows)
        if (score > (best?.score ?? 0)) best = { rows: raw!.rows as string[], score }
        if (score >= GOOD_ENOUGH) break
      } catch {
        break
      }
    }
    if (best && best.score >= 0.55) return { def: { ...base, rows: best.rows }, drawn: "model" }
  }
  return { def: base, drawn: "nearest" }
}

/** Put an item made in play into `ITEMS`, so `item(id)` knows it. Safe to repeat. */
export function registerCustom(custom: Record<string, ItemDef> | undefined) {
  for (const def of Object.values(custom ?? {})) ITEMS[def.id] = def
}
