/**
 * lib/cycle-lens-copy.ts — Prose for the cycle detail popup
 *
 * Three peer lenses on a phase that `phaseForDate` already derived.
 * The phase is not stored. Spotting is not a phase. This file is education
 * and reflection from the user's own marks. It is not a diagnosis.
 */
import type { CyclePhase } from "@/lib/cycle-phase"

export const CYCLE_PHASES: readonly CyclePhase[] = [
  "menstrual",
  "follicular",
  "ovulatory",
  "luteal",
  "unknown",
]

export type CycleLensId = "clinical" | "chinese" | "esoteric"

/** One row of peer views. Order is the order of the switch. */
export const CYCLE_LENSES: readonly { id: CycleLensId; label: string }[] = [
  { id: "clinical", label: "Clinical" },
  { id: "chinese", label: "Chinese medicine" },
  { id: "esoteric", label: "Esoteric" },
]

export const CYCLE_PHASE_TITLE: Record<CyclePhase, string> = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulatory: "Ovulatory",
  luteal: "Luteal",
  unknown: "Unknown",
}

/** Shown with the clinical lens. Education from marks, not a clinical act. */
export const CLINICAL_EDUCATION_LINE =
  "This is education from your own bleed and ovulation marks, not a diagnosis or a fertility guarantee."

/** Shown with the Chinese-medicine lens. A reading, not a formula to take. */
export const CHINESE_LENS_LINE =
  "A traditional reading of these marks. Not a prescription, and not a diagnosis."

/** Shown with the esoteric lens so it is never mistaken for science. */
export const ESOTERIC_LENS_LINE =
  "This is a lens on attention, not a scientific claim, and it does not require a belief."

export type CycleLensBody = { paragraphs: readonly string[] }

const menstrualClinical: CycleLensBody = {
  paragraphs: [
    "Menstrual days are the ones marked bleeding. A run of days that touch, each marked bleeding, is one menses on this calendar. Physiologically, menstruation is the shedding of the functional layer of the endometrium after a luteal phase in which a pregnancy did not continue. Estradiol and progesterone have both fallen from their luteal levels. The lining cannot hold under that withdrawal: the spiral arterioles constrict, the tissue becomes ischemic, and the functional layer sloughs, mixed with blood and fluid. By the ordinary count, the first day of bleeding is cycle day 1, and a new cohort of follicles is already being recruited while the lining is still leaving. A day you marked only as spotting is not part of this phase.",
    "What is typical in the body is cramping from prostaglandins, which make the uterine muscle contract, a low ache in the pelvis, and flow that is often heavier in the first half of the bleed and lighter toward the end. Clots can appear when flow is brisk, because blood has had time to coagulate before it leaves. Energy and attention commonly narrow. Sleep may be lighter, and the day can feel smaller. Some people feel a clearing as the late-luteal drop finishes. Others feel flat, tender, or easily flooded for a day or two. Those are ordinary shapes of a bleed. None of them, alone, is a disease name.",
    "What is worth doing is to treat the bleed as a physiological event with a cost, not as a blank to be ignored. Warmth, rest scaled to how heavy the day is, and meals that replace iron when flow is substantial are plain care. A short walk often eases cramping more than unbroken stillness, because movement helps the uterus finish the work of contracting, but the walk is care and not a performance. Mark the days you are actually bleeding. Those marks are how the calendar finds the follicular days that follow, and how a later luteal stretch knows where it ended.",
    "What is worth not doing is to read one heavy day, or one light day, as a verdict on the whole cycle, or to treat this label as proof that ovulation occurred in the cycle before. The calendar knows the marks you set. It does not know a serum level, the thickness of a lining, or whether the next cycle will look like this one. Pain that is new, fainting, or bleeding that soaks through protection hour after hour belongs in a conversation with a clinician. The word menstrual is not that conversation.",
  ],
}

const follicularClinical: CycleLensBody = {
  paragraphs: [
    "After a bleed ends, and until an ovulation mark takes effect, these days are follicular. In the ovary a cohort of follicles grows under follicle-stimulating hormone. Usually one becomes dominant. Its granulosa cells make estradiol, and estradiol rises across the phase. That rise rebuilds the endometrium — the proliferative lining — changes cervical fluid toward a clearer, more slippery quality, and at the hypothalamus and pituitary eventually switches from holding luteinizing hormone back to provoking its surge. The length of this phase is the variable part of a cycle. A long gap or a short one is still follicular here when no ovulation has been marked, including the whole stretch to the next bleed if ovulation was never marked at all.",
    "What is typical is a gradual widening of energy as bleeding stops and estradiol climbs. For many people sleep and mood are steadiest in this stretch, though that is a tendency, not a rule, and a tired follicular week is still follicular. Attention often holds a wider field: starting, learning, and arranging sit more easily than they do once progesterone is dominant. If you take a waking temperature, it is usually lower in this half than after ovulation. These are signs a person may notice. The label does not require them. It requires only the marks.",
    "What is worth doing is to use the clearer days for work that needs range, and to keep sleep and meals ordinary so the rise has a body to stand on. If you already have a way you trust for noticing ovulation — a test you run, a temperature shift you know, a fluid pattern you have learned — mark the day when you judge it has arrived. Until you do, the calendar stays follicular. That is the accurate reading of an absent mark, not a guess that the body failed to ovulate.",
    "What is worth not doing is to assign ovulation to a fixed cycle day, or to treat a missing mark as proof that ovulation did not occur. Absence of a mark means the calendar was not told. It is not a hormone assay and not an ultrasound. It is also not a statement that a particular day is fertile or infertile. Estradiol's rise is the physiology of this phase. What you do with that knowledge in a life that may or may not be trying to conceive is outside this label.",
  ],
}

const ovulatoryClinical: CycleLensBody = {
  paragraphs: [
    "The ovulatory day is a day you marked ovulation, provided that day is not also marked bleeding. If both marks are set, bleeding wins and the day is menstrual. Physiologically, the late-follicular estradiol peak triggers a surge of luteinizing hormone from the pituitary. That LH surge resumes the final maturation of the oocyte and, about a day after the surge begins, the dominant follicle ruptures. The egg is released and may be picked up by the fallopian tube. Estradiol is high and then falls briefly. Progesterone is just starting, as the ruptured follicle luteinizes and becomes the corpus luteum. The event is short. This calendar gives it the day you marked, not a week-long season.",
    "What is typical around the turn is a brief change, not a new steady state. Some people notice a one-sided twinge as the follicle ruptures, a peak and then a fall in slippery cervical fluid, or a small rise in waking temperature over the following mornings as progesterone takes the temperature set-point up. Attention can feel bright, outward, or slightly edged. Estradiol is high, and the LH surge is a real neuroendocrine event, so a change in how the day feels is plausible. It is not required. The mark is the whole of what this calendar calls ovulatory. A second marked day is a second ovulatory day. An unmarked day is not one.",
    "What is worth doing is to set the mark on the day you actually take to be ovulation, using whatever method you already use, and then to let the following days become luteal. If you are unsure, leave the mark off. An unmarked day after a bleed stays follicular. That is the honest reading when the calendar has not been told, and it keeps a guess from painting a luteal half that your marks do not support.",
    "What is worth not doing is to treat this label as a fertility guarantee, as guidance about conception, or as a prediction of the next cycle. A marked day is not a laboratory LH value and not a rupture seen on ultrasound. The physiology — estradiol peak, LH surge, release of the egg, the first progesterone from the new corpus luteum — is the education. Whether any of that happened in your body on this date is exactly as sure as the mark you chose to set, and no surer.",
  ],
}

const lutealClinical: CycleLensBody = {
  paragraphs: [
    "From the day after an ovulation mark until the next bleed begins, the days are luteal. If no later bleed is marked, later days stay luteal. The ruptured follicle is now the corpus luteum, and its main hormone is progesterone, with a second, usually lower, rise of estradiol beside it. Progesterone converts the proliferative lining into secretory endometrium, raises waking temperature, quiets uterine muscle, and signals the brain so that another ovulation does not start in the same cycle. If a pregnancy does not continue, the corpus luteum involutes after about twelve to fourteen days, both hormones fall, and the next bleed begins because the lining loses that support. The fall is the bridge into menses. Until bleeding is marked, this calendar still calls the days luteal.",
    "What is typical is a warmer, slower, more inward body. Progesterone is mildly sedating for many people and lifts the temperature set-point by a few tenths of a degree. Breasts may feel fuller. Appetite often increases. Sleep may be heavier, or more broken. Late in the phase, as the corpus luteum fades, the withdrawal of progesterone and estradiol can bring irritability, sadness, bloating, or a sense of pressure. That late stretch is not a separate phase here. It is the end of the luteal half. Attention that was wide while estradiol was rising alone often prefers a narrower field: finishing, keeping, and noticing what is already open.",
    "What is worth doing is to protect sleep, to keep meals steady so the progesterone-related appetite is not a swing from empty to overrun, and to let the work of the days be consolidation more than launch. Progesterone's job is maintenance of the lining. A matching use of attention is to close loops, edit, and look after what was started in the follicular days. When bleeding begins, mark it. That mark is what ends the phase. Leaving it unmarked leaves the calendar in luteal time, which will be wrong once the bleed is real.",
    "What is worth not doing is to treat a long luteal tail with no next bleed as proof of pregnancy, or a short one as proof of a luteal defect. This calendar cannot see progesterone. It sees only that an ovulation mark is still the latest structuring event and that no bleed has been marked after it. Spotting in these days is stored and does not move the phase. A question about a missed bleed, a short luteal interval, or pain is a clinician's question. The word luteal does not answer it.",
  ],
}

const unknownClinical: CycleLensBody = {
  paragraphs: [
    "The calendar does not have enough bleed history yet to name a phase for this day. A day before the first bleeding mark, when no ovulation mark is in effect either, stays unknown. Mark bleeding on the days it happens and the later labels have a place to start.",
    "An ovulation mark can still open luteal days after itself even before any bleed is recorded. This day, if it is neither bleeding nor ovulation and has no earlier bleed to stand on, remains unknown. The gap is missing history, not a hidden phase.",
  ],
}

const menstrualChinese: CycleLensBody = {
  paragraphs: [
    "In this lens the bleed is Blood moving, and the sea of Blood is discharging. The Chong vessel, the Penetrating vessel, and the Ren vessel open so the discharge can descend. Pen qi — the qi of that Penetrating vessel, the sea of Blood — is spending itself downward rather than gathering. What the tradition asks of the menstrual phase, 行经期, is free passage. Liver qi courses, so Blood is not held back by a knot. Kidney qi is the root that timed the arrival, but this is not the hour to shut the gate with heavy astringency. The four-phase map taught in modern Chinese gynecology puts this movement first: Blood leaves, and only then can yin grow again. The older books speak of the vessels and of Blood; they do not pretend to be a hormone chart.",
    "What is typical in the body is a downward bearing in the lower abdomen, cramping as the uterus works, and a relative emptiness of qi and Blood once the discharge is under way. Attention narrows. Cold hands or a wish for warmth is read here as the surface not being held while Blood moves inside. It is not a moral failing, and it is not a diagnosis. If Liver qi is stuck and the descent is obstructed, irritability is part of the picture. If the qi is free, the same days can feel simply quiet, as if the month had set something down. Both belong to Blood moving.",
    "What is worth doing is to let the movement finish. Warmth on the lower abdomen, rest, and food that is easy and slightly warming are the ordinary nursing of this phase. Keep the day uncluttered enough that Liver qi is not jammed by strain, or by anger that has nowhere to go. Mark the days of actual bleeding. In this lens those marks are the open gate. Without them the calendar cannot say that Kidney yin has a place to start growing, and pen qi has no discharge to be faithful to.",
    "What is worth not doing is to tonify as though the body were only deficient, in a way that stalls the flow, or to treat the bleed as a failure of Kidney yin. The relative emptiness arrives with the discharge. The work of this turn is movement. Spotting on a day that is not marked bleeding does not make that day menstrual. Pen qi is not asked to pour out and to store at full strength on the same day. A formula, a needle, or a dose belongs to a practitioner who can see the person. This text is the shape of the phase, not an order to take anything.",
  ],
}

const follicularChinese: CycleLensBody = {
  paragraphs: [
    "After the bleed, Blood and yin are relatively empty, and the work is to fill them. This is the post-menstrual phase, 经后期, in the modern teaching: Kidney yin grows, Blood is replenished, and the sea of Blood begins to fill again. Tian gui, the menstrual essence, depends on Kidney yin being abundant enough to express it. The Ren vessel is nourished. The Liver stores Blood as it returns. Pen qi, spent in the discharge, starts to accumulate in the Chong vessel rather than to pour out. The image is yin lengthening before yang is asked to declare itself. On this calendar, that season is the follicular label: a bleed has ended, and no ovulation mark has yet taken effect.",
    "What is typical is a gradual return of moisture and of appetite for ordinary effort, and a mind quieter than the bleed or the days just before it. In the body this is yin and Blood coming back — fluids less scant, sleep less broken, the lining restoring — when Kidney yin is adequate. Attention widens, not as a demand but as what a filling sea allows. If yin is thin, these same days can feel dry, scant, or oddly tired. They are still this phase. The task remains nourishing, not pushing the turn before it has been marked.",
    "What is worth doing is to feed the growth. Regular meals, enough sleep, and work that builds rather than only spends are the practical face of nourishing Kidney yin and Blood. Liver qi should stay free, because a yin phase still knots if the qi that courses Blood is stuck, but the emphasis is storage and increase, not the great movement of the menses. Leave the ovulation mark unset until you judge the transformation has happened. Until then this lens keeps the days in the time of growing yin.",
    "What is worth not doing is to treat these days as already yang, or to force a transformation the marks have not named. In the old language, heavy heating scatters yin before it has gathered. Pretending the calendar knows a change it was never given is the same mistake in another dialect. Pen qi is gathering. This is not yet 重阴转阳, the turn in which full yin gives rise to yang. Kidney yang will have its season. Calling it early does not make the sea ready.",
  ],
}

const ovulatoryChinese: CycleLensBody = {
  paragraphs: [
    "When yin reaches fullness it must turn. The intermenstrual phase, 经间期, is taught as the time of yinyun: dense yin at the point of change, when heavy yin gives birth to yang, 重阴必阳. Kidney yin is at its height. Kidney yang has to warm the transformation, or the turn stays incomplete. Liver qi must be free, or what is full cannot pivot. Pen qi in the Chong vessel is replete, and the Ren is open to the change. On this calendar the gate is the day you marked ovulation and did not also mark bleeding. It is a gate, not a long season. Classical language describes a change of tide in the sea of Blood. It does not clock the tide with a laboratory assay, and this lens will not pretend that it does.",
    "What is typical is a short brightness. The body may feel a one-sided ache low in the abdomen, a sudden increase in slippery fluid, or a lift in outward attention, as if something that had been filling had found its edge. In this language that is yin culminated and yang just taking the lead. The turn can also pass almost unnoticed. A quiet change is still a change. The mark you set is what this lens reads. It does not invent a second day, and it does not scold an absent sensation. Kidney yang's contribution may be felt as warmth arriving. It may not be felt at all.",
    "What is worth doing is to mark the day you take the transformation to have happened, and then to stop asking these hours to be a whole chapter. Ease, a little warmth, and unobstructed Liver qi are the companions of the pivot in this medicine. After the mark, the following days belong to yang. If you are not sure the turn occurred, do not mark it. An unmarked day after a bleed remains the phase of growing Kidney yin, which is the truthful reading and the one pen qi can still accumulate inside.",
    "What is worth not doing is to stretch the gate into a promise, or to treat yinyun as an instruction about conception. The word names a timing inside a tradition. It is not a command, and it is not evidence that Kidney yang successfully transformed. Bleeding on the same day wins in the phase model, because Blood moving is the stronger fact: the gate of discharge overrides the gate of the turn. Spotting does not create this phase and does not cancel it.",
  ],
}

const lutealChinese: CycleLensBody = {
  paragraphs: [
    "After the turn, yang is in charge. This is the premenstrual phase, 经前期, of the four-phase teaching: Kidney yang warms and holds, qi secures what yin has built, and the luteal half is yang-dominant. Pen qi is gathered in the Chong vessel rather than discharged. Blood is full and waiting. The Ren and the Chong are in a state of relative repletion. When yang is adequate, the next bleed can arrive as a smooth release rather than a struggle. The calendar stays here from the day after an ovulation mark until bleeding is marked again. A long tail with no new bleed is still yang holding. It is not, by itself, news of a pregnancy, and this lens will not say that it is.",
    "What is typical is warmth, a fuller chest or abdomen, heavier sleep, and attention that would rather finish than open. Kidney yang is doing the work of containment. Late in the phase, Liver qi is easily constrained, because qi is abundant and must keep a path toward the next discharge. When Liver qi knots, the days before the bleed feel tight, irritable, swollen, or sad. That picture is well known in this medicine. It is still this phase. It is not a separate season, and it is not a fault of character. The sea is full and the gate has not yet opened. Blood is waiting on Liver qi to let it move when the time comes.",
    "What is worth doing is to support yang without stirring it into restlessness: warmth, regular rest, and tasks that consolidate. Leave room for Liver qi to course — a walk, a conversation that is actually finished, a day that is not packed past its edge — so fullness does not become a knot. When the bleed starts, mark it. That mark is the discharge of the sea of Blood, and it is what ends yang's hold. Pen qi can spend itself then. Asking it to spend early, before Blood is moving, confuses the two gates.",
    "What is worth not doing is to strongly move or purge Blood before the gate opens, as if late tightness were already the menses, or to decide from a short or long yang phase that Kidney yang is deficient. The marks can show duration. They cannot show the pulse, the tongue, or the gate of vitality. Spotting does not flip the phase into the bleed and does not cancel yang. A prescription would require a person in the room, not a calendar. This reading stops at the shape of the phase.",
  ],
}

const unknownChinese: CycleLensBody = {
  paragraphs: [
    "The calendar does not have enough bleed history yet to say whether Blood is moving, whether Kidney yin is growing, or whether Kidney yang is holding. Liver qi and pen qi are not given a task for this day, because the sea of Blood has no marked start to measure from.",
    "Mark bleeding when it happens. Until then this lens stays quiet on purpose. An unnamed day is more traditional than a costume of certainty.",
  ],
}

const menstrualEsoteric: CycleLensBody = {
  paragraphs: [
    "Retreat is the season of attention that belongs to these days. The bleed is the body's own closing of a chapter, and the matching inner motion is to step back from the width of the month. This is a lens, not a finding and not a rite you owe anyone. Nothing here has to be believed for the marks to remain true. The marks say blood is leaving. The lens says attention may leave with it: fewer fronts, a smaller room, a willingness to let the day be about what is ending.",
    "What is typical, in this reading, is a pull inward that can feel like fatigue, tenderness, or a sudden honesty about what no longer fits. Thoughts that were easy to postpone arrive and ask to be set down. The body wants warmth and a shorter reach. Some people experience the pull as relief, the way a shore feels when a tide goes out and the rocks are simply there. Others experience it as exposure. Both are retreat. Neither is a punishment, and neither means the other seasons have failed.",
    "What is worth doing is to make the retreat real in small, choosable ways. Fewer new promises. A softer schedule where you actually have the choice. A little time in which nothing is being improved. Attention in retreat is not blank. It is precise about endings. If writing helps, write what the month was. Mark the bleed. The later seasons on this calendar depend on this one being told the truth, not on it being beautiful.",
    "What is worth not doing is to glorify collapse, to frighten yourself with the idea that retreat means you are lost, or to demand that these days feel sacred. A lens is a way of looking. If the day is ordinary, crampy, and dull, that is a complete retreat. You do not have to perform depth, and you do not have to push the day into the shape of a rising one. The next season starts when the bleeding stops, not when a lesson has been extracted.",
  ],
}

const follicularEsoteric: CycleLensBody = {
  paragraphs: [
    "Rise is the season after retreat, when attention comes back out. On this calendar it is the follicular stretch: the bleed has ended, and no ovulation mark has said that a meeting occurred. As a lens, rise means the return of range. What was shed does not need to be replaced by an identical life. The days are for beginning, for looking farther, and for letting interest attach to something that was not available in the closed room of the bleed. No belief is required. The season describes how attention often behaves once the body is no longer spending the bleed. It does not describe a law.",
    "What is typical is a widening. Energy returns in uneven steps, not as an announcement. Curiosity gets specific. The future feels more thinkable, and the past less like the only room you are allowed to stand in. The body is rebuilding; this lens does not pretend to measure that. It notices that attention, given a chance, starts to lean forward. If the days are still tired, rise can be a slow incline. A season does not fail because it is undramatic.",
    "What is worth doing is to give the widening a real object. Start the thing that needed a clearer head. Learn. Arrange. Let plans stay provisional, because rise is not yet the meeting and not yet the ripening. Sleep and food belong to the season. Attention cannot rise on a body that is still empty, and pretending otherwise turns the lens into a whip. Leave the ovulation mark for the day you judge the turn, so this season is not closed early by a wish.",
    "What is worth not doing is to spend the whole rise proving that retreat is over, or to treat every open day as a debt to output. Rise is increase, not a contest, and not a promise that the month will crest on a certain date. If no ovulation is marked, this lens keeps calling the days rise, all the way to the next bleed. That is not a spiritual failure. It is the calendar refusing to invent a meeting you did not record.",
  ],
}

const ovulatoryEsoteric: CycleLensBody = {
  paragraphs: [
    "Meeting is the short season of the turn. It is the day you marked ovulation, when that day is not also a bleed. In this lens the image is a meeting between what has been growing and what will carry it: the inward work of rise comes to an edge and meets a decision, a piece of work, or simply the fact of its own fullness. This is not science, and it is not a teaching about fertility or about how to conduct a private life. It says that attention, at this gate, is briefly face to face with what the month has been building. You do not have to believe the meeting is mystical for the day to be worth noticing.",
    "What is typical is a brightness that does not last. Attention feels more outward, more edged, sometimes more tender at the same time. A choice that has stayed theoretical can feel present. The body may signal the turn in a way you already know how to read. The lens does not add a required sign, and it does not threaten you if the sign is absent. A meeting can be quiet. The useful part is that it is a gate. If you marked only this day, tomorrow the season is ripening. The meeting is not asked to become a personality.",
    "What is worth doing is to mark the day honestly and to give the gate a little room. Notice what, in the work of the month, is actually ready to be met — a conversation that needs a real answer, a commitment, a draft that needs a yes or a no. Then let the day end. The lens helps because it is brief. A meeting forced to last the whole month stops being a meeting and becomes a performance of intensity.",
    "What is worth not doing is to load the day with omen, to fear that a missed sensation means the month has no center, or to treat the mark as an instruction about desire. If you did not mark ovulation, there is no meeting on this calendar, and rise continues. That is allowed. Bleeding on the same day is retreat, not meeting, because the phase model lets the bleed win. The lens follows that rule so it does not tell two stories about one day.",
  ],
}

const lutealEsoteric: CycleLensBody = {
  paragraphs: [
    "Ripening is the season after the meeting, and it runs until the next bleed. In the other lens, yang is holding. Here the image is fruit that is no longer becoming and has not yet fallen. Attention turns toward what can be finished, sweetened, or stored. This is a way of looking at the shape of the days. It is not a claim about progesterone, and it is not a belief you must hold. The calendar calls the days luteal because an ovulation mark is still the latest event and bleeding has not been marked again. Ripening is the reading that fits that interval.",
    "What is typical is a heavier, warmer, more inward attention than rise, without the full retreat of the bleed. The work already in front of you may matter more than new work. Sleep asks for more of the night. Feelings that were easy to outrun can catch up, especially late in the season, when the month is full and the gate has not opened. That late pressure is still ripening. It is not a curse, and it is not evidence that the month was lived wrongly. Density can feel like irritability or like depth. This lens refuses to frighten you with either word.",
    "What is worth doing is to finish, to edit, to care, and to put away what the rise opened. Ripening is a sound season for judgment of a plain kind: what is actually good, what is finished, what should not be carried into the next retreat. Keep the days a little spacious, so fullness does not turn into a knot of unfinished talk. When bleeding starts, mark it. Retreat begins on that mark, and ripening's job is done. Leaving the bleed unmarked asks this season to continue after the fruit has already fallen.",
    "What is worth not doing is to open a second whole life in a season whose gift is completion, or to read a long stretch without a new bleed as a sign from outside the world. The calendar is not an oracle. A luteal tail means the marks have not yet recorded a bleed. Ripening can simply continue. Spotting does not end the season and does not start the retreat. You are not required to feel ripe, wise, or peaceful. Ordinary tiredness is a faithful reading of these days.",
  ],
}

const unknownEsoteric: CycleLensBody = {
  paragraphs: [
    "The calendar does not have enough bleed history yet, so retreat, rise, meeting, and ripening are not assigned. This lens does not invent a season for a day that sits before the first bleed and outside any ovulation mark.",
    "It will speak when the marks give it a turn to name. Until then the day is just the day, and no belief is asked of you in the meantime.",
  ],
}

export const CYCLE_LENS_COPY: Record<CyclePhase, Record<CycleLensId, CycleLensBody>> = {
  menstrual: { clinical: menstrualClinical, chinese: menstrualChinese, esoteric: menstrualEsoteric },
  follicular: { clinical: follicularClinical, chinese: follicularChinese, esoteric: follicularEsoteric },
  ovulatory: { clinical: ovulatoryClinical, chinese: ovulatoryChinese, esoteric: ovulatoryEsoteric },
  luteal: { clinical: lutealClinical, chinese: lutealChinese, esoteric: lutealEsoteric },
  unknown: { clinical: unknownClinical, chinese: unknownChinese, esoteric: unknownEsoteric },
}

export function cycleLensParagraphs(phase: CyclePhase, lens: CycleLensId): readonly string[] {
  return CYCLE_LENS_COPY[phase][lens].paragraphs
}
