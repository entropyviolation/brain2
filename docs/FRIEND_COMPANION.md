# Today's friend — companion + suggestion engine (plan)

This is the north-star spec for turning the header **today's friend** from a
photograph + bubble into a **large, multi-facet companion system**.

Shipped now (keep these; extend them):

- Photograph gallery, naming, shuffle, vaulted upload cutouts. **The
  preapproved pack and your own uploads are the only picture sources** — the
  Openverse / Commons / Wikipedia search is gone, so no creature is ever
  invented.
- **Preapproved pack** from `animalsrcs/` (`public/friend-pack/`, 71 pictures).
  Studio plates knocked out at process time (10); scenes keep their backdrop.
  Cards start **unnamed** — name them in Gallery. Shuffle wears another gallery
  card; the Gallery name field names the next unnamed pack card. Storage is **per card id**: names do not
  hop between pictures; deleted pack photos stay gone (id + URL dismiss, no
  re-seed on roll/hydrate). Persist **v7**.
- Worn friend until **Monday** or a manual change (`cogs-friend-worn` /
  `brain2-friend-worn`)
- Removed friends stay gone (union-only dismiss by **card id** / catalog species + confirm delete; pack names do not dismiss other species)
- Click the **photograph** → this friend’s **instrument** (same page as Gallery
  Details: portrait, bond, mission, voice keys, equalizer, journal).
- **Chat** sits beside Gallery, under the name → Stardew bubble (habits / today's To Do /
  Next Actions, species bias, title-loves, optional “I love you” / whims).
  A second click asks for another line and logs the previous offer as
  “Asked for another” (an accepted mission stays accepted).
- **Click the bubble** for the mission sheet. The heading is **Mission from
  {name}:** and the task row opens **item detail on top of the sheet** (To Do
  / Next Action). **Accept mission** starts a same-day window: finish before
  local midnight for friend points, then a small cheer. **Decline mission**
  asks to break the task into smaller steps, then to do only the first step,
  then for a written reason. Every answer is in the mission journal.
  Esc / × / outside dismisses the bubble without declining.
  Opening the bubble gives the friend well a short CRT power-on / glass-edge
  melt (~560ms); `prefers-reduced-motion: reduce` shows the bubble with no
  power-on.
- Reunion lines when a known friend is assigned again (not on refresh)
- Gallery **Details** is that same instrument: visit history, mission journal,
  voice keys, equalizer, title-love beads, and list-bias beads. Save stays open.
  **Chat** on the instrument previews a line and does not log a mission.
- Personality types + species presets + flavor (`lib/baby-animal-personality.ts`)
- Name + picture fits for the current named gallery (`lib/friend-personality-fits.ts`)
  so a bat called mouse whispers, a turtle called skunk soaks, a snow marten
  called Little Rock Hyrax sparkles
- Mission journal + rewards (`friendMissions`: offered / accepted / declined /
  done / expired, with the decline ladder and the reason). Points only if the
  mission was **accepted** and finished before the end of that local day
  (`points-store` × `rewardScale`). Whims use **I did it** after accept.
  A finished mission opens a short cheer in the friend’s bubble voice.

---

## Why this will be huge

The friend is the first **gamify beat** that already sits on every tab. The
product goal is a living application: a small creature that **knows the graph**,
has a **mood**, **asks for work**, **pays in points/trinkets**, and **can be
tuned**.

That is not a second chat product. It is a **policy + scoring + timing +
reward** system over Items, lists, habits, tracking, reviews, and points.

| Machine | Job | Status |
|---------|-----|--------|
| Face | Photo, name, gallery, Monday wear | shipped |
| Voice | Stardew lines, reunion, affection, whim copy | shipped (thin tables) |
| Picker | Which item / whim to mention | shipped (click + flavor) |
| Clock | When to speak without a click | **later** |
| Bias | lists / folders / types | species + list beads on the instrument |
| Push | insist / celebrate | types + editor; clock later |
| Reward | Points on finish | **started** (points only; no trinkets) |
| Memory | Asked / declined / done | **started** (`friendMissions`, cap 80) |
| Quiet | Hours, ADHD-gentle, RSD | types only; clock later |

---

## Personality (Gallery Details)

`FriendPersonality` is the shared vocabulary. Gallery **Details** writes one
record per creature (`animalId`). The nest uses `personalityFor` (stored overlay on the name/picture fit, then
the species preset).

| Knob | Meaning | Engine |
|------|---------|--------|
| `cadence` | quiet / occasional / chatty / eager | Clock later |
| `tone` | gentle / playful / direct / coach | Copy tables **shipped** |
| `pushiness` | never / nudge / insist / celebrate | Clock later; celebrate should cheer completions |
| `suggestionRate` | 0–100 | Clock later; click still always speaks |
| `habitWeight` / `todoWeight` / `nextActionsWeight` | Source mix | **shipped** |
| `listBias` | `listId` → 0–100 | **shipped** (beads on the instrument) |
| `rewardScale` | 0–100 | **shipped** for mission points |
| `urgencyBias` | overdue / urgency | Partial in score |
| `loveYouRate` | Chance a click is affection | **shipped** (nest `flavor: true`) |
| `whimRate` / `whimId` | Soft real-world asks | **shipped** (`lib/friend-whims.ts`) |
| `titleLoves` | Boost titles containing these words | **shipped** (owl → read/book/study) |
| `dialogEffect` | Bubble chrome | **shipped** (heart / sparkle / stamp / whisper / bounce) |
| quiet hours | local minutes | Clock later; click still works |

Defaults keep `loveYouRate` / `whimRate` at 0 so pure unit tests without
`flavor: true` stay deterministic. Species flavor overlays real rates.

### The instrument

`components/friend-details/` is the page. The photograph sits in a lace window.
`dialogEffect` chooses the shape: arch, heart, oval, medallion, or tribal.
Jewel-case nubs sit on the glass. Opening it plays the same short CRT
power-on as the bubble. Chat is a round key under the portrait. It previews
a line and does not log a mission.

Bond level is lifetime friend points (finished missions) plus times worn, 20
points a level (`lib/friend-stats.ts`). Twenty glass tubes light one per point
inside the level. Points are a numeral and a willpower gem. A streak tube
appears from day two. A line under the panel names the next window. Met date
and times worn are thin leaders on the portrait.

Today’s mission is a dark strip. **Accept** and **I did it** sit on the strip.
The title opens the mission card, which still walks **Something smaller**, the
first step, and a reason, and opens the task on top.

Win98 tabs — Today, Personality, Keepsakes, Journal — replace the long scroll.
The last tab is remembered per friend. Today holds the newest journal rows.

Tone is a dial. Bubble effects are swatches. Whims sit in a two-column grid.
Hovering one previews the line in the portrait bubble. Cadence and pushiness
sit in a recessed bay marked **saved**. Celebrate may glow, because a finish
already adds the warm line.

The equalizer is eight vertical faders with silver caps and a dB scale. The
Habits / To Do / Next mix is a green trace. Presets live under a **Presets**
key. Title loves and favorite lists are removable beads.

A journal row or the mission title opens a mission card over the page. Save is
off until the draft differs. The footer lamp is amber while edits are unsaved
and green once saved. Close asks before discarding edits. The glass shine
passes at most once a minute. `prefers-reduced-motion` stops the glow, pulse,
power-on, spiral bloom, points flight, and cursor flock.

Keepsakes are counted from the log, wear, points, and tones tried on this
friend: first mission, first step, 3-day and 7-day streaks, worn 10 times,
finished before noon, bond level 5, every tone, and a finished whim. Nothing
new is stored in the personality record.

### Species flavor (examples)

- **Owl** — Next Actions + always wants reading; whisper bubble; whim “Read a little”
- **Puppy** — today's To Do; high “I love you”; walk whim; heart bubble
- **Hedgehog** — daily habits; curl-up whim; whisper
- **Kitten** — To Do; doodle whim; sparkle; loves play/yarn in titles
- **Crow** — Next Actions; shiny-object tidy whim; stamp; low affection

---

## Suggestion engine

**Chat button:** `lib/friend-suggestion.ts` + `lib/friend-copy.ts` + nest adapter
`lib/baby-animal-nudge.ts`. Empty favorite source falls through. A second chat
click while a bubble is open **declines** that still-offered mission (reason
“Asked for another”) then picks another. Accepted missions are left alone.
The mission sheet’s task row opens that Item in `TaskDetailPopup` **over the
sheet** (portaled inside it so the sheet’s focus lock does not hide it).
Habits and whims have no Item row, so that door stays a title, not a button.
`flavor: true` in the nest may interrupt with affection or a whim **before**
the world pool. Tests leave flavor off (or force rates) so `rng=0` does not
always say “I love you”.

### Remaining files

| File | Role | Status |
|------|------|--------|
| `lib/friend-suggestion.ts` | Pure pick | **shipped** |
| `lib/friend-copy.ts` | Tone × source lines | **shipped** |
| `lib/friend-whims.ts` | Soft missions | **shipped** |
| `lib/friend-mission.ts` | Log sanitize | **shipped** |
| `lib/friend-reward.ts` | Point grants | **shipped** (no trinkets) |
| `lib/friend-stats.ts` | Bond, streak, badges, mix shares | **shipped** |
| `lib/friend-mission-steps.ts` | Smaller-task / first-step writes | **shipped** |
| `lib/friend-suggestion-clock.ts` | Unsolicited ticks | later |
| `lib/friend-quests.ts` | Multi-step item quests | later |
| `lib/friend-mood.ts` | Hunger / sleep / weather / tracking | later |
| `lib/friend-trinkets.ts` | Nest furniture cosmetics | later |

### Candidate pool (phased)

1. **Shipped** — unmet daily habits, today's To Do, open Next Actions, affection,
   whims. Duplicate ids keep the source the personality likes more. Title-loves
   boost matching words (reading, walk, play…).
2. **Next** — overdue / Needs Attention bonus; decline skip-this-week
   in the scorer (log exists, scorer does not read it yet). `listBias` beads are shipped.
3. **Later** — extra folders, reviews, Operations, Tracking gaps, Goals, sleep
   debt, “you’ve been in Inbox too long”.
4. **Later** — generated quests through the item write door.

Never suggest completed items, logged-action rows, or Inbox fog unless the
personality opts into “help me clarify.”

### Scoring sketch

```
score = w_source * sourceWeight
      + w_list * listBias[listId]
      + w_urg * urgencyBias * overdueOrUrgency
      + w_imp * importance
      + titleLoveBoost
      + w_attn * inNeedsAttention          // later
      - w_recent * suggestedRecently       // later
      - w_declined * declinedThisWeek      // later (log is there)
```

Personality `suggestionRate` still gates **clock**, not click.
`pushiness`: never / nudge / insist / celebrate as before.

Quiet hours: clock off; **click still works**.

### Clock (later)

Unsolicited bubbles, rare and interruptible (same Esc / × / outside). Triggers:

- First header paint of the local morning (after quiet-to)
- After a completion, if pushiness is celebrate (cheer line + maybe a treat)
- After N minutes idle on Home with Needs Attention non-empty
- Never while a dialog is open, never during Just Start

Persist `lastUnsolicitedAt`. Do not log into the item History tab until the
user acts.

### Memory

Per friend:

- **Shipped:** `friendHistory` (first/last/wearCount), `friendMissions`
  (offered / declined / done)
- **Later:** ring buffer of last ids in the scorer, “opened from bubble”,
  reunion already used this assignment, mood

Do not store chat transcripts. The friend is not an LLM session.

### Copy

Tables keyed by `tone` × source (including affection + whim). Keep lines short.
Never “wee”. Never shame overdue. Describe the event and date it: “not yet
today”, “pushed 9 times since Jul 3”. Do not tell the person what they are.
The friend raises a signal and says why it was raised. That voice is GS-3 in
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md). Later: empty pool,
repeat, celebrate, decline voice, weather, sleep.

### Rewards, quests, trinkets

**Started:** completing a bubble-sourced habit / To Do / Next Action (store
subscribe) or tapping **I did it** on a whim grants `friendRewardPoints(rewardScale)`
through `points-store` (`Friend: {title}`). Idempotent via mission `done`.

**Later:**

- Undo should reverse the friend grant (`action-history`)
- Trinkets are gallery cosmetics / nest furniture, not a second economy
- Multi-step quests are Items with stages, not a shadow DB
- The friend never invents money or calendar events without the write door
- Streak treats, “best friend” days, photo frames, CRT stickers
- Celebrate pushiness: extra line + bonus when *that* mission completes
- Decline too often: animal gets quietly disappointed (copy only; no punishment points)

### Dialog / nest UX (later)

- Click bubble already opens the mission sheet
- Click animal already declines
- Later: “not this” chip on the bubble without rolling immediately
- Deep-link the mission to Habits / To Do / Lists
- Nest furniture that reacts to `dialogEffect` beyond CSS classes
- Sound optional, off by default

### LLM (maybe never)

Optional flavor on copy, not the picker. Picker stays testable. If an LLM is
added, it receives the already-chosen title + tone, and may not choose a
different item.

---

## Persistence & identity (shipped constraints)

- Gallery JSON is metadata. Bytes live in `friend:<id>` / `cogs-friend-pic:<id>`.
  Pack bytes are static files under `/friend-pack/*.png` (`via: "pack"`).
- Dismiss is **union-only**. Identity keys include catalog species tokens
  (`foal` from “small foal”).
- Delete is confirmed.
- `personalities` + `friendMissions` persist (v6+). Removing a friend may keep
  the personality keyed by `animalId`.
- Gallery **reset** is the only path that clears the dismiss pin.

---

## Future work order (do not invent extra products)

Priority for later agents — still click-first until the clock feels kind:

1. Scorer reads declined/done missions (skip this week; celebrate done)
2. **Shipped:** `listBias` beads (0–100) on the instrument. Later: folder bias.
3. **Shipped:** mission sheet task row opens item detail over the sheet. **Later:** Habits
   deep-link; To Do / Next Actions tab focus
4. Undo-aware rewards; Home points well copy “your friend tipped you”
5. Quiet hours + unsolicited clock (cadence + pushiness)
6. Needs Attention / overdue / Operations / Tracking-gap candidates
7. Mood from sleep + tracking occupancy (tired friend asks for soak/curl)
8. Trinkets / nest furniture; CRT stickers as gallery cosmetics
9. Multi-step item quests through the write door
10. Optional LLM rewrite of the one chosen line

Do not restyle the CRT nest into a chat app. Do not add a second personality
editor in Settings (Gallery Details is the one).

---

## Later: machine learning, adaptability, prediction

Personality knobs are **hand-set and species-preset today**. Later they should
**learn** without becoming a chat LLM:

- **Adaptability** — raise/lower source weights, love/whim rates, and
  pushiness from what you actually finish, decline, or ignore (the mission log
  is the training signal).
- **Predictive algorithms** — when a friend is likely to help vs interrupt
  (clock, quiet hours, sleep/tracking mood); which item you will do next.
- **Machine learning** — local, inspectable models over that log + graph.
  Features stay named (habit vs To Do, overdue, title-loves). The picker
  remains a scored list you can test. An LLM may rewrite the one chosen line
  later; it must not pick a different item.

Do not train on private prose dumps. Do not hide the Gallery Details knobs
behind a black box — learned values should still show up there.

## Later: renew interest, and one symbol mission

Specified in [`JungBrain2.md`](JungBrain2.md) JG-8. Not built.

When the same mission kind is declined three times in a row, that kind pauses
for seven days and the next offer is a different kind. Declined rows stay in
the log. If a symbol has shown up on three or more days in the past week, one
mission can ask whether to write about it. The pause is a dated skip, not a
judgment of the person.

---

## Test plan

- Personality sanitize/clamp + species flavor (love rates, owl read whim)
- Picker source bias; title-loves; flavor affection/whim
- Nest: photograph → details; chat button → bubble; bubble → mission sheet (task → item popup over the sheet; accept / decline ladder); Esc still closes the bubble
- Instrument: Save stays disabled until the draft changes; title-love beads and list beads save; Chat does not log a mission; Personality hides the equalizer; a journal row opens the mission card, which accepts, splits, and opens the task
- Gallery Details saves tone overlay
- Pack import + unnamed placeholders; naming a card persists; shuffle avoids search
  when the pack is in the gallery
- Rewards go through `points-store`
- Dismissed species never appear in shuffle/request/Monday roll/hub overlay

## Out of scope until named

- Full conversational agent
- Reading mail into the bubble
- Training on the user's prose
- Changing Monday wear rules
