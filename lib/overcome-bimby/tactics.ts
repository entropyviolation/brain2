/**
 * lib/overcome-bimby/tactics.ts — Known tactics for starting what the brain will not start
 *
 * Hand-written from ADDA's "ADHD and Motivation" and the ADHD productivity-hack lists the person pasted (2026-11-02). Plain data:
 * the pipeline ranks these, the model only phrases them. Add a tactic here and the picker can offer it.
 */

import type { Barrier, Reading, Tactic, TacticKind } from "./types"

export const TACTICS: Tactic[] = [
  { id: "two-minutes", name: "Two-minute start", kind: "friction", helps: ["dread", "overwhelm", "vague", "boring"], do: "Set a timer for five minutes and only open the first tab or file for {task}. Stopping afterward is allowed." },
  { id: "micro-step", name: "Atomic first step", kind: "friction", helps: ["overwhelm", "vague"], do: "Write the very next physical action as one line, such as “open the CD project”. Do just that." },
  { id: "count-in", name: "Count-in", kind: "friction", helps: ["dread", "boring", "unknown"], do: "Say “1, 2, 3, 4, go” out loud, then stand up and move to where the work is." },
  { id: "low-bar", name: "Make the bar absurdly low", kind: "friction", helps: ["perfectionism", "overwhelm"], do: "Aim for an ugly first pass. One rough, wrong version counts as done for now." },
  { id: "beat-clock", name: "Beat the clock", kind: "dopamine", helps: ["boring", "dread"], do: "Set 15 minutes and see how much you can clear before it goes off." },
  { id: "sandwich", name: "Dopamine sandwich", kind: "dopamine", helps: ["boring", "dread"], do: "Put one thing you love right before it and one right after, then start the sandwich." },
  { id: "backdrop", name: "Change the backdrop", kind: "dopamine", helps: ["boring", "unknown"], do: "Take the laptop to another room or a café and start there." },
  { id: "character", name: "Play a character", kind: "dopamine", helps: ["dread", "boring"], do: "You are an efficient assistant hired for 20 minutes to clear this out. Put on the hat and begin." },
  { id: "body-double", name: "Body double", kind: "scaffold", helps: ["dread", "boring", "overwhelm", "unknown"], do: "Text someone and work next to them, in person or on a call, for 25 minutes.", external: true },
  { id: "bet", name: "Skin in the game", kind: "scaffold", helps: ["dread", "unknown"], do: "Tell someone you will send the finished thing by a set time, or pay them.", external: true },
  { id: "phone-toss", name: "Phone across the room", kind: "block", helps: [], do: "Put your phone on a bed in another room before you begin." },
  { id: "block-sites", name: "Block the escape hatches", kind: "block", helps: ["boring", "dread"], do: "Turn on your site blocker for the next 30 minutes." },
  { id: "want-not-have", name: "Want, not have to", kind: "reframe", helps: ["dread", "perfectionism"], do: "Say it as “I want this finished because …” and finish the sentence with your own reason." },
  { id: "normalize", name: "Not in the mood is fine", kind: "reframe", helps: ["dread", "unknown"], do: "You can feel the resistance and do it anyway. Work while it is still there." },
  { id: "name-cost", name: "Say the cost", kind: "consequence", helps: [], do: "Read aloud what stays broken each day it stays undone. Then do the two-minute start." },
  { id: "good-enough", name: "Good-enough rule", kind: "decide", helps: ["choices", "perfectionism", "overwhelm"], do: "Write the rule before you look: “the first option that fits my dealbreakers wins”. You are not hunting for the perfect one." },
  { id: "three-max", name: "Three options, then flip", kind: "decide", helps: ["choices", "overwhelm"], do: "Look at three options at most. If you are tied, flip a coin and go with it." },
  { id: "dealbreakers", name: "Dealbreakers first", kind: "decide", helps: ["choices", "vague"], do: "Write down what rules an option out before you search, so you can throw options away fast." },
  { id: "four-facts", name: "Write the four facts", kind: "prep", helps: ["vague", "choices", "overwhelm", "cost"], do: "For {task}, write only what you need: what, when, how flexible, and your limit (money or time)." },
  { id: "checklist", name: "Five-item checklist", kind: "prep", helps: ["overwhelm", "vague"], do: "Split {task} into five things you can cross off. “Do it” is too vague to start." },
  { id: "one-note", name: "Everything in one note", kind: "prep", helps: ["dread", "cost", "boring"], do: "Put what {task} needs (logins, ids, payment method, links) in one note, so it is ready the moment you start." },
  { id: "price-first", name: "Look at the range first", kind: "prep", helps: ["cost"], do: "Look only at the price range for {task}, then set your ceiling before you look at anything else." },
  { id: "lock-something", name: "Lock something reversible", kind: "decide", helps: ["cost", "perfectionism", "vague"], do: "Pick a refundable, flexible or rough version of {task} just to lock something in. You can improve it later." },
  { id: "tell-waiting", name: "Message whoever is waiting", kind: "message", helps: ["dread", "unknown", "overwhelm"], do: "Send: “Sorry for the delay. You will have it by [a specific time today].” It makes the deadline real and lifts pressure.", external: true },
  { id: "reset", name: "Reset and restart", kind: "restart", helps: [], do: "Stand up, drink some water, do 20 jumping jacks, then restart the timer. No self-criticism: every restart counts." },
  { id: "reward", name: "Pay yourself right after", kind: "reward", helps: [], do: "Pick the small reward you get the moment the timer ends: a snack, a song, a walk." },
]

export const tacticById = (id: string): Tactic | undefined => TACTICS.find((t) => t.id === id)

export const BARRIERS: Barrier[] = ["dread", "boring", "overwhelm", "vague", "perfectionism", "choices", "cost", "unknown"]

/** What the person taps to name what is in the way after a tactic fails. */
export const BARRIER_WHY: Record<Barrier, string> = {
  dread: "Dreading it", boring: "Boring", overwhelm: "Too big", vague: "Don't know the first step",
  perfectionism: "Want it perfect", choices: "Too many choices", cost: "Worried about cost", unknown: "Not sure",
}

/** The group a tactic sits under in a reply. */
export const KIND_HEADING: Record<TacticKind, string> = {
  friction: "Shrink the first step", decide: "Cut the decision load", prep: "Get it ready", dopamine: "Add momentum", scaffold: "Add momentum",
  message: "Add momentum", block: "Cut the friction", reframe: "Change the frame", consequence: "Make it real", reward: "Pay yourself", restart: "If you stall",
}

/** Fill `{task}` so a tactic names the thing. */
export const fillTactic = (t: Tactic, reading: Reading): Tactic => ({ ...t, do: t.do.replace(/\{task\}/g, reading.task || "it") })
