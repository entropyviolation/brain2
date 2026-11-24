# `lib/coach-bimby/` — the Coach BIMBY

_Last mapped: 2026-11-22_

BIM remembers who you are, what you want and what you need to get done. It texts you reminders on Telegram,
sends a morning brief and an evening check-in, and coaches you to the next step. Before this, BIM had kept
facts ("remember that the gate code is 4412") and Reminders. Those Reminders texted only while the app window
was open, and nothing in chat could set a timed one.

## What you can say

- **About you:** "about me: I'm a graphic designer", "remember that I hate mornings", "my goals are to swim more and launch my shop", "my main goal this year is to move to New York", "I'm working toward a solo show". Each is kept as a note in your words (`said`).
- **What BIM knows:** "what do you know about me?" lists the notes by kind. "What are my goals?" lists your goals. "Forget that I hate mornings" drops a note. It matches on content words only (`forgetWords`). "Delete that" and "remove the last one" name nothing, so they are left to the undo; before this, "that" alone could drop any note holding the word. A `forget …` that matches no note is left for the other lanes. "Don't forget my keys" is a To Do (the `keep` lane), not a note.
- **Timed reminders:** "remind me at 5pm to call mom", "remind me to call mom at 5", "remind me tomorrow at 9 to pay rent", "remind me in 20 minutes to check the oven", "remind me on friday to email Dana", "remind me every day at 8am to stretch". Each makes a row on the Reminders list (`addReminder`), and that row texts you when it is due. A bare hour is read as the next time that hour comes. When both its am and pm have passed today, it is tomorrow's day-time hour: at 16:30, "at 4" is 16:00 tomorrow and "at 12" is noon, not 04:00 or midnight. A bare "sun", "sat", "wed" or "mon" is a word, not a day ("go sit in the sun"). "Ask when the store opens at 5pm" is a reminder, while "remind me when I get home" stays a cue. "Remind me to water the plants" has no time, so it stays a To Do (the `keep` lane). "Remind me to stretch if I sit too long" stays a cue.
- **Coaching:** "what should I do now?", "coach me", "help me focus", "morning brief", "check in with me", "am I on track with my goals?". With LLM on, the main model writes two to five sentences: one concrete next step from today's To Do and your goals, then one question. With LLM off, or when the model fails, code writes the brief from the same read.
- **Switches:** "morning brief at 8am", "evening check-in at 10pm", "stop the morning brief", "turn off coach texts", "turn on coach texts".

All of these work in BIM chat and on Telegram.

_2026-11-24:_ A hello in front is skipped (`lib/ingest/greeting.ts`): "hi. remember that my name is Allie" is kept as a `who` note. Before this it was logged.

## Learning as you talk

With LLM on, after BIM answers a line, the main model reads that line once, off the turn (`learn.ts`). It starts after the turn's Trace closes, so its call is not counted in that turn, and it skips a line that failed. The `coach` lane looks up the model crew only for a coaching ask. The line must speak of you ("I", "my"), have some substance, and not be a command or a question. The model returns lasting facts only: who you are, a goal, a want, a need, a like, a dislike, or a person in your life. Moods, today's plans and errands are dropped. A fact is kept only when the line states it. Three in four of its words must be in the line, and every capitalized name in it too. The notes are marked "(picked up)" in the list.

Checked live on 2026-11-22. For "ugh im a freelance illustrator and my sister dana is visiting next week", the 14B kept "I am a freelance illustrator" and "Dana is my sister". "So tired today lol" and "bought milk and eggs" kept nothing. The 3B kept nothing at all, so learning runs on the main model. An early prompt gave "My sister Dana lives in Ohio" as an example, and the model copied it. The name check now refuses that, and the prompt has no example.

## What the coach reads (`context.ts`)

`coachSnapshot` reads, in code:

- your notes
- your goals in your own words, then the Goals tab's open goals with progress
- objectives you prioritized for this day, week, month or year
- today's open To Do, most important first
- what you finished today
- reminders still to come today

Secret items stay out. `aboutBlock` gives the same read as prompt lines. It goes to the coach's model and to the chat lane (`lib/bim-flow/chat-lane.ts`, `about`), so ordinary chat replies can use your name, your goals and today's list.

## Telegram

- **Before the executor.** The always-on hub (`scripts/phone-hub.ts`) passes each text line to `telegramCoachFirst` before the executor runs. It skips a line while a ritual or clarify question is open for that chat, and it skips any line that starts with `word:`. If the coach answers, the executor does not see the line.
- **Every minute** (`startReminderTick` in the hub):
  - `deliverDueReminders` copies each due Reminder into the Inbox and texts it.
  - `coachTick` (`tick.ts`) sends the morning brief (default 09:00) and the evening check-in (default 21:30) to the newest paired chat. Each goes out once a day, at or after its time. A slot more than two hours late is skipped for that day. The day each was sent is kept on the prefs, so a restart does not send it twice.
- **No double texts.** The hub's `/api/ingest/status` says `remindersByHub`. While the hub says so, the app's own reminder tick stands down (`hooks/use-reminder-tick.ts`). `BRAIN2_HUB_REMINDERS=0` turns the hub tick off, and the app delivers again.

## Files

| File | Role |
|------|------|
| `me-store.ts` | `useMeStore`, in the vault (`brain2-coach-me`): notes (`who`, `want`, `goal`, `need`, `like`, `dislike`, `person`, `note`; `said` or `learned`) and the coach prefs. No duplicates. Your own words replace a learned copy. Capped at 200 notes, and the oldest learned notes go first. Guarded in `lib/vault-guard.js` and backed up (`lib/data/backup.ts`) |
| `read.ts` | Pure shapes: `parseAboutMe`, `parseMeAsk`, `parseForget`, `parseCoachAsk`, `parseCoachPrefs`, `parseTimedReminder` / `parseReminderWhenWords`, `kindOf` |
| `apply.ts` | `tryRemind`, `tryCoach`, `telegramCoachFirst` |
| `context.ts` | `coachSnapshot`, `aboutBlock` |
| `brief.ts` | `morningBrief`, `eveningCheckIn`, `goalsCheck`, `nowNudge` (code); `coachReply` (model) |
| `learn.ts` | `worthLearning`, `grounded`, `learnFromLine` |
| `tick.ts` | `coachTick` |
| `read.test.ts`, `coach.test.ts` | Shapes, memory, coaching with and without a model, reminders, learning, the tick |

The BIM chat lanes are `remind` and `coach`, right after `self` and before `keep` (`lib/ingest/bim-lanes.ts`). The Blueprint is `lib/agents/adapters/coach-bimby.ts`.

**Not checked:** a live Telegram send from the hub, because the running hub was not restarted, and the console and phone screens in the browser.

**Planned:**
- a Me panel to see and edit the notes outside chat
- a check-in that writes your answer to the evening question into the day's review
- a nudge when a prioritized goal has had no step for some days
- the brief written by the model when one is reachable
