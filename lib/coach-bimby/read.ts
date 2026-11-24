/**
 * lib/coach-bimby/read.ts — The Coach BIMBY's shapes, read in code (pure)
 *
 *   about me   "remember that I hate mornings", "about me: I'm a designer", "my goal is to run a marathon",
 *              "my goals are a, b and c", "one of my goals is …", "I'm working toward …"         → a note
 *   ask        "what do you know about me?", "who am I?", "what are my goals?"                      → the notes
 *   forget     "forget that I hate mornings", "forget about the marathon"                          → a note removed
 *   coach      "coach me", "what should I do now?", "help me focus", "morning brief", "check in"    → the coach
 *   prefs      "morning brief at 8am", "evening check-in at 10pm", "stop the morning brief",
 *              "turn off coach texts"                                                             → the switches
 *   remind     "remind me at 5pm to call mom", "remind me to call mom in 2 hours",
 *              "remind me tomorrow at 9 to pay rent", "remind me every day at 8am to stretch"     → a Reminder
 *
 * No stores, no models. `apply.ts` does the writing.
 */

import { dropGreeting } from "@/lib/ingest/greeting"
import { parseClockToken } from "@/lib/ingest/times"
import type { RecurringReminderRepeat } from "@/lib/reminders"
import type { MeKind } from "./me-store"

// ---------------------------------------------------------------- about me

export interface AboutMe {
  kind: MeKind
  texts: string[]
}

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s,:;-]+|[\s,.!;]+$/g, "").trim()

/** "a, b and c" → [a, b, c]. */
function splitList(s: string): string[] {
  return s
    .split(/\s*(?:,|;|\band\b|\balso\b)\s*/i)
    .map(clean)
    .filter((x) => x.length >= 2)
}

/** What a first-person sentence is about, by its words. */
export function kindOf(text: string): MeKind {
  const t = text.toLowerCase()
  if (/\b(goal|aim|working (?:on|to(?:ward)?s?)|trying to|want to (?:become|be|get|learn|build|start|finish|launch|make|save|run|move)|dream)\b/.test(t)) return "goal"
  if (/\b(need|have to|must|should)\b/.test(t)) return "need"
  if (/\b(hate|can'?t stand|dislike|don'?t like|not a fan|allergic)\b/.test(t)) return "dislike"
  if (/\b(love|like|enjoy|favorite|favourite|into)\b/.test(t)) return "like"
  if (/\b(want|wish|hope)\b/.test(t)) return "want"
  if (/\bmy (?:mom|mum|dad|mother|father|sister|brother|partner|boyfriend|girlfriend|husband|wife|friend|best friend|son|daughter|boss|roommate|therapist|cat|dog)\b/.test(t)) return "person"
  if (/\b(i am|i'm|im|i was born|i live|i work|my job|my name)\b/.test(t)) return "who"
  return "note"
}

/** "I hate mornings" → "I hate mornings"; "that im a designer" → "I'm a designer". First person kept, tidied. */
function firstPerson(s: string): string {
  return clean(s)
    .replace(/^that\s+/i, "")
    .replace(/^im\b/i, "I'm")
    .replace(/^i\b/, "I")
}

const ABOUT_LEAD = /^(?:about me|fyi about me|for the record|a thing about me|something about me)\s*[:,-]\s*(.{3,300})$/i
/** "remember that I …" / "remember my …" / "keep in mind I …": only about the person, so the fact lane keeps the rest. "Don't forget my keys" is the keep lane's To Do. */
const REMEMBER_ME = /^(?:please\s+)?(?:remember|keep in mind|note|know|never forget)(?:\s+that)?[:,]?\s+((?:i|i'm|im|i've|ive|i'd|my)\b.{2,300})$/i
const GOALS = /^(?:(?:one of )?my\s+(?:(?:big|main|long[- ]term|short[- ]term|life|biggest|top|new|current|real)\s+)*(goals?|dreams?|aims?|priorit(?:y|ies)|focus)(?:\s+(?:this|for (?:this|the|next))\s+(?:week|month|year))?\s+(?:is|are|=|:)\s*(?:to\s+)?)(.{2,300})$/i
const WORKING = /^i(?:'m| am|m)\s+(?:working (?:toward|towards|on)|trying to|aiming to)\s+(.{3,300})$/i

/** A line that tells BIM something lasting about you. Null when it is not one of the shapes. */
export function parseAboutMe(raw: string): AboutMe | null {
  const text = dropGreeting(raw.replace(/\s+/g, " ").trim())
  if (!text || /\?\s*$/.test(text) || text.length > 320) return null
  const goals = GOALS.exec(text)
  if (goals) {
    const items = splitList(goals[2]!)
    const plural = /s$|ies$/i.test(goals[1]!)
    const texts = (plural ? items : [clean(goals[2]!)]).map((g) => g.replace(/^to\s+/i, ""))
    const label = /^dream/i.test(goals[1]!) ? "want" : /^priorit|^focus/i.test(goals[1]!) ? "goal" : "goal"
    return texts.length ? { kind: label, texts } : null
  }
  const working = WORKING.exec(text)
  if (working) return { kind: "goal", texts: [clean(working[1]!)] }
  const lead = ABOUT_LEAD.exec(text)
  if (lead) {
    const body = firstPerson(lead[1]!)
    return { kind: kindOf(body), texts: [body] }
  }
  const me = REMEMBER_ME.exec(text)
  if (me) {
    const body = firstPerson(me[1]!)
    return { kind: kindOf(body), texts: [body] }
  }
  return null
}

// ---------------------------------------------------------------- questions and forget

export type MeAsk = "all" | "goals"

export function parseMeAsk(raw: string): MeAsk | null {
  const t = dropGreeting(raw.trim()).toLowerCase().replace(/[?.!]+$/, "")
  if (/^(?:what|wat|wht)(?:'s| is| are)? my (?:goals?|aims?|priorities|dreams?)(?: again)?$|^(?:list|show|tell me)(?: me)? my (?:goals?|priorities)$|^remind me (?:of|what) my goals(?: are)?$/.test(t)) return "goals"
  if (/^(?:what do you (?:know|remember)(?: about me)?|who am i|what have you learned about me|tell me (?:about me|what you know about me)|what do you know of me|do you know me|how well do you know me|show (?:me )?(?:what you know|my memory|your memory of me))$/.test(t)) return "all"
  return null
}

const FORGET_STOP = new Set(["the", "that", "this", "and", "about", "what", "one", "last", "thing", "said", "you", "your", "with", "for", "from", "was", "are", "its", "it's", "i'm", "im", "have", "has", "had", "not", "but", "all"])
/** The words a forget is matched on: content words only, so "the" and "that" never pick a note. */
export function forgetWords(what: string): string[] {
  return what.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 2 && !FORGET_STOP.has(w))
}

/** "forget that I hate mornings" → "I hate mornings". Null when the line is not a forget. */
export function parseForget(raw: string): string | null {
  const m = /^(?:please\s+)?(?:forget|stop remembering|delete|remove|drop)(?:\s+(?:that|about|the (?:note|fact|thing)(?: that)?|what i said about))?\s+(.{3,200})$/i.exec(dropGreeting(raw.trim()))
  if (!m) return null
  const what = clean(m[1]!)
  // "delete that", "remove the last one": an undo, not a note. A forget names what it drops.
  if (!forgetWords(what).length || /^(?:that|this|it|them|those|these|everything|all(?: of it)?|(?:the )?last(?: one| thing| line)?)$/i.test(what)) return null
  // "delete the last log", "remove milk from groceries": those are other lanes' commands.
  if (/\b(?:from|log|item|list|task|to ?do|reminder|habit|grocer)/i.test(what)) return null
  return what
}

// ---------------------------------------------------------------- coach

export type CoachAsk = "now" | "morning" | "evening" | "goals-check"

export function parseCoachAsk(raw: string): CoachAsk | null {
  const t = raw.trim().toLowerCase().replace(/[?.!]+$/, "").replace(/\s+/g, " ")
  if (/^(?:morning brief|brief me|my brief|give me (?:my|the) (?:morning )?brief|plan my morning|good morning bim|gm bim)$/.test(t)) return "morning"
  if (/^(?:evening check[- ]?in|check in with me|night check[- ]?in|end of day (?:check[- ]?in|review)|how did (?:i|today) go|review my day)$/.test(t)) return "evening"
  if (/^(?:how am i doing(?: on my goals| with my goals)?|am i on track(?: with my goals)?|goal check|check my goals)$/.test(t)) return "goals-check"
  if (
    /^(?:coach me|be my coach|life coach me|help me focus|help me prioriti[sz]e|keep me on track|motivate me|i need motivation|i need a push|what should i (?:do|work on|focus on|tackle)(?: (?:now|next|today|right now|first|tonight))?|what(?:'s| is) next|what now|where should i start|what do i do now|what's most important(?: (?:now|today))?)$/.test(
      t,
    )
  )
    return "now"
  return null
}

export interface CoachPrefsPatch {
  patch: { on?: boolean; morning?: string; evening?: string; morningOn?: boolean; eveningOn?: boolean }
  said: string
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

/** Switches for the Telegram brief and check-in. */
export function parseCoachPrefs(raw: string): CoachPrefsPatch | null {
  const t = raw.trim().toLowerCase().replace(/[.!]+$/, "").replace(/\s+/g, " ")
  const which = (s: string): "morning" | "evening" | null => (/morning|brief|gm\b/.test(s) ? "morning" : /evening|night|check[- ]?in/.test(s) ? "evening" : null)
  const at = /^(?:(?:send|text|do|set)(?: me)?(?: the| my)? )?(morning brief|brief|evening check[- ]?in|night check[- ]?in|check[- ]?in)s?(?: to| for)? (?:at|@) (.+)$/.exec(t)
  if (at) {
    const w = which(at[1]!)
    const min = parseClockToken(at[2]!.replace(/\s+/g, ""), w === "evening" ? "pm" : "am")
    if (!w || min == null) return null
    return w === "morning"
      ? { patch: { morning: hhmm(min), morningOn: true, on: true }, said: `Morning brief at ${hhmm(min)}.` }
      : { patch: { evening: hhmm(min), eveningOn: true, on: true }, said: `Evening check-in at ${hhmm(min)}.` }
  }
  const off = /^(?:stop|turn off|pause|no more|disable|mute)(?: the| my| sending)? (morning briefs?|briefs?|evening check[- ]?ins?|night check[- ]?ins?|check[- ]?ins?|coach(?:ing)?(?: texts| messages)?|life coach(?:ing)?)$/.exec(t)
  if (off) {
    const w = /coach/.test(off[1]!) ? null : which(off[1]!)
    if (!w) return { patch: { on: false }, said: "Coach texts are off. “Turn on coach texts” brings them back." }
    return w === "morning" ? { patch: { morningOn: false }, said: "No more morning brief." } : { patch: { eveningOn: false }, said: "No more evening check-in." }
  }
  const on = /^(?:start|turn on|resume|enable|unmute)(?: the| my| sending)? (morning briefs?|briefs?|evening check[- ]?ins?|night check[- ]?ins?|check[- ]?ins?|coach(?:ing)?(?: texts| messages)?|life coach(?:ing)?)$/.exec(t)
  if (on) {
    const w = /coach/.test(on[1]!) ? null : which(on[1]!)
    if (!w) return { patch: { on: true }, said: "Coach texts are on: a morning brief and an evening check-in on Telegram." }
    return w === "morning" ? { patch: { morningOn: true, on: true }, said: "Morning brief is on." } : { patch: { eveningOn: true, on: true }, said: "Evening check-in is on." }
  }
  return null
}

// ---------------------------------------------------------------- timed reminders

export interface TimedReminder {
  what: string
  when: Date
  repeat: "once" | RecurringReminderRepeat
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DAY_RE = "(?:sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?"
const CLOCK_RE = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm)?|noon|midnight)`

function dayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3)
  return DAYS.findIndex((d) => d.startsWith(w))
}

/** A bare hour with no am/pm: the next time that hour comes round, read as the nearer of am and pm, within 12 hours. */
function clockMinutes(token: string, now: Date, sameDay: boolean): number | null {
  const tok = token.replace(/\s+/g, "").replace(/\./g, "")
  if (/^(?:noon)$/i.test(tok)) return 12 * 60
  if (/^(?:midnight)$/i.test(tok)) return 0
  if (/[ap]m$/i.test(tok)) return parseClockToken(tok)
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(tok)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  if (h >= 13 || h === 0) return h * 60 + min
  if (!sameDay) return (h === 12 ? 12 : h < 7 ? h + 12 : h) * 60 + min
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const am = (h % 12) * 60 + min
  const pm = am + 12 * 60
  if (am > nowMin) return am
  if (pm > nowMin) return pm
  // Both gone today: the next day's reading, as for "tomorrow at 4" (16:00), so "at 12" is noon, not midnight.
  return (h === 12 ? 12 : h < 7 ? h + 12 : h) * 60 + min
}

/** The "when" part of a reminder, read against `now`. */
export function parseReminderWhenWords(raw: string, now: Date): { when: Date; repeat: TimedReminder["repeat"] } | null {
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim()
  // in 20 minutes / in an hour / in 2 hrs / in 3 days
  const rel = /^in (\d+(?:\.\d+)?|an?|a few|half an?) ?(min(?:ute)?s?|h(?:ou)?rs?|hours?|days?|weeks?)$/.exec(s)
  if (rel) {
    const n = rel[1] === "a" || rel[1] === "an" ? 1 : rel[1] === "a few" ? 3 : /^half/.test(rel[1]!) ? 0.5 : Number(rel[1])
    const unit = rel[2]!
    const ms = /^m/.test(unit) ? 60_000 : /^h/.test(unit) ? 3_600_000 : /^d/.test(unit) ? 86_400_000 : 7 * 86_400_000
    const when = new Date(now.getTime() + n * ms)
    when.setSeconds(0, 0)
    return { when, repeat: "once" }
  }
  const halfHour = /^in half an? hour$/.test(s)
  if (halfHour) return { when: new Date(now.getTime() + 30 * 60_000), repeat: "once" }

  // every day / every morning / every weekday / every monday / daily, with an optional clock
  const every = new RegExp(`^(?:every ?(day|morning|night|evening|weekday|week|month|${DAY_RE})|daily|weekly|each (day|morning|night))(?: (?:at|@) (${CLOCK_RE}))?$`).exec(s)
  const everyClockFirst = new RegExp(`^(?:at |@ )?(${CLOCK_RE}) (?:every ?(day|morning|night|evening|weekday|week|month|${DAY_RE})|daily|weekly|each (day|morning|night))$`).exec(s)
  if (every || everyClockFirst) {
    const unit = (every ? every[1] ?? every[2] : everyClockFirst![2] ?? everyClockFirst![3]) ?? (/weekly/.test(s) ? "week" : "day")
    const clockTok = every ? every[3] : everyClockFirst![1]
    const defaultMin = /morning/.test(unit) ? 9 * 60 : /night|evening/.test(unit) ? 21 * 60 : 9 * 60
    const min = clockTok ? clockMinutes(clockTok, now, false) : defaultMin
    if (min == null) return null
    const repeat: TimedReminder["repeat"] = /weekday/.test(unit) ? "weekdays" : /^week$/.test(unit) ? "weekly" : /^month$/.test(unit) ? "monthly" : dayIndex(unit) >= 0 && !/^(?:day|morning|night|evening)$/.test(unit) ? "weekly" : "daily"
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(min / 60), min % 60, 0, 0)
    const di = dayIndex(unit)
    if (repeat === "weekly" && di >= 0 && !/^(?:day|morning|night|evening|week)$/.test(unit)) {
      while (when.getDay() !== di || when.getTime() <= now.getTime()) when.setDate(when.getDate() + 1)
    } else {
      while (when.getTime() <= now.getTime() || (repeat === "weekdays" && (when.getDay() === 0 || when.getDay() === 6))) when.setDate(when.getDate() + 1)
    }
    return { when, repeat }
  }

  // [today|tonight|tomorrow|on friday|friday] [morning|afternoon|evening|night] [at 5pm] — in either order
  const day = new RegExp(`(?:^|\\s)(today|tonight|tomorrow|tmrw|tmr|(?:on |this |next )?${DAY_RE})(?: (morning|afternoon|evening|night))?(?=\\s|$)`).exec(s)
  const clock = new RegExp(`(?:^|\\s)(?:at |@ |by )?(${CLOCK_RE})(?=\\s|$)`).exec(day ? s.replace(day[0], " ") : s)
  const part = day?.[2] ?? (/(?:^|\s)(morning|afternoon|evening|tonight|night)$/.exec(s)?.[1])
  const leftover = s
    .replace(day?.[0] ?? "", " ")
    .replace(clock?.[0] ?? "", " ")
    .replace(/\b(?:at|@|by|on|this|the|in the)\b/g, " ")
    .replace(/\b(?:morning|afternoon|evening|night)\b/g, " ")
    .trim()
  if (leftover) return null
  if (!day && !clock && !part) return null
  // A clock alone must look like a clock: "at 5", "5pm", "17:30" — never a bare "5" with no "at".
  if (clock && !day && !/(?:at|@|by)\s/.test(clock[0]) && !/[ap]\.?m|:|noon|midnight/.test(clock[1]!)) return null
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let sameDay = true
  if (day) {
    const d = day[1]!.replace(/^(?:on|this|next) /, "")
    if (d === "tonight") {
      /* today */
    } else if (/^(?:tomorrow|tmrw|tmr)$/.test(d)) {
      base.setDate(base.getDate() + 1)
      sameDay = false
    } else if (d !== "today") {
      const di = dayIndex(d)
      if (di < 0) return null
      base.setDate(base.getDate() + 1)
      while (base.getDay() !== di) base.setDate(base.getDate() + 1)
      if (/^next /.test(day[1]!) && base.getTime() - now.getTime() < 7 * 86_400_000 - 86_400_000) {
        /* "next friday" is the coming one, as people mostly mean it */
      }
      sameDay = false
    }
  }
  const partMin = part === "morning" ? 9 * 60 : part === "afternoon" ? 14 * 60 : part === "evening" ? 19 * 60 : part === "night" || part === "tonight" || day?.[1] === "tonight" ? 21 * 60 : null
  let min = clock ? clockMinutes(clock[1]!, now, sameDay && !part) : partMin
  if (min == null) min = 9 * 60
  // "tonight at 9" / "evening at 7": a bare hour is pm.
  if (clock && (part === "evening" || part === "night" || part === "afternoon" || day?.[1] === "tonight") && min < 12 * 60 && !/am/.test(clock[1]!)) min += 12 * 60
  const when = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(min / 60), min % 60, 0, 0)
  // A clock already past today, with no day named: tomorrow.
  if (!day && when.getTime() <= now.getTime()) when.setDate(when.getDate() + 1)
  if (when.getTime() <= now.getTime()) return null
  return { when, repeat: "once" }
}

const WHEN_TAIL = new RegExp(
  String.raw`\s+((?:in\s+(?:\d+(?:\.\d+)?|an?|a few|half an?)\s?\w+)|(?:every\s?\S+|daily|weekly|each \S+)(?:\s+(?:at|@)\s+${CLOCK_RE})?|(?:(?:at|@|by)\s+${CLOCK_RE}(?:\s+(?:every\s?\S+|daily|weekly))?)|(?:(?:today|tonight|tomorrow|tmrw|tmr|(?:on\s+|this\s+|next\s+)?${DAY_RE})(?:\s+(?:morning|afternoon|evening|night))?(?:\s+(?:at|@|by)\s+${CLOCK_RE})?)|(?:(?:at|@)\s+${CLOCK_RE}\s+(?:today|tonight|tomorrow|(?:on\s+)?${DAY_RE})))$`,
  "i",
)
const WHEN_HEAD = new RegExp(
  String.raw`^((?:in\s+(?:\d+(?:\.\d+)?|an?|a few|half an?)\s?\w+)|(?:every\s?\S+|daily|weekly|each \S+)(?:\s+(?:at|@)\s+${CLOCK_RE})?|(?:(?:at|@)\s+${CLOCK_RE}(?:\s+(?:today|tonight|tomorrow|every\s?\S+|daily|(?:on\s+)?${DAY_RE}))?)|(?:(?:today|tonight|tomorrow|tmrw|tmr|(?:on\s+|this\s+|next\s+)?${DAY_RE})(?:\s+(?:morning|afternoon|evening|night))?(?:\s+(?:at|@)\s+${CLOCK_RE})?))\s+(?:to\s+|that\s+|about\s+)?`,
  "i",
)

/**
 * "remind me at 5pm to call mom" → call mom at 17:00 today. "text me tomorrow at 9 to pay rent", "set a reminder for
 * friday to email Dana", "remind me to stretch every day at 8am". Null when no time can be read (that line is the
 * `keep` lane's To Do) or when the line is a cue ("… if …").
 */
export function parseTimedReminder(raw: string, now: Date): TimedReminder | null {
  const text = raw.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "")
  const lead = /^(?:(?:hey |ok |okay )?(?:bim[, ]+)?)?(?:please\s+|can you\s+|could you\s+)?(?:remind me|text me|ping me|nudge me|set (?:a |me a )?reminder(?: for me)?|add (?:a )?reminder)\s*(?:for\s+|on\s+)?/i.exec(text)
  if (!lead) return null
  let rest = text.slice(lead[0].length).trim().replace(/\?$/, "")
  // A cue ("remind me if I'm …", "… when I get home") is the keep lane's; "ask when the store opens" is not a cue.
  if (!rest || /\b(?:if|when(?:ever)?)\b/i.test(rest.replace(/\b(?:ask|check|see|find out|figure out|know|wonder|tell \w+)\s+(?:if|when)\b/gi, " "))) return null
  let whenWords: string | null = null
  const head = WHEN_HEAD.exec(rest)
  if (head) {
    whenWords = head[1]!
    rest = rest.slice(head[0].length)
  } else {
    rest = rest.replace(/^(?:to|that|about)\s+/i, "")
    const tail = WHEN_TAIL.exec(rest)
    if (!tail) return null
    whenWords = tail[1]!
    rest = rest.slice(0, tail.index)
  }
  // "remind me at 5 to call mom tomorrow": a second time word in what is left.
  const tail2 = WHEN_TAIL.exec(" " + rest)
  if (tail2 && head) {
    whenWords = `${tail2[1]} ${whenWords}`
    rest = (" " + rest).slice(0, tail2.index).trim()
  }
  const what = clean(rest.replace(/^(?:to|that|about)\s+/i, ""))
  if (what.length < 2) return null
  // "go sit in the sun", "the sat results": a bare short day name is a word, not a day.
  if (/^(?:sun|sat|wed|mon)$/i.test(whenWords.trim())) return null
  const when = parseReminderWhenWords(whenWords, now)
  if (!when) return null
  return { what: what[0]!.toUpperCase() + what.slice(1), ...when }
}
