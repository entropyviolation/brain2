/**
 * components/Analytics/chrome/analytics-tabs.ts — Data groups + views
 *
 * Categories live on a studio index; the views of the selected group sit
 * beneath. Item Types is a first-class Library view (Settings still edits types).
 * Sources hosts reports built from outside data exports (Instagram).
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
      { id: "seasons", label: "Seasons" },
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
      { id: "people", label: "People" },
      { id: "mood-field", label: "Mood field" },
      { id: "diversity", label: "Diversity" },
      { id: "transitions", label: "Transitions" },
      { id: "context-switch", label: "Context Switch" },
      { id: "text-events", label: "Text events" },
      { id: "text-spans", label: "Text spans" },
      { id: "log", label: "Log" },
      { id: "wardrobe", label: "Wardrobe" },
      { id: "cycle-phase", label: "Cycle phase" },
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
      { id: "research-report", label: "Produce research report" },
    ],
  },
  {
    id: "texts",
    label: "Texts",
    tabs: [{ id: "texts-report", label: "Report" }],
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
  {
    id: "sources",
    label: "Sources",
    tabs: [
      { id: "instagram", label: "Instagram" },
      { id: "browser", label: "Browser" },
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
    "Completion reviews. Legacy satisfaction / resistance / focus / distraction stay on the trajectory (a missing score is skipped, not a 5). New plates: review points (3 + 0.1 per word), exact vs estimated vs unknown time (unknown is a count, not zero), and the same three marks for starts (an unknown start is a count, not a time), expected vs actual difficulty, optional feelings, and which goals or objectives held the hard or joyful work.",
  "todo-pulse":
    "Morning walkthrough fields on to-dos: tier, expected duration, points, day importance (0–10), resistance readings over time (0–10, many samples), and day excitement (0–10). Each number is labeled. Text-pipeline mornings stay tagged as from BIM.",
  reviews:
    "Saved period + morning reviews. Morning cards show all-nighter, affirmations, to-dos, priorities, habit priorities, day plan, circumstances, best day, gratitude (BIM text-pipeline labeled). Expand a period card for evening text. Blocked-reason mosaic is counts, not a ranking.",
  seasons:
    "Calendar quarters named as seasons: Q1 Spring, Q2 Summer, Q3 Fall, Q4 Winter. This year and last year show completions, points, and season rituals. Season goals are the Goals whose period is Season. This view is not clipped to the shared date window.",
  overcommit:
    "Reconstructed day-pushes and logged minutes. This tab does not reschedule anything.",
    tracking:
    "Same minutes as Home → Tracking. Donut and ranked rows are the same slices — click either to drill. The period filmstrip is chronological paint; Days and Weeks color each cell by the pen that took the most minutes at the selected depth. Average-day ribbons (All + Mon–Sun) show when pens typically sit on the clock in 15-minute slots. Find blocks matches names, pens, secondary pens, counts-as chains, and action formats — jump highlights the block, Show matches redraws this view on that set only (other paint is hidden, not called untracked). Click Untracked for gap list, then Log activity; click a painted block (drill or filmstrip) to edit via the Home Tracking entry dialog. % of tracked vs % of day are both meant. Include assumed if you want estimated blocks in the total. Up/down compares each pen to the equal-length period before this window. Tag bars are weekly and monthly minutes, a minute tagged in two scopes counted once. Block-length violin is duration of painted spans; hour × pen small multiples share Circadian's 24 columns.",
  sleep:
    "Nights from the sleep log and Sleep-painted grid, same stretch as Tracking. ~ means an end was estimated; est. means the night was read off paint. Blank nights are excluded from averages, not counted as zero. Ridgelines are Gaussian KDEs of duration and bedtime by weekday. Against the sun uses each day's stored sunrise/sunset (not today's clock on every night); productivity and joy around the sun can join later.",
  screentime:
    "Active vs untracked from ActivityWatch-painted Screen Time scope; AFK is untracked; alignment vs human Activity occupancy; last-sync from prefs.",
  circadian:
    "Hour × day occupancy. Empty cells are missing hours, not zero work. Instants have no duration and stay off the heat. The weekday cycle plot is Cleveland's mean occupancy by hour, one row per weekday.",
  people:
    "Who you spend time with: Company person pens (the ones People I Know items join), counted from Company blocks that name them and Social blocks that tick them, once. Change is against the previous window of the same length; rhythm is the median days between days together. Drifting is past twice that rhythm.",
  places:
    "Location pens as time-at-pen. Repeated GPS pins (80 m) can be named here. Not a map. Depth uses the same rungs as Tracking.",
  "mood-field":
    "Any painted mood name, plus the stretches you opened: same word, the water, and marks (each with n; blanks left out). A color with no card stays out of the averages. Logged joy / suffering / alignment still sit beside that when n allows.",
  diversity:
    "Shannon entropy of Tracking pens per day (H = −Σ p log₂ p of that day's minute shares) plus Gini of the window's pen totals and weekday vs weekend occupancy. 0 bits = one pen took the day.",
  transitions:
    "Markov matrix of Tracking pen changes: P(to | from) among switches only. Same-pen continuation is not a transition. Rows sum to 1. The alluvial below uses raw switch counts (not p, not duration).",
  "context-switch":
    "A switch is a pen change: one block ending and another beginning. Hour-of-day shows when fragmentation clusters.",
  "text-events":
    "Activity instants from the phone text pipeline (log:, discrete triggers, switch markers). Always labeled from text pipeline. Counts by day in the shared Data range.",
  "text-spans":
    "currently / stopped / switched Activity intervals stamped by the text pipeline. Shows painted durations and switch-instant counts. Always labeled from text pipeline.",
  log:
    "Activity instants from Tracking log: food, drink, drug, bare intake, and any event phrase (left room). Counts by day and by kind (`intake.food`, `intake.drink`, `intake.drug`, `intake`, or a slug such as left room). Exact and estimated clocks scatter; unknown clocks are a count, not a point on the stored minute. The phase strip is labeled from bleed days and ovulation marks over this window — not a medical prediction. Spotting is recorded and does not change the phase. Filter by that kind string; there is no preset list of events. The shower plate reads Shower ticks, as of today, and is not another event-kind bar.",
  wardrobe:
    "Looks in the shared range. One outfit is one wear. Times worn, days worn, and days since last worn. By category, the first number is distinct outfits; the second is piece-links. A row opens the days that look was worn.",
  "cycle-phase":
    "Days in this window labeled menstrual, follicular, ovulatory, luteal, or unknown from bleed days and ovulation marks. Spotting is not a phase. Each joined series is a mean and a median by phase, with n. A missing reading stays out; a log count treats a silent day as 0 logs. Unknown days stay in their own bucket. This describes your logs. It is not a diagnosis.",
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
    "Objective contribution and neglected goals in this window, plus which linked goals held the harder or more enjoyable work. Open those items in Lists.",
  observatory:
    "Classical Pearson r on inner-joined calendar days. Correlation is not causation. Thin overlap is watermarked, not a finding.",
  "cross-section":
    "Linked density: hover or pin a day to highlight the same column in every series. Missing nights stay blank.",
  metrics:
    "All five wellbeing series as small multiples. Pick one for the detail chart. Log {name} writes into the same store as the Metrics key on Current moment.",
  correlation:
    "Pairwise Pearson matrix. Click a cell for the scatter and sentence. Not a chart builder.",
  spectrum:
    "Lag-1 / lag-7 autocorrelation of daily habit % and of sleep duration, a naive DFT periodogram of habit %, and coefficient of variation of sleep. Classical only — not a forecast.",
  "research-report":
    "A rundown of this window, chosen from the live vault. A section is included only when a shape clears its floor: a habit day at least 25 points from the window median (n ≥ 5), a current streak of 3 or more fully met habit days, tracking coverage at least 25 points from the median of painted days (n ≥ 5), a sleep night at least 90 minutes from the median (n ≥ 5), one wellbeing series that rose or fell once n clears 7, a week grade at least 8 points from its raw grade, planned minutes and tracked minutes both present, a text-pipeline stamp beside the other rows, the longest gratitude list, or a why / blocked-reason note (a repeat, or a plain count). A thin sample keeps the studio floor sentence and is not captioned as a trend. Counts only — no sentiment score.",
  "texts-report":
    "Every iMessage and SMS on this Mac since 2018, read from a local copy of the Messages database by scripts/texts-analysis. The report keeps its own look. It updates itself every Sunday at 21:00 while Brain2 is open (or the next time it opens), adding the new week. Update now runs it at once. Message text stays on this Mac.",
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
  browser:
    "Chrome history, merged across profiles. The Brain2 extension sends each finished local day at 12:05am when this app is open; a JSON file also lands in Downloads. Quick Chrome History Export (JSON, CSV, or Excel) still works — rename history.json to the profile name before adding. A later file only adds visits that are not already here. Visits per day, week by hour, sites and kinds of site, sessions, Google searches, and every YouTube video with a topic guessed from its title. Files stay on this computer. The shared date range does not apply here.",
  instagram:
    "The Instagram report, built on this computer from your Instagram data export (Download your information, JSON, all time). Nothing is sent anywhere; only the click-to-load post previews and the opt-in profile photos reach the internet. The shared date range does not apply here. A new export in Downloads is picked up by the desktop app. Limits of the export: who liked or commented on your posts and stories is not in it, so per-person engagement comes from DMs only. Carousel posts have no insights. Follower counts of other accounts are not in it. Comments have no link to their post. Time active is an estimate, and before the recent view-log window it is a floor.",
}
