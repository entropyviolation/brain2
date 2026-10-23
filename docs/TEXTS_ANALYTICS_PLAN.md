# Texts in Analytics

_Last mapped: 2026-10-22_

Analytics gains a **Texts** group. Its one view, **Report**, shows the texts analysis that was built as a side project in `~/texts-analysis`. It covers every iMessage and SMS on the Mac since July 2018 (about 305,000 messages).

## Rules from allie (2026-10-22)

- The report keeps the look it has now. No studio skin, no restyle to match the rest of Brain2 yet.
- It updates at the end of every week, adding the new texts.
- New sections compare stats week by week and month by month.
- Conflicts and relationships are analyzed on demand, from notes allie takes in the message browser. There is no batch run over every candidate.
- Message text stays on the Mac. AI reads use a local model (Ollama). No outside API.

## Shape

| Part | Where | What it does |
|------|-------|--------------|
| Pipeline | `scripts/texts-analysis/` (Python) | Copies `chat.db` and Contacts into the home folder, computes aggregates, writes the report. |
| Home | `~/texts-analysis` (`COGS_TEXTS_HOME`) | `data/` (database copies), `out/` (summary, report, per-chat message files, notes database), `.venv`. Never in the repo. |
| Server | `scripts/texts-analysis/serve.py` | Serves the report on `127.0.0.1:8765` (`COGS_TEXTS_PORT`). Holds notes and labels. Runs AI jobs and refreshes. |
| Desktop bridge | `electron/texts-report.js` | Starts the server when the view opens. Checks hourly and runs the weekly refresh once per week after Sunday 21:00 local. |
| View | `components/Analytics/TextsReportView.tsx` | Frames the report unchanged. Shows the last update and **Update now**. |

The web build has no bridge. The view says the report only opens in the desktop app.

## Server contract

`serve.py --home <home> --port <port>` binds 127.0.0.1 only.

- `GET /` serves `out/report.html` and its files.
- `GET /api/status` returns `{ lastRun, running, messages, range: { from, to }, error }`. `lastRun` is the ISO time the last refresh finished.
- `POST /api/refresh` starts the pipeline in the background and returns the status. A second call while one runs does nothing.
- Notes, labels and AI jobs use their own `/api/*` routes inside the report.

The refresh copies a fresh `chat.db`, reruns the analysis, adds the week and month comparisons, and rebuilds the report. It needs Full Disk Access for the process that runs it. When Brain2 starts the server, that is Brain2.

## Weekly and monthly comparisons (Planned)

New sections inside the report, in its existing style:

- This week against last week and against the average week: texts, sent and received, people, reply times, sentiment, top words.
- This month against last month and the same month last year.
- Week-by-week and month-by-month series for those stats, with the newest period marked.

## Notes and on-demand analysis (Planned)

- Notes, tags, sentiment overrides and conflict marks on any message or range in the message browser.
- Detected conflicts can be confirmed or rejected. **Analyze conflict** runs the local model on that window plus allie's notes.
- Each person has a **Relationship** page with notes and **Analyze relationship**.
- Confirm and reject labels train the conflict detector over time.

## Order

1. Brain2 side: Texts group, view, bridge, weekly schedule. Done on this branch.
2. Move the pipeline scripts from `~/texts-analysis` into `scripts/texts-analysis/` and add `serve.py` status and refresh routes.
3. Week and month comparison sections.
4. Notes layer and on-demand analysis.
