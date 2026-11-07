/**
 * lib/baby-game/letters.ts — The Best Friends BIMBY, model half: a friend's note in their own words, and the gift they think of
 *
 * `bestie.ts` posts a scripted letter overnight. `penLetter` asks the model to write it again as that friend would, from
 * everything they know: their memories, what they have read, and what C has told them. For a gift letter the model is given two
 * **tools** to call, as one closed answer:
 *   - `give_item(item)`: pick something that already exists (checked against `ITEMS`; a keepsake or Lamp part is refused).
 *   - `invent_item(name, description, kind, tags, color)`: dream up something new. The Item Forge (`forge.ts`) turns the description
 *     into the best item it can, and it is kept in the save.
 * Anything else, or no model, keeps the scripted letter and gift. Never throws.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { resident } from "./cast"
import { amendLetter, CALLED, type Letter } from "./bestie"
import { type GameState, hearts } from "./engine"
import { forgeItem, registerCustom } from "./forge"
import { chatSystem } from "./llm"
import { ITEMS, TAGS, type ItemDef } from "./items"

const TOOLS = ["none", "give_item", "invent_item"] as const

const SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", maxLength: 320 },
    tool: { type: "string", enum: [...TOOLS] },
    give_item: { type: "string", maxLength: 40 },
    invent_name: { type: "string", maxLength: 28 },
    invent_description: { type: "string", maxLength: 160 },
    invent_kind: { type: "string", enum: ["material", "trinket"] },
    invent_tags: { type: "array", items: { type: "string", enum: [...TAGS] }, maxItems: 3 },
    invent_color: { type: "string", maxLength: 16 },
  },
  required: ["text", "tool"],
}

const KIND_HINT: Record<Letter["kind"], string> = {
  question: `Write a short note to ${CALLED} that asks one new question about themselves. Start from what you already know of them.`,
  reading: `Write a short note to ${CALLED} telling them what you have been reading and what it made you think, and what else you would like to read next. Thank them for bringing you books.`,
  note: `Write a very short note to ${CALLED} just because you were thinking of them.`,
  gift: `Write a short note to ${CALLED} to go with a gift you have thought of for them, from what you remember about them. Then call a tool: give_item with the id of an existing item, or invent_item to dream up something new that fits them. The gift should say "I listened".`,
}

const giftable = () =>
  Object.values(ITEMS)
    .filter((d) => (d.kind === "material" || d.kind === "trinket") && !d.id.startsWith("shell-"))
    .map((d) => `${d.id} (${d.name})`)
    .join(", ")

export type LetterPatch = { text: string; gift?: string; made?: ItemDef }

/** Put a patch onto the letter in the current state, and keep any invented item in the save. Safe if the letter was already picked up. */
export function applyLetterPatch(s: GameState, letterId: string, p: LetterPatch): GameState {
  const base = p.made ? { ...s, custom: { ...(s.custom ?? {}), [p.made.id]: p.made } } : s
  if (p.made) registerCustom({ [p.made.id]: p.made })
  return amendLetter(base, letterId, { text: p.text, by: "model", ...(p.gift ? { gift: p.gift } : {}) })
}

/** The friend's own words for a posted letter, and (for a gift letter) the gift they chose or invented. Null keeps the script. Never throws. */
export async function penLetter(s: GameState, letter: Letter, call: ModelCall | null): Promise<LetterPatch | null> {
  const r = resident(letter.from)
  if (!call || !r) return null
  try {
    const raw = (await call({
      system: [
        chatSystem(r, s, hearts(s, r.id)),
        KIND_HINT[letter.kind],
        "At most three short sentences, in your own voice. Never say you are an AI. Never promise anything you cannot give.",
        letter.kind === "gift" ? `Items you may give: ${giftable()}.` : "tool must be none.",
      ].join("\n"),
      user: `Your first draft: "${letter.text}"`,
      schema: SCHEMA,
      maxTokens: 320,
    })) as Record<string, unknown> | null
    const text = typeof raw?.text === "string" ? raw.text.trim().replace(/^"|"$/g, "").slice(0, 360) : ""
    if (!text) return null
    const patch: LetterPatch = { text }
    if (letter.kind !== "gift") return patch
    if (raw!.tool === "give_item" && typeof raw!.give_item === "string") {
      const d = ITEMS[raw!.give_item]
      if (d && (d.kind === "material" || d.kind === "trinket") && d.id !== "gem") patch.gift = d.id
    } else if (raw!.tool === "invent_item" && typeof raw!.invent_name === "string") {
      const id = `gift-${letter.id}`
      const { def } = await forgeItem(
        { name: raw!.invent_name, description: String(raw!.invent_description ?? ""), kind: String(raw!.invent_kind ?? ""), tags: Array.isArray(raw!.invent_tags) ? (raw!.invent_tags as string[]) : [], color: String(raw!.invent_color ?? "") },
        id,
        call,
      )
      patch.gift = id
      patch.made = def
    }
    return patch
  } catch {
    return null
  }
}
