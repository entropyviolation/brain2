/**
 * lib/baby-game/gens.ts — The ComfyUI generation log, for the Baby animal game's art
 *
 * Types for what `/api/baby-gens` returns (`scripts/baby-gens-api.mjs`), plus the boards that turn likes into a
 * verdict on setups: which checkpoint, LoRA and strength, cfg and sampler keep winning. Liked setups are the seed of
 * the recipes the game's own generation BIMBY will fill later (`docs/BABY_GAME_REDESIGN.md`, _Image model road_).
 */

export type GenLora = { name: string; model: number | null; clip: number | null }

export type GenRecipe = {
  checkpoint: string | null
  loras: GenLora[]
  positive: string
  negative: string
  seed: number | null
  steps: number | null
  cfg: number | null
  sampler: string | null
  scheduler: string | null
  denoise: number | null
  width: number | null
  height: number | null
  batch: number | null
  nodes: number
}

export type Gen = { file: string; at: number; bytes: number; recipe: GenRecipe | null; workflowNotes: string[] }

export type GenVerdict = "like" | "nope"
export type GenKind = "character" | "prop" | "tile" | "other"
export type GenNote = { verdict: GenVerdict | null; kind: GenKind | null; text: string; tags: string[]; at: number }
export type GenNotes = Record<string, GenNote>
export type GenPatch = Partial<Pick<GenNote, "verdict" | "kind" | "text" | "tags">>

export const GEN_KIND_LABEL: Record<GenKind, string> = { character: "Character", prop: "Prop", tile: "Tile", other: "Other" }

export const stripExt = (name: string) => name.replace(/\.safetensors$|\.ckpt$|\.pt$/i, "")

const strength = (n: number | null) => (n == null ? "?" : String(Math.round(n * 100) / 100))

/** The LoRAs as one short line, `pixel-art-xl 1.2`. */
export const loraLine = (r: GenRecipe | null) => (r?.loras.length ? r.loras.map((l) => `${stripExt(l.name)} ${strength(l.model)}`).join(" + ") : "no LoRA")

/** What a setup is, without the prompt and seed: the knobs a recipe would fix. */
export function setupKey(r: GenRecipe | null): string {
  if (!r) return "no recipe"
  const parts = [stripExt(r.checkpoint ?? "?"), loraLine(r)]
  if (r.cfg != null) parts.push(`cfg ${r.cfg}`)
  if (r.sampler) parts.push(`${r.sampler}${r.scheduler && r.scheduler !== "normal" ? `/${r.scheduler}` : ""}`)
  if (r.steps != null) parts.push(`${r.steps} steps`)
  return parts.join(" · ")
}

export type BoardRow = { key: string; total: number; liked: number; nope: number; rated: number; files: string[] }

function board(gens: Gen[], notes: GenNotes, keysOf: (g: Gen) => string[]): BoardRow[] {
  const rows = new Map<string, BoardRow>()
  for (const g of gens) {
    const v = notes[g.file]?.verdict ?? null
    for (const key of keysOf(g)) {
      const row = rows.get(key) ?? { key, total: 0, liked: 0, nope: 0, rated: 0, files: [] }
      row.total++
      row.files.push(g.file)
      if (v === "like") row.liked++
      if (v === "nope") row.nope++
      if (v) row.rated++
      rows.set(key, row)
    }
  }
  return [...rows.values()].sort((a, b) => likeScore(b) - likeScore(a) || b.liked - a.liked || b.total - a.total || a.key.localeCompare(b.key))
}

/**
 * Likes with a prior of one like and one nope, so one lucky image does not top ten good ones:
 * (liked + 1) / (rated + 2). Unrated setups sit at one half.
 */
export const likeScore = (r: Pick<BoardRow, "liked" | "rated">) => (r.liked + 1) / (r.rated + 2)

/** One row per whole setup. */
export const setupBoard = (gens: Gen[], notes: GenNotes) => board(gens, notes, (g) => [setupKey(g.recipe)])

/** One row per LoRA at a strength, and one for no LoRA, so a LoRA used in several setups is judged across all of them. */
export const loraBoard = (gens: Gen[], notes: GenNotes) =>
  board(gens, notes, (g) => (g.recipe?.loras.length ? g.recipe.loras.map((l) => `${stripExt(l.name)} ${strength(l.model)}`) : ["no LoRA"]))

export type GenFilter = "all" | "like" | "nope" | "unrated"

export function filterGens(gens: Gen[], notes: GenNotes, filter: GenFilter, kind: GenKind | "any", setup: string | null): Gen[] {
  return gens.filter((g) => {
    const n = notes[g.file]
    if (filter === "like" && n?.verdict !== "like") return false
    if (filter === "nope" && n?.verdict !== "nope") return false
    if (filter === "unrated" && n?.verdict) return false
    if (kind !== "any" && n?.kind !== kind) return false
    if (setup && setupKey(g.recipe) !== setup) return false
    return true
  })
}

/** Tags typed as `cute, too busy` into a clean list. */
export const parseTags = (s: string) => s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
