/**
 * lib/friend-copy.ts — Short Stardew lines for a friend suggestion
 *
 * Tone × source tables. Never “wee”. Never shame overdue.
 */

import type { FriendDialogEffect, FriendSuggestionSource, FriendTone } from "@/lib/baby-animal-personality"

type LineFn = (title: string) => string

const NEXT_ACTION: Record<FriendTone, LineFn[]> = {
  playful: [
    (title) => `Hey! Maybe do ${title}?`,
    (title) => `${title} would be a good one.`,
    (title) => `Want to try ${title}?`,
  ],
  gentle: [
    (title) => `Whenever you're ready, ${title} is waiting.`,
    (title) => `${title} could be a kind next step.`,
  ],
  direct: [
    (title) => `Next: ${title}.`,
    (title) => `Do ${title}.`,
  ],
  coach: [
    (title) => `Let's take on ${title}.`,
    (title) => `${title} moves the pile. You've got this.`,
  ],
}

const HABIT: Record<FriendTone, LineFn[]> = {
  playful: [
    (title) => `Daily habit time — ${title}?`,
    (title) => `Don't forget ${title} today!`,
  ],
  gentle: [
    (title) => `${title} is still open on today's habits.`,
    (title) => `A small ${title} would feel good today.`,
  ],
  direct: [
    (title) => `Habit still open: ${title}.`,
    (title) => `Tick ${title} today.`,
  ],
  coach: [
    (title) => `Keep the streak alive with ${title}.`,
    (title) => `${title} is today's rhythm. One check.`,
  ],
}

const TODO: Record<FriendTone, LineFn[]> = {
  playful: [
    (title) => `Today's list still has ${title}!`,
    (title) => `Ooh, ${title} is on To Do today.`,
  ],
  gentle: [
    (title) => `${title} is on today's To Do when you want it.`,
    (title) => `Today includes ${title}. No rush.`,
  ],
  direct: [
    (title) => `On today's To Do: ${title}.`,
    (title) => `Today: ${title}.`,
  ],
  coach: [
    (title) => `Knock out ${title} on today's list.`,
    (title) => `${title} is scheduled today. Start there.`,
  ],
}

const AFFECTION: Record<FriendTone, LineFn[]> = {
  playful: [() => "I love you!", () => "You're my favorite human today."],
  gentle: [() => "I love you. That's all.", () => "Just checking in. I like you."],
  direct: [() => "I love you.", () => "You're doing fine."],
  coach: [() => "I love you. Keep going.", () => "Proud of you already."],
}

const WHIM: Record<FriendTone, LineFn[]> = {
  playful: [(title) => `Side quest: ${title}!`, (title) => `Ooh — ${title}?`],
  gentle: [(title) => `A soft ask: ${title}.`, (title) => `${title} could be a treat.`],
  direct: [(title) => `Mission: ${title}.`, (title) => `Do ${title}.`],
  coach: [(title) => `Let's try ${title}.`, (title) => `${title} would count.`],
}

const TABLES: Record<FriendSuggestionSource, Record<FriendTone, LineFn[]>> = {
  nextAction: NEXT_ACTION,
  habit: HABIT,
  todo: TODO,
  affection: AFFECTION,
  whim: WHIM,
}

export const EMPTY_FRIEND_NUDGE =
  "Nothing I can cheer yet. Add a Next Action, a today's To Do, or a daily habit!"

function pickLine(lines: LineFn[], rng: () => number): LineFn {
  return lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))] ?? lines[0]!
}

export function friendSuggestionLine(
  tone: FriendTone,
  source: FriendSuggestionSource,
  title: string,
  rng: () => number = Math.random,
): string {
  const table = TABLES[source][tone] ?? TABLES[source].playful
  return pickLine(table, rng)(title)
}

export function friendSourceLabel(source: FriendSuggestionSource | null): string {
  if (source === "habit") return "Daily habit"
  if (source === "todo") return "Today's To Do"
  if (source === "nextAction") return "Next Action"
  if (source === "whim") return "Soft mission"
  if (source === "affection") return "Just affection"
  return "Hello"
}

const CHEER: Record<FriendDialogEffect, (name: string, title: string, points: string) => string> = {
  heart: (name, title, points) => `${name} bumps your hand. ${title} is finished. ${points}.`,
  sparkle: (name, title, points) => `Little sparks. ${name} is proud you finished ${title}. ${points}.`,
  stamp: (name, title, points) => `${name} stamps a tiny gold star on ${title}. ${points}.`,
  whisper: (name, title, points) => `${name} whispers, well done. ${title} is done. ${points}.`,
  bounce: (name, title, points) => `${name} does a tiny happy hop. ${title} is done. ${points}.`,
  plain: (name, title, points) => `${name} sits up a little taller. ${title} is done. ${points}.`,
}

export function friendCheerLine(name: string, title: string, points: number, effect: FriendDialogEffect = "plain"): string {
  const who = name.trim() || "Your friend"
  const pay = points === 1 ? "That's 1 friend point" : `That's ${points} friend points`
  const line = CHEER[effect] ?? CHEER.plain
  return line(who, title, pay)
}

export function friendMissionBlurb(source: FriendSuggestionSource | null, title: string): string {
  if (source === "habit") {
    return `Open Habits and tick ${title} for today. When it is done, this friend will try to give you a small point reward.`
  }
  if (source === "todo") {
    return `${title} is on today's To Do. Finish it there — the friend is watching that row.`
  }
  if (source === "nextAction") {
    return `${title} is an open Next Action. Complete it and this friend may pay extra points.`
  }
  if (source === "whim") {
    return `This is not on a list. Do it in the real world, then tap I did it on the mission card.`
  }
  if (source === "affection") {
    return "Not a chore. They just wanted to say it."
  }
  return "A hello, not a mission."
}
