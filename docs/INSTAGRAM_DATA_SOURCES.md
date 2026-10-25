# Instagram data sources

_Last mapped: 2026-10-23_

**Planned, partly built.** How Brain2 gets Instagram data that the export file does not have, without breaking what reads the export today. Built so far: Settings → Imports → **Instagram accounts** (log into more than one account, sessions sealed with the OS keychain). Everything else here is a plan.

Related: `components/Settings/README.md` (the two Instagram bays), `electron/README.md` (`instagram-accounts.js`), `~/instagram-analysis/PROFILES.md` (the `profiles.py` fetcher), `docs/KNOWLEDGE_GRAPH_PLAN.md` (where a follower graph would live).

## What stays exactly as it is

The export file is the ground truth and keeps working with no login.

- Settings → **Import from Instagram data** (`InstagramImportPanel.tsx`, `lib/instagram-lists.ts`) reads `following.json` and `followers_N.json`. It does not change.
- `~/instagram-analysis/analyze.py` and `build_report.py` read the unzipped export. They do not change.
- `profiles.py` only adds columns to the report when `profiles.json` exists. Without it the report is the same as before.

Every new source writes to its own file or store. None of them overwrites a value that came from the export.

## The layers

Each layer answers what the one above it cannot. A run tries them in order and records which one answered (`src` in `profiles.json`).

| Layer | What it gives | Who it covers | Exact? | Instagram's terms | Risk to the account | State |
|---|---|---|---|---|---|---|
| 0. Data export ("Download your information") | Your own followers, following, DMs, likes, comments, posts, stories | You only | Yes, as of the export date | Allowed | None | Built (import + report) |
| 1. Official Graph API, Business Discovery | Followers, following and post counts, bio, recent media | Professional (Creator/Business) accounts only | Yes | Allowed | None | Built in `profiles.py` (`graph`), needs a token |
| 2. Logged-in session (web endpoints, Instaloader, instagrapi) | Profile counts for any account you can see; other accounts' follower lists | Anyone your account can see | Yes | Not allowed (automated collection) | Rate limits, checkpoints, possible ban | Profile counts built in `profiles.py` (`session`). Logins built in Brain2. Lists planned. |
| 3. Logged-out public page | Rounded counts | Public accounts, when there is no login wall | Rounded above 10K | Not allowed | Low for the account | Built in `profiles.py` (`page`) |

The recommendation: layers 0 and 1 for everything they cover, then layer 2 with one of your own logins at a slow pace for the rest, and layer 3 as a last try. Each layer stops itself the moment Instagram refuses (401, 403, 429, checkpoint).

## Instaloader with switching IPs

Brain2 does not build this. Reasons:

- **It does not help a logged-in session.** Instagram limits and checkpoints the account, not just the address. One account showing up from many addresses looks more like a stolen login, so it raises the checkpoint risk instead of lowering it.
- **Logged out, most profile data is behind a login wall now.** Changing address does not remove the wall.
- **It is evading Instagram's blocks.** That is a step past "automated collection" in the terms, and a ban for it can reach every account tied to you.

What works instead: one stable address (your Mac), your own login, a slow pace (`profiles.py` defaults to one request every ~20 seconds, at most 120 an hour), stalest and closest people first, and stopping on the first refusal. Spread over days, that covers a few thousand accounts. If you still want to go further, that is your call to make, and this doc should be updated with the decision.

## Instagram accounts (built)

_Last mapped: 2026-10-23_

Settings → Imports → **Instagram accounts** (`components/Settings/InstagramAccountsPanel.tsx`, `lib/instagram-accounts.ts`, `electron/instagram-accounts.js`).

- **Log into Instagram** opens Instagram's own login page in a desktop window. Two-factor and "confirm it's you" work there as in a browser. Brain2 never sees the password at login.
- The window uses an in-memory partition. When `sessionid` and `ds_user_id` appear, main copies the session cookies out, seals them with `safeStorage` (macOS Keychain), writes `userData/instagram-accounts.json` (mode 600), clears the partition, and closes the window.
- More than one account is supported. The same Instagram user id logging in again replaces its old session instead of adding a row.
- Each account has a label, **Check session** (one `web_profile_info` request for its own username: works / expired / checkpoint / refused / different account), **Log in again**, an opt-in **Remember password** (sealed the same way, kept for planned export requests, unused today), and **Remove** with a confirm.
- Without OS encryption (no keychain, or Linux `basic_text`), Brain2 refuses to store a login. It never falls back to plain text.
- The renderer only gets the public view: username, user id, label, dates, check result, and whether a session or password exists. No IPC channel returns a cookie or password. `sessionCookies(id)` and `password(id)` exist in main for later runners.
- The web and iOS builds show "Logging in works in the desktop app only."
- Nothing uses these logins on its own yet.

## Planned

### Run `profiles.py` from Brain2

Main spawns `profiles.py` with the chosen account's cookie in the `IG_COOKIE` environment variable, so the cookie never lands in `profiles_config.json`. `profiles.py` already reads `IG_COOKIE`. One account per run. A refusal stops that run and is shown in the panel. Per-account pacing is kept in main so two runs never share an account.

### Automatic exports

_Checked: 2026-10-25_

**Scheduled export (lands in Drive; one copy failed, now read file by file).** Meta's developer docs say Accounts Center can send an export to Google Drive or Dropbox again and again, from daily to yearly, for one to three years (for example `ONCE_A_MONTH_FOR_ONE_YEAR`). Athena's account sends a JSON, all-information export to Google Drive once a day. It arrives as one `meta-…` folder in My Drive with each day's `instagram-…` folder inside it (`docs/INSTAGRAM_AUTO_UPDATE.md`). On 2026-10-23 a copy of that folder failed because Google Drive canceled `copyfile` on one online-only DM photo (`ECANCELED`). The folder stays in Drive, streamed. It is not in iCloud, and it does not need to be available offline. Brain2 reads each file instead, retries a cancel, and skips a photo that still will not download so the day still imports. The monthly reminder stays until a full run has finished after that change.

**Fallback: automated requests (planned, only if the scheduled export fails).**

1. **Request.** On a schedule, main opens Accounts Center in a window with that account's session and asks for JSON, all time, all information. Instagram may ask for the password, and that is what **Remember password** is for. This is UI automation and will break when Meta changes the page. It stops and asks you whenever a screen is not the one expected.
2. **Wait for the email.** Watch for Meta's "your information is ready" email. Options, most private first: a mail rule that saves the email to a folder Brain2 watches, IMAP with an app password kept in the keychain, or a Gmail connector. Only the link is read.
3. **Download.** Open the link in a window with the same session. The download needs the login, and the link expires after 4 days. Save the zip into a folder Brain2 manages.
4. **Process.** The Instagram view's watcher unzips the export, runs `analyze.py` and `build_report.py`, and keeps the last good report if a run fails.

### Continuous monitoring

Each export, and each layer-2 list fetch, becomes a dated **snapshot** of followers and following. Diffs between snapshots give new followers, unfollows and follow-backs with dates. Exports give your own lists exactly; layer 2 can fill the gaps between exports at a slow pace. Snapshots are kept, never overwritten.

### Follower graph and search

- **Store.** Nodes are accounts (`id`, username, and counts with the date and source of each). Edges are `follows` with `first_seen`, `last_seen` and source. This fits the knowledge graph plan (`docs/KNOWLEDGE_GRAPH_PLAN.md`): a missing edge means "not loaded", not "does not follow".
- **What it costs.** Your own lists come from the export. Another person's follower list is layer 2 only: about one request per 50 accounts, plus one request per account for its counts. A 2,000-follower account is about 40 list requests and 2,000 count lookups, which is roughly 17 hours at 120 an hour. Counts already in `profiles.json` and fresh enough are reused.
- **Views.** A web of who follows whom around a chosen person; their followers sorted and filtered by follower count; overlap between two people's followers.

### Mobile

The iOS build cannot run Python or hold an Instagram login. The phone gets results through the phone hub: snapshots, diffs and the last report, read only. Alerts (a new follower, a finished export) come from the desktop over BIM.

## Open questions for Athena

- Which `profiles.py` sources to run (asked in the follower-counts thread).
- Which accounts are yours to log in with, and whether any of them should be used for lookups at all.
- Whether to set up the scheduled export to Drive or Dropbox and try one run. Automated requests only matter if that fails.
