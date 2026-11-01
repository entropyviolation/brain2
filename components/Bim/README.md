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

Plain sentences work, ahead of the command ladder (`lib/ingest/bim-tell.ts`, `apply-tell.ts`; the note is in `lib/ingest/README.md`):

- **Tell:** "The last time I saw Shelby was July 5th" sets Shelby's Last seen. "The Foxtide CDs are extremely overdue" raises the task, puts it on today's to do, and notes it. "Elijah comes home on nov 18th" plans an event.
- **Ask:** "When was the last time I saw Shelby?" reads Last seen. If BIM has nothing, it asks "When do you remember last seeing Shelby?" and files your answer.
- **Command:** "Create a countdown widget to when Elijah comes home" makes a Countdown from the Plan event. With no date known BIM asks for one; your answer creates the event and the countdown.

Names in these lines come from the vault. Someone BIM does not know falls through to a normal log line. Pronouns are never guessed in replies. The open question is in memory only.

| File | Role |
|------|------|
| `use-bim-chat.ts` | Shared draft, Enter-to-send (Shift+Enter is a new line), scroll pin, open clarify answers, quick commands. _Last mapped: 2026-11-01_ Also photos: the 📷 key opens the file picker (camera or library on iOS), thumbnails wait with the caption, Send works with a photo alone, and the executor asks what the photo is if the caption does not say. Not checked on a device: Tesseract OCR in the iOS app |
| `phone/bim-phone.tsx` / `.css` | iPhone shell **BIM** tab (`components/Mobile/MobileApp.tsx`). A text terminal on the same drifting ink, silver keycaps for quick commands and answers. The Pull / Location / Health / NFC cards hide on this tab |
| `console/llm-suggestions.tsx` (+ `.test.tsx`) | _Last mapped: 2026-10-31_ The LLM tab's "LLM suggested …" sections. REJECT asks why and keeps the reason; ACCEPT keeps the row's note; both are verdicts (`lib/bim-flow/suggestion-verdicts.ts`) and the row is not shown again. The last pass's suggestions are kept in `localStorage` (`bim-llm-suggestions-v1`) and shown again when the tab reopens, minus rows with a verdict, so nothing undecided has to be regenerated. Each pass that asked the model is kept as a BIM flow run marked "Activated from Brain2 button click". Accepted LLM blocks may overlap one another and are listed under the suggestions until their bounds are set in Tracking; the same activity overlapping merges into one block with every detection in its notes. Runs `suggestWeek` (`lib/bim-flow/suggestions.ts`) with the bench's saved routed Log flow and model, fills in as each message finishes, expands a row to show its evidence lines. ACCEPT writes one suggestion through `lib/bim-flow/accept.ts` as one undo step: a block paints an Activity entry (split at midnight, refused if that time was painted since), an item goes through Quick Add, a habit is marked by the `habit:` writer. Accepted blocks are noted "Suggested by BIM flow" and stamped `generatedBy: { kind: "llm", id: "bim-suggest:<id>" }`, so they can be found and swept. **Planned:** sections for the other proposal kinds (mood, intake, person, location, company) |
| `bim-ink.css` | _Last mapped: 2026-10-30_ BIM's phosphor, shared by console and phone. `--bim-ink` is the Dash's ghost green (`#5cf2d6`) drifting to ghost blue (`#8fd3ff`) over about three minutes; `--bim-ink-2` drifts the other way, so sections differ. Fixed: `--bim-lcd` (you), `--bim-violet` (commands), `--bim-fault`. `.bim-glass` is the CRT well. Drift stops under reduced motion |
| `console/bim-console.tsx` / `.css` | Desktop console, redesigned 2026-10-30: a silver handheld (like the Friend instrument) with CRT glass wells. _2026-11-01:_ every key is the app's ortholinear keycap (`.todo-cap` shape: pale silver, inset 2px skirts and a 4px foot, 2px drop on press); SEND is the primary cap (navy edge and ring), clear and 📷 are the grey modifier cap, the selected tab and MODE key are CRT glass with a lamp. Not-wired tabs sit apart under "not wired yet". Chat shows BIM and you in different inks with times, BIM's thinking as three bars, and starter chips in the empty log. A pixel face in the dossier blinks and talks while BIM works. The number keypad is gone: with a question open, digits 1–9 tap the numbered answer. LOG can show errors only; COMMANDS has a filter. The grid row is `minmax(0, 1fr)` and the dialog height is `!important`, so long replies scroll inside the glass instead of growing the dialog. CHAT, LOG (ingest events for `bim-chat`), COMMANDS (`ALL_COMMANDS`), and LLM are live. LLM lists the week's flow suggestions (`console/llm-suggestions.tsx`: time blocks, items, habit completions not yet in Brain2; press Suggest, needs Ollama; ACCEPT writes one, REJECT keeps why) above a door to the flow bench, `/lab/bim-flow`. Keys inside glass (chips, LLM ACCEPT/REJECT, tools) are keycaps too; only the expanding LLM row stays a ghost. The ✕ is the shared `KeycapClose`. _Last mapped: 2026-11-01_ At phone width the compose row reads like a texting app: a round paperclip keycap left of the well, a round ↑ send keycap right, the well rounded, and messages as subtle bubbles (thin ring, tail corner squared). Desktop keeps 📷 and SEND ↵. The compose well has extra padding so the focus ring never touches the text. Buttons carry `data-no95` and the dialog face is `!important` so the Win95 keycap and dialog skins stay off. Under 768px (or a coarse pointer under 981px) it is one column: chat, compose, quick keys; the dossier hides |
| `bim-key.tsx` | Pin-bar key in **Capture** (`components/AppHeader.tsx`), and with `phoneBar` the `>_` key on the phone bar beside Menu. Loads the console on first press |
| `bim-screens.test.tsx` | Phone send/reply, console digit answer, Enter, planned tab. Ask-back and check-ins are tested in `lib/ingest/bim-switchboard.test.ts` |

**Planned:** console tabs GRAPH (knowledge graph), ACTIONS (approvable actions), RULES (standing rules), and
more fields on the dossier card once those are wired.

## LLM mode (switchboard, first slice)

_Last mapped: 2026-11-01_ A **MODE** switch sits on top of the console chat: ROUTER (plain routing, the Telegram bot: commands run, lines are filed, no models) or LLM. The dossier shows the mode too. The phone header keeps its LLM key. Both are `useBimLlmMode` (`localStorage` `bimchat-llm-mode`, on by default). The switch moved out of the quick row because it was not seen there. On, a line the ladder would only capture (one line, no verb, nothing open) is routed first (`lib/ingest/bim-switchboard.ts`, `lib/bim-flow/chat-router.ts`): code rules, then `qwen2.5:3b`, climbing to the 14B when unsure (`lib/bim-flow/crew.ts`). A sure question runs the Ask flow and is answered in chat with an evidence fold; nothing is filed. Chat runs the answer on the 14B, not the 30B: on a 32 GB Mac the 30B pushed the 14B out and every question reloaded models (112s, then 120s timeouts; now about 35s). Every other label or an unsure route goes to the executor unchanged. A sure ask whose run fails or times out says so in chat and files nothing; with LLM on and no model reachable, BIM says it cannot reach the models (before, the ladder replied "needs LLM on" while it was on). BIM lines show a route chip ("ASK · code · q3 30b-a3b · 4.2s"). The iPhone app runs the flow on its own vault copy and sends only model calls to the Mac's `/api/ollama` proxy (`scripts/persist-api.mjs`, hub token when set; `lib/bim-flow/chat-models.ts`). Telegram never uses it. _Last mapped: 2026-11-01_ A clarify the ladder gives up on (`start`, `mood`, `location`) is routed once before you see it: a sure ask is answered, a sure log is filed. **Planned:** chat, tell, build, correct lanes and the rest of `docs/BIM_CHAT_SWITCHBOARD_PLAN.md`.

**Why "when did Elijah leave for tour?" failed (fixed 2026-11-01).** Three causes. 1) `qwen3:30b-a3b` thinks by default and spent the token cap on it, so `content` was empty and `JSON.parse` threw "Unexpected end of JSON input"; `lib/bim-flow/ollama.ts` now sends `think: false` and names an empty or cut-off reply. 2) Plan events (`useEventStore`, "elijah leaves for tour", all day) were never in the snapshot; `buildHistory` now carries them and `retrieve.ts` reads them as `plan event` rows. "leave" also matches "left" now (a short irregular-past table), and a bare mark (four content words or fewer) gets half a point over a chat line with the same hits. 3) The answer prompt dropped any row about someone else, and refused a day without an hour. Both rules are rewritten in `run-flow.ts`.

## BIM asks you

_Last mapped: 2026-11-01_ BIM asks as well as answers (`lib/ingest/bim-chat.ts`, `AskBack`). In memory only, like the tell question.

- **Check-ins.** "What are you doing right now?" and "How are you feeling right now?", alternating. BIM asks on open when the last check-in is two hours old and nothing else is open, and on the **ask me** key. The answer is filed as `doing:` or `mood:`; mood has tap answers. `skip` drops it.
- **Don't know → ask.** An Ask answer with confidence none or low starts "I don't know." and asks you for it. Your answer is filed as `log: <answer> (answer to "<question>")`, so the next ask finds it.
- A new question (ends in `?`) or a real command drops the open question and runs.

**Planned:** check-ins timed to gaps in Activity, and clarifying questions written by the model when the evidence is close but not enough.

## iOS desk sheet and the keycap deck

_Last mapped: 2026-10-30._ On the iOS desk, the BIM key opens the console as a phone sheet. The keycap deck (`components/Mobile/keyboard`) is fixed over the bottom of the screen, so `bim-console.css` shrinks the sheet by `--m-keyboard-h` while `html.m-keyboard-open` is set. Before that, the compose well sat under the deck and typing was invisible. On a coarse pointer the textarea no longer takes `autoFocus`; the person taps it. `useBimChatStore.send` also catches a throw so `busy` never sticks. _2026-11-01:_ typing in the sheet closed BIM Chat and the Menu. The cause was the Menu sheet, not BIM: its key lived in the sheet, and the sheet closed itself on clicks that React passed up from the console. BIM is now a phone-bar key beside Menu (`components/Mobile/README.md`).
