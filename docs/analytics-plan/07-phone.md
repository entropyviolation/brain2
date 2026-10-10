# Build brief — Phone

One Phone room. BIM is the phone door. The seed is already on screen: **Text events** and **Text spans** in `components/Analytics/TextPipelineView.tsx`. Both filter `generatedBy.kind === "text"`. Both keep the kicker **from text pipeline**. Add plates beside them. Do not rename those two views, and do not call hand-painted tracking “phone.”

The conversation is a rolling audit. The life record is thick, and only the allow-list below remembers a channel. Every plate names its grain in the corner: last 200 `IngestEvent` turns, or stamped history that survives rotation.

**Later owner:** one phone agent.

**Files:** `components/Analytics/TextPipelineView.tsx` and new phone plate files next to it. Do not edit habit grade math. Do not edit the plan ribbon.

**Coverage line, first on the page:** Conversation log: last 200 turns. Stamped history: as far back as the vault. GPS successes: this sitting only (memory ring, not the persist hub).

---

## Seed (keep)

| View | Filter | Shows |
| --- | --- | --- |
| Text events | text-pipeline instants in the analytics window | Discrete events and switch markers. Counts by day. List row ends with `from text pipeline`. |
| Text spans | text-pipeline intervals (`currently` / `stopped` / `switched`) | Painted minutes and switch-instant count. Same label. |

`generatedBy.kind === "text"` is also set by Simulate. When the last-200 log still holds the turn, filter `channel === "telegram"` before calling a minute a phone minute. Leave Simulate in the seed views only as text pipeline, which is what the label already says.

---

## Stamp allow-list

Provenance share (phone versus desk) is drawn only for these stamps. Name this list on the room.

| Stamp | Record | Share |
| --- | --- | --- |
| `generatedBy.kind === "text"` | Time entries (the seed views) | Text-pipeline instants versus other instants. Text-pipeline span minutes versus hand-painted Activity minutes. Count span starts separately: `currently` paints through midnight. |
| `keywordLogged` (and `keywordValue` when present) | Habit cell after `dh:` | Keyword-met habit-days versus hand-met. A later in-app edit can change `value` and leave the flag. If `updatedAt` is much later than the ingest turn, call that cell “edited after.” |
| `stampSuffix === "from text"` | Plan append lines | Plan lines with that suffix versus other plan lines. |
| `morning.source` | Day review morning slice | `"telegram"` versus `"desktop"`. Compare telegram mornings to desktop mornings, not to days with no morning. |
| `allNighterSource` | Sleep night | Channel of the all-nighter flag only. Bed and wake from `gm` or `sleep:` do not set this. |

Weaker marks exist in the vault (`sent from text`, `logged from text`, folder From phone, `precision: "estimated"`, `account: "Telegram"`, `livePins.grocery`). They are not on this allow-list. Do not stack them into a phone-versus-desk share.

---

## Not separable

These domains have no channel flag. The plate title is **not separable**. List them. Do not draw a zero phone share, and do not draw 100% desk.

- Inbox and quick add (`capture`, `qa:`, `add:`, `inbox:`, `idea:`)
- Grocery checkout (`bought` / receipt completion)
- Night review (`endCompleted` is not channel-specific; night `source` is unset)
- `habit:` / `did:` cells without `keywordLogged`
- Cycle flags
- Day notes
- Location, mood, and track paints (`at:`, `mood:`, `start:` as a pen, `track:`) — they look hand-painted; `track:` may fill `trackedValue` rather than `keywordLogged`

Refuse channel crosses that need one of those flags: Telegram location × later mood, Telegram cycle × sleep, night-review gratitude × next-day habits.

---

## Conversation plates (last 200)

Source: `brain2-ingest-store` `events`, newest first, max 200. GPS successes are already stripped. Fields used: `kind`, `status` (`applied` \| `clarify` \| `ignored` \| `error`), `raw`, `at` (send time = `message.date`, not apply time), `channel`, `chatId`, `summary`, optional `itemIds`. `edit_date` is ignored.

**Reads versus mutations.** Reads are reply-only kinds (`read:`, `lists`, `help`, `info`, `today`, `where`, `ping`, and the rest of the catalog’s non-writing verbs). Mutations are the writes. Help and reads stay in a quiet color; mutations in a strong one. Parse-but-no-persist (`help`, `pin`, empty grocery dump, `stop` with nothing running) is visible by kind and is not a failed write.

**Command mix.** Channel `telegram` inside the window. The log stores `kind`, not the surface verb. Kind share and family share (help, grocery, needed, capture, bulk, habits, log, monitor, plan, todo, review, track, note, sleep, gps, screen, call, text, iphone-notes, pin, inventory, receipt, journal, read). Alias waste is not stored. Infer a shortcut only when `raw` still starts with a one-letter token or a key in `shortcuts`. Hover lists kinds, not a guessed verb, unless `raw` is still in the window.

**Sessions are derived.** None are stored.

- Capture session: one `chatId`, sort by `at`. Cut when the gap exceeds 20 minutes, or when a ritual pending opens or closes.
- Ritual session: a `morning`, `night`, `review`, or `reviews` turn that opens a ritual pending, through the turn that clears it. Step names live on the pending ritual. A partial morning is also `morning.resumeStep`.

Session strip: blocks by kind, width by count. Ritual steps only when `raw` plus the state machine can recover them.

**Funnels** (three, not one). Start the published turn funnel at paired turns. Draw sent, extracted, and claimed as a dashed unknown — those stages are not rows.

1. Turn funnel, window: paired → applied / clarify / error / ignored. `Unpaired sender` is its own exit, not a parse failure.
2. Clarify: opened, resolved next turn, re-asked, abandoned, escape hatch (`new`, `see`, `again`, `dismiss`, `inv`, `skip`).
3. Morning survival from the depth score (0–11: no slice; bed or all-nighter; wake or all-nighter; dream or skipped via all-nighter; affirmations; todos added or `requiredTaskIds` defined, including empty; `priorityTaskIds` defined; `priorityHabitIds` defined; walk index or walk finished into the day plan; `dayPlanLogged`; `bestDayWhy`; gratitude length > 0 and `completed`). One curve for completed, one for `resumeStep` abandoned. `STOP` still saves. It is depth-at-exit, not a failure.

Night: `endCompleted` is the only durable finish bit and is not channel-specific. Inside the window, re-simulating `periodSteps` is deterministic and still an outside join. Label it. Do not put night on the provenance share.

This section expires. Say so.

---

## Ingest lag

`processedAt` is not a field. Do not subtract `at` from itself. Do not plot a fake lag.

Empty frame until `processedAt` exists. Sentence: “Lag is not recorded.”

The only clocks that differ from send time, and only if the plate mentions them, marked **partial**:

- Habit cell `updatedAt` minus the event’s `at` (last write wins; a later in-app edit measures the edit).
- Last grocery pin `livePins.grocery.at` minus the event (one row, overwritten; `at` is wall-clock of the pin call).

Album wait (1.1 s) and the long-poll timeout (25 s) are constants, not measurements. Queue lag while the laptop sleeps is censored at about 24 hours because Telegram drops unclaimed updates. That is a coverage caveat, not a number.

---

## Capture completeness

Count only what the telegram vision says is countable. Do not invent poll-error history. The hub heartbeat file and Electron poll fields hold the latest error only.

| Fact | What the room may say |
| --- | --- |
| Apply, clarify, error, ignored | Rates inside the 200. GPS successes are already out of the denominator, so the apply rate is biased away from location life. |
| Silent drops | Qualitative checklist: stickers, video, contacts, polls, documents that are neither PDF nor image, photos or PDFs over 12 MB with an empty caption, `getFile` failures, empty text. They die before the executor. There is no stored count. |
| Dedupe | `Duplicate Telegram update` and “ingest disabled” return before the log. The rate is not stored. Seen-key overflow (ring of 500) is not directly countable. A symptom is two domain rows with the same title and the same send timestamp — a possible re-apply, not two intentions. |
| GPS hidden from the log | Successful GPS paints are removed from `events`. The memory ring of 40 is this sitting only. Location grid notes `"gps"` survive and still cannot separate Live Location, `gps:` text, and the Shortcut. |
| 24-hour retention | Unclaimed updates older than about 24 hours are a hole no store can fill. State it. Do not impute the missing turns. |

Human retry, inside the window only: same chat, same kind, normalized `raw`, gap under 2 minutes, previous status `error`.

---

## Telegram-day contrast

Descriptive, not causal. The person chooses to text. The sentence is “days I reached for the phone look like this,” not “the bot caused the day.”

A local date is a telegram day only when an allow-list stamp is true that day: a text-pipeline time entry, a habit cell with `keywordLogged`, a plan line with `stampSuffix === "from text"`, `morning.source === "telegram"`, or `allNighterSource === "telegram"` on that morning’s night. Do not define the day from the 200-row window.

Bin in the zone the executor used. There is no per-chat zone. `message.date` is an absolute instant; habit dates are local.

Difference in means versus other days, with a weekday fixed effect. Outcomes the bot does not fully determine: keyword-habit meets split from hand meets; morning `completed` among mornings that exist, by source; day-plan presence by stamp on the line; Activity span minutes kept separate from instant counts. The count of text-pipeline instants is higher on telegram days by definition. Do not use it as the finding.

---

## Edits and failed sends

An edit is a new `update_id` with the same `message_id`. Dedupe prefers `update_id`, so the edit is a second command. It does not update the first record. The clock stays `message.date`. Say that on the conversation plate.

A failed `sendMessage` can leave the vault written and the phone unconfirmed. Reply success is not a column. The view must not treat a missing confirmation as proof nothing was written. A retry is a new message and will not collapse. Pin failure leaves the previous grocery pin in place.

---

## Out of scope

No habit grades. No plan-ribbon redesign. No sixth section that re-charts sleep architecture or plan quality. Phone may link to a habit cell or a time entry. It does not recompute them.
