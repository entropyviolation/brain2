/**
 * lib/baby-game/life.ts — The seam where your real life will walk into the story
 *
 * **Planned, not wired.** The game's model voice (`llm.ts`) already accepts an optional `LifeContext`: a few plain sentences
 * about the player's real tasks, habits, and wishes. When it is present, friends may mention them kindly in passing ("you
 * said you wanted to walk more; the orchard is lovely at dusk"), and the diary may. Nothing here reads the app yet: the
 * Baby animal game still never touches tasks, habits, or points. When it does, a BIMBY will turn the real data into this
 * shape, read-only, so the game can only ever *say* things about your life, never change it.
 */

export type LifeContext = {
  /** Open things the player means to do, in their own words. */
  tasks?: string[]
  /** Habits they are building, and how it has been going. */
  habits?: string[]
  /** Things they want, wish for, or are afraid of. */
  wishes?: string[]
}

export const emptyLife: LifeContext = {}

/** One short block for a prompt, or an empty string when there is nothing to say. */
export function lifeBrief(life?: LifeContext): string {
  if (!life) return ""
  const bits = [
    life.tasks?.length ? `Things they mean to do: ${life.tasks.slice(0, 3).join("; ")}.` : "",
    life.habits?.length ? `Habits they are building: ${life.habits.slice(0, 3).join("; ")}.` : "",
    life.wishes?.length ? `What they wish for: ${life.wishes.slice(0, 3).join("; ")}.` : "",
  ].filter(Boolean)
  if (!bits.length) return ""
  return `About the Center of The World's real life (mention at most one thing, only if it fits, and gently; never pressure; never invent more): ${bits.join(" ")}`
}
