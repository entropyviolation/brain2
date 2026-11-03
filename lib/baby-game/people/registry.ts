/**
 * lib/baby-game/people/registry.ts — where drawn people plug into the sprite pipeline
 *
 * `sprites.ts` owns the palette and the letter grids; people need colors it has never heard of (every shirt is its own
 * color) and poses the generic walk and idle passes cannot make (swinging arms, a wave). This file imports nothing, so
 * both sides can reach it without a cycle. `paletteSink` is set by `sprites.ts`; `poseSources` is filled by `player.ts`.
 */

export type View = "front" | "side" | "back"

/** A hand-drawn pose for one body, or `null` when the pose does not apply (the caller falls back to the still). */
export type PoseSource = (view: View, pose: string) => string[] | null

export const paletteSink: { target: Record<string, string> | null } = { target: null }
export const poseSources = new Map<string, PoseSource>()
