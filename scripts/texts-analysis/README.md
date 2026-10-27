# `scripts/texts-analysis/` — Texts pipeline

_Last mapped: 2026-10-22_

Python pipeline behind Analytics → Texts. Plan: [`docs/TEXTS_ANALYTICS_PLAN.md`](../../docs/TEXTS_ANALYTICS_PLAN.md).

Code only. Data, output and the venv live in the home folder, `~/texts-analysis` by default (`BRAIN2_TEXTS_HOME`). The `.gitignore` refuses `data/`, `out/`, `.venv/`, `.env` and database files here too.

## Files

- `texts_home.py` reads `--home` (or `$TEXTS_HOME`, default `~/texts-analysis`). Every script imports it.
- `analyze.py` copies `chat.db` and Contacts into `data/` (always with `--fresh`), then writes the aggregates to `out/summary.json`.
- `analyze2.py` builds per-person detail and `out/threads/`.
- `calls.py` copies the Mac's call history (`CallHistory.storedata`, the iPhone's calls synced through Continuity) into `data/calls/` and writes `out/calls.json`. No recordings exist. If the Mac has no call history, the report says so and texts still update.
- `detector_eval.py` scores conflict candidates and learns from your labels.
- `build_report.py` writes `out/report.html`, inlining `report_extra.js` and `report_app.js`.
- `llm_pass.py` and `llm_jobs.py` talk to local Ollama only.
- `serve.py` serves the report and the API on 127.0.0.1. Notes, labels and jobs live in `out/annotations.sqlite`. Logs go to `out/serve.log`. It opens a browser only with `--open`.

## First run on a Mac

1. Give Full Disk Access to Terminal (or to Brain2).
2. `python3 -m venv ~/texts-analysis/.venv && ~/texts-analysis/.venv/bin/pip install -r scripts/texts-analysis/requirements.txt`
3. `~/texts-analysis/.venv/bin/python scripts/texts-analysis/serve.py --home ~/texts-analysis --open` to open `http://127.0.0.1:8765`.

## Server contract

See the plan doc. `electron/texts-report.js` relies on `GET /api/status` and `POST /api/refresh`.

## Linking to Brain2 people

_Last mapped: 2026-10-23_

`analyze2.py` keeps each person entity's numbers and emails as `handles` (in `out/`, local only). Inside Brain2, a relationship page shows **Person in Brain2**: search People I Know and link. Brain2 sends People I Know into the frame by `postMessage`, and the page asks Brain2 to save the chat's numbers on that Person (`components/Analytics/TextsReportView.tsx`). `serve.py` is not involved. A report built before this change asks for Update now first.

## Merges, names and Brain2 people

_Last mapped: 2026-10-23_

Three keys in the `settings` table of `out/annotations.sqlite`, written by the report through `POST /api/settings`. `analyze.py` reads them in `load_contacts` / `resolve_handle` / `label_people`, so `analyze2.py` and `calls.py` follow, and they hold through every refresh.

- `people_links` `[{id, name, handles}]`: People I Know from Brain2. Every number on one Person resolves to one card, key `b2:<id>`, named after the Person. The frame posts it whenever Brain2 sends people.
- `merges` `{from_key: {to, name}}`: Name and merge → fold another chat into this card. Undo removes the row.
- `names` `{key: name}`: Name and merge → Rename.

Each of these re-runs the pipeline (`POST /api/refresh`); Brain2 reloads the frame when it ends. Person cards carry `key` and `handles`, and `detail.json` carries the current `overrides`. Card ids (`p01`…) are ranks, so a merge can shift which id a card has; saved rows follow the card by its numbers instead (see "Topic review" below).

In Brain2, the frame also sends its person cards (`index`), which Person → View text analytics uses. Brain2 can ask the frame to `open` the card for some numbers.

## Topic review

_Last mapped: 2026-10-23_

Topic chips on a relationship page open the conversations behind them. Confirm, reject, change, add or comment on a tag. Corrections are append-only rows in `topic_feedback` (`out/annotations.sqlite`), for later training on your own texts. Saved rows follow a person by their numbers, not by card rank. See [`docs/TEXTS_ANALYTICS_PLAN.md`](../../docs/TEXTS_ANALYTICS_PLAN.md) → "Topic review and your corrections". A report built before this asks for Update now first.

## Sections and folding

_Last mapped: 2026-10-23_

`report_app.js` reads the section list from the header nav. Each section folds from the arrow by its heading, remembered in `localStorage`. A section taller than about 3.5 screens is cut with **Show all**. Inside Brain2's main window the nav moves to the Analytics sidebar (`nav`, `sections`, `section`, `goto` messages).

## Trends, drifting, timeline, search, mood

_Last mapped: 2026-10-23_

See [`docs/TEXTS_ANALYTICS_PLAN.md`](../../docs/TEXTS_ANALYTICS_PLAN.md) → "Reply trends, drifting, calls + texts, search, mood". New data: `reply_weekly` (overall in `comparisons`, and per person), `drifting` in `detail.json`, and `log` in `calls.json`. New routes: `GET /api/search`, job kind `mood`. Thread rows are `[ts, me, who, text, mid, topic bits]`; Python readers take the first five (`llm_pass.fmt_line`).

