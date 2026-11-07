# `lib/inbox-bimby/` — The Inbox Helper BIMBY

_Last mapped: 2026-11-07_

A **BIMBY** (small, single-job sub-agent) for the Inbox and Monkey brain tabs. For each captured idea it suggests where it goes, what it repeats, and what to clarify. UI: the **Inbox helper** foot key, painted by `components/inbox/helper/inbox-helper-dialog.tsx`. It is optional: nothing runs until the person presses Ask.

## Flow

POOL → PICK → CLEAN → REVIEW → USE.

- **Pool.** `context.ts`. The query is the idea's title, notes and tags. Candidates are every list (with a few of its item names), every open filed item, and every other idea still in the Inbox. Each gets a shared-word score (`words` from `lib/link-bimby/context.ts`); `embedScores` (`nomic-embed-text`) adds a meaning score when installed. `shortlist` keeps 12 lists (`L…`), 12 filed items (`I…`) and 8 Inbox ideas (`S…`).
- **Pick.** `suggest.ts` `helpTask`. One schema-bound call per idea on the `pick` ladder through `escalate`: up to 3 `files` (lists), up to 3 `matches` (`duplicate` or `similar`) and up to 2 `questions`.
- **Clean.** `cleanHelp` keeps only shortlist refs, once each; a list the idea is already on is dropped; refs written in prose become names. `exactMatches` finds same-title repeats with no model and `withExact` puts them first, so a plain duplicate is never missed. With no model, `helpByRules` offers the best word matches ("Shares the words …") and, for a one-word bare capture, asks what to do with it.
- **Review and use.** The dialog lists each idea with its suggestions. **File** (`applyFile`) adds the list and takes the idea out of the Inbox. **Merge into** (`mergePlan` + `applyMerge`) folds the idea into the item it matches through `lib/item-merge.ts`, every detail kept, the match surviving. **Clarify** opens the normal Clarify sheet. ✗ drops the idea's suggestions. File and Merge call `rememberWorld` first, so Cmd/Ctrl-Z undoes, and show the undo banner.
- **Scope.** The checked ideas, else every idea in view (search and slice apply). One pass reads 25 at most, one at a time, with Stop. The queue lives in `store.ts`, so closing the dialog does not stop it.

## Rules this BIMBY keeps

- **Advice is not data.** Suggestions live in `store.ts` for the session only and are never written onto the task. Only File, Merge and Clarify change anything, and only on a key press.
- **Never invent a place.** A suggestion must name a shortlist ref. It cannot create a list or an item.
- **Planned.** Remembering ✓ / ✗ like the Link BIMBY's feedback lessons; a Merge preview before folding; "Ask" on a single row; suggestions for tracking-log transfer; the phone Inbox.

## Files

- `types.ts`: `Candidate`, `FileGuess`, `MatchGuess`, `HelperSuggestion`.
- `context.ts`: `nameOf`, `normalTitle`, `ideaText`, `buildPool`, `shortlist`, `exactMatches`.
- `suggest.ts`: `HELP_SCHEMA`, `HELP_SYSTEM`, `helpPrompt`, `cleanHelp`, `withExact`, `helpByRules`, `helpTask`.
- `apply.ts`: `applyFile`, `mergePlan`, `applyMerge`.
- `store.ts`: `useInboxHelperStore`, `runInboxHelper`, `stopInboxHelper`, `HELPER_BATCH`.
- `inbox-bimby.test.ts`.

_2026-11-07:_ Lab page `/lab/inbox-bimby` (`components/Lab/InboxBimby/`): pick or type an idea, see where it would go. A dry run; nothing is filed or merged.
