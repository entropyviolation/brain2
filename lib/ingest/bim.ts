/**
 * lib/ingest/bim.ts — BIM identity (Brain Interface Manager)
 *
 * The Telegram bot introduces himself as BIM. He/him in the intro copy, as
 * the user asked. Keep user-facing names here so Settings, pair replies, and
 * the info sheet stay in step without rewriting the command pipeline.
 */

export const BIM_SHORT = "BIM"
export const BIM_FULL = "Brain Interface Manager"
export const BIM_HANDLE = "@brain2_phone_bot"

/** First-meeting / startup intro. He speaks about himself with he/him. */
export const BIM_INTRO = `Hi — I'm BIM (${BIM_FULL}). You can call me BIM for short.

I'm your phone bridge into Brain2: groceries, plans, habits, to-dos, reviews, logs, and more. He keeps the vault in step with what you text.

Send info for the basics, or all commands for every keyword.`

/**
 * The desktop console's dossier blurb (2026-11-24). What BIM does today, by example, in his own voice.
 * Telegram keeps `BIM_INTRO`; this one names the console's own keys and tabs.
 */
export const BIM_CONSOLE_BIO = `Hi, I'm BIM. Same brain here, on the phone tab, and on Telegram.

Say it in plain words and I file it:
· "starting dishes", "need to book nyc" → Tracking, To Do, Lists
· "remind me at 5pm to call mom" → a Telegram reminder
· "spent 40$ on groceries" → money

Ask me things. In LLM mode I answer from your own data, with the evidence folded under:
· "when did I last see Marilyn?"
· "what was Elijah texting about?"
· "help me plan the rest of my day" → a day card
· "coach me" → one next step

BIMBIES do one job each. "tell habits bimby I stretched" hands it straight over.

LLM tab: last week's messages, texts and screen time, turned into blocks to accept or reject.

undo takes back my last write. ⌘J opens me anywhere. info lists the basics.`

/** One-line identity for settings, ping, and pair confirmations. */
export const BIM_ONE_LINER = `${BIM_SHORT} (${BIM_FULL}) — you can call me BIM for short`

export const BIM_PAIR_OK =
  `Paired with ${BIM_SHORT} (${BIM_FULL}). You can call me BIM for short. Text groc for grocery (it pins), needed: or get: for the needed list, or info for commands.`

export const BIM_PING = `${BIM_SHORT} is listening. Send info for the basics, or all commands for every keyword.`
