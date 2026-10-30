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
| `use-bim-chat.ts` | Shared draft, Enter-to-send (Shift+Enter is a new line), scroll pin, open clarify answers, quick commands |
| `phone/bim-phone.tsx` / `.css` | iPhone shell **BIM** tab (`components/Mobile/MobileApp.tsx`). A plain text terminal, silver keycaps for quick commands and answers. The Pull / Location / Health / NFC cards hide on this tab |
| `console/llm-suggestions.tsx` | The LLM tab's "LLM suggested …" sections. Runs `suggestWeek` (`lib/bim-flow/suggestions.ts`) with the bench's saved routed Log flow and model, fills in as each message finishes, expands a row to show its evidence lines. **Planned:** Accept (write through the `lib/ingest/` apply paths, tagged `llm`), and sections for the other proposal kinds (mood, intake, person, location, company) |
| `console/bim-console.tsx` / `.css` | Desktop green-phosphor console. CHAT, LOG (ingest events for `bim-chat`), COMMANDS (`ALL_COMMANDS`), and LLM are live. LLM lists the week's flow suggestions (`console/llm-suggestions.tsx`: time blocks, items, habit completions not yet in Brain2; press Suggest, needs Ollama; read only, Dismiss hides one on this device) above a door to the flow bench, `/lab/bim-flow`. Keypad digits answer numbered questions. Buttons carry `data-no95` and the glass is `!important` so the Win95 keycap and dialog skins stay off. Under 768px (or a coarse pointer under 981px) it is one column: chat, compose, quick keys; the dossier and keypad hide |
| `bim-key.tsx` | Pin-bar key in **Capture** (`components/AppHeader.tsx`). Loads the console on first press |
| `bim-screens.test.tsx` | Phone send/reply, console keypad, Enter, planned tab |

**Planned:** console tabs GRAPH (knowledge graph), ACTIONS (approvable actions), RULES (standing rules), and
more fields on the dossier card once those are wired.
