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
| `console/bim-console.tsx` / `.css` | Desktop console, redesigned 2026-10-30: a silver handheld (like the Friend instrument) with CRT glass wells. Silver keycaps for tabs, quick words, and SEND; the selected tab is CRT glass with a lamp. Not-wired tabs sit apart under "not wired yet". Chat shows BIM and you in different inks with times, BIM's thinking as three bars, and starter chips in the empty log. A pixel face in the dossier blinks and talks while BIM works. The number keypad is gone: with a question open, digits 1–9 tap the numbered answer. LOG can show errors only; COMMANDS has a filter. The grid row is `minmax(0, 1fr)` and the dialog height is `!important`, so long replies scroll inside the glass instead of growing the dialog. CHAT, LOG (ingest events for `bim-chat`), COMMANDS (`ALL_COMMANDS`), and LLM are live. LLM lists the week's flow suggestions (`console/llm-suggestions.tsx`: time blocks, items, habit completions not yet in Brain2; press Suggest, needs Ollama; ACCEPT writes one, REJECT keeps why) above a door to the flow bench, `/lab/bim-flow`. Keys inside glass (chips, LLM ACCEPT/REJECT, tools) are keycaps too; only the expanding LLM row stays a ghost. The ✕ is a square keycap. The compose well has extra padding so the focus ring never touches the text. Buttons carry `data-no95` and the dialog face is `!important` so the Win95 keycap and dialog skins stay off. Under 768px (or a coarse pointer under 981px) it is one column: chat, compose, quick keys; the dossier hides |
| `bim-key.tsx` | Pin-bar key in **Capture** (`components/AppHeader.tsx`). Loads the console on first press |
| `bim-screens.test.tsx` | Phone send/reply, console digit answer, Enter, planned tab |

**Planned:** console tabs GRAPH (knowledge graph), ACTIONS (approvable actions), RULES (standing rules), and
more fields on the dossier card once those are wired.

## LLM mode (switchboard, first slice)

_Last mapped: 2026-11-01_ An **LLM on/off** key sits at the end of the console's quick row and in the phone header (`useBimLlmMode`, `localStorage` `bimchat-llm-mode`, on by default). Off is the grammar ladder alone, as before. On, a line the ladder would only capture (one line, no verb, nothing open) is routed first (`lib/ingest/bim-switchboard.ts`, `lib/bim-flow/chat-router.ts`): code rules, then `qwen2.5:3b`, climbing to the 14B when unsure (`lib/bim-flow/crew.ts`). A sure question runs the Ask flow and is answered in chat with an evidence fold; nothing is filed. Every other label, an unsure route, no model, a timeout, or a failed run goes to the executor unchanged. BIM lines show a route chip ("ASK · code · q3 30b-a3b · 4.2s"). The iPhone app runs the flow on its own vault copy and sends only model calls to the Mac's `/api/ollama` proxy (`scripts/persist-api.mjs`, hub token when set; `lib/bim-flow/chat-models.ts`). Telegram never uses it. _Last mapped: 2026-11-01_ A clarify the ladder gives up on (`start`, `mood`, `location`) is routed once before you see it: a sure ask is answered, a sure log is filed. **Planned:** chat, tell, build, correct lanes and the rest of `docs/BIM_CHAT_SWITCHBOARD_PLAN.md`.

## iOS desk sheet and the keycap deck

_Last mapped: 2026-10-30._ On the iOS desk, the BIM key opens the console as a phone sheet. The keycap deck (`components/Mobile/keyboard`) is fixed over the bottom of the screen, so `bim-console.css` shrinks the sheet by `--m-keyboard-h` while `html.m-keyboard-open` is set. Before that, the compose well sat under the deck and typing was invisible. On a coarse pointer the textarea no longer takes `autoFocus`; the person taps it. `useBimChatStore.send` also catches a throw so `busy` never sticks. **Not reproduced:** the send crash on the phone. It is not in the executor (it passes in node). Check the device if it persists.
