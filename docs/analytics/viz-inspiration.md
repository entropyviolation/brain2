# Information is Beautiful → Brain2 Data

_Last mapped: 2026-10-23_

What this is: every data type that flows into Data, matched to a piece on
[Information is Beautiful](https://informationisbeautiful.net/) (IIB) and how to
adapt it as an interactive plate. Section agents read **only their own section**
below plus **Moves** and **Rules**. Nothing here is built. It is a menu, not a spec.

How it was made: data types from `components/Analytics/README.md` and
`analytics-tabs.ts`. IIB pieces found by site search (the site index renders in
script, so it was not crawled whole). Forms are described from the pieces
themselves. Open the link before you copy a geometry.

## Rules

- Purely additive. A new plate sits beside the old one. No view id, store or math is dropped.
- Use the house skin and kit first (`docs/analytics-plan/11-viz.md`, `components/Analytics/studio/studio-kit.tsx`, `studio-plots.tsx`). IIB gives the **idea**: scale, anchors, annotation, sort, filter. It does not give a new color system. Data fills stay data.
- Every plate keeps **n**, the window, `~` / **est.**, and Open in Lists.
- **Instagram** and **Texts** are frames with their own look. Their rows are for reference only. Do not change them yet.

## Moves

The IIB habits worth stealing, by short name. Sections cite these.

| Move | What it is | Seen in |
|---|---|---|
| **Sized squares** | Nested squares scaled by amount, grouped by kind, with a familiar anchor square for scale. | [Billion Dollar-o-Gram](https://informationisbeautiful.net/visualizations/billion-dollar-o-gram-2013) |
| **Evidence bubbles** | Bubble y = strength, size = how much it matters, a "worth it" line, click for the why. | [Snake Oil Supplements](https://informationisbeautiful.net/visualizations/snake-oil-scientific-evidence-for-nutritional-supplements-vizsweet/) |
| **Annotated year line** | One line across the calendar with labels on the spikes ("Spring clean", "2 weeks before Christmas"). | [Peak Break-Up Times](https://informationisbeautiful.net/2010/peak-break-up-times-on-facebook/) |
| **Culture wheel** | Concentric rings, one ring per group, one wedge per category, each cell a color. | [Colours in Cultures](https://informationisbeautiful.net/visualizations/colours-in-cultures/) |
| **Bubble timeline + filter** | x = time, bubble = size, color = method, filter chips and a search. | [Biggest Data Breaches](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/), [Ransomware Attacks](https://informationisbeautiful.net/visualizations/ransomware-attacks/) |
| **Anchored bars** | Ranked bars where familiar things sit among the data so the size means something. | [Million Lines of Code](https://informationisbeautiful.net/visualizations/million-lines-of-code/) |
| **Truth barcode** | One strip per story, one cell per scene, colored true / false, with a strictness toggle. | [Based on a True True Story](https://informationisbeautiful.net/visualizations/based-on-a-true-true-story/) |
| **Quadrant scatter** | Two scores, the plane split into four named corners, icons as points. | [Best in Show](https://informationisbeautiful.net/visualizations/best-in-show-whats-the-top-data-dog/), [Caffeine vs Calories](https://informationisbeautiful.net/visualizations/caffeine-and-calories/) |
| **Axis picker** | Choose x, y and size from menus; the bubbles re-settle. | [The Hollywood In$ider](https://informationisbeautiful.net/visualizations/the-hollywood-insider/) |
| **Unit grid** | One square per event, grouped by cause and phase, so counts are countable. | [Plane Truth](https://informationisbeautiful.net/visualizations/plane-truth-every-single-commercial-plane-crash-visualized/) |
| **Digit grid** | A 100×100 heat grid of a two-part code; the structure pops out of the pattern. | [Most Common PIN Codes](https://informationisbeautiful.net/visualizations/most-common-pin-codes/?mc_eid=dc3f396ec5) |
| **Category tiles** | Every item one tile, colored by family, sized by rank. | [Top 500 Passwords](https://informationisbeautiful.net/visualizations/top-500-passwords-visualized/) |
| **Fear peaks** | A media-buzz timeline where each scare is a peak with its name on top. | [Mountains Out of Molehills](https://informationisbeautiful.net/visualizations/mountains-out-of-molehills/) |
| **Log timeline** | Time on a log scale so the near and the far both fit. | [Timeline of the Far Future](https://informationisbeautiful.net/visualizations/timeline-of-the-far-future/) |
| **Rate clock** | A total turned into "per hour" so it can be felt. | [Senseless](https://informationisbeautiful.net/visualizations/senseless-conflict-deaths-per-hour/) |
| **Your-number input** | Type one value about you; the page answers in your terms. | [Who Old Are You?](https://informationisbeautiful.net/visualizations/who-old-are-you/) |
| **Periodic taxonomy** | A labeled grid of named kinds, grouped by family, each with a one-line definition. | [Rhetological Fallacies](https://informationisbeautiful.net/visualizations/rhetological-fallacies/), [Common MythConceptions](https://informationisbeautiful.net/visualizations/common-mythconceptions/) |
| **Mirror split** | Two halves face each other, same rows, so differences line up. | [Left vs Right (World)](https://informationisbeautiful.net/visualizations/left-vs-right-world/) |
| **Size bubbles by cause** | Packed bubbles grouped by cause, area = total. | [20th Century Death](https://informationisbeautiful.net/visualizations/20th-century-death/) |
| **Step heights** | Levels drawn as rising steps with landmarks beside them. | [When Sea Levels Attack!](https://informationisbeautiful.net/visualizations/when-sea-levels-attack-2/) |
| **Lawsuit arcs** | Who-points-at-whom arrows between named nodes. | [Who's Suing Whom in the Telecoms Trade](https://informationisbeautiful.net/2010/whos-suing-whom-in-the-telecoms-trade/) |
| **Loop timelines** | Paths that leave and rejoin a main line. | [Time Travel in Film and TV](https://informationisbeautiful.net/visualizations/timelines-time-travel-in-popular-film-and-tv/) |
| **Era bars** | Horizontal spans by start and end, thickness = size. | [Largest Empires](https://informationisbeautiful.net/visualizations/worlds-largest-empires/) |
| **Good-viz test** | Information + story + goal + visual form; check every plate against it. | [What Makes a Good Data Visualization?](https://informationisbeautiful.net/visualizations/what-makes-a-good-data-visualization/) |

---

## Behavior

### Habits — daily done/not per habit, day %, grades, streak link, weekday/weekend
- **Truth barcode**: one strip per habit, one cell per day, done / missed / exempt. Toggle "count partial as done". Sort strips by rate or by recent slip.
- **Annotated year line** over day %: label the three biggest dips and climbs with the dates and the habit that moved most.
- **Your-number input**: "If I keep today's rate for N days…" slider projects the grade.

### Streaks — current and longest runs
- **Era bars**: every run as a span on the calendar, thickness = length. The longest gets a label. Hover shows start and end.
- **Anchored bars**: current runs ranked, with the all-time best of each as a ghost bar behind.

### Points — awards by source (habit / bonus / task), ledger
- **Sized squares**: the window's points as nested squares by source, then by item. An anchor square is "a typical day".
- **Rate clock**: points per waking hour, per day, per week as one readout row.

### Velocity — completions, points, cycle time, reward scatter
- **Quadrant scatter**: x = cycle time, y = points. Corners: quick wins, slow rewards, slow and small, fast and big. Click a point to open the item.

### Reflection — score trajectory, difficulty expected vs actual, feelings, notes
- **Mirror split**: expected difficulty left, actual right, one row per task. Bars that differ stand out.
- **Evidence bubbles**: feeling y = satisfaction, size = time, color = type. A line marks the median.

### To-do pulse — tier, duration, points, importance, resistance, excitement
- **Quadrant scatter**: x = resistance, y = excitement. Name the corners (dread, joy, chore, hook). Slider for date.

### Reviews — morning, slices, night, blocked reasons, why-it-didn't notes
- **Periodic taxonomy** of blocked reasons: one tile per preset with count and the latest typed words. Family = source (push, missed task, habit, op).
- **Category tiles**: every why-note a tile, sized by recency, search box on top.

### Seasons — quarter comparison, this year vs last
- **Mirror split**: last year left, this year right, rows = completions, points, rituals, goals.
- **Culture wheel**: four rings for four quarters, wedges for measures.

### Overcommit — weeks/months pushed
- **Step heights**: committed vs done per week as rising steps; the gap is shaded.

## Time

### Tracking — pen minutes, levels, tags, company, filmstrip, deltas
- **Sized squares** for composition at any depth. Click a square to zoom into its child pens. The anchor is "one day = 1440 min".
- **Fear peaks** for tags: each tag's weekly minutes as a peak labeled by its name. Filter chips by tag family.
- **Mirror split** for Up / down vs previous window.

### Sleep — nightly start/end, duration, CV, sun, all-nighters
- **Era bars**: each night a horizontal span on a 6pm→noon axis, stacked by date. Sunrise and sunset as a soft band. Slider for "late after".
- **Unit grid** of all-nighters: one square each, grouped by source.

### Screen Time — apps, categories, active vs untracked
- **Million Lines of Code**-style **Anchored bars**: app hours ranked, with anchors like "a workday", "a film", "a flight to Tokyo".
- **Sized squares**: category → app.

### Circadian — hour × day (Activity, Mood), weekday cycle
- **Digit grid**: hour (24) × day-of-year cells. Patterns like late weeks pop. Toggle Activity / Mood.
- **Culture wheel** as a 24-hour clock: rings = weekdays, wedges = hours.

### Places — location time, GPS pins
- **Size bubbles by cause**: packed bubbles per place, area = minutes, grouped by place kind. Click to name.

### People — company minutes, rhythm, drifting
- **Lawsuit arcs** reborn as **company arcs**: you in the middle, people around, arc width = time together. Drifting people fade.
- **Era bars**: each person's seen-days as a span strip; gaps longer than 2× rhythm are marked.

### Mood field — mood names, cards, marks
- **Colours in Cultures** wheel: rings = weeks, wedges = mood words, cell color = the mood's own color. Search a word to light its cells.
- **Periodic taxonomy** of mood words, grouped by vibe, each with its count and last date.

### Diversity — entropy, Gini, weekday/weekend
- **Your-number input**: "how many pens make up 80% of my time" with a slider for the share.
- **Anchored bars**: today's entropy among anchors (a single-task day, a perfectly even day).

### Transitions — pen-to-pen switches
- **Digit grid**: from-pen × to-pen heat, like the PIN grid. Diagonal = staying. Sort rows by total.
- **Loop timelines**: common loops (A → B → A) as paths leaving and rejoining.

### Context Switch — switches by day and hour
- **Rate clock**: switches per waking hour, with the day's worst hour named.

### Log — kinds (intake, left room…), clock times
- **Unit grid**: one square per event, grouped by kind, ordered by time. Filter by kind string.
- **Bubble timeline + filter** for the clock scatter.

### Cycle phase — phase mix, marked vs estimated
- **Culture wheel**: one ring per cycle, wedges for days, colored by phase. Estimated cells hatched. Keep the concealed gate.

### Operations — stages, categories, debriefs
- **Bubble timeline + filter**: x = date, size = hours logged, color = stage. Click opens the debrief.
- **Evidence bubbles**: execution y, morale x, size = hours.

### Text events / Text spans — text-pipeline instants and intervals
- **Unit grid** for events by kind; **Era bars** for spans.

## Accuracy

### Plan vs Reality — planned vs tracked minutes, capacity
- **Mirror split**: plan left, reality right, rows = pens.
- **Truth barcode**: one strip per day, one cell per planned block, colored kept / moved / dropped.

### Calibration — estimate vs actual
- **Based on a True True Story** as **estimate barcode**: one row per task type, cell per task, colored under / on / over. A slider sets what counts as "on" (±10–50%).
- **Quadrant scatter** with the y = x line.

### Cycle — days pushed, open important items, survival
- **Fear peaks**: most-pushed items as named peaks.
- **Unit grid**: open stock as squares, colored by age band.

### Regret — accrued cost of important items undone
- **Sized squares**: cost per item, grouped by list. Anchor = "one day of the most important item".

### Goals — objective contribution, neglect, progress
- **Size bubbles by cause**: packed bubbles per goal, area = minutes, color = neglect.
- **Step heights**: progress per goal against its target.

## Meta

### Observatory / Correlation — Pearson findings, matrix
- **Evidence bubbles**: one bubble per pair. y = |r|, size = n, a "worth noticing" line at the floor. Click for the scatter and the caveat.
- **Axis picker**: choose any two series for x and y, a third for size. Built from `cross-section.ts`.

### Cross-section — linked daily series
- **Truth barcode** stack: one strip per series, aligned by date. Hover a day to read every strip.

### Metrics — five wellbeing metrics
- **Annotated year line**: label the peaks and troughs with what was logged that day.

### Spectrum — autocorrelation, periodogram
- **Log timeline**: period axis on log scale (1 day → 1 year) with 7-day and 28-day marks named.

### Research report — plain-language rundown
- **What Makes a Good Data Visualization?** as a checklist: each section shows its information, story, goal and form in four small tags.
- **Your-number input**: pick one sentence and expand it into its plate.

## Library

### Item Types / Lists & areas — types, lists
- **Category tiles**: every item a tile, colored by type, grouped by list. Search and sort.
- **Sized squares**: area → list → type.

### Attributes — typed attribute histograms
- **Periodic taxonomy**: one tile per attribute with its type, fill rate and a tiny histogram.

### Tags — free tags, combinations
- **7-way Venn** ([7-way Venn](https://informationisbeautiful.net/2012/7-way-venn/)) for the top tags beside the UpSet.

### Stages — inbox → completed
- **Step heights**: stage counts as steps with the drop between each named.

### Weight — importance, load, entropy
- **Quadrant scatter**: importance × load, corners named.

## Sources and Texts (reference only, do not change yet)

### Instagram — DMs, follows, likes, media from the export
- Later: **Lawsuit arcs** for DM partners, **Fear peaks** for posting bursts, **Category tiles** for media.

### Texts — chats, reply times, topics, mood
- Later: **Mirror split** for you vs them per chat, **Annotated year line** for message volume, **Who's Suing Whom in AI** arcs ([link](https://informationisbeautiful.net/2026/whos-suing-whom-in-ai/)) for who starts conversations.
