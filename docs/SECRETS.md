# Secrets

_Last mapped: 2026-11-24_

Brain2 has two kinds of secret. Both are hidden by default from search, word clouds, graphs, summaries, recaps and every model reply. They come back only when you EXPLICITLY include them.

## 1. Secret items

Any item can be marked Secret in its settings (`Item.secret`). The same flag covers Activity entries (`TimeEntry.secret`), day notes (`secretDayNotes`), documents (they are note items), and a secret person's texts (`secretHandles`). The filter is `withoutSecrets` in `lib/secrets.ts`.

## 2. Secret spans inside any text

Any text anywhere can hide part of itself. That includes notes, note-log entries, titles, why, Activity notes, day notes, chat lines, Telegram lines and documents. Put the secret words between two `\secret` marks:

```
loved the new One Direction album \secret and I'm thinking about all of them at once \secret honestly
```

- Braces are optional. `\secret {text} \secret` reads the same.
- If a span has no closing mark, it runs to the end of the text. A forgotten mark hides more, never less.
- The text keeps its marks on disk. Only readers strip them.
- In BIM chat, the **SECRET** key in the quick row writes the marks for you. In an empty box it writes `\secret  \secret` with the cursor between the marks. In a box with text it puts the marks at the cursor and deletes nothing. If text is selected, it wraps the selection.

The rest of the text is not secret. "loved the new One Direction album honestly" is still searchable, still feeds clouds and graphs, and BIM can still use it.

## The rule

A secret span or secret item counts toward any text, reply, recap, word cloud, graph or layout only when secrets are **EXPLICITLY included**. Nothing else counts as including them: not the topic, a mood, the word "therapy", or a question about the same subject. So "what do I think about One Direction?" never sees the span above. "secrets included: what do I think about One Direction?" does.

Explicit always needs the passphrase: one must be set, and you must have typed it (unlocked). With no passphrase set there is no way in. Then it is one of these:

| Way | Where | Lock |
|---|---|---|
| The line says **"secrets included"** (also "include my secrets", "with my secrets") | BIM chat, that one line only | Needs the passphrase typed. The phrase alone never works. |
| **Include secrets in answers** switch | BIM console MODE row (surface `chat`) | Needs the passphrase. Turns off when you lock, reload, or stay idle for 10 minutes. |
| **Include secrets** switch | Search → Advanced (surface `search`) | Same as above. |

`secretsAskedFor(text)` in `lib/secrets-store.ts` makes this decision for a chat line. _2026-11-24:_ before this date, the phrase worked with no passphrase set. It no longer does.

## After you send a line

_Last mapped: 2026-11-24_

Locked, a span is gone after you press send. You cannot see it, and nothing reads it.

- **On screen.** The chat log, BIM's replies ("Logged: …"), the Thought sheet (what you said, every step, every prompt, the copy button), Report and Pattern cards, the memory graph and the chat titles all draw the line with its spans cut. A line of yours that was all secret is not drawn at all. There is no mask, no mark and no count. `useShownLines` (`components/Bim/use-bim-chat.ts`) and `maskSecrets` / `useSecretsShown` (`lib/secrets-store.ts`) do this. A card field that holds a span is drawn stripped and cannot be edited, because saving it would delete the secret.
- **Readers.** `sendToBim` (`lib/ingest/bim-chat.ts`) cuts the spans before anything reads the line: the router, every lane, the pattern and report readers, cues, follow-through, the Coach's learning read, earlier turns given to the chat lane, and the Trace. `allBimLines()` strips by default.
- **The write.** Only the executor's write gets your exact words, so the span waits in the vault for an unlocked read and the covert tallies. A line that is all secret is filed as `log: …` and BIM answers only "Kept." (route `SECRET · code`). If a lane other than the executor takes the line, it files the stripped words, so the span is kept only in the chat transcript.
- **Telegram.** Telegram sits outside the passphrase gate. `scripts/phone-hub.ts` strips every span from every message and edit it sends.
- **Unlocked.** With the passphrase typed and **Include secrets in answers** on, every screen above shows the lines as written. Lock, reload or 10 idle minutes hide them again. `asksForSecrets(text)` in `lib/secrets.ts` is the phrase test.

## Where it is enforced

The default is fail-closed. A reader that never heard of secrets still never sees them.

| Seam | File | What it does |
|---|---|---|
| Every model call | `lib/bim-flow/ollama.ts` (`ollamaCall`, `embedScores`) | Cuts every span from the system and user text before the model, the cache, the trace or the archive sees it. Only `ollamaCall(…, { secrets: "included" })` keeps spans, and a `background` call never does. All BIMBIES (Day Log, Coach, Dump, …) therefore stay secret-free, as does every future model caller. |
| BIM chat | `lib/ingest/bim-switchboard.ts` (`secretsFor`) | The only place that opts in. When `secretsAskedFor(line)` is true, that line's Ask and chat lanes get `secrets: "included"` and a snapshot that includes secrets. The router and the after-turn learning read never opt in. |
| BIM's view of the vault | `lib/bim-flow/store-snapshot.ts` | `snapshotFromStores` / `snapshotFromPersistItems` drop secret items and deep-strip spans (`stripSecretsDeep`) unless `includeSecrets`. |
| Search | `lib/search.ts` | Words inside a span never match unless `includeSecrets`. Secret items are dropped. |
| Memory graph | `lib/memory-graph/build.ts` | `itemGraph`, `bimGraph` and `itemFacts` strip spans first, so a span never becomes a node, a fact, or a "mentions" link. |
| Pure helpers | `lib/secrets.ts` | `hasSecretSpans`, `stripSecretSpans`, `revealSecretSpans`, `secretSpans`, `stripSecretsDeep`, `insertSecretMarks`, `asksForSecrets`, `secretTally`. |

**Any new surface that reads text** must call `stripSecretSpans` / `stripSecretsDeep`, unless it is reached only through a seam above. That includes word clouds, keyphrases, analytics language readings, summaries, Day Logs, widgets and exports. The word cloud in `docs/analytics-vision/06-language.md` is **Planned**, and it must strip spans.

## Covert tallies

A span can carry a tag: `\secret[o] what I was thinking \secret`. `secretTally(rows, tag)` in `lib/secrets.ts` is a pure count over your own rows. Every row on the tally's pen (for example the "o" Activity pen) counts once, and so does every row with a span of that tag. For each one it gives the time, the tagged thoughts, and the minutes when the row is a timed block. Nothing stores the tally, and nothing shows it. It is computed on demand from text that is already secret.

Example: a block on the "o" pen from 22:10 to 22:24 with the note `\secret[o] Marilyn Monroe \secret` is one instance: 14 minutes, thinking "Marilyn Monroe".

**Planned:**
- A tally view, shown only while unlocked with secrets included.
- Wiring the tally rows from Tracking entries on a pen.
- Answering "secrets included: how many this month?" in BIM chat from the tally.
- Durations that get better as tracking does.

## Use in therapy-style retrieval

A future reflective or therapy BIMBY may use spans only on a turn that explicitly includes secrets. It must call the model with `secrets: "included"`, and only from that foreground turn. A standing BIMBY that runs on its own (in the background, on a schedule, or writing Day Logs) never includes secrets.

## What it is not

- It is not encryption. The text, spans included, sits in the vault on disk and in backups. The passphrase gates the app. It does not lock the files.
- The editor shows your own note with its marks. Hiding a span inside the editor is **Planned**. So is a masked chip for spans in read-only views such as item cards and search result snippets.
- The BIM chat transcript is kept on the device as written (`localStorage` `bimchat-transcript`). Locked, no screen draws its spans, but the text is in browser storage.
- These are not covered yet: Tracking's own find, the BIM feed rows shown raw, health imports, and `keyphrase` / `doc-retrieval` when they are called directly (not through a model). Their model calls are still stripped at the `ollama.ts` seam.
