# Future widget ideas

Potential squares for the Home overview strip (`HomeOverview`). These are
**plans**, not commitments. Shipped tiles stay in
[`components/Home/README.md`](../components/Home/README.md#overview-widgets).
The join is [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). Meaning-layer sketches
follow [`jungideas.md`](jungideas.md). Map-and-territory sketches follow
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md). Steersman sketches
follow [`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3.
Product chrome never names those sources.

The strip is caption + CRT + footer, equal height, hidable from the date-bar
**Widgets** key. Do not clone Review, Points, Today’s Progress, the screen pet,
Affirmation, Weather, Next, Day lamp, Days Until, **Latest award**, **Solar remainder**,
**Tracking now**, **Night well**, **Harvest leftover**, or **Inbox mill**.
Do not clone the header **now** well, **today’s friend**, or
the Needs Attention queue.

---

## Shipped from this list

| Id | Name | What it does |
|----|------|----------------|
| `solar` | Solar remainder | Live sun phase: until sunrise → sunrise → to sunset → sunset → after sunset → midnight, then the next day. |
| `tracking` | Tracking now | Current or last-known Activity / Location / Mood / Company, plus **Update**. |
| `night` | Night well | Last night’s hours, asleep / woke clocks, and one vs-sunset phrase. |
| `harvest` | Harvest leftover | Points still available today. Footer: `N left of M`. |
| `inbox` | Inbox mill | Unclarified count and the newest title. Click opens Inbox. |
| `award` | Latest award | Newest positive points and why (completion, high % bonus, grades above yesterday, weekly grades above last week). |

---

## Potential

### 2. Intention vs paint

CRT: planned minutes vs painted minutes for the selected day. Footer: `plan 5.0h · lived 3.2h`.

The Brain2 law in one instrument. Plan-vs-reality exists in Analytics; Home should feel the mismatch *today*.

### 3. Still-fits

CRT: `Fits` / `Tight` / `Overflow` from remaining planned work vs remaining waking minutes. Footer: `+48m spare` or `1.4h over`.

The Plan rail has 10-pip capacity per item. This is the *day’s* capacity.

### 4. Unpainted

CRT: untracked waking hours (`2.8h`). Footer: longest empty gap. Click → Tracking Fill.

### 6. Seed (Just Start)

CRT: one molecular step, not the parent task. Footer: `2 min`. Click launches Just Start (`lib/molecular.ts`).

### 7. True work

CRT: a single title — highest-regret, oldest important, or the zombie the queue pretends is equal. Footer: `12d overdue · regret 48`. Click opens item detail.

Needs Attention is a queue. This is a verdict.

### 8. Regret twin

CRT: today’s accrued regret, same glass as Today’s Points, darker phosphor. Footer: `week 210`.

`regret-store` has no face on Home.

### 9. Overcommit needle

CRT: analog needle from reconstructed day-pushes + logged minutes. Footer: one sentence (`load rising · n=14`). Does not reschedule. Click → Analytics Overcommit.

### 10. Calibration compass

CRT: needle around 1.0 — recent estimate/actual ratio. Footer: `you run ~30% long` or `thin n`. Empty until n clears the floor.

### 11. Good-day lamp

CRT: current good-day streak. Footer: `11 of last 30`.

Today’s Progress is *this* day. This is identity over time.

### 12. Week-grade ampoule

CRT: miniature Week grade tube. Footer: Perfect output as a second pip.

Port the ampoule when you live in Plan or Tracking — not the whole Habits console.

### 13. Mood ampoule

Finer than Tracking now: current Mood-scope pen as colored gas only. Header **now** is work; this is state.

### 14. Place well

Finer than Tracking now: current Location pen + duration. Not a map.

### 15. Switch geiger

CRT: today’s context-switch count. Footer: `peak 10–11a`. Click → Analytics.

### 16. Screen hourglass

CRT: today’s Screen Time / iPhone minutes vs recent median. Footer: top app + last-sync honesty.

### 17. Objective tape

CRT: the period’s #1 objective title. Footer: contribution % or `neglected 9d`. Click → Goals.

### 18. Mix (entropy)

CRT: `Narrow` / `Mixed` / `Scattered` from today’s Activity-pen Shannon entropy. Footer: top two pens.

### 19. Heartbeat

CRT: `alive` / `quiet` / `stale`. Footer: last successful ingest or Screen Time sync.

### 21. Plan stamp

CRT: `Stamped` or `Unwritten` for the selected day’s Plan text log. Footer: time of Submit plan, or `no day plan`.

The Day Plan composer is easy to skip. A square that notices whether intention was written — distinct from Next (the next event) and from Intention vs paint (minutes).

### 22. Unmet gems

CRT: count of daily habits that have not yet contributed a Willpower stone *today*. Footer: first unmet habit name.

The gems plate lives on the Habits control panel. Every other Home tab is blind to which stones are still missing. Click jumps to Habits Daily.

---

## Meaning layer (from [`jungideas.md`](jungideas.md))

Plans only. Product chrome never names Jung. A coincidence is shown, never called a cause. The ten-slice build is [`JungBrain2.md`](JungBrain2.md); these squares would be Home glances over that layer, not a second essay.

### 23. Coincidence well

CRT: today’s count of same-meaning pairs across unrelated rooms (a tag, type, or word that hits Inbox *and* Tracking, or a dream line *and* a capture, with no dependency between them). Footer: the shared word · `not a cause`.

Cross-section already lines dates up (synchronism). This square asks for shared *meaning*. Empty until n clears a floor. Click opens the coincidence log, not a horoscope.

### 24. Exception cell

CRT: `Peak` / `Hole` / `Usual` for whether *today* is an outlier on one tracked series (habit %, sleep, completions). Footer: which series · `n=…`.

Averages hide the day that mattered. Density calendars already paint the cell; this interviews it. Click starts the exception note: what was different.

### 25. Series lamp

CRT: `×n` for the longest same-word / same-tag run across rooms in the last 24 hours (Inbox, Docs, BIM, Tracking). Footer: the term.

Jung’s fish series: meaning-sense grows with the number of terms. Distinct from habit streaks (mechanical repetition of one habit). This is recurrence *across* the graph.

### 26. Affect gap

CRT: `Bright` / `Narrow` / `Quiet` from Mood intensity versus capture volume in the last few hours. Footer: first item captured during the last mood spike, or `nothing written`.

Affect brightens one content and darkens the rest. Mood pens exist; nothing yet ties a spike to what entered the vault while it lasted.

### 27. Impasse

CRT: days since last real progress on the most-pushed important item (`12d`). Footer: **Ask sideways** — one irrational / chance prompt when rational pushing has failed (not another to-do).

Regret and Overcommit find the stall. Just Start is the smallest rational step. This is the other response: a prompt from out-of-the-way material (dreams, parked notes, friend whim) when the causal chain is stuck.

### 28. Dream echo

CRT: match count between the last morning-review dream text and today’s titles/tags, or `silent`. Footer: the overlapping word.

Dreams are already logged. The scarab pattern is *next-day* echo, labeled unconfirmed (`est.`), never asserted as prediction.

### 29. Whole situation

CRT: four tiny pips — habits, sleep, completions, mood — as one mosaic, not four scores. Footer: `the day, not the detail`.

I Ching / Cross-section as a square: impose the fewest conditions. Distinct from Mix (entropy of pens) and from Progress (to-do + habit %).

### 30. Season lamp

CRT: `Morning` / `Noon` / `Afternoon` from this period’s mix of natural-aim work (points, streaks, plan-vs-reality) versus cultural-aim work (reflection scores, Docs, reviews, formulations). Footer: neglected objective from Direction.

The afternoon cannot run on the morning’s program. Objectives persist until edited; this square asks whether the standing rules still fit the season.

### 31. Unlived

CRT: count of parked + neglected + high-regret items treated as one body. Footer: oldest title.

What youth stored does not vanish. Regret, Parked, and Direction neglected already exist in separate rooms. One well shows the unlived life as a single leftover.

### 32. Interest fuel

CRT: `Keen` / `Cool` / `Spent` from recent friend-mission declines, Just Start abandons, and affirmation skips. Footer: last decline.

Rhine: scores drop when interest dies. Today’s friend already uses chance; this meter says whether the mantic fuel is still there, so the clock can quiet instead of nagging.

---

## Map and territory (from [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md))

Plans only. Product chrome never names Korzybski or general semantics. The ten-slice build is GS-1 … GS-10 in that file; these squares practice the method at a glance.

### 33. Leftover strings

CRT: count of characteristics *this day left out* — unpainted scopes (no Mood, no Company), empty required attributes, unconfirmed `est.` values. Footer: first missing characteristic. Click opens the capture that already exists for it.

The Structural Differential’s hanging strings: what the map forgot. Distinct from Unpainted (empty waking minutes) — this is missing *sides of the same minutes*, not missing time.

### 34. Order of the day

CRT: dominant order among today’s numbers — `observed` / `recorded` / `derived` / `inferred`. Footer: `12 inferred · 4 recorded`.

Consciousness of abstracting as a well. GS-1 puts an order on every derived value; Home should show which order the day is living in, so inferences are not read as descriptions.

### 35. Coverage (etc.)

CRT: share of today’s claims that actually have evidence (`n / possible`). Footer: `61% of tasks had no estimate`.

Non-allness: no map represents all of its territory. Analytics sentences should already carry coverage; this square is the day’s etc. — what the map refuses to pretend it knows.

### 36. Delay well

CRT: age of the oldest unclarified Inbox item (`14h`), not the pile’s count. Footer: that item’s title.

Delayed reaction: capture is not classification. Inbox mill (potential #5) is pressure of *how many*. This is how long a judgment has been postponed — the training, not the guilt.

### 37. Describe latch

CRT: `Described` / `Open` / `Jumped` for whether the current evening or weekly review confirmed facts before conclusions. Footer: last inference still linked, or `no review`.

Object first, label next. The two-step review (GS-5) is easy to skip. The square notices a jump from description to inference.

### 38. Handoff plate

CRT: first line of the latest period handoff (what the next self should start from). Footer: `written Tue` or `no handoff`.

Time-binding: each period begins where the last left off. Distinct from Plan stamp (whether *today’s* day-plan text was submitted). This is premises for the next week, on the Home strip.

### 39. Identity gutter

CRT: count of is-of-identity / allness hits in today’s Docs, journal, or review draft (`I am…`, `always`, `never`). Footer: first phrase, truncated.

The check never blocks a save. It places the map next to the vault’s count (`skipped gym 2 of 5`). Home only shows that a generalization was written, so the organism can delay.

### 40. Unserved

CRT: today’s completions that served no objective (`3`). Footer: first title.

Logical fate: change premises to change behavior. Direction already flags days whose tasks served no goal. The square is the daily remainder of that report — work that did not touch a standing premise.

### 41. Graded day

CRT: mean completion *degree* for today’s work (`73`), not done/not-done counts. Footer: `bare 1 · goal 4 · exceptional 0`.

Infinite-valued evaluation. Today’s Progress is two checklists. This well credits partial work the way GS-9 would credit points, habits, and plan-vs-reality.

### 42. Dated self

CRT: calendar years or days between two dated wordings of a pinned formulation / standing rule (`belief₁ Mar · belief₂ now`). Footer: the newer sentence, truncated.

Smith₁₉₂₀ is not Smith₁₉₃₃. Objectives, habits, and affirmations persist until someone edits them. This square shows that a label hid change — or that it was revised on purpose.

---

## The steersman (from [`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3)

Plans only. Product chrome never names Wiener or cybernetics. CY-2 owns the Bands instrument. These squares are the glance; the slice is the build. A day inside every band sends nothing, so a quiet CRT is the success face, not an empty state.

### 43. Bands

CRT: the worst vital reading against its edges (`sleep 6.4h`, band `7–9`). Footer: days out, or `inside`. Click opens the needle.

Slow loop. Seven-day mean. One effector speaks, and only outside the band. Distinct from Overcommit (load swinging) and from Night well (last night’s clocks).

### 44. Tone

CRT: `Low` / `Even` / `High` from points and regret over the last 3 days. Footer: which side moved.

CY-11’s header lamp, available as a square. It does not merge the two ledgers and it does not say what the person is. Distinct from Harvest leftover (points still available today).
