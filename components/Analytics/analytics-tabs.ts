/**
 * components/Analytics/analytics-tabs.ts — Analytics groups + views
 *
 * Categories live on a studio index; the views of the selected group sit
 * beneath. Item Types is a first-class Library view (Settings still edits types).
 */
export const ANALYTICS_TAB_GROUPS = [
  {
    id: "behavior",
    label: "Behavior",
    tabs: [
      { id: "habits", label: "Habits" },
      { id: "streaks", label: "Streaks" },
      { id: "points", label: "Points" },
      { id: "velocity", label: "Velocity" },
      { id: "reflection", label: "Reflection" },
      { id: "todo-pulse", label: "To-do pulse" },
      { id: "reviews", label: "Reviews" },
      { id: "overcommit", label: "Overcommit" },
    ],
  },
  {
    id: "time",
    label: "Time",
    tabs: [
      { id: "tracking", label: "Tracking" },
      { id: "sleep", label: "Sleep" },
      { id: "screentime", label: "Screen Time" },
      { id: "circadian", label: "Circadian" },
      { id: "places", label: "Places" },
      { id: "mood-field", label: "Mood field" },
      { id: "diversity", label: "Diversity" },
      { id: "transitions", label: "Transitions" },
      { id: "context-switch", label: "Context Switch" },
      { id: "text-events", label: "Text events" },
      { id: "text-spans", label: "Text spans" },
      { id: "operations", label: "Operations" },
    ],
  },
  {
    id: "accuracy",
    label: "Accuracy",
    tabs: [
      { id: "plan", label: "Plan vs Reality" },
      { id: "calibration", label: "Calibration" },
      { id: "cycle", label: "Cycle" },
      { id: "regret", label: "Regret" },
      { id: "goals", label: "Goals" },
    ],
  },
  {
    id: "meta",
    label: "Meta",
    tabs: [
      { id: "observatory", label: "Observatory" },
      { id: "cross-section", label: "Cross-section" },
      { id: "metrics", label: "Metrics" },
      { id: "correlation", label: "Correlation" },
      { id: "spectrum", label: "Spectrum" },
    ],
  },
  {
    id: "library",
    label: "Library",
    tabs: [
      { id: "item-types", label: "Item Types" },
      { id: "lists-areas", label: "Lists & areas" },
      { id: "attributes", label: "Attributes" },
      { id: "tags", label: "Tags" },
      { id: "stages", label: "Stages" },
      { id: "weight", label: "Weight" },
    ],
  },
] as const

export type AnalyticsTabGroup = (typeof ANALYTICS_TAB_GROUPS)[number]
export type AnalyticsGroupId = AnalyticsTabGroup["id"]
export const ANALYTICS_TABS = ANALYTICS_TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.id))
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

export function groupForTab(tab: AnalyticsTab): AnalyticsTabGroup {
  return ANALYTICS_TAB_GROUPS.find((g) => g.tabs.some((t) => t.id === tab)) ?? ANALYTICS_TAB_GROUPS[0]
}

export function tabLabel(tab: AnalyticsTab): string {
  for (const group of ANALYTICS_TAB_GROUPS) {
    const found = group.tabs.find((t) => t.id === tab)
    if (found) return found.label
  }
  return tab
}

export function firstTabInGroup(groupId: AnalyticsGroupId): AnalyticsTab {
  const group = ANALYTICS_TAB_GROUPS.find((g) => g.id === groupId) ?? ANALYTICS_TAB_GROUPS[0]
  return group.tabs[0].id
}

/** One instruction per view. Always keep these honest and specific. */
export const ANALYTICS_TAB_HELP: Record<AnalyticsTab, string> = {
  habits:
    "Daily completion for the shared window. Heatmap cells are percent of habits met that day. Bars sort by rate. Week/month grades use the same math as Home Habits. Horizon folds daily % into three bands; the slopegraph is weekday vs weekend rate per habit.",
  streaks:
    "Current and longest runs are all-time, not clipped to this window. Home glance and this tab stay separate on purpose.",
  points:
    "Daily points stacked by source (habit / bonus / task). Top earners open those items in Lists.",
  velocity:
    "Completions and points per day, plus median time from start (or create) to done. Display only — does not nag.",
  reflection:
    "Satisfaction, resistance, focus, and distraction (1–10) from completion reviews. Thin samples stay unlabeled.",
  "todo-pulse":
    "Morning walkthrough fields on to-dos: tier, expected duration, points, day importance (0–10), resistance readings over time (0–10, many samples), and day excitement (0–10). Each number is labeled. Text-pipeline mornings stay tagged as from BIM.",
  reviews:
    "Saved period + morning reviews. Morning cards show all-nighter, affirmations, to-dos, priorities, habit priorities, day plan, circumstances, best day, gratitude (BIM text-pipeline labeled). Expand a period card for evening text. Blocked-reason mosaic is counts, not a ranking.",
  overcommit:
    "Reconstructed day-pushes and logged minutes. This tab does not reschedule anything.",
    tracking:
    "Same minutes as Home → Tracking. Pie and mosaic are the same slices: click either to drill. The drill lists every block in the window; click a slice to filter, click a block to edit it. % of tracked vs % of day are both meant. Include assumed if you want estimated blocks in the total. Block-length violin is duration of painted spans; hour × pen small multiples share Circadian's 24 columns.",
  sleep:
    "Nights from the sleep log and Sleep-painted grid, same stretch as Tracking. ~ means an end was estimated; est. means the night was read off paint. Blank nights are excluded from averages, not counted as zero. Ridgelines are Gaussian KDEs of duration and bedtime by weekday. Against the sun uses each day's stored sunrise/sunset (not today's clock on every night); productivity and joy around the sun can join later.",
  screentime:
    "Active vs untracked from ActivityWatch-painted Screen Time scope; AFK is untracked; alignment vs human Activity occupancy; last-sync from prefs.",
  circadian:
    "Hour × day occupancy. Empty cells are missing hours, not zero work. Instants have no duration and stay off the heat. The weekday cycle plot is Cleveland's mean occupancy by hour, one row per weekday.",
  places:
    "Location pens as time-at-pen. No coordinates are stored, so this is not a map. Depth uses the same rungs as Tracking.",
  "mood-field":
    "Painted Mood pens plus logged joy / suffering / alignment when n allows. Spec §15 cognitive-state trends.",
  diversity:
    "Shannon entropy of Tracking pens per day (H = −Σ p log₂ p of that day's minute shares) plus Gini of the window's pen totals and weekday vs weekend occupancy. 0 bits = one pen took the day.",
  transitions:
    "Markov matrix of Tracking pen changes: P(to | from) among switches only. Same-pen continuation is not a transition. Rows sum to 1. The alluvial below uses raw switch counts (not p, not duration).",
  "context-switch":
    "A switch is a pen change: one block ending and another beginning. Hour-of-day shows when fragmentation clusters.",
  "text-events":
    "Activity instants from the phone text pipeline (log:, discrete triggers, switch markers). Always labeled from text pipeline. Counts by day in the shared Analytics range.",
  "text-spans":
    "currently / stopped / switched Activity intervals stamped by the text pipeline. Shows painted durations and switch-instant counts. Always labeled from text pipeline.",
  operations:
    "Operation items: stage/category mosaic and work vs neglect from timeLogs. Does not restyle the Operations module.",
  plan:
    "Planned minutes (tasks + calendar events) vs actual. Capacity vs the waking window is labeled ~ when sleep is inferred.",
  calibration:
    "Estimate vs actual. Findings print only when n clears the floor. PERT bands appear only on items that have a three-point estimate.",
    cycle:
    "How often items were pushed, how old open important items are (survival of the current stock plus a beeswarm of ages), and how often estimates were confirmed.",
  regret:
    "Accrued cost of important items sitting undone past due. Not a to-do list.",
  goals:
    "Objective contribution and neglected goals in this window. Open those items in Lists.",
  observatory:
    "Classical Pearson r on inner-joined calendar days. Correlation is not causation. Thin overlap is watermarked, not a finding.",
  "cross-section":
    "Linked density: hover or pin a day to highlight the same column in every series. Missing nights stay blank.",
  metrics:
    "All five wellbeing series as small multiples. Pick one for the detail chart. Log {name} writes into the same store as header Metrics.",
  correlation:
    "Pairwise Pearson matrix. Click a cell for the scatter and sentence. Not a chart builder.",
  spectrum:
    "Lag-1 / lag-7 autocorrelation of daily habit % and of sleep duration, a naive DFT periodogram of habit %, and coefficient of variation of sleep. Classical only — not a forecast.",
  "item-types":
    "Every item type by count. Settings still edits schemas. Open in Lists jumps to those items.",
  "lists-areas":
    "Lists sized by item count (area ∝ n). Switch to Rate for completion %. Click a tile to open that list.",
  attributes:
    "Histograms from type and list schemas that already exist. Not a custom formula builder.",
  tags:
    "Free-form item tags. Area follows how many items carry the tag. The UpSet matrix counts exact tag combinations. Click to open those items.",
  stages:
    "Lifecycle bucket (inbox / clarified / scheduled / completed / list). This is Task.stage, not a list name.",
  weight:
    "Importance, cognitive load, and entropy already stored on items. Missing values stay missing.",
}
