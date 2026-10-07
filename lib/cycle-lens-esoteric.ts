/**
 * lib/cycle-lens-esoteric.ts — Esoteric lens for the cycle reading
 *
 * Seasons of attention for a phase `phaseForDate` already derived.
 * Retreat, rise, meeting, ripening. Unknown names none.
 * A lens, not a scientific claim, and not a belief.
 */
import type { CyclePhase } from "@/lib/cycle-phase"

export type LensSectionId = "physiology" | "typical" | "worth-doing" | "worth-not-doing"

export type LensSection = {
  id: LensSectionId
  title: string
  paragraphs: readonly string[]
}

/** Shown with this lens so it is never mistaken for science. */
export const ESOTERIC_LENS_LINE =
  "This is a lens on attention, not a scientific claim. It does not require a belief."

function sections(
  season: readonly string[],
  typical: readonly string[],
  doing: readonly string[],
  notDoing: readonly string[],
): readonly LensSection[] {
  return [
    { id: "physiology", title: "The season", paragraphs: season },
    { id: "typical", title: "What's typical", paragraphs: typical },
    { id: "worth-doing", title: "Worth doing", paragraphs: doing },
    { id: "worth-not-doing", title: "Worth not doing", paragraphs: notDoing },
  ]
}

const menstrual = sections(
  [
    "Retreat is the season of days marked bleeding. Attention draws in with them: fewer fronts, a smaller room, the day allowed to be about what is ending.",
    "The marks say blood is leaving. The lens says attention may leave with it. You do not have to believe the second sentence for the first to remain true.",
  ],
  [
    "A pull inward. It may come as tiredness, as tenderness, or as a sudden honesty about what no longer fits. Thoughts that were easy to postpone arrive and ask to be set down. The reach of the day shortens.",
    "Some people feel the pull as relief, the way a shore feels when the water is out and the rocks are simply there. Others feel it as exposure. Both are retreat. Neither means the other seasons have failed.",
  ],
  [
    "Make the retreat small enough to choose. Fewer new promises. A softer schedule, where you actually have the choice. A little time in which nothing is being improved.",
    "Attention here is not blank. It is exact about endings. If writing helps, write what the month was. Mark the days you are bleeding. Later seasons depend on that mark being true, not on the day being beautiful.",
  ],
  [
    "Collapse is not a height to aim at, and retreat does not mean you are lost. A plain, dull day is a complete retreat. You do not have to perform depth, and the day does not have to feel sacred. A day marked only as spotting is not this season.",
    "Do not hurry these days into the shape of rise. Retreat lasts while bleeding is marked. When it stops, the marks choose. Rise, if no meeting was marked in that bleed or after it. Ripening, if a meeting was marked and the day is no longer a bleed.",
  ],
)

const follicular = sections(
  [
    "Rise is the season after retreat. The bleed has ended, and no meeting has been marked in that bleed or since. Attention comes back out. What the retreat set down does not need an identical life in its place.",
    "These are days for beginning, and for an interest the smaller room could not hold. Rise is a tendency of attention, not a law, and it asks for no belief. If no meeting is marked, the season runs on until a bleed is marked. That unmarked stretch is not a mystical event.",
  ],
  [
    "A widening, by uneven steps, not by announcement. Curiosity becomes particular. The future is more thinkable. The past is less like the only room you are allowed to stand in.",
    "Tired days do not cancel the season. The incline can be slow. A quiet rise is still rise.",
  ],
  [
    "Give the widening a real object. Start what needed a clearer head. Learn. Arrange. Let plans stay provisional. This is not yet the meeting, and not yet the ripening.",
    "Keep sleep and meals ordinary, so attention has a day to stand in. Leave the ovulation mark unset until the day you judge the turn. A wish is not a meeting, and it should not close this season.",
  ],
  [
    "Do not spend the rise proving that retreat is over. Do not turn each open day into a debt of output. Increase is not a contest. The season has not promised a crest on a certain date.",
    "Spotting does not open another season. A day you did not mark stays rise, however it feels. The calendar will not invent a meeting you did not record.",
  ],
)

const ovulatory = sections(
  [
    "Meeting is one day: ovulation marked, bleeding not. If both marks are set, the day is retreat. A second marked day is a second meeting. The season is a gate, not the days to either side of it.",
    "What has been growing comes to an edge. It meets a decision, a piece of work, or simply its own fullness. Attention is briefly face to face with what the month has been building. You do not have to believe the meeting is more than a way of looking.",
  ],
  [
    "Brightness, and it does not last. Attention runs more outward, a little more edged, sometimes more tender in the same hour. A choice that stayed theoretical can feel present.",
    "A meeting can be quiet. No sign is required, and an absent one is not a flaw in the month. The meeting is not a personality. It does not have to be worn past the day.",
  ],
  [
    "Mark the day honestly, and leave the gate a little room. Notice what is actually ready to be met: a conversation that needs a real answer, a commitment, a draft that needs a yes or a no.",
    "Then let the day end. Stretched over the whole month, a meeting becomes a performance of intensity, and stops being a meeting.",
  ],
  [
    "Do not hang an omen on the day. If a sensation you expected never comes, the month has not lost its center. A day without the mark is not a meeting. Through the rise, when no meeting has been marked, the rise goes on, and that is allowed.",
    "A bleed on the same day is retreat, so the lens does not tell two stories about one day. Spotting does not create a meeting, and does not erase a mark you set. After the gate, a day that is not a bleed and not a new meeting is ripening.",
  ],
)

const luteal = sections(
  [
    "Ripening follows a meeting. After that day, it holds until a bleed is marked, on every day that is not a new meeting and not a bleed.",
    "The image is fruit that is no longer becoming, and has not yet fallen. Attention turns toward what can be finished, sweetened, or kept. This is a way of looking, not a law, and not a belief you must hold. If no later bleed is marked, ripening continues. Its length is not a mystical event.",
  ],
  [
    "Heavier and more inward than rise, and not yet the retreat of a bleed. Work already open matters more than work not begun. Sleep asks for more of the night.",
    "Late, when the month is full and retreat has not begun, feelings that were easy to outrun can catch up. The density may feel like irritability, or like depth. Neither word is a verdict. Both can be ripening.",
  ],
  [
    "Finish, edit, and take care of what the rise opened. Set down what should not be carried into the next retreat. This season suits a plain kind of judgment: what is good, what is done, what is finished.",
    "Leave a little space, so fullness does not harden into talk that never ends. When bleeding starts, mark it. That mark closes the season. Leave the bleed unmarked, and ripening is asked to go on after the fruit has fallen.",
  ],
  [
    "Do not open a second life in a season given over to finishing. A long run of days with no new bleed is not a sign. The calendar is not an oracle. Ripening can simply continue.",
    "Spotting does not end the season, and does not begin retreat. You are not required to feel ripe, or wise, or at peace. Ordinary tiredness is a faithful way to meet these days.",
  ],
)

const unknown = sections(
  [
    "No season is named. The marks have not started. This day lies before the first bleed and before any ovulation mark, so retreat, rise, meeting, and ripening are not assigned.",
    "The lens will not cover the gap by inventing a season. What is missing is history, not a hidden turn.",
  ],
  [
    "There is no typical shape of attention yet, because no season was given. The day may be bright, heavy, or dull.",
    "A feeling does not stand in for a mark. Attention owes this day no particular motion.",
  ],
  [
    "Mark the days you are bleeding. Mark ovulation on the day you judge it has come. Either mark is a place a later day can be read from. This one, with neither behind it, stays unnamed.",
  ],
  [
    "Leave the gap bare. It is not an omen, and it is not a failure to have begun. Spotting does not start the record.",
    "The lens is quiet on purpose. Until a mark gives it a turn to name, the day is just the day, and no belief is asked of you.",
  ],
)

export const esotericLensSections: Record<CyclePhase, readonly LensSection[]> = {
  menstrual,
  follicular,
  ovulatory,
  luteal,
  unknown,
}
