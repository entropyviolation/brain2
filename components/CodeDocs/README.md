# `components/CodeDocs/` — Reader for the repo `docs/` folder

_Last mapped: 2026-10-28._

On a phone (`max-width: 767px`) the reader fits the width and the find field is 16px. Desktop chrome is unchanged.

The header question mark still only toggles Names. While Names is on, a
**CODE DOCUMENTATION** key appears in the System group. Opening this reader
turns Names off, so the cursor and clicks stay ordinary and no nameplate
shows. The key hides with Names. The reader stays open until it is closed.
Pressing the question mark again while the reader is open does not turn
Names back on.

This is not the Docs tab. That tab is the person's notes (`components/Docs/`).

The reader lists every file under `docs/`. Markdown is rendered (tables,
fenced code, heading links). A relative link inside `docs/` stays in the
reader. A link that leaves the folder does not navigate the app. A picture
opens with its `.txt` sidecar when one exists. The `screenshots` folder is a
gallery of the pictures in that folder; `screenshots/history` stays a nested
folder. HTML mockups open in a frame. Other text opens as source. A binary
file can be opened from the dev server.

`GET /api/code-docs` is the list. `GET /api/code-docs/raw/…` is one file.
Both the dev server and the production window server serve them
(`scripts/code-docs-api.mjs`). Paths cannot leave `docs/`. A window on
`app://` uses `window.desktop.codeDocs` (`electron/code-docs.js`) and reads
the same folder when it sits next to the app.

## Files

| File | Purpose |
|------|---------|
| `CodeDocsViewer.tsx` | Dialog: file index, search, back stack, markdown page, image, gallery, HTML frame |
| `code-docs.css` | Navy caption, index, paper page. Prose is Karla. Imported from `app/layout.tsx` so Fast Refresh keeps it |

Helpers: `lib/code-docs-fs.mjs` (walk and read), `lib/code-docs-path.ts` (relative links), `lib/code-docs-render.ts` (markdown), `lib/code-docs-client.ts` (HTTP, then the Electron bridge).
