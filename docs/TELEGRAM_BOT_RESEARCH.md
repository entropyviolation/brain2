# Telegram bot research — what to build next on BIM

Read-only look at the Brain2 phone bot on **9 Oct 2026**. BIM (Brain2 Ingestion
Messenger) is already a capture, list, habit, tracking, and plan door. The
useful next work is making one text land once, and making the grocery pin and
the questions the bot already asks easier to use in a private chat.

This file does not change the command language. Another pass was editing
`lib/ingest` and the ingest docs while this was written. The behaviors below
are what the tree contained at read time, checked against unit tests.

Companion view: the canvas
`telegram-bot-research.canvas.tsx` in the Cursor canvases folder.

## What is already running

| Piece | Where | Observed |
| --- | --- | --- |
| Command core | `lib/ingest/` | Verb plus payload. Prefix-less text is Inbox, except a multi-line `Name:` dump. LLM-free. |
| Long poll | `electron/telegram-ingest.js`, `scripts/phone-hub.ts` | `getUpdates` timeout 25s. `allowed_updates`: `message`, `edited_message` only. |
| Webhook | `scripts/phone-hub.ts` `POST /telegram/webhook` | Used when `COGS_TELEGRAM_WEBHOOK` is set. Optional `X-Telegram-Bot-Api-Secret-Token`. |
| Queue-only poller | `scripts/telegram-ingest.mjs` (`npm run ingest`) | Does not apply. Prefer `npm run phone:hub`. |
| Replies | `lib/ingest/deliver-reply.ts`, `lib/ingest/chunk-text.ts` | Plain `sendMessage`. Split at 3900 characters. Telegram’s cap is 4096. |
| Pin | `pinChatMessage` / `unpinChatMessage` | One grocery pin in `livePins.grocery`. Private chats can pin without admin rights. |
| Pairing | `lib/ingest/pairing.ts`, Settings | 6-digit code, or pair-by-sight from a logged refusal. Unknown senders get no reply. Groups off unless Settings allows them. |
| Tests | `lib/ingest/*.test.ts` | 28 files, 218 tests, all passed (see below). |

One consumer at a time: phone hub, or Electron, or `npm run ingest`. Electron
yields when `data/phone-hub-status.json` is fresh.

## Recent direction, as it stood in this tree

These were specified as product direction. In the files read here they are
**implemented and tested**, not merely intended. Treat a later edit by the
other pass as newer than this paragraph.

| Direction | Status in this snapshot |
| --- | --- |
| Bare `now` / `status` / `where` is the status readout. `now` plus a payload, and `/now`, are Now capture (`doing \| just did \| about to`), not Status. | Implemented. `apply-now.ts`, `executor.test.ts` (“keeps Now prose as Now capture”). |
| Fuzzy match must not let glue words (`store`, `list`, `to`, …) carry a hit. A unique fuzzy hit is refused when the query still has content words the candidate name does not contain. | Implemented. `name-resolve.ts` and its tests (`outfit store` vs `grocery store`; `flights to tokyo` vs `flights to book`). |
| `got` / `bought`, `text` / `sent` / `call` / `called`, `did`, `add` must not eat ordinary sentences. Colon forms keep the command. Bare words stay inbox. | Implemented. `COLON_ONLY` in `parse-message.ts`. A bare `got` / `bought` still checks off when **every** comma-separated piece uniquely matches an open grocery line (`matchesOpenGroceryLines`). “Got back from walk” stays inbox. “got oats” checks off oats. |
| Dedupe persists `telegramMessageId` and refuses apply when the dedupe key is null. | Implemented. `dedupe.ts` returns null when a non-simulate message has neither `update_id` nor `message_id`. `executor.ts` logs `Null dedupe key` and does not apply. The event stores `telegramMessageId` and `dedupeKey`. |
| Live grocery list is chosen in Settings. A `groc` reply shows other open shopping-list counts. Bare `store` dumps the list and refreshes the pin. | Implemented. `groceryListId`, `annotateOtherLists`, alias `store`. Tested. Delivery still sends a **second** bubble when the count is present (see correctness). |
| `/quicklists` slots: to-do today, this week, this month, next actions, grocery, shopping, ISO, undone habits. A number alone shows that list. Old grocery / todo keywords should stop stealing prose. | Implemented. `apply-quicklists.ts`. `grocery` / `shop` / `shopping` are bare-or-colon, so “grocery list” and “to do list” stay inbox. A bare number is quicklists only when no clarify is waiting. |

`docs/UI_NEXT.md` calls the null-key rule **Quadruple Inbox**. In that file it
is this dedupe behavior, not a four-pane inbox.

`docs/analytics-vision/05-telegram.md` still says the ingest event does not
store either Telegram id. The executor in this snapshot does store
`telegramMessageId` and `dedupeKey`. That vision doc was left untouched.

## How a text moves

```text
Telegram update
  → extract (electron/telegram-file.js): text or caption, photo/PDF, location, voice
  → dedupe key: upd:<update_id>, else msg:<channel>:<chat>:<message_id>, else null
  → expand shortcuts (w gym → at: gym; custom first word)
  → pairing / allowlist
  → open ritual owns the reply (gm and cancel still work from night/start/end)
  → open clarify owns a non-verb reply (a bare number answers the question)
  → else a bare number is /quicklists
  → explicit verb, else loose got/bought if it matches open grocery lines,
    else discrete trigger, else inbox
  → reply, and maybe pin
```

Writes use Telegram `message.date` (send time), in the **process** timezone.
There is no per-chat zone.

## Fix correctness

Ranked. The first three are also the first three things to do next.

### 1. Confirm the update only after the vault write

**Status: implemented.** The hub poll and the Electron poll advance their
offsets only through a prefix of updates whose vault write finished. A photo
album's promise resolves after the merged apply, not when the timer is
scheduled. The webhook returns 200 after that write and 500 when it fails.
Webhook applies for one chat are serialized. Electron acks from the renderer
after `flushScheduledPersist`.

**Why it matters.** Telegram delivers at least once. `getUpdates` treats an
update as confirmed once a later call passes a higher `offset`. A webhook that
is not HTTP 2xx is retried, then dropped. Unconfirmed updates last about 24
hours. If the phone shows no reply, the person sends the line again. The
second text has a new message id, so dedupe will not catch it. Inbox, grocery,
habits, and plan all double.

**What exists.**

- Electron (`electron/telegram-ingest.js`) advances `offset` and writes
  `telegram-update-offset.json` after `sendToRenderer`. That IPC send does not
  wait for apply or flush.
- The hub poll (`scripts/phone-hub.ts`) mutates `offset` while reading the
  batch. A throw after that mutation, before the offset file is written, skips
  those updates for the rest of the process lifetime. A restart re-reads the
  file, so they can come back only if the file was not written.
- Photo albums wait 1.1s (`pushAlbum`). The offset file is written, and the
  webhook returns 200, when the timer is **scheduled**, not when the merged
  apply finishes. A crash in that window loses the album. Telegram will not
  send it again.
- `claimIngestDedupe` runs at the start of `authorizeIncoming`, before the
  domain write. A webhook 400 after a successful claim and a failed flush
  either drops the retry (still in memory) or applies twice (process died
  before flush).

**Smallest step.** Advance the poll offset, and return webhook 200, only after
apply and flush for that update. Hold album updates unconfirmed until the
merged apply finishes. Serialize webhook handling per chat (the renderer
already chains applies; the hub webhook does not).

**Avoid.** Do not ack first and process in the background. Do not rely on the
500-key `seenIngestKeys` ring as the only idempotency.

### 2. Treat a text edit as the same message

**Status: implemented.** Text claims `msg:<channel>:<chat>:<message_id>` plus the first `update_id`. An edit's new update id does not apply again. Live Location still claims only `update_id`, so each sample re-applies.

**Why it matters.** Fixing a typo in a capture, a `log:` line, or `groc milk`
runs the command a second time. The record forks.

**What exists.** Both pollers subscribe to `edited_message`. Dedupe prefers
`update_id`. An edit keeps `message_id` and mints a new `update_id`, so it is a
new key. `telegramMessageId` is stored and is the dedupe key only when
`update_id` is missing. Live Location is the edit path that should re-apply
(`locationUpdate`). A ritual already drops those samples until it ends.

**Smallest step.** After a text apply has succeeded for a `message_id`, ignore
later updates with that id unless the update is a location sample. Keep
`update_id` as the retry key for the first delivery.

**Avoid.** Do not unsubscribe from `edited_message`. GPS depends on it.

### 3. Pin one grocery card, not two bubbles

**Why it matters.** The pin is the list that survives a closed laptop. A second
copy of the same list pushes it down the thread.

**What exists.** `dumpOrEmpty` sets `pinText` to the raw dump, then
`annotateOtherLists` appends `Other open shopping lists: …` to `reply` only.
`deliverIngestReply` pins the first reply chunk when `pinText` equals the
reply. When another shopping list is open, they differ, so the transport sends
the annotated reply **and** a second dump, and pins the second. The executor
test checks that the reply mentions the other list and that `pinText` contains
the items. It does not call `deliverIngestReply`.

**Smallest step.** Put the other-list line on the same string that is pinned,
and pin that send.

**Avoid.** Do not drop the count. Do not pin a separate card for it.

### 4. `store` plus a sentence still adds to grocery

Bare `store` dumps and pins (tested). `grocery` / `shop` / `shopping` need a
colon or they stay prose. `store` is a normal alias, so `store the idea`
files “the idea” onto the live grocery list. Settings still describes `store`
as the `groc` shortcut, including `store milk`.

**Smallest step.** Put `store` in the same bare-or-colon set as `grocery`: bare
`store` dumps, `store:` adds. Keep `groc milk`.

**Avoid.** Do not remove the dump. Do not make `store milk` a fuzzy activity
match; glue-word protection already stops `store` from selecting a pen by
itself.

### 5. `where` and `status` swallow a payload

Bare `now`, `status`, and `where` are the readout. Only the alias `now`, when
it has a payload, becomes Now capture. `where gym` and `status something` still
parse as status, and `applyStatus` ignores the rest. `w gym` is fine: expand
rewrites it to `at: gym`.

**Smallest step.** If `where` or `status` has a payload, leave the line as
inbox. Do not change the bare words.

### 6. Smaller reliability notes

- **Seen-key ring of 500.** Each Live Location edit is a new `update_id`. A
  long share can evict an older capture key. A late webhook retry can apply
  again. Poll offset makes this uncommon. Stamp text idempotency on
  `message_id` in the domain row.
- **Process timezone.** A hub in UTC files `gm` and habit days on the wrong
  local date. Run the hub in the life zone, or store that zone and use it for
  every phone day. Do not infer a zone from the GPS trail.
- **Reply failed after a successful write.** Analytics vision already names
  this. The human retry is a new message. Logging `sendOk` / `pinOk` (proposed
  in `05-telegram.md` and not present on the event) would make the split
  visible. It does not by itself stop the double write.

## New capability

Only ideas that attach to a path already in this repo, or to a Bot API method
checked against the changelog fetched the same day
([core.telegram.org/bots/api-changelog](https://core.telegram.org/bots/api-changelog)).

### 7. Reply to the grocery pin to check a line off

**Why it matters.** The pin is the list. Replying to it checks a line off
without a new verb and without letting bare `got` eat sentences.

**What exists.** `pinChatMessage` works in a private chat (Bot API: all
non-service messages can be pinned there). `livePins.grocery` stores chat id
and message id. Checkout already exists (`got:` / `bought:`, and the loose
match). `extractTelegramMessage` never reads `reply_to_message`.

**Smallest step.** Carry `reply_to_message.message_id`. If it equals the live
grocery pin, call the existing checkout with the reply text.

**Avoid.** Do not treat every reply as checkout. Do not remove `got:` /
`bought:`.

### 8. Buttons only on questions the bot already asks

**Why it matters.** Clarify (habit, pen, grocery line), duplicate
`see` / `again` / `dismiss`, and receipt `inv` / `skip` are already numbered
menus. A bare `1` is also quicklists slot 1 when nothing is pending. A tap
cannot miss.

**What exists.** Pending clarify wins over quicklists. Replies are plain text.
`callback_data` is 1–64 **bytes** (Bot API, `InlineKeyboardButton`). The
pollers do not subscribe to `callback_query`. Nothing calls `setMyCommands`
(at most 100 commands).

**Smallest step.** On `needs_clarify`, add an inline keyboard whose
`callback_data` is a short code plus a candidate id, not the item title. Add
`callback_query` to `allowed_updates`. Call `answerCallbackQuery` so the client
stops waiting, then clear the markup. Separately, set a **private-chat**
command menu: `start`, `help`, `now`, `quicklists`, `info`.

**Avoid.** Do not attach a reply keyboard to the composer. This bot is a prose
line; a standing keyboard turns ordinary words into commands. Do not publish
the catalog as slash commands.

### 9. Edit the morning card in place

**Status: implemented.** The open ritual stores the bot's message id and edits that message each step. The person's messages are not edited.

**Why it matters.** `gm` is many replies. They bury the thread. The grocery pin
survives, but the conversation does not.

**What exists.** Ritual state is one pending per chat. `editMessageText` on the
bot’s own message in a private chat is not under the 48-hour rule. That limit,
in the API text fetched today, applies to **business messages that were not
sent by the bot** and have no inline keyboard.

**Smallest step.** Store the bot’s ritual message id on the pending ritual and
edit that message each step.

**Avoid.** Do not edit the person’s messages. Do not start this before the
ack-after-write fix, or a retried update will fight the card.

### 10. Phone undo for the last text write

**Status: implemented.** `undo` reverts the last applied text write for this chat when that write is still the named top of the stack. If it cannot name that write, it says so. An open ritual is not rewound.

Desktop undo goes through action-history. The phone word is the recovery for a
capture that applied and whose reply never arrived.

**Smallest step.** `undo` reverts the last applied text write for this chat
when the store can name it.

**Avoid.** Do not rewind an open ritual with the same word. Morning already
uses `STOP`.

## Leave these alone

| Idea | Why it does not help this bot |
| --- | --- |
| `sendChecklist` / `editMessageChecklist` | Bot API 9.1 (3 Jul 2025): a checklist **on behalf of a business account**. Different trust model from a paired private bot. |
| `sendMessageDraft` | Streaming generated text. All bots as of Bot API 9.5 (1 Mar 2026). BIM replies are local and short. |
| Mini App | A second vault UI. The phone path is text on purpose. |
| Private-chat topics | `has_topics_enabled` in Bot API 9.3 (31 Dec 2025); `createForumTopic` in private chats in 9.4 (9 Feb 2026). A grocery topic hides the pin from the one chat that is opened at the store. |
| Groups | Stay off. The allowlist and the “no reply to strangers” rule are the security model. |
| Reactions as the confirmation | `setMessageReaction` exists (Bot API 7.0). `message_reaction` updates require the bot to be an admin and are not delivered for reactions the bot itself sets. A reaction cannot replace the sentence that says what was written. |
| More verbs | The catalog in `command-catalog.ts` is already the language. New words are how prose gets stolen. |

## Top five, in order

1. **Confirm the update only after the vault write.** Implemented. Stops double captures when a reply never arrives, and stops lost albums.
2. **Treat a text edit as the same message.** Implemented. Stops a typo fix from running the command again. Keep Live Location edits.
3. **Pin one grocery card.** The other-list count stays; the chat stops receiving the list twice.
4. **Reply to the pin to check a line off.** Uses the pin that is already the store list.
5. **Inline buttons on clarify, plus a five-command menu.** Taps for questions the bot already asks. No standing reply keyboard.

## Tests run

No product code was changed to obtain these results.

| Command | Result |
| --- | --- |
| `npx vitest run lib/ingest` | 28 files, 218 tests, all passed (about 5.3s) |
| `npx vitest run components/Settings/MessageIngestPanel.test.tsx components/ingest-log-dialog.test.tsx lib/rituals.test.ts` | 3 files, 12 tests, all passed |

## Sources

- Repo: `lib/ingest/` (parser, dedupe, executor, grocery, quicklists, now, deliver-reply), `electron/telegram-ingest.js`, `electron/telegram-file.js`, `scripts/phone-hub.ts`, `hooks/useMessageIngest.ts`, `docs/MESSAGE_INGEST.md`, `docs/UI_NEXT.md` (Now capture and Quadruple Inbox), `docs/analytics-vision/05-telegram.md`.
- Telegram Bot API and changelog, fetched 9 Oct 2026: message text 1–4096 characters; `callback_data` 1–64 bytes; webhook retry on non-2xx; `getUpdates` offset confirmation; private-chat pin; `setMyCommands` cap 100; checklist and draft and private-topic dates cited above.
