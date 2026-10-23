# `scripts/texts-analysis/` — Texts pipeline

_Last mapped: 2026-10-22_

Python pipeline behind Analytics → Texts. Plan: [`docs/TEXTS_ANALYTICS_PLAN.md`](../../docs/TEXTS_ANALYTICS_PLAN.md).

Code only. Data, output and the venv live in the home folder, `~/texts-analysis` by default (`COGS_TEXTS_HOME`). The `.gitignore` refuses `data/`, `out/`, `.venv/`, `.env` and database files here too.

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
