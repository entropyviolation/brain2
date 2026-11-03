/**
 * lib/baby-game/lines.ts — Scripted small talk and reactions, by the app's friend tone
 *
 * These are the words the game says with no model at all, and what `llm.ts` falls back to. Four tones
 * (`FRIEND_TONE`), three moods. Never shaming: a grumpy friend is tired, not angry at you.
 */

import type { FriendTone } from "@/lib/baby-animal-personality"

const SMALL_TALK: Record<FriendTone, string[]> = {
  gentle: [
    "It's a quiet kind of day. I like that.",
    "Thank you for stopping by. It means more than I say.",
    "The grass feels softer today, doesn't it?",
    "There's no hurry in me today. Is there in you?",
  ],
  playful: [
    "Did you see that? No? Neither did I. Wow.",
    "Guess what! ...I forgot. It'll come back.",
    "Race you to anything. Anything at all.",
    "Today is a good day to be a small thing with big ideas.",
  ],
  direct: [
    "Ask me anything. Short answers.",
    "Busy day. Talk is fine.",
    "Keep it simple and we'll get along.",
    "I notice you came back. Good.",
  ],
  coach: [
    "Small steps. Big days. You're doing great.",
    "One more thing and then rest. Deal?",
    "Look at you. Showing up. That's the whole trick.",
    "Whatever's heavy, we carry it in pieces.",
  ],
}

const GRUMPY: Record<FriendTone, string> = {
  gentle: "I'm a little tired today. Is it okay if we just sit?",
  playful: "Nngh. Come back when I've stretched. My ears are asleep.",
  direct: "Not my best day. Make it count.",
  coach: "Rough one. Even coaches need a breather.",
}

const RAIN: Record<FriendTone, string> = {
  gentle: "Listen. The rain is saying something kind.",
  playful: "RAIN! It's like the sky is giving high-fives!",
  direct: "Wet. But fine. Everything grows.",
  coach: "Rain's just weather doing its job. Let's do ours.",
}

const EVENING: Record<FriendTone, string> = {
  gentle: "The light's gone soft. I love this part.",
  playful: "Evening! Everything glows a little. Even you.",
  direct: "Day's winding down. Good.",
  coach: "You made it to evening. Count that.",
}

export function smallTalk(tone: FriendTone, mood: number, weather: "clear" | "rain", hour: number, pick: number): string {
  if (mood < 0) return GRUMPY[tone]
  if (weather === "rain" && pick % 3 === 0) return RAIN[tone]
  if (hour >= 18 && pick % 3 === 1) return EVENING[tone]
  const pool = SMALL_TALK[tone]
  return pool[pick % pool.length]!
}

export type Taste = "love" | "like" | "meh" | "hate"

const GIFT: Record<Taste, Record<FriendTone, string>> = {
  love: {
    gentle: "Oh... this is exactly right. How did you know?",
    playful: "YES! That's my favorite thing ever! (Today.)",
    direct: "Good. Very good. You pay attention.",
    coach: "That's how it's done. You really see me.",
  },
  like: {
    gentle: "That's thoughtful. Thank you.",
    playful: "Ooh! For me? Fun!",
    direct: "Useful. Thanks.",
    coach: "Nice work. I'll take it.",
  },
  meh: {
    gentle: "Oh. Thank you. It's the thought that counts.",
    playful: "Huh. Interesting. I... will find a use?",
    direct: "Noted. Not my thing.",
    coach: "I appreciate the effort. Next time, aim closer.",
  },
  hate: {
    gentle: "Oh. Oh no. Thank you, but... I'd rather not.",
    playful: "Ew! No! Take it away! (Thanks!)",
    direct: "No.",
    coach: "I respect the try. Not this one.",
  },
}

export const giftLine = (taste: Taste, tone: FriendTone) => GIFT[taste][tone]

export function approachLine(distance: number, tone: FriendTone): string {
  if (distance === 0) {
    return {
      gentle: "...Yes. That's it. That's how I like to be met.",
      playful: "Now THAT'S how you start a conversation!",
      direct: "Good approach. Straight. I respect it.",
      coach: "That was exactly the push I needed.",
    }[tone]
  }
  if (distance === 1) return "That was... fine. I wasn't ready for that, but I can work with it."
  return "Oh. Hm. That wasn't what I needed. It's okay. I'll be okay."
}

export function favorLine(grade: number): string {
  return ["We tried. It didn't quite land. That's allowed.", "Nice! That was fun.", "PERFECT. I'll remember that all week."][grade] ?? ""
}

export const SPOOK_LINE = "Eep! Too fast! Please slow down around me."

export function moodLabel(mood: number): string {
  return ["cranky", "tired", "steady", "bright", "glowing"][Math.max(0, Math.min(4, mood + 2))]!
}
