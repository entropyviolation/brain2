/**
 * lib/skills/seeds.ts — The skills each agent ships with, written by hand
 *
 * Each restates a rule the agent already keeps (the Helper's WIRE prompt, the Lists BIMBY's guard and grammar), as a
 * short principle a person can read, edit, or retire in the lab. Seeds are general; learned skills are task skills
 * that arrive later. The Blueprint carries these (`Blueprint.skills`).
 */

import type { Skill } from "./types"

const seed = (id: string, name: string, principle: string, whenToApply: string, category: string, kind: Skill["kind"] = "general"): Skill => ({ id, name, principle, whenToApply, kind, category, status: "active", source: "hand", from: [], uses: 0, wins: 0 })

export const TRACKING_HELPER_SKILLS: Skill[] = [
  seed("th.point-never-write", "Point at tags, never write times", "Every time, day and length is a tag. Name the tag. A time that is not tagged does not exist.", "Any account with times in it", "wire:tags"),
  seed("th.one-entry-per-thing", "One entry per distinct thing", "List each thing done once, in the order told. Skip anything with no time near it, and do not pad the list.", "Any account of several activities", "wire:entries"),
  seed("th.leave-blank", "Blank beats a guess", "When the words do not give a start, end, place or day, leave the field empty. Code fills edges from neighbours.", "A field the text does not state", "wire:blank"),
  seed("th.end-not-maybe", "The plain time is the end", "'At least A to B, maybe until C' is start A, end B, maybeEnd C. The maybe time is never the end.", "Hedged or open-ended durations", "wire:end-vs-maybe"),
  seed("th.vague-words", "Vague words mark the edge", "Mark an edge vague when the words say guess, minimum, maybe, around or sometime. Mark it sure when they say it is sure.", "Hedging words next to a time", "wire:vague-edge"),
  seed("th.place-as-written", "Only a place they name", "Write a place only when the person names it, as written. Otherwise empty; code learns places from history.", "Any mention of where", "wire:place"),
  seed("th.later-sentence-ends", "A later sentence can end an earlier thing", "'By 6:22 the trash was done' is the end of the earlier trash entry. Use its tag as that entry's end, not a new entry.", "A done-by sentence after the activity", "wire:end-vs-maybe"),
]

export const LISTS_HELPER_SKILLS: Skill[] = [
  seed("lh.ask-two-fit", "A name that fits two things is asked about", "When a name matches more than one list or item, show one key per candidate. Never pick one.", "An ambiguous list or item name", "lists:names"),
  seed("lh.plan-before-write", "Plan, count, then approve", "Work out every edit and count it before anything is written. The person says yes, or types the count for a big change.", "Any change to lists or items", "lists:approval"),
  seed("lh.never-destroy", "Never destroy", "Only a merge removes items. A bulk write has a hard cap, touches only fields its tool owns, is verified after, and is put back if the check fails.", "Any bulk write", "lists:guard"),
  seed("lh.replan-on-apply", "Plan again on today's data", "Before writing, plan again and compare. Write only when the effect is identical to what was approved.", "Applying an approved plan", "lists:apply"),
]
