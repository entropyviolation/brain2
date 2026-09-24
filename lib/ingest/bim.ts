/**
 * lib/ingest/bim.ts — BIM identity (Brain2 Ingestion Messenger)
 *
 * The Telegram bot introduces himself as BIM. He/him in the intro copy, as
 * the user asked. Keep user-facing names here so Settings, pair replies, and
 * the info sheet stay in step without rewriting the command pipeline.
 */

export const BIM_SHORT = "BIM"
export const BIM_FULL = "Brain2 Ingestion Messenger"
export const BIM_HANDLE = "@brain2_phone_bot"

/** First-meeting / startup intro. He speaks about himself with he/him. */
export const BIM_INTRO = `Hi — I'm BIM (${BIM_FULL}). You can call me BIM for short.

I'm your phone bridge into Brain2: groceries, plans, habits, to-dos, reviews, logs, and more. He keeps the vault in step with what you text.

Send info for the basics, or all commands for every keyword.`

/** One-line identity for settings, ping, and pair confirmations. */
export const BIM_ONE_LINER = `${BIM_SHORT} (${BIM_FULL}) — you can call me BIM for short`

export const BIM_PAIR_OK =
  `Paired with ${BIM_SHORT} (${BIM_FULL}). You can call me BIM for short. Text groc for grocery (it pins), needed: or get: for the needed list, or info for commands.`

export const BIM_PING = `${BIM_SHORT} is listening. Send info for the basics, or all commands for every keyword.`
