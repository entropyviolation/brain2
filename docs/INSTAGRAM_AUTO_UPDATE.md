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
multiple accounts, and the follower-graph ideas are covered by the Instagram
login work in Settings and its design doc.

## Sources

- [Meta Data Portability: Deep Linking Guide](https://developers.facebook.com/documentation/data-portability/deep-link-guide)
- [Meta DMA compliance report 2024](https://transparency.meta.com/sr/meta-compliance-report-2024)
- [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)
- [Conversations API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations-api)
- [Instagram Help: data scraping](https://help.instagram.com/740480200552298)
- Full research notes: `research/instagram-auto-update.md` and
  `research/instagram-future-sources.md` in the project files.
