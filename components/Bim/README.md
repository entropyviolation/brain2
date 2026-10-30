# `components/Bim/` — BIM Chat

_Last mapped: 2026-10-30_

BIM in the app. A line typed here goes through the Telegram bot's executor
(`lib/ingest/bim-chat.ts` → `ingestIncomingAsync`), so every BIM command works
and writes the same stores. It runs on the `simulate` channel with chat id
`bim-chat`. That channel skips pairing and dedupe. The bot, its allowlist, its
poll offset, and the Telegram feed are untouched. Rituals, clarify questions,
and `undo` have their own thread under `bim-chat`. The transcript is
per-device (`localStorage` `bimchat-transcript`, outside the vault).

| File | Role |
|------|------|
| `use-bim-chat.ts` | Shared draft, Enter-to-send (Shift+Enter is a new line), scroll pin, open clarify answers, quick commands |
| `phone/bim-phone.tsx` / `.css` | iPhone shell **BIM** tab (`components/Mobile/MobileApp.tsx`). A plain text terminal, silver keycaps for quick commands and answers. The Pull / Location / Health / NFC cards hide on this tab |
| `console/bim-console.tsx` / `.css` | Desktop green-phosphor console. CHAT, LOG (ingest events for `bim-chat`), and COMMANDS (`ALL_COMMANDS`) are live. Keypad digits answer numbered questions. Buttons carry `data-no95` and the glass is `!important` so the Win95 keycap and dialog skins stay off. Under 768px (or a coarse pointer under 981px) it is one column: chat, compose, quick keys; the dossier and keypad hide |
| `bim-key.tsx` | Pin-bar key in **Capture** (`components/AppHeader.tsx`). Loads the console on first press |
| `bim-screens.test.tsx` | Phone send/reply, console keypad, Enter, planned tab |

**Planned:** console tabs GRAPH (knowledge graph), LLM (free text to a model
with vault context), ACTIONS (approvable actions), RULES (standing rules), and
more fields on the dossier card once those are wired.
