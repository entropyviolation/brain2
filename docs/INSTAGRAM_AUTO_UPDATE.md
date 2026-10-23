# Instagram: keeping the data up to date

_Last mapped: 2026-10-23_

Brain2 shows the Instagram report in Analytics → Sources → **Instagram**
(`components/Analytics/README.md` → Instagram (Sources)). This doc covers how
new data gets in today, and the routes we hope to add later.

## Today

Everything after the export request is automatic.

1. **Remind.** A monthly row, **Request a new Instagram export**, sits on the
   Reminders list (`lib/instagram-export-reminder.ts`). It lands in the Inbox,
   stays in the header bell until Dismiss, and is texted with the Accounts
   Center link when Text me is on. The Instagram view shows the next reminder
   and a switch.
2. **Request.** In Accounts Center: Create export → Export to device → All
   time, JSON, all information (`lib/instagram-export-steps.ts`). A date-range
   export leaves whole sections empty. Meta emails when it is ready. The link
   works for 4 days.
3. **Ingest.** The Electron main process sees the zip in `~/Downloads` (or a
   watched folder), copies it into `<userData>/instagram/exports/`, runs
   `analyze.py` then `build_report.py`, and swaps in the new report. A failed
   run keeps the previous report and shows the error
   (`electron/instagram-report.js`).

## Every export is kept

Brain2 keeps every export in its own archive and merges them
(`electron/instagram-archive.js`). Each file is stored once by content, so
daily exports cost little extra space. A DM that an earlier export had and a
later one does not shows as unsent, deleted or edited, with its text. A
message sent and removed between two exports was never captured.

## Scheduled export to Google Drive or Dropbox (found, not tested)

_Checked: 2026-10-23_

Accounts Center can send an export to Google Drive or Dropbox and repeat it.
Meta's own developer page lists the options: Instagram (`account_type=1`),
`import_service` `GoogleDrive` or `Dropbox`, `format=JSON`,
`date_range=ALL_TIME`, and `schedule_frequency` from daily to yearly, each for
one to three years (for example `ONCE_A_MONTH_FOR_ONE_YEAR`). Meta's 2025 DMA
compliance report describes the same recurring transfers.

If it works for an Instagram JSON export, the path is:

1. Set it up once: Accounts Center → Create export → Export to external
   service → Google Drive or Dropbox → JSON, All time, all information →
   monthly.
2. The Drive or Dropbox desktop app syncs each export to a local folder.
3. Brain2 watches that folder ("Watch a folder…" in the Instagram view).

This removes the request, the email, the 4-day window, and the password step.
The schedule ends after one to three years and has to be set up again.

Not confirmed until one real run:

- That a Drive or Dropbox export holds the same files as a device export,
  media included.
- The file and folder names. The watcher matches
  `instagram-<account>-<YYYY-MM-DD>-<id>`; a different name is not picked up.
- Whether the option is offered in every region and for both destinations.

Until that run, the monthly reminder stays on.

**Set up (2026-10-23):** Athena's account sends a JSON, all-information
export to Google Drive once a day for 3 years. Meta keeps every export in
Drive, so a free 15 GB Drive can fill within days. Once Brain2 has archived an
export, the copy in Drive can be deleted without losing anything.

## Google Drive export: what is wired (2026-10-23)

_Last mapped: 2026-10-23_

The first scheduled export arrived in Athena's My Drive as a folder named
`meta-2026-Oct-22-20-23-37` (Meta's name: `meta-<YYYY>-<Mon>-<DD>-<HH>-<mm>-<ss>`).
Its contents were not inspected yet (the Mac was offline), so the watcher
accepts all three likely shapes. `electron/instagram-report.js`:

- `googleDriveDirs` finds `~/Library/CloudStorage/GoogleDrive-*/My Drive`
  (Google Drive for desktop). `watchedDirs` adds them to Downloads and the
  picked folder while `watchGoogleDrive` is on (the default in `config.json`).
- `parseMetaFolderName` reads the date from the folder name. `scanMetaFolder`
  takes, inside it: an unzipped export, `instagram-…` zips or folders, or
  any zips as the parts of one export. Meta's name has no account, so these
  are not filtered by `handle`.
- The newest export builds the report as before. Every other export found,
  older or skipped while Brain2 was closed, is unzipped, archived
  (`archiveOnly`), and its copy removed. So daily exports are not lost to the
  archive.
- The view's status line says **Google Drive watched** when a Drive folder
  is found.

Steps 1, 2, 5 and 6 below are still open. Steps 3 and 4 are now checks
against the real files.

## TO DO LATER: when the first Google Drive export lands

_Written: 2026-10-23. Status: waiting on Meta. Athena scheduled a daily
JSON, all-information export of `_entropyviolation_` to Google Drive for 3
years, starting 2026-10-23. Meta gave no date for the first file._

Nothing below has been checked against a real Drive export. Do these steps in
order, and write what you find back into this doc and
`components/Analytics/README.md`.

### 1. Find the files

- Google Drive for desktop puts Drive under
  `~/Library/CloudStorage/GoogleDrive-<email>/My Drive/`. Ask Athena for
  folder access to `~/Library/CloudStorage` (the session cannot list it
  without a grant).
- Look for a new folder or zip from Meta. Write down the exact path, the
  folder names, and the file names. Note whether one export is one zip,
  several zips, or an already-unzipped folder.
- Check the Drive app's mode. In **Stream files** mode the files are
  cloud-only placeholders until read. In **Mirror files** mode they are on
  disk. Note which one is in use.

### 2. Check the contents match a device export

- Unzip one copy into a scratch folder (never inside Drive).
- Confirm it has `your_instagram_activity/` and
  `connections/followers_and_following/`, JSON (not HTML), and the media
  folders.
- Compare the top-level folders and file counts with the device export in
  `~/Downloads/instagram-_entropyviolation_-2026-10-22-vn7ORB66/`. List
  anything missing.
- Run `analyze.py` and `build_report.py` on it by hand (see
  `/Users/otherworld/instagram-analysis/README.md`). Note any errors.

### 3. Check the watcher picks it up

The watcher already handles Drive (see "what is wired" above). Check it
against the real files; change code only where they differ.

- **Shape.** Write down the real folder and file names. If they are not one of
  the shapes `scanMetaFolder` takes (`electron/instagram-report.js`), extend
  it and add a test in `electron/instagram-report.test.ts` with the real
  names.
- **Path.** Confirm `googleDriveDirs` finds the local `My Drive` path, and
  the view says **Google Drive watched**.
- **Account.** Confirm `exportAccount` reads the username from
  `personal_information/personal_information/personal_information.json`.
- **Placeholders.** If Drive is in Stream mode, check that the 10 s
  hold-still wait (`STABLE_MS`) sees the real size, and that reading the
  zip downloads it. If not, tell Athena to set the Meta folder to
  "Available offline", or switch the Drive app to Mirror mode.
- **macOS prompt.** Reading `~/Library/CloudStorage` may trigger a macOS
  files-access prompt for Brain2. If it does, say so in the view's help text.

### 4. Check no daily export is skipped

Done in code: every export not yet archived is archived, even when only the
newest builds the report. After a few days of Drive exports, open the
archive (`<userData>/instagram/archive/index.json`) and confirm each day is
listed.

### 5. Drive space

Meta keeps every export in Drive, and a free 15 GB Drive fills in days.

- After `archiveExport` succeeds for an export, show it in the view as
  "safe to delete from Drive" with its path. Do not delete it from Drive
  automatically unless Athena asks for that.

### 6. Reminder and docs

- If the Drive export works, change the monthly reminder
  (`lib/instagram-export-reminder.ts`) into one reminder before the schedule
  ends (about 2029-10-23), and update the view's export steps
  (`lib/instagram-export-steps.ts`) to describe the Drive route first.
- If it does not work, say why here, and keep the monthly reminder.
- Update "Scheduled export to Google Drive or Dropbox" above from "found,
  not tested" to what is now known. Tell the Instagram data-sources doc
  (`docs/INSTAGRAM_DATA_SOURCES.md`) the result too.

## Later: routes we hope to add

The aim is to update as much of this as possible without a manual export:
an iPhone app, official APIs, and free tools, used together. What each can
reach today:

| Route | What it can reach | Limits |
|---|---|---|
| Scheduled export (above) | Everything in the export | Untested. Fixed schedule, not live. |
| Instagram API with Instagram Login | Own posts and reels, post and account insights, follower and following counts, comments on own posts with usernames, mentions, the 20 newest messages per DM thread | Needs a Creator or Business account. No follower or following lists, likes, saved posts, story interactions or watch history. Some insights need 100+ followers. No App Review for your own account. |
| iPhone app | Receive an export zip from Files, Mail, Safari, Drive or Dropbox through the share sheet. Nudge when Meta's "ready" email arrives (Shortcuts Email automation). | iOS keeps Instagram's data and Mail out of reach. Screen Time gives time-on-app only, and only on the phone. Background tasks run when iOS chooses. The download itself needs an Instagram login. |
| Instaloader, instagrapi | Own posts, saved posts, follower and following lists; instagrapi also DMs | Against Instagram's Terms. Checkpoints, blocks, and account loss are real risks. |
| EU DMA portability | Nothing for a personal app | Destinations must be verified businesses. Meta's user-facing answer is the scheduled export. |

A likely combination later: the scheduled export for the full archive, the
Instagram API for live counts and new comments between exports, and an
iPhone app as a hand-off point and nudge. Logging into Instagram from Brain2,
multiple accounts, email-driven requests, and the follower-graph ideas are in
[`docs/INSTAGRAM_DATA_SOURCES.md`](INSTAGRAM_DATA_SOURCES.md).

## Sources

- [Meta Data Portability: Deep Linking Guide](https://developers.facebook.com/documentation/data-portability/deep-link-guide)
- [Meta DMA compliance report 2024](https://transparency.meta.com/sr/meta-compliance-report-2024)
- [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)
- [Conversations API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations-api)
- [Instagram Help: data scraping](https://help.instagram.com/740480200552298)
- Full research notes: `research/instagram-auto-update.md` and
  `research/instagram-future-sources.md` in the project files.
