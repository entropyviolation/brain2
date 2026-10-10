/**
 * lib/points-rules.ts — Global points-rule catalog (pure)
 *
 * One row per aggregated rule: label, default, clamp, where the live number
 * lives, and the explanation shown in Settings → Points rules.
 *
 * `home: "pointsRules"` is the map on `user-settings` (persist v5). Missing
 * keys mean the defaults below, so an existing install does not change until
 * a row is edited.
 *
 * `home: "userSettings"` and `home: "habits"` already have their own fields.
 * The popup writes through those setters. It does not copy them into the map.
 *
 * Award paths read the live number via `pointsRuleValue` in
 * `points-rules-live.ts`. These constants stay the defaults and the fallback
 * when a reader is not bound yet.
 *
 * Clamps match the helpers those stores already use
 * (`clampAccomplishmentBonus`, `clampAccomplishmentThreshold`,
 * `clampMorningRitualPointMultiplier`, `clampFocusMultiplier`,
 * `clampPointAmount`) without importing them — habit priority already imports
 * habit points, and habit points reads this catalog.
 */

export const POINTS_RULE_SECTIONS = [
  "Inbox",
  "Schedule",
  "Habits",
  "Lists and completion",
  "Goals and multipliers",
  "Rituals",
  "Reviews",
  "Friends",
  "Penalties / Regret",
] as const

export type PointsRuleSection = (typeof POINTS_RULE_SECTIONS)[number]

export type PointsRuleId =
  | "inbox.handlePoints"
  | "inbox.clearBonus"
  | "schedule.placementPoints"
  | "habit.dailyFullMark"
  | "habit.defaultPoints.daily"
  | "habit.defaultPoints.weekly"
  | "habit.defaultPoints.monthly"
  | "habit.defaultPoints.seasonal"
  | "habit.gradeBonusEither"
  | "habit.gradeBonusBoth"
  | "habit.gradeBonusThreshold"
  | "habit.accomplishmentThreshold"
  | "habit.accomplishmentBonus"
  | "habit.dayLiftBonus"
  | "habit.weeklyLiftBonus"
  | "habit.weeklyAvgBeatBonus"
  | "habit.monthlyAvgBeatBonus"
  | "habit.morningRitualDisplayMult"
  | "list.defaultCompletionPoints"
  | "list.beatTheClockMaxBonus"
  | "tiers.bareMinPoints"
  | "tiers.goalPoints"
  | "tiers.exceptionalPoints"
  | "tiers.bonusPerUnit"
  | "objective.defaultMultiplier"
  | "objective.prioritySeedMultiplier"
  | "goalFocus.multiplier"
  | "goal.defaultPoints"
  | "goal.actionBasePoints"
  | "ritual.sectionPoints"
  | "ritual.completionBonus"
  | "review.quickBase"
  | "review.pointsPerWord"
  | "friend.rewardBase"
  | "friend.rewardScaleDivisor"
  | "regret.minDailyWeight"

export type PointsRuleHome = "pointsRules" | "userSettings" | "habits"

export type PointsRuleClampKind =
  | "points"
  | "ritualPoints"
  | "habitPoints"
  | "habitThreshold"
  | "multiplier"
  | "focus"
  | "percent"
  | "morning"
  | "fraction"
  | "divisor"

export interface PointsRuleDef {
  id: PointsRuleId
  section: PointsRuleSection
  label: string
  unit: string
  defaultValue: number
  clamp: PointsRuleClampKind
  step: number
  min: number
  max: number
  home: PointsRuleHome
  /** Field on that store. Nested habit defaults use `defaultHabitPoints.daily`. */
  stateKey: string
  explanation: string
}

const stays =
  "Changing this does not rewrite points already in the ledger. The next time this happens, the new number is what gets saved."

const habitDaySync =
  "Saving a new number can rewrite those day rows the next time habits sync. The app already replaces those rows when habits sync, so the ledger catches up. Other ledger rows stay as they were written."

const habitWeekSync =
  "Saving a new number can rewrite that week’s lift row the next time habits sync. The app already replaces that row when habits sync. Other ledger rows stay as they were written."

const replaceOnResubmit =
  "Changing this does not by itself rewrite the ledger. Submitting that ritual or report again replaces its one row with the new total."

const replaceOnReviewSave =
  "Changing this does not by itself rewrite the ledger. Saving that quick review again replaces its one row."

export const POINTS_RULES_ITEM_NOTE =
  "Some rewards stay on the thing they belong to. This list does not edit them. A habit’s own points field is what a weekly, monthly, or season habit pays the first time its goal is met, and it is what the default-points rows stamp onto a new habit. A goal’s own points field, an item’s own reward, and a list’s Points attribute or formula (including a tier ladder already saved on that list) stay on that item. The multiplier you later set on one objective for one specific period stays on that objective. A friend’s personality reward scale stays on that friend — the friend rows here are only the base and the divisor."

export const POINTS_RULES: readonly PointsRuleDef[] = [
  {
    id: "inbox.handlePoints",
    section: "Inbox",
    label: "Handle an inbox idea",
    unit: "pts",
    defaultValue: 1,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "inbox.handlePoints",
    explanation: `You earn this when you clarify one inbox idea or discard one inbox idea. Each idea is its own grant. Emptying the inbox is a separate bonus and is not included here. ${stays}`,
  },
  {
    id: "inbox.clearBonus",
    section: "Inbox",
    label: "Inbox clear bonus",
    unit: "pts",
    defaultValue: 50,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "inbox.clearBonus",
    explanation: `You earn this once when the open inbox count goes from more than zero to zero. Handling an idea while others are still open does not pay it. Opening a new idea later and clearing again can pay it again. It is not added to each idea. ${stays}`,
  },
  {
    id: "schedule.placementPoints",
    section: "Schedule",
    label: "Place on the schedule",
    unit: "pts",
    defaultValue: 1,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "schedule.placementPoints",
    explanation: `You earn this when a task moves into a different period bucket: a day, week, month, or year. Dropping it on Eventually or Later does not pay. Unscheduling does not pay. Removing it from the scheduler does not pay. Dropping it on the bucket it is already in does not pay. ${stays}`,
  },
  {
    id: "habit.dailyFullMark",
    section: "Habits",
    label: "Daily habit full mark",
    unit: "pts",
    defaultValue: 50,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "habit.dailyFullMark",
    explanation: `A daily habit pays this full mark times that day’s completion ratio. Half done earns half of this number. A finished boolean earns the whole mark. This is the daily ledger line. It does not use the habit’s own points field. That field is what a weekly, monthly, or season habit pays the first time its goal is met, and it is what the default-points rows stamp onto a new habit. The morning-review × is a mark on the habit, not a multiplier of this line. ${habitDaySync}`,
  },
  {
    id: "habit.defaultPoints.daily",
    section: "Habits",
    label: "New daily habit points",
    unit: "pts",
    defaultValue: 10,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "defaultHabitPoints.daily",
    explanation: `This number is stamped onto a new daily habit’s own points field when you create it and that field is empty. It does not pay the daily ledger. The daily ledger uses the daily full mark times that day’s completion ratio. Changing this does not change a habit that already has its own number, and it does not rewrite points already earned. The same four defaults are in Habits → Settings.`,
  },
  {
    id: "habit.defaultPoints.weekly",
    section: "Habits",
    label: "New weekly habit points",
    unit: "pts",
    defaultValue: 10,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "defaultHabitPoints.weekly",
    explanation: `This number is stamped onto a new weekly habit’s own points field when you create it and that field is empty. A weekly habit pays that field the first time its goal is met. It is not the daily full mark, and it is not scaled by a completion ratio each day. Changing this does not change a habit that already has its own number, and it does not rewrite points already earned.`,
  },
  {
    id: "habit.defaultPoints.monthly",
    section: "Habits",
    label: "New monthly habit points",
    unit: "pts",
    defaultValue: 10,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "defaultHabitPoints.monthly",
    explanation: `This number is stamped onto a new monthly habit’s own points field when you create it and that field is empty. A monthly habit pays that field the first time its goal is met. It is not the daily full mark. Changing this does not change a habit that already has its own number, and it does not rewrite points already earned.`,
  },
  {
    id: "habit.defaultPoints.seasonal",
    section: "Habits",
    label: "New season habit points",
    unit: "pts",
    defaultValue: 10,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "defaultHabitPoints.seasonal",
    explanation: `This number is stamped onto a new season habit’s own points field when you create it and that field is empty. A season habit pays that field the first time its goal is met. It is not the daily full mark. Changing this does not change a habit that already has its own number, and it does not rewrite points already earned.`,
  },
  {
    id: "habit.gradeBonusEither",
    section: "Habits",
    label: "Grade bonus, one rail",
    unit: "pts",
    defaultValue: 100,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "habit.gradeBonusEither",
    explanation: `Once per day, if the Week grade or Perfect output — but not both — is at or above the grade-bonus threshold, the day earns this. If both rails clear the threshold, the day earns the both-rails bonus instead, not this one added on top. The rails are read after their curves. This is not the Good-day accomplishment bonus, and it is not the morning-review mark. ${habitDaySync}`,
  },
  {
    id: "habit.gradeBonusBoth",
    section: "Habits",
    label: "Grade bonus, both rails",
    unit: "pts",
    defaultValue: 300,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "habit.gradeBonusBoth",
    explanation: `Once per day, if the Week grade and Perfect output are both at or above the grade-bonus threshold, the day earns this instead of the one-rail bonus. The two bonuses are not added together. The rails are read after their curves. This is not the Good-day accomplishment bonus. ${habitDaySync}`,
  },
  {
    id: "habit.gradeBonusThreshold",
    section: "Habits",
    label: "Grade bonus threshold",
    unit: "%",
    defaultValue: 75,
    clamp: "percent",
    step: 1,
    min: 0,
    max: 100,
    home: "pointsRules",
    stateKey: "habit.gradeBonusThreshold",
    explanation: `This is the percent a Week grade or Perfect output must reach, after its curve, before the one-rail or both-rails grade bonus can pay. It is not the Good-day line. A day under this percent on both rails earns neither grade bonus. 0 means any grade of zero or more clears it. 100 means only a full rail clears it. ${habitDaySync}`,
  },
  {
    id: "habit.accomplishmentThreshold",
    section: "Habits",
    label: "Good day threshold",
    unit: "%",
    defaultValue: 80,
    clamp: "habitThreshold",
    step: 1,
    min: 1,
    max: 100,
    home: "habits",
    stateKey: "accomplishmentThreshold",
    explanation: `A Good day is when that day’s raw daily-habit completion is at or above this percent. Raw means the checklist itself, before the letter-grade curve. It is not the Week-grade threshold. The lowest it can be stored is 1, so a blank or 0 becomes 1. The same field is in Habits → Settings. ${habitDaySync}`,
  },
  {
    id: "habit.accomplishmentBonus",
    section: "Habits",
    label: "Good day bonus",
    unit: "pts",
    defaultValue: 50,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "accomplishmentBonus",
    explanation: `When that day’s raw daily-habit completion meets the Good day threshold, the day earns this once. It does not pay per habit. It does not pay when the day is under the threshold. 0 turns it off. The same field is in Habits → Settings. ${habitDaySync}`,
  },
  {
    id: "habit.dayLiftBonus",
    section: "Habits",
    label: "Beat yesterday",
    unit: "pts",
    defaultValue: 25,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "dayGradeLiftBonus",
    explanation: `If today’s raw daily-habit completion is higher than yesterday’s, this many points are added once. Equal or lower pays nothing. It does not pay per habit, and it does not look at the Week grade. 0 turns it off. The same field is in Habits → Settings. ${habitDaySync}`,
  },
  {
    id: "habit.weeklyLiftBonus",
    section: "Habits",
    label: "Beat last week",
    unit: "pts",
    defaultValue: 25,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "weeklyGradeLiftBonus",
    explanation: `Each rail — Week grade and Perfect output — that is higher than the prior calendar week pays this once. Both rails up pays it twice. A rail that stayed the same or fell pays nothing. 0 turns it off. The same field is in Habits → Settings. ${habitWeekSync}`,
  },
  {
    id: "habit.weeklyAvgBeatBonus",
    section: "Habits",
    label: "Beat the prior 7 days",
    unit: "pts",
    defaultValue: 5,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "weeklyAverageBeatBonus",
    explanation: `If today’s raw daily-habit completion is higher than the average of the prior 7 days, this many points are added once. Equal is not higher. It can pay on the same day as the 30-day rule. 0 turns it off. The same field is in Habits → Settings. ${habitDaySync}`,
  },
  {
    id: "habit.monthlyAvgBeatBonus",
    section: "Habits",
    label: "Beat the prior 30 days",
    unit: "pts",
    defaultValue: 5,
    clamp: "habitPoints",
    step: 1,
    min: 0,
    max: 10_000,
    home: "habits",
    stateKey: "monthlyAverageBeatBonus",
    explanation: `If today’s raw daily-habit completion is higher than the average of the prior 30 days, this many points are added once. Equal is not higher. It can pay on the same day as the 7-day rule. 0 turns it off. The same field is in Habits → Settings. ${habitDaySync}`,
  },
  {
    id: "habit.morningRitualDisplayMult",
    section: "Habits",
    label: "Morning review mark",
    unit: "×",
    defaultValue: 5,
    clamp: "morning",
    step: 1,
    min: 0,
    max: 99,
    home: "habits",
    stateKey: "morningRitualPointMultiplier",
    explanation:
      "This is a mark on a habit the morning review prioritized. The habit shows this times sign so you can see it was picked. It does not multiply the daily ledger, the grade bonus, or any other award. 0 hides the mark. The highest it can go is 99. Changing it does not rewrite points already earned, because it never wrote them. The same field is in Habits → Settings.",
  },
  {
    id: "list.defaultCompletionPoints",
    section: "Lists and completion",
    label: "Default completion points",
    unit: "pts",
    defaultValue: 1,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "list.defaultCompletionPoints",
    explanation: `This is the base when you complete a list or to-do item that has no Points attribute and no reward of its own. A Points attribute or formula on the list replaces this base. An item’s own reward replaces it when the item is not a next action. Next actions can then add the beat-the-clock bonus on top of whatever the base became. ${stays}`,
  },
  {
    id: "list.beatTheClockMaxBonus",
    section: "Lists and completion",
    label: "Beat the clock cap",
    unit: "×",
    defaultValue: 0.2,
    clamp: "fraction",
    step: 0.01,
    min: 0,
    max: 1,
    home: "pointsRules",
    stateKey: "list.beatTheClockMaxBonus",
    explanation: `Only next actions. If you finish under the estimate, the base is multiplied by 1 plus a fraction of this cap. Finishing in half the estimated time uses half the cap. Finishing instantly uses the whole cap. Finishing on time or late adds nothing. 0.2 means up to 20% extra. 0 turns the bonus off. 1 means an instant finish can double the base. It does not apply to other list items, and it does not change a Points formula. ${stays}`,
  },
  {
    id: "tiers.bareMinPoints",
    section: "Lists and completion",
    label: "Tier bare-minimum points",
    unit: "pts",
    defaultValue: 1,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "tiers.bareMinPoints",
    explanation: `When a completion-tier set is created, clearing the bare-minimum threshold is written into that list’s Points formula as this many points. Changing it does not rewrite a formula already stored on a list, and it does not rewrite points already earned. The next tier set you create uses the new number.`,
  },
  {
    id: "tiers.goalPoints",
    section: "Lists and completion",
    label: "Tier goal points",
    unit: "pts",
    defaultValue: 10,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "tiers.goalPoints",
    explanation: `When a completion-tier set is created, clearing the goal threshold is written into that list’s Points formula as this many points. Changing it does not rewrite a formula already stored on a list, and it does not rewrite points already earned. The next tier set you create uses the new number.`,
  },
  {
    id: "tiers.exceptionalPoints",
    section: "Lists and completion",
    label: "Tier exceptional points",
    unit: "pts",
    defaultValue: 50,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "tiers.exceptionalPoints",
    explanation: `When a completion-tier set is created, clearing the exceptional threshold is written into that list’s Points formula as this many points, plus the per-unit bonus for anything past that threshold. Changing it does not rewrite a formula already stored on a list, and it does not rewrite points already earned. The next tier set you create uses the new number.`,
  },
  {
    id: "tiers.bonusPerUnit",
    section: "Lists and completion",
    label: "Tier extra per unit",
    unit: "pts",
    defaultValue: 1,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "tiers.bonusPerUnit",
    explanation: `When a completion-tier set is created, each unit past the exceptional threshold adds this many points inside that list’s Points formula. 1 means one extra point per extra unit. 0 means exceptional pays a flat amount with nothing added past it. Changing it does not rewrite a formula already stored on a list, and it does not rewrite points already earned. The next tier set you create uses the new number.`,
  },
  {
    id: "objective.defaultMultiplier",
    section: "Goals and multipliers",
    label: "Objective default multiplier",
    unit: "×",
    defaultValue: 1.5,
    clamp: "multiplier",
    step: 0.1,
    min: 0.01,
    max: 100,
    home: "pointsRules",
    stateKey: "objective.defaultMultiplier",
    explanation: `When work serves an objective that is not prioritized for the current period, that objective contributes this multiplier. If the work serves several objectives, their multipliers multiply together. A period priority stores its own multiplier on the objective and is used instead of this default for that period. This does not multiply with tomorrow’s goal focus: when both would boost the same completion, the larger one is kept. It cannot be 0 or negative. ${stays} It also does not change a priority already saved.`,
  },
  {
    id: "objective.prioritySeedMultiplier",
    section: "Goals and multipliers",
    label: "First priority multiplier",
    unit: "×",
    defaultValue: 2,
    clamp: "multiplier",
    step: 0.1,
    min: 0.01,
    max: 100,
    home: "pointsRules",
    stateKey: "objective.prioritySeedMultiplier",
    explanation: `The first time you prioritize an objective for a period, the multiplier written on that period starts at this number. After that you can edit that period’s multiplier on the objective, and that later edit is not this row. Changing the seed does not change priorities already saved, and it does not rewrite points already earned. It cannot be 0 or negative.`,
  },
  {
    id: "goalFocus.multiplier",
    section: "Goals and multipliers",
    label: "Tomorrow’s goal focus",
    unit: "×",
    defaultValue: 1.5,
    clamp: "focus",
    step: 0.1,
    min: 1,
    max: 100,
    home: "userSettings",
    stateKey: "goalFocusMultiplier",
    explanation:
      "Goals you focus for tomorrow use this multiplier on tasks that serve those goals, or an objective those goals serve. It also makes those tasks more likely to be picked when a friend suggests work. That pick weight is the same number; it is not a second grant. It composes with an objective multiplier by keeping the larger one, not by multiplying them. 1 means no boost. It cannot be set below 1. Beat-the-clock stays inside the base and is not part of this. Changing it does not rewrite points already earned.",
  },
  {
    id: "goal.defaultPoints",
    section: "Goals and multipliers",
    label: "New goal points",
    unit: "pts",
    defaultValue: 20,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "goal.defaultPoints",
    explanation: `The points field on a new goal starts at this number. It is that goal’s own points, not a ledger award by itself. Changing the default does not change goals you already created, and it does not rewrite points already earned.`,
  },
  {
    id: "goal.actionBasePoints",
    section: "Goals and multipliers",
    label: "Goal action base",
    unit: "pts",
    defaultValue: 1,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "goal.actionBasePoints",
    explanation: `When you log a completed action on a goal, the points are this base times the objective multiplier for the objectives that goal serves. Tomorrow’s goal-focus multiplier is not applied on this button. ${stays}`,
  },
  {
    id: "ritual.sectionPoints",
    section: "Rituals",
    label: "Ritual section",
    unit: "pts",
    defaultValue: 10,
    clamp: "ritualPoints",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "userSettings",
    stateKey: "ritualSectionPoints",
    explanation: `When you submit a ritual or a Star Lord report, each section you actually filled or confirmed pays this many points. A section left blank is skipped. A section that had nothing to settle still counts. Closing without submitting saves a draft and awards nothing, including no sections. Week, month, season, and year count each answered question. Fear and its reframe are one section. A photo with no caption counts as inspiration. The stats panel is not a question. ${replaceOnResubmit}`,
  },
  {
    id: "ritual.completionBonus",
    section: "Rituals",
    label: "Whole ritual bonus",
    unit: "pts",
    defaultValue: 30,
    clamp: "ritualPoints",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "userSettings",
    stateKey: "ritualCompletionBonus",
    explanation: `Submitting the whole ritual or Star Lord report adds this bonus once, on top of the section points. A draft awards nothing, including no bonus. ${replaceOnResubmit}`,
  },
  {
    id: "review.quickBase",
    section: "Reviews",
    label: "Quick review base",
    unit: "pts",
    defaultValue: 3,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "review.quickBase",
    explanation: `Turning on the quick review on a finished task pays this many points before any words. The notes add the per-word amount on top. A later Reflect note is not this review and does not change the award. ${replaceOnReviewSave}`,
  },
  {
    id: "review.pointsPerWord",
    section: "Reviews",
    label: "Quick review per word",
    unit: "pts",
    defaultValue: 0.1,
    clamp: "points",
    step: 0.1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "review.pointsPerWord",
    explanation: `Each whitespace-separated word in the quick-review notes adds this many points. Punctuation stays on the word it touches, so “well-known” is one word. Empty notes add nothing extra, so you still get the base. Only those notes count, not a later Reflect note. ${replaceOnReviewSave}`,
  },
  {
    id: "friend.rewardBase",
    section: "Friends",
    label: "Friend mission base",
    unit: "pts",
    defaultValue: 2,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "friend.rewardBase",
    explanation: `When a friend mission is finished, the points are the larger of 1 and the rounded sum of this base plus the friend’s personality reward scale divided by the scale divisor. The scale is clamped between 0 and 100 and stays on that friend. This row does not edit it. Trinkets and nest furniture are not this grant. ${stays}`,
  },
  {
    id: "friend.rewardScaleDivisor",
    section: "Friends",
    label: "Friend scale divisor",
    unit: "",
    defaultValue: 12,
    clamp: "divisor",
    step: 1,
    min: 0.01,
    max: 10_000,
    home: "pointsRules",
    stateKey: "friend.rewardScaleDivisor",
    explanation: `The friend’s personality reward scale (0 to 100) is divided by this number and then added to the friend mission base. A larger divisor makes the personality scale matter less. It has to stay above 0. The scale itself stays on the friend. ${stays}`,
  },
  {
    id: "regret.minDailyWeight",
    section: "Penalties / Regret",
    label: "Empty-item daily regret",
    unit: "pts",
    defaultValue: 1,
    clamp: "points",
    step: 1,
    min: 0,
    max: 1_000_000,
    home: "pointsRules",
    stateKey: "regret.minDailyWeight",
    explanation: `Each day an overdue item stays undone, regret goes up by its importance plus its urgency plus its reward. When that sum is 0, the day costs this floor instead. A positive sum ignores the floor. Completing the item stops new regret. This is the cost side of the same scoring story, not a grant. Changing the floor does not rewrite regret already written. The next day that accrues uses the new floor.`,
  },
]

const BY_ID = new Map<PointsRuleId, PointsRuleDef>(POINTS_RULES.map((rule) => [rule.id, rule]))

export function isPointsRuleId(value: string): value is PointsRuleId {
  return BY_ID.has(value as PointsRuleId)
}

export function pointsRuleDef(id: PointsRuleId): PointsRuleDef {
  return BY_ID.get(id)!
}

function clampPoints(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const n = Math.round(value * 100) / 100
  if (n < 0) return 0
  return Math.min(1_000_000, n)
}

function clampMultiplier(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(100, Math.round(value * 100) / 100)
}

function clampPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(0, Math.round(value)))
}

function clampFraction(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000))
}

function clampDivisor(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(10_000, Math.round(value * 100) / 100)
}

/** Same range as `clampAccomplishmentBonus`: 0…10_000, whole points. */
function clampHabitPoints(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(10_000, Math.max(0, Math.round(value)))
}

/** Same range as `clampAccomplishmentThreshold`: 1…100. */
function clampHabitThreshold(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(1, Math.round(value)))
}

/** Same as `clampMorningRitualPointMultiplier`: 0…99, whole numbers. 0 hides the mark. */
function clampMorning(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(99, Math.max(0, Math.round(value)))
}

/** Same as `clampFocusMultiplier`: below 1 becomes 1. */
function clampFocus(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.round(value * 100) / 100
}

/** Same as `clampPointAmount`: non-negative whole points. */
function clampRitualPoints(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.round(value))
}

export function clampPointsRule(id: PointsRuleId, value: number): number {
  const rule = pointsRuleDef(id)
  switch (rule.clamp) {
    case "points":
      return clampPoints(value, rule.defaultValue)
    case "ritualPoints":
      return clampRitualPoints(value, rule.defaultValue)
    case "habitPoints":
      return clampHabitPoints(value, rule.defaultValue)
    case "habitThreshold":
      return clampHabitThreshold(value, rule.defaultValue)
    case "multiplier":
      return clampMultiplier(value, rule.defaultValue)
    case "focus":
      return clampFocus(value)
    case "percent":
      return clampPercent(value, rule.defaultValue)
    case "morning":
      return clampMorning(value, rule.defaultValue)
    case "fraction":
      return clampFraction(value, rule.defaultValue)
    case "divisor":
      return clampDivisor(value, rule.defaultValue)
    default:
      return rule.defaultValue
  }
}

/** Drop unknown keys and values that are already the default. */
export function sanitizePointsRules(value: unknown): Partial<Record<PointsRuleId, number>> {
  if (!value || typeof value !== "object") return {}
  const out: Partial<Record<PointsRuleId, number>> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isPointsRuleId(key)) continue
    const rule = pointsRuleDef(key)
    if (rule.home !== "pointsRules") continue
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue
    const next = clampPointsRule(key, raw)
    if (next !== rule.defaultValue) out[key] = next
  }
  return out
}
