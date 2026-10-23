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
| Desktop bridge | `electron/texts-report.js` | Starts the server when the view opens. Checks hourly and runs the refresh once a day, the first check after 04:00 local. |
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

## Topic review and your corrections

_Last mapped: 2026-10-23_

Topics are keyword lists (`THEMES` in `scripts/texts-analysis/analyze2.py`). Each thread row in `out/threads/` carries a bitmask of the topics that message hit, in `DET.theme_lexicon` order. `DET.theme_version` hashes the lists, so a correction records which lists it judged.

On a relationship page, every chip under **Topics vs your normal** opens that topic (`openTopic` in `report_app.js`). It lists the conversations (6-hour gaps, same rule as the analyzer) with matching messages and the words highlighted. You can **Confirm**, mark **Not this topic**, **Change to…** another topic, **Also tag as…** another one, or add a new topic, and comment on any of them.

Corrections go to the `topic_feedback` table in `out/annotations.sqlite` through `POST /api/topics`. The table is append-only: every confirm, reject, change, clear and comment is a new row, so changes of mind survive. The latest row per conversation and topic wins on screen. Each row keeps the conversation's message ids and times, whether the keywords tagged it, how many messages hit, which words matched, and the lexicon version. It holds no message text.

### Stable keys

Card ids (`p01`, `g03`) follow rank. They move when Brain2 links a number, a merge happens, or new texts reorder people. Every saved row (annotations, labels, notes, jobs, topic feedback) now also keeps `ent_ids`: the person's numbers and emails, or a group's chat ids. `serve.py` `rehome()` points each row at the card that holds those ids, at start, after a refresh, and whenever `detail.json` changes. Rows saved before this were keyed to the card they were on at the time.

### Training on your own life (Planned)

Not built yet. The idea:

1. Export `topic_feedback` with the messages it points to, read locally from the thread files. Message text never leaves the Mac.
2. Use confirmed and added rows as positives, and rejected and changed-away rows as negatives, per topic. Keep custom topics you added.
3. Start simple: grow or prune each keyword list from the words that separate your positives from your negatives. Later, train a small local classifier (or few-shot prompts to local Ollama) on the same rows.
4. Score it against your held-out corrections before it replaces the keyword lists, the same way `detector_eval.py` does for conflicts.
5. Show the learned topics next to the keyword ones until you trust them.

## Reply trends, drifting, calls + texts, search, mood

_Last mapped: 2026-10-23_

- **Reply time by week** (Response times, and each relationship page). `analyze2.py` `reply_weekly()`: median minutes to answer per week for you and for them, last 52 weeks, blank under 3 replies. A table compares this week, last week and 8 weeks per person, with a trend (last 4 weeks against the 8 before).
- **Who's drifting** (its own section). `drifting()`: people you texted at least 5 a week in the 180 days before the last 60, now under a third of that. "Changed around" is the day that best splits a busy 90 days from a quiet stretch after it.
- **Texts and calls by day** (relationship page). Texts come from the thread file. Calls come from `calls.json` `log` (`[epoch, person key, outgoing, missed, minutes]`), matched on the card's `key`. Click a day to open its messages.
- **Search** (its own section). `GET /api/search?q=&ent=&side=` in `serve.py` reads every thread file into memory once, on 127.0.0.1 only. It returns the newest 300 hits and a count per chat. Needs the local app.
- **Mood by month** (relationship page, on demand). Job kind `mood` → `llm_jobs.analyze_mood`: a sample of each month (last 24 with 20+ messages) goes to local Ollama, which returns a tone, a −2 to +2 score and one paraphrased sentence. It is drawn next to the keyword sentiment line.

## Order

1. Brain2 side: Texts group, view, bridge, weekly schedule. Done on this branch.
2. Move the pipeline scripts from `~/texts-analysis` into `scripts/texts-analysis/` and add `serve.py` status and refresh routes.
3. Week and month comparison sections.
4. Notes layer and on-demand analysis.
