# `scripts/texts-analysis/` — Texts pipeline

_Last mapped: 2026-10-22_

Python pipeline behind Analytics → Texts. Plan: [`docs/TEXTS_ANALYTICS_PLAN.md`](../../docs/TEXTS_ANALYTICS_PLAN.md).

Code only. Data, output and the venv live in the home folder, `~/texts-analysis` by default (`COGS_TEXTS_HOME`). The `.gitignore` refuses `data/`, `out/`, `.venv/`, `.env` and database files here too.

**Planned:** the scripts (`analyze.py`, `analyze2.py`, `build_report.py`, `llm_pass.py`, `serve.py`) move here from `~/texts-analysis`. Until then this folder holds only this README, and the desktop view reports `serve.py is missing`.

## First run on a Mac

1. Give Full Disk Access to Terminal (or to Brain2).
2. `python3 -m venv ~/texts-analysis/.venv && ~/texts-analysis/.venv/bin/pip install pandas vaderSentiment scikit-learn emoji`
3. `~/texts-analysis/.venv/bin/python scripts/texts-analysis/serve.py --home ~/texts-analysis` then open `http://127.0.0.1:8765`.

## Server contract

See the plan doc. `electron/texts-report.js` relies on `GET /api/status` and `POST /api/refresh`.
