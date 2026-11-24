/**
 * lib/ingest/greeting.ts — A hello in front of a line, set aside (pure)
 *
 * "hi. Remember that my name is Allie" starts with "hi", so a shape that reads from the start of the line
 * ("remember that …") never saw it, and the line was logged. `dropGreeting` takes off one leading hello or
 * filler word and the mark after it. A shape reads what is left; the rest of BIM still sees the whole line.
 * A line that is only a hello is left as it is.
 */

const HELLO = String.raw`(?:hi+|hey+|hello+|hiya|heya|yo|howdy|sup|gm|good (?:morning|afternoon|evening)|morning|ok(?:ay)?|k|so|um+|uh+|oh|also|btw|alright|hey there|hi there)`
const LEAD = new RegExp(String.raw`^\s*${HELLO}(?:\s+(?:bim|there))?\s*(?:[.,!:;-]+\s*|\s+)(?=\S)`, "i")

/** "hi. remember that …" → "remember that …"; "hey bim, about me: …" → "about me: …". */
export function dropGreeting(text: string): string {
  return text.replace(LEAD, "")
}
