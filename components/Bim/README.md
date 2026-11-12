# `components/Bim/` — BIM Chat

_Last mapped: 2026-10-30_

BIM in the app. A line typed here goes through the Telegram bot's executor
(`lib/ingest/bim-chat.ts` → `ingestIncomingAsync`), so every BIM command works
and writes the same stores. It runs on the `simulate` channel with chat id
`bim-chat`. That channel skips pairing and dedupe. The bot, its allowlist, its
poll offset, and the Telegram feed are untouched. Rituals, clarify questions,
and `undo` have their own thread under `bim-chat`. The transcript is
per-device (`localStorage` `bimchat-transcript`, outside the vault).

## Telling BIM things, and asking

- **Hand off to a BIMBY:** "send this to tracking bimby: computer work 1 hr from 11:40 - 12:40 timeblock with note '…'" passes the words after the colon, unread, to the Tracking BIMBY's own chat (`lib/ingest/bimby-handoff.ts`). It runs as if typed in the Tracking tab; its proposed blocks wait for Add there. "Tell habits bimby i did skincare, stretched, drank water, unfollowed 1 person" does the same for the Habits BIMBY: the proposed cells are drawn under BIM's reply (`habit-card.tsx`) and wait for Accept there or in the Habits chat (the Inbox shows a notice). With "bimby" or "helper" said, no colon is needed. _2026-11-11:_ a plain line that reads as daily habits done ("did skincare, stretched, drank water") is handed over without naming the BIMBY (`lib/habit-helper/README.md`, "Automatic hand-off from BIM chat").

Plain sentences work, ahead of the command ladder (`lib/ingest/bim-tell.ts`, `apply-tell.ts`; the note is in `lib/ingest/README.md`):

- **Tell:** "The last time I saw Shelby was July 5th" sets Shelby's Last seen. "The Foxtide CDs are extremely overdue" raises the task, puts it on today's to do, and notes it. "Elijah comes home on nov 18th" plans an event.
- **Ask:** "When was the last time I saw Shelby?" reads Last seen. If BIM has nothing, it asks "When do you remember last seeing Shelby?" and files your answer.
- **Command (mirror):** "Create a document in Docs called "Allietext" and add any text I type by hand over 70 words" makes the note and adds a page-wide `typed-text → doc-append` rule (`lib/ingest/apply-text-mirror.ts`, `lib/rules/`). "Stop auto-adding typed text" turns it off.
- **Command:** "Create a countdown widget to when Elijah comes home" makes a Countdown from the Plan event. With no date known BIM asks for one; your answer creates the event and the countdown.
- **Don't forget:** "dont forget to cancel instacart" goes on today's To Do ("… tomorrow" on tomorrow's). A line with a clock ("at 5pm") is left as before. "Don't forget that the gate code is 4412" is a kept fact, as "remember that" is.
- **Remind me if:** "got 15$ off restaurant food on instacart remind me if im thinking about ordering food or if i need to order food" keeps the fact and says it back under BIM's reply only when a later line is that situation, then stays quiet for 30 minutes. "used it" or "stop reminding me" ends it. "What are you reminding me about?" lists them. See `lib/cues/README.md`.
- **Money:** "foxtide owes me 600$ for the cd designs", "Spent 90$ on the amex getting hairdye and other stuff on instacart", "i regret the instacart order", "who owes me?" go to the Financial BIMBY (`lib/finance-bimby/README.md`). A photo sent right after a spend, or captioned as one, is attached as its receipt. "undo that" takes the write back.
- **Plan the day:** "what I have to do for the rest of the day: order hairdye asap, dye hair, bleach eyebrows, pack (my stuff and elijahs) … MUST be done is dye hair (and thus order hairdye) … foxtide stuff and planning ny is important as well" becomes a day card (below). "Help me plan the rest of my day" makes BIM ask for the list.
- **Command (trip prep):** "Have to do before leaving for New York:" then one thing per line ("pack", "talk to Shelby") finds the flight or event for the day, makes the list "To do before New York" in Lists, and dates each thing on To Do leading up to leaving (packing last). It asks for the date when none is found, and asks to merge a thing that looks like a task you already have (`lib/ingest/apply-trip-prep.ts`).

Names in these lines come from the vault. Someone BIM does not know falls through to a normal log line. Pronouns are never guessed in replies. The open question is in memory only.

| File | Role |
|------|------|
| `use-bim-chat.ts` | Shared draft, Enter-to-send (Shift+Enter is a new line), scroll pin, open clarify answers, quick commands. _Last mapped: 2026-11-02_ The unsent line is saved on every keystroke (`lib/draft-store.ts`, `brain2-draft-bim-chat`) and restored on mount; only a send clears it. Photos are not kept. _2026-11-11:_ The log follows the newest line only while you are at the bottom; scrolled up, a reply or a card repaint leaves you where you are. Your own send always scrolls down. Also photos: the 📷 key opens the file picker (camera or library on iOS), thumbnails wait with the caption, Send works with a photo alone, and the executor asks what the photo is if the caption does not say. Not checked on a device: Tesseract OCR in the iOS app |
| `phone/bim-phone.tsx` / `.css` | iPhone shell **BIM** tab (`components/Mobile/MobileApp.tsx`). A text terminal on the same drifting ink, silver keycaps for quick commands and answers. The Pull / Location / Health / NFC cards hide on this tab |
| `console/llm-suggestions.tsx` (+ `.test.tsx`) | _Last mapped: 2026-10-31_ The LLM tab's "LLM suggested …" sections. REJECT asks why and keeps the reason; ACCEPT keeps the row's note; both are verdicts (`lib/bim-flow/suggestion-verdicts.ts`) and the row is not shown again. The last pass's suggestions are kept in `localStorage` (`bim-llm-suggestions-v1`) and shown again when the tab reopens, minus rows with a verdict, so nothing undecided has to be regenerated. Each pass that asked the model is kept as a BIM flow run marked "Activated from Brain2 button click". Accepted LLM blocks may overlap one another and are listed under the suggestions until their bounds are set in Tracking; the same activity overlapping merges into one block with every detection in its notes. Runs `suggestWeek` (`lib/bim-flow/suggestions.ts`) with the bench's saved routed Log flow and model, fills in as each message finishes, expands a row to show its evidence lines. ACCEPT writes one suggestion through `lib/bim-flow/accept.ts` as one undo step: a block paints an Activity entry (split at midnight, refused if that time was painted since), an item goes through Quick Add, a habit is marked by the `habit:` writer. Accepted blocks are noted "Suggested by BIM flow" and stamped `generatedBy: { kind: "llm", id: "bim-suggest:<id>" }`, so they can be found and swept. **Planned:** sections for the other proposal kinds (mood, intake, person, location, company) |
| `bim-ink.css` | _Last mapped: 2026-10-30_ BIM's phosphor, shared by console and phone. `--bim-ink` is the Dash's ghost green (`#5cf2d6`) drifting to ghost blue (`#8fd3ff`) over about three minutes; `--bim-ink-2` drifts the other way, so sections differ. Fixed: `--bim-lcd` (you), `--bim-violet` (commands), `--bim-fault`. `.bim-glass` is the CRT well. Drift stops under reduced motion |
| `console/bim-console.tsx` / `.css` | Desktop console, redesigned 2026-10-30: a silver handheld (like the Friend instrument) with CRT glass wells. _2026-11-01:_ every key is the app's ortholinear keycap (`.todo-cap` shape: pale silver, inset 2px skirts and a 4px foot, 2px drop on press); SEND is the primary cap (navy edge and ring), clear and 📷 are the grey modifier cap, the selected tab and MODE key are CRT glass with a lamp. Not-wired tabs sit apart under "not wired yet". Chat shows BIM and you in different inks with times (_2026-11-10:_ a line from another day reads "Nov 9 · 11:40", with the year when it is not this year; today stays the time alone; the LOG tab uses the same stamp), BIM's thinking as three bars, and starter chips in the empty log. A pixel face in the dossier blinks and talks while BIM works. The number keypad is gone: with a question open, digits 1–9 tap the numbered answer. LOG can show errors only; COMMANDS has a filter. The grid row is `minmax(0, 1fr)` and the dialog height is `!important`, so long replies scroll inside the glass instead of growing the dialog. CHAT, LOG (ingest events for `bim-chat`), COMMANDS (`ALL_COMMANDS`), and LLM are live. LLM lists the week's flow suggestions (`console/llm-suggestions.tsx`: time blocks, items, habit completions not yet in Brain2; press Suggest, needs Ollama; ACCEPT writes one, REJECT keeps why) above a door to the flow bench, `/lab/bim-flow`. Keys inside glass (chips, LLM ACCEPT/REJECT, tools) are keycaps too; only the expanding LLM row stays a ghost. The ✕ is the shared `KeycapClose`. _Last mapped: 2026-11-01_ At phone width the compose row reads like a texting app: a round paperclip keycap left of the well, a round ↑ send keycap right, the well rounded, and messages as subtle bubbles (thin ring, tail corner squared). Desktop keeps 📷 and SEND ↵. The compose well has extra padding so the focus ring never touches the text. Buttons carry `data-no95` and the dialog face is `!important` so the Win95 keycap and dialog skins stay off. Under 768px (or a coarse pointer under 981px) it is one column: chat, compose, quick keys; the dossier hides |
| `bim-key.tsx` | Pin-bar key in **Capture** (`components/AppHeader.tsx`), and with `phoneBar` the `>_` key on the phone bar beside Menu. Loads the console on first press. On mount, once per device, it replays the saved transcript through the Flight BIMBY (`lib/flight-bimby/backfill.ts`) so a confirmation pasted before that existed is filed, and adds a BIM line saying what it caught up on. _Last mapped: 2026-11-10._ The phone bar key remembers that BIM Chat is open (`brain2-bim-chat-open` in `localStorage`): quit the iOS app with it open and it is open again on the next launch, at phone width. Only closing it clears the flag. The desktop key does not remember |
| `day-card.tsx` / `day-card.css` (+ `day-card.test.tsx`) | The day plan card, under a chat line that has `dayId` (console and phone). See "Day card" below |
| `habit-card.tsx` | _2026-11-11._ The Habits BIMBY's proposals under a chat line that has `habitLineId` (console and phone): the BIMBY's own `ProposalTable`, read from `useHabitsBimby`, so Accept, edit and Dismiss work in BIM chat and the Habits chat shows the same rows. Set by a named hand-off and by the automatic one (`lib/habit-helper/README.md`). **Planned:** the same for Tracking BIMBY blocks |
| `bim-screens.test.tsx` | Phone send/reply, console digit answer, Enter, planned tab. Ask-back and check-ins are tested in `lib/ingest/bim-switchboard.test.ts` |

_Last mapped: 2026-11-01_ Fonts: the quick keycaps (INFO … CLEAR) are `w95fa` (`--w95-font`). The tabs are Silkscreen at its one weight, like the BIM plate. MODE keys and answer chips are unchanged.

**Planned:** console tabs GRAPH (knowledge graph), ACTIONS (approvable actions), RULES (standing rules), and
more fields on the dossier card once those are wired.

## LLM mode (switchboard, first slice)

_Last mapped: 2026-11-01_ A **MODE** switch sits on top of the console chat: ROUTER (plain routing, the Telegram bot: commands run, lines are filed, no models) or LLM. _2026-11-08:_ it is one slide switch, not two keys: a CRT-glass groove with a silver keycap knob, ROUTER on the left and LLM on the right, each word a lamp you can tap (`role="switch"`, checked = LLM). The secrets checkbox beside it is a plain checkbox now; it had picked up the keycap skin and drawn an empty grey key. The dossier shows the mode too. The phone header keeps its LLM key. Both are `useBimLlmMode` (`localStorage` `bimchat-llm-mode`, on by default). The switch moved out of the quick row because it was not seen there. On, a line the ladder would only capture (one line, no verb, nothing open) is routed first (`lib/ingest/bim-switchboard.ts`, `lib/bim-flow/chat-router.ts`): code rules, then `qwen2.5:3b`, climbing to the 14B when unsure (`lib/bim-flow/crew.ts`). A sure question runs the Ask flow and is answered in chat with an evidence fold; nothing is filed. Chat runs the answer on the 14B, not the 30B: on a 32 GB Mac the 30B pushed the 14B out and every question reloaded models (112s, then 120s timeouts; now about 35s). Every other label or an unsure route goes to the executor unchanged. A sure ask whose run fails or times out says so in chat and files nothing; with LLM on and no model reachable, BIM says it cannot reach the models (before, the ladder replied "needs LLM on" while it was on). BIM lines show a route chip ("ASK · code · q3 30b-a3b · 4.2s"). The iPhone app runs the flow on its own vault copy and sends only model calls to the Mac's `/api/ollama` proxy (`scripts/persist-api.mjs`, hub token when set; `lib/bim-flow/chat-models.ts`). Telegram never uses it. _Last mapped: 2026-11-01_ A clarify the ladder gives up on (`start`, `mood`, `location`) is routed once before you see it: a sure ask is answered, a sure log is filed. _2026-11-10:_ a sure `chat` line now gets a reply from the chat lane (below). Corrections are read in code ahead of the router (below). **Planned:** tell and build lanes and the rest of `docs/BIM_CHAT_SWITCHBOARD_PLAN.md`.

**Why "when did Elijah leave for tour?" failed (fixed 2026-11-01).** Three causes. 1) `qwen3:30b-a3b` thinks by default and spent the token cap on it, so `content` was empty and `JSON.parse` threw "Unexpected end of JSON input"; `lib/bim-flow/ollama.ts` now sends `think: false` and names an empty or cut-off reply. 2) Plan events (`useEventStore`, "elijah leaves for tour", all day) were never in the snapshot; `buildHistory` now carries them and `retrieve.ts` reads them as `plan event` rows. "leave" also matches "left" now (a short irregular-past table), and a bare mark (four content words or fewer) gets half a point over a chat line with the same hits. 3) The answer prompt dropped any row about someone else, and refused a day without an hour. Both rules are rewritten in `run-flow.ts`.

## Texts: what someone said

_Last mapped: 2026-11-11_ "What was Shelby talking about in her last text to me?" is answered from the texts themselves (`lib/ingest/bim-texts.ts`, `tryTexts` in `lib/ingest/bim-chat.ts`), in ROUTER and LLM mode alike. Before, it went to the Ask flow, which reads texts only as a day's digest, so it could not say.

- **Who.** Code finds the person by name or nickname in People I Know. Their saved phone numbers and emails tie texts to them. No number saved: BIM says so. Two people with the same name: BIM asks which.
- **Which texts.** The hub's last 60 days (`/api/phone-texts`). Their last text to you and the ones sent with it (back to back, no gap over 30 min). A direct thread wins over a group chat. "What did I text Elijah last?" reads your side. "My last texts with Shelby" reads the last exchange, both sides.
- **The answer.** With LLM on, the main model says in one or two sentences what the texts were about, from those texts only (and up to 6 earlier ones as context). It does not quote them. The texts are in the evidence fold, and an **exact words** key asks again for them word for word. "Word for word", "exactly", "quote" or "read me" in the question quotes them with no model. With LLM off or no model reachable, BIM says when the texts came and offers the key; it does not guess.
- **iPhone.** The app asks the Mac hub it syncs with for the texts. Not checked on a device.
- Secret people's texts stay out, as everywhere (`secretHandles`). Nothing is filed. The chip is `TEXTS · code · <model> · 1.2s`.

**Planned:** "texts from Shelby today", a topic ("what did Shelby say about the jacket?"), and the thread's pronoun follow-ups ("and what did she say before that?").

## Thread: follow-ups

_Last mapped: 2026-11-09_ BIM answered each line alone, so "and last week?" had no subject. Now the last question you asked is the thread's **focus** (`lib/ingest/bim-thread.ts`), and a short follow-up is made whole in code before any lane reads it. No model is asked.

- **Time:** "how many hours of computer work this week?" then "and last week?" runs "how many hours of computer work last week?".
- **Person:** "when did I last see Shelby?" then "what about Elijah?" runs "when did I last see Elijah?".
- **Pronoun:** "where did she go after?" runs "where did Shelby go after?", only when the focus names exactly one person. With none or two, nothing is rewritten.

The reply shows `read as: …` in the route ink (`BimLine.readAs`, console and phone), so a wrong reading is visible. The whole question then goes through the normal order (facts, tell, router, Ask), in ROUTER and LLM mode alike. The rewritten question is the new focus, so follow-ups chain. A time or a name alone counts only with a lead-in ("and", "what about") or a question mark; a bare "yesterday" stays an answer or a log line. An open question (tell, fact, check-in, clarify) owns the line first; a new question after "Do you know?" may still be a follow-up. The focus is kept per device (`localStorage` `bimchat-thread`, outside the vault), goes stale after 30 minutes, and is dropped by **clear**.

**Why it left the plan:** `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §5 has the thread hold the last 8 turns, linked entities, and a model-written summary. This slice keeps only the last question and re-links its people on demand, because the code rewrite needs nothing else and the transcript already holds the turns. **Planned:** the rolling summary, open questions saved in the thread so a reload keeps them, a time and a person in one follow-up, and one thread shared across devices once the hub runs flows.

## Chat lane: talking, grounded or plainly general

_Last mapped: 2026-11-10_ With LLM on, a line the router is sure is `chat` (thinking out loud, a feeling, small talk) gets a reply and is **not filed**. Before, it was logged like any other line. The lane is `lib/bim-flow/chat-lane.ts`, called from `runSwitchboard`.

- **Steps.** Code links names, topics, time words and words the vault has seen. A model (role `pick`) chooses at most one tool from a closed list: `count`, `last`, `day`, `person-days`, `search`, `texts-day`, `none`. Code runs it with the existing `runCompute` / `retrieve` reads. The main model (the 14B, like Ask) writes one to three sentences from the last 8 turns and the tool result. A second pick is asked for only when the first read found nothing; never a third.
- **General.** A reply with no rows and no counted fact behind it is general, by code, and the line says "general, not from your data" (`BimLine.general`). With rows in hand the model may say its reply did not use them; that can only move a reply toward general. A grounded reply shows its rows in the evidence fold.
- **General questions.** A question the code rules call `ask` that names nothing in the vault (no "I" or "my", no time word, no known name or topic, no word the vault has seen), such as "what is the boiling point of nitrogen?", goes to this lane and skips the Ask flow, which could only say "I don't know".
- **Log it.** A statement gets a **log it** key that sends `log: <your words>`. Only your words are ever filed, never the model's.
- **Failure.** If the reply model fails or times out (90s), a chat line is filed as before and a question goes on to the Ask flow. The chip reads `CHAT · q2.5 3b · count · q2.5 14b · 8.0s · 2 calls`; `∅` marks a read that found nothing.

Checked on the real 14B against the test vault (2026-11-10): a feeling got a short reply and no tool; "been doing computer work a lot this week" got the counted 10h 30m; a cooking question about a thing the vault mentions was answered from general knowledge and marked general. Not checked in the running app.

**Why it left the plan:** `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` §5 makes this a bench flow with a new `tool` node and a `converse` answer mode. It is plain code here, so it could ship without changing the flow engine; the steps and the closed tool list are the same. **Planned:** the bench flow, the optional `check` step, offering a fact that bears on a feeling (sleep after "so tired"), chat + log in one line, and Telegram once the hub runs flows.

## Corrections

_Last mapped: 2026-11-10_ "no, yesterday" used to be filed as a new log line. Now a line that fixes BIM's last turn is read in code (`lib/ingest/bim-correct.ts`) and acted on first, in ROUTER and LLM mode alike (`tryCorrect` in `lib/ingest/bim-chat.ts`). No model is asked. The reply's chip is `CORRECT · code`.

- **When:** "no, yesterday", "actually it was at 3pm", "wrong, 11/7/26 at 14:00", "no, 2 days ago", "no, on friday". The last write is undone through the executor's own `undo`, then the same executor line is sent again as if at that time. A day alone keeps the hour; a clock alone keeps the day. A second fix moves the moved write. A time that has not happened yet is refused.
- **Not a question:** "that wasn't a question", "I wasn't asking", "just log it" files the line BIM answered as `log:`.
- **Was a question:** "that was a question", "I was asking" undoes the write and asks the line.
- **Undo in words:** "scrap that", "never mind", "don't log that".
- **Bare "no" / "wrong":** BIM says what it filed and offers keys: undo it, it was a question (or just log it), leave it.

Both route fixes leave a **route verdict** (`lib/bim-flow/route-verdicts.ts`, `localStorage` `bimroute-verdicts-v1`, and the disk archive as `route-verdict`). The switchboard sends the same words straight to the corrected lane next time, in code, and the newest six verdicts are shown to the routing model as examples.

Limits. The last turn is in memory only, so a reload forgets it; it also goes stale after 30 minutes and when a question is open. Cards (Report, Wire, Stream) are not corrected this way; they have their own Reject. If something else changed after the line, the undo is refused and nothing moves. A line that starts with "no" and says something else ("no coffee today") is still a log line. `ping` no longer counts as a write for `undo` (`phone-undo.ts`), so it cannot cover the last real write.

**Why it left the plan:** `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` routes `correct` through the router and a bench flow, and links a fix to the run and node that made the mistake. Here the shapes are read in code ahead of the router, so a fix costs nothing and works with LLM off. **Planned:** corrections the code shapes miss, through the router's `correct` label; fixing a field other than the time ("no, 2 hours not 1"); the long-press on the route chip; verdicts as taught examples on the flow node; a routing score that counts them.

## Secrets in answers

_Last mapped: 2026-11-02_ Items marked Secret never reach the model. `snapshotFromStores` (`lib/bim-flow/store-snapshot.ts`) and BIM's search read (`lib/ingest/apply-read.ts`) drop them unless the **Include secrets in answers** switch in the console's MODE row is on, which needs the passphrase (`lib/secrets-store.ts`). Telegram and the hub snapshot never include them. The chat transcript (`bimchat-transcript`) is kept on the device, so an answer that used a secret stays in it after you lock. **Planned:** drop those lines on lock.

## BIM asks you

_Last mapped: 2026-11-01_ BIM asks as well as answers (`lib/ingest/bim-chat.ts`, `AskBack`). In memory only, like the tell question.

- **Check-ins.** "What are you doing right now?" and "How are you feeling right now?", alternating. BIM asks only on the **ask me** key. _2026-11-01:_ it no longer asks on open; the chat stays quiet until you say something. `checkInDue` is kept for the **Planned** timed check-ins. The answer is filed as `doing:` or `mood:`; mood has tap answers. `skip` drops it.
- **Don't know → ask.** An Ask answer with confidence none or low starts "I don't know." and asks you for it. Your answer is filed as `log: <answer> (answer to "<question>")`, so the next ask finds it.
- A new question (ends in `?`) or a real command drops the open question and runs.

**Planned:** check-ins timed to gaps in Activity, and clarifying questions written by the model when the evidence is close but not enough.

## iOS desk sheet and the keycap deck

_Last mapped: 2026-10-30._ On the iOS desk, the BIM key opens the console as a phone sheet. The keycap deck (`components/Mobile/keyboard`) is fixed over the bottom of the screen, so `bim-console.css` shrinks the sheet by `--m-keyboard-h` while `html.m-keyboard-open` is set. Before that, the compose well sat under the deck and typing was invisible. On a coarse pointer the textarea no longer takes `autoFocus`; the person taps it. `useBimChatStore.send` also catches a throw so `busy` never sticks. _2026-11-01:_ typing in the sheet closed BIM Chat and the Menu. The cause was the Menu sheet, not BIM: its key lived in the sheet, and the sheet closed itself on clicks that React passed up from the console. BIM is now a phone-bar key beside Menu (`components/Mobile/README.md`). _2026-11-01:_ with the deck up, the sheet slid down and the compose row sat under the deck. `touch.css` centers dialogs with `margin: auto`, so a shorter sheet moved down by half. The sheet is now pinned at `--phone-sheet-top` with a stronger selector. With the deck up it ends above the deck, the chat glass shrinks, and the quick keys hide. The round send key drops the lamp square, so the arrow is centered.

_2026-11-08:_ the phone sheet was crushed. The secrets toggle in the MODE row shrank to one letter per line and the row took most of the screen, so the chat glass showed one line and, with the deck up, the compose row was cut off. Now, at phone width: the MODE row is the switch and the secrets checkbox only (the sentence and the passphrase hint are desktop only); the four live tabs share the header evenly and the planned tabs are hidden; the round send key has no navy ring or edge. With the deck up the MODE row hides too, and `use-bim-chat.ts` keeps the newest line in view when the glass shrinks (a `ResizeObserver`, only when you were already at the bottom).

## Freezes (fixed 2026-11-11)

_Last mapped: 2026-11-11_ BIM chat froze for 1–2.5 s after a send, after Accept, and on what felt like random moments. Routing a line takes 20–40 ms (the turn's Trace says so); the freeze was the vault sync around it, measured in the running app:

- **Day-notes loop.** The Tracking store saves without `dayNotes`; every hub pull put them back into the stored blob (`overlayLocalTrackingNotes` in `lib/vault-guard.js`). So the next save never matched, ran the full union guard (about 1 s), POSTed 6 MB, and pulled again. A pull runs on every window focus, which is the "random" part. The overlay no longer adds the field to a blob that has none.
- **Pull of identical copies.** `mergeHubIntoStores` (`lib/persist-storage.ts`) now skips a key whose hub copy is the same bytes as the local one.
- **The 60 s dump.** `hooks/useMessageIngest.ts` sent the whole 16 MB vault to the phone hub every minute (about 200 ms frozen). It now sends only after a save (`pushVaultToHubIfChanged`, `lib/ingest/vault-push.ts`).
- **Accept.** Report card saves are queued and paint first (`lib/report-bimby/decide.ts`), so the card shows SAVING… and the chat scrolls while it writes.

A send of `status` went from a 1.6 s block to about 70 ms. A focus pull still costs about 2 s while the hub holds an older Tracking copy that differs from this one; it clears on the next Tracking save. The phone hub process (`scripts/phone-hub.mjs`) merges with the new guard only after a restart. **Planned:** run the hub pick off the main thread (a worker) so a real difference cannot freeze the page either.

## Wire card

_Last mapped: 2026-11-07_ `wire-card.tsx` draws the Wire BIMBY's plan under a chat line that has `wireId` (console and phone). "Connect the speed reader to my daily reading habit", or "make it so the detail view includes pages read and lets me say which book", becomes steps (connect, breakdown, entry). Each step shows why, editable fields (habit, module, what it counts, what it is about), and its checks against the real habits plus a sample report. Accept stays shut while a check fails. A box under the steps rebuilds the plan from your words (tweak); saved steps stay saved. Logic and limits: `lib/wire-bimby/README.md`.

## Report card

_Last mapped: 2026-11-09_ The same card also draws a Stream BIMBY plan (`lib/stream-bimby/README.md`): a pasted day of timed lines becomes one editable line per filing, each sent to the executor on Accept. A stream card ends with LINK blocks (a planned step and what happened to it) and FEEL blocks (pull, resistance, how it sat), which confirm records in `lib/follow-through/README.md`; the reply's follow-through question shows as the usual numbered choices. `report-card.tsx` / `report-card.css` draw the Report BIMBY's plan under a chat line that has `reportId` (console and phone). A status report becomes a trace plus one block per change (cycle, sleep, inventory, intake, activity), each with why, evidence, editable fields, Accept / Reject. Nothing saves until Accept. The logic is in `lib/report-bimby/README.md`. _2026-11-11:_ It also draws a Social BIMBY plan (`lib/social-bimby/README.md`): a line about a friend becomes PERSON, NOTE, BIRTHDAY, REMIND and PLAN blocks.

## Neutral accept

_Last mapped: 2026-11-11_ Every proposal card in BIM chat has a **Neutral** key beside Accept: the Report, Stream and Social card, the Wire card, the Habits card, and the LLM tab's suggestions (and the Tracking BIMBY's blocks, where they wait). Neutral writes exactly what Accept writes, the same way, with the same undo. The difference is what it teaches. Accept says the output was right. Neutral says it was ok to apply, not that it was right. The decision is still kept, marked `grade: "ok"` (`lib/accept-grade.ts`), and the card shows `SAVED · NEUTRAL` (`accepted · neutral` on Habits rows, `added · neutral` on Tracking blocks).

- **Skills loop** (`lib/skills/`, the Tracking BIMBY): an untouched block is a `neutral` experience, not a success. It credits no skill (no use, no win), stays out of the success rate, and is never shown to distill. A field you changed before Neutral is still a failure with your value, because the proposal was wrong there.
- **LLM suggestions:** the verdict is `accepted` with `grade: "ok"`. `goodAccepts` (`lib/bim-flow/suggestion-verdicts.ts`) leaves it out, so it is never fed back as a good example. The tab counts neutral verdicts.
- **Report, Wire, Habits:** nothing learns from their accepts yet. The grade is kept on the effect, step or row, so a learner added later skips them.

Each card has **Neutral all** beside Accept all. **Planned:** Neutral on the day card, which files a whole plan and teaches nothing today.

## Day card

_Last mapped: 2026-11-11_ `day-card.tsx` draws the Plan BIMBY's day plan (`lib/plan-bimby/README.md`, "Today") under a chat line that has `dayId`. The lane is `tryDay`, called from `sendToBim` after the follow-through answers and before the flight and stream lanes.

- **Rows.** One per thing: weight (must / important / if time, the left rule shows it), the title, minutes, a chip saying where the minutes came from (your history and your own words are solid, a model guess or rule of thumb is dashed), and where it falls on the clock. A row that ends after the day does is dashed and says PAST THE END.
- **Reasons fold.** Why it matters today, what happens if it is not done, resistance, what is in the way, steps, and whether to use the task you already have. A model's guess shows as a placeholder with **Keep the guess**; it is never filed unless kept.
- **Head.** Time left, what the musts and everything need, and what to let go of first. The end of the day is editable.
- **Keys.** **Put on To Do today** files tasks and the follow-through intention (one undo step). **File and start** also starts the Plan BIMBY run list, which is then drawn inside the card on a light well. **Reject** sets the plan aside. **Say a change** takes the same sentences chat does.
- **In chat.** BIM asks for the reasons one at a time with tap answers. Lines like "pack will take 2 hours", "drop shave legs", "done dye hair" change the live plan; the reply carries the card again, and the older copy becomes a one-line stub.

Corrections ("no, yesterday") and the follow-through line reader skip a day line, as they do for the other cards.

Not checked in the running app: the card's look on the console and the phone, and the run list inside it. The render test covers rows, an edit, the change box, and filing.
