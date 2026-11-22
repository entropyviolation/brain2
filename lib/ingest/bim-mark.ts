/**
 * lib/ingest/bim-mark.ts — "mark that …" in BIM chat: log what follows, minus the chatter
 *
 * "lolll mark that i heavily regretted not reading that text" was read by the router as a correction and filed
 * word for word. Here, in code: the laugh and "mark that" go, a leading "I" goes, and "that text" becomes
 * "Shelby's text" when a recent line of yours asked about someone's texts. The rest is sent to the executor as
 * `log: …`, so it files and undoes like any typed log line. Pure: the caller hands in the recent lines and the namer.
 */

const LEAD = /^(?:(?:lo+l+|lmf?ao+|haha+|ha|omg|ok(?:ay)?|ugh|welp|oof)[,!.\s]+)*(?:(?:pls|please|can you|could you)\s+)?(?:mark|note|log|record|jot|write)\s+(?:it\s+)?(?:down\s+)?(?:that|this)\s+(?:down\s+)?/i
const ABOUT_TEXT = /\b(?:that|the|her|his|their|this)\s+(texts?|messages?|dms?)\b/i

export interface MarkRead {
  /** The words to log, cleaned. */
  body: string
  /** The person "that text" was taken to mean, when one was. */
  person?: string
}

/**
 * Read a "mark that …" line. `namedIn` names the person a recent line asked about texts with, newest first;
 * null when none. Null when the line is not a "mark that".
 */
export function readMark(text: string, recent: string[], namedIn: (line: string) => string | null): MarkRead | null {
  const t = text.trim()
  if (!t || t.includes("\n") || /\?\s*$/.test(t)) return null
  const lead = LEAD.exec(t)
  if (!lead) return null
  let body = t.slice(lead[0].length).replace(/^i\s+/i, "").replace(/[.!\s]+$/, "").trim()
  if (body.length < 3) return null
  let person: string | undefined
  if (ABOUT_TEXT.test(body)) {
    for (const line of recent) {
      const who = namedIn(line)
      if (who) {
        person = who
        body = body.replace(ABOUT_TEXT, (_m, what: string) => `${who}'s ${what}`)
        break
      }
    }
  }
  return { body: body[0]!.toUpperCase() + body.slice(1), ...(person ? { person } : {}) }
}
