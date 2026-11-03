/**
 * lib/baby-game/story.ts — The Hush over Valdivia
 *
 * Valdivia is a hidden valley of old forests, still lakes, and half-finished stone stairways that lead
 * somewhere else than they should. Every dusk the Orb Lamp, a white orb with a cobalt heart, hummed the Evening Song and the whole village sang along.
 * One autumn night it went dark in pieces, and the Hush came: friends forgot their songs and each other's names for a
 * moment too long. The five parts of the lamp turned up in small, ordinary places, kept by the friends who loved the lamp most.
 * You are the Center of The World, newly arrived. The friend you opened the game from found you at the gate and follows you.
 */

import type { Resident } from "./cast"
import { LAMP_PARTS } from "./items"

export const INTRO: string[] = [
  "Valdivia used to sing. It is a hidden valley, all old trees and still water and crooked stone stairways that climb up and arrive back where they started. Every evening the Orb Lamp hummed one slow song, and every small creature in the village hummed it back.",
  "Then, one autumn night, the lamp went dark in pieces. The Hush came down. It is not cruel and it is not a monster. It is something flatter: the beige feeling, the one where nothing is worth wondering about. Friends forgot their songs, then each other's names, then why anything had ever glittered.",
  "You are the Center of The World. So is everyone, in their own small universe, but this one is yours and you are the only one in it. Your cottage stands beside the lamp, with a good garden patch out back. The friend you came with trots at your heel and says nothing, which is rude, and also exactly right.",
  "The oldest saying in the valley came over the mountains long ago, on the back of some traveler: be a lamp unto yourself. Nobody remembers who said it. Everybody remembers that the lamp is not only a lamp. The beige comes when you stop looking, and it goes when you look, gently, at whatever is right in front of you.",
  "Five parts of the lamp are scattered through the valley, each kept safe by a friend who loved it too much to let go. They won't hand one to a stranger. Make friends. Plant things. Bring them what they ask for. Listen to what they don't say. Look in the puddles; Valdivia keeps its secrets in reflections.",
]

export const ACTS: Array<{ title: string; zone: string; part: string; blurb: string }> = [
  { title: "Act I — Refraction Orchard", zone: "orchard", part: "Wick", blurb: "Four friends, one braided wick, and a breakfast song nobody can find. Dew on every leaf, each drop a tiny lens. Theme: beginner's mind, and waking up." },
  { title: "Act II — Moiré Pond", zone: "pond", part: "Glass", blurb: "The lagoon used to ring like a bell, and its surface bent the sky into new shapes. Five friends wait on its shores. Theme: water, stillness, and the wisdom of not forcing." },
  { title: "Act III — Fossil Hill", zone: "hill", part: "Oil", blurb: "Shy ones, sleepy ones, and one sly fox who hid something for good reasons. Everyone here collects, and everyone has a system. Theme: attention, enough, and kindness to yourself." },
  { title: "Act IV — Swap Meet Yard", zone: "barn", part: "Frame", blurb: "Loud, fast, and tender. The sturdiest friends keep the sturdiest part, and they would love a hand fixing things. Theme: effort that is neither too tight nor too loose." },
  { title: "Act V — Thistle Wood", zone: "wood", part: "Spark", blurb: "The deepest dark, and the smallest light. Moss, glowcaps, and old things worth reading. Theme: emptiness, words that point, and a flame passed hand to hand." },
]

export const PART_PLACED: Record<string, string> = {
  "lamp-wick": "The braided wick settles into the lamp's heart. It smells of warm wool. Somewhere in the grove, the glowcaps blink twice, politely, and a small white orb of light floats up from the lamp and hangs there, deciding.",
  "lamp-glass": "The glass slides into its ring and the whole lamp rings once, like a spoon on a cup. The lagoon answers, and the light comes out the far side split into a faint rainbow, muted: seafoam, lilac, cornflower.",
  "lamp-oil": "The oil goes in with a sound like a sigh. The craters shiver, then settle, then hum. The lamp's heart turns cobalt blue.",
  "lamp-frame": "The frame closes around the lamp with a click that you feel in your teeth. It stands straighter. So do you. Someone nearby says \"oh, wow!\" and nobody makes fun of them.",
  "lamp-spark": "The Spark touches the wick. For one breath, nothing. Then the lamp wakes, and the whole valley takes a breath with it. The light climbs the lamp's glass in a slow spiral, and you notice you are smiling.",
}

export const GATE_OPENED: Record<number, string> = {
  2: "The lagoon gate swings open on its own.",
  3: "The gate to the Fossil Hill unlatches.",
  4: "The gate to the Swap Meet Yard creaks open.",
  5: "The gate to the Thistle Wood parts like a curtain.",
}

export const ENDING: string[] = [
  "The Festival of Orb Lights begins before anyone decides it should. Fireworks go up over the lagoon and their colors fall twice, once in the sky and once, upside down and wobbling, in the water. Friends arrive from every corner of the valley, each holding the keepsake they gave you, or the memory of it. There is a long table, and everyone brought a dish, and nobody counted.",
  "Wallace reads the first five verses from her pages. Vonnegut, who has been quiet his whole life, sings the sixth without being asked. The seventh is nobody's. It's yours, and it's the one you hum.",
  "The lamp burns steady and bright, a white orb with a blue heart. The Hush doesn't leave. It just takes its place, between verses, where it was always meant to be. Rest is allowed. The beige is not.",
  "Wallace closes her book. \"The Song was never in the pages,\" she says, and nobody argues. One candle lights another, and the first loses nothing.",
  "Tomorrow the sun will rise, and it always does. That is the nicest rule in the valley.",
]

export const AFTER = "The valley is yours now. Friends still have more to say, and the hearts go up to ten."

/** A friend's goodbye at the festival, shaped by how close you got. */
export function farewell(r: Resident, h: number): string {
  if (h >= 9) return `${r.name}: "${r.story[2]}"`
  if (h >= 6) return `${r.name}: "${r.story[1]}"`
  if (h >= 3) return `${r.name}: "${r.story[0]}"`
  return `${r.name} sings along from the edge of the crowd, a little shyly.`
}

export const LAMP_BLURB = `The Orb Lamp is missing ${LAMP_PARTS.length} parts. Each friend who holds one will give it to someone they trust.`

export function companionBark(kind: "found" | "ready" | "rain" | "night", name: string): string {
  return {
    found: `${name} sniffs the ground and looks up at you, proud.`,
    ready: `${name} points their nose at someone. They have what you need.`,
    rain: `${name} shakes off a very small raindrop, offended.`,
    night: `${name} yawns and leans on your boot.`,
  }[kind]
}
