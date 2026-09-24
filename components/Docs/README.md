# `components/Docs/` — Docs tab

Top-level **Docs** workspace in **Brain2**: Windows 95 chrome around a single-pane WYSIWYG
editor (Notion / Google Docs style). Outer window caption, menubar keys, and status
counts are a whisper of the house [milled fascia](../../docs/DESIGN_STYLE.md#milled-fascia);
the white document surface and editor paper stay as they are. Documents are ordinary `note` items in
`task-store` (`lib/note-types.ts`) with rich **HTML** in `Item.body`, optional
folder / font / status attributes, and auto-save.

Mounted from `app/page.tsx`. Last selected doc + folder filter persist via
`lib/app-navigation.ts` (`docsDocId`, `docsFolder`). In-document scroll, folder
homepage scroll, and the recent-docs sidebar restore after refresh or leaving
the Docs tab (`ui-scroll` slots `docs:<id>` / `docs-home:<folder>` / `docs-sidebar`).

Copy in a document stays the person's words. A later gutter (Wave 13, GS-4) may
mark an is-of-identity or an allness word and offer a dated rewrite; it will
not block save or replace the sentence on its own.
[`docs/ScienceandSanityBrain2.md`](../../docs/ScienceandSanityBrain2.md).

## Files

| File | Purpose |
|------|---------|
| `DocsPanel.tsx` | Tab orchestrator: folder sidebar, document list, title/folder fields, auto-save, archive/delete. `data-ui-name="Docs"` — this tab is **user notes**, not the repo manual Help/Inspect would load. |
| `DocumentEditor.tsx` | contenteditable surface + formatting toolbar (fonts, sizes, lists, images, PDF ingest, links) |
| `LinkDialog.tsx` | Ctrl/Cmd+K hyperlink dialog (optional display text + URL) |
| `doc-actions.ts` | Create / rename / folder / font / body / status / delete helpers over `note` tasks |
| `doc-actions.test.ts` | Unit tests for doc-actions |
| `docs.css` | Outer window chrome: milled caption bay, metal menubar keys, CRT status counts (paper untouched) |
| `document-editor.css` | Page surface, list markers, toolbar, embedded link/video cards |

## Related helpers (`lib/`)

| File | Purpose |
|------|---------|
| `doc-html.ts` | Sanitize HTML, selection styles, markdown→HTML one-shot migration, word count |
| `doc-links.ts` | URL detect / normalize / auto-linkify for typed and pasted links |
| `google-fonts.ts` | Allow-listed Google Fonts catalog + stylesheet loader |
| `image-resize.ts` | Client-side downscale/compress for image uploads |
| `pdf-to-html.ts` | pdfjs ingest → editable HTML paragraphs/headings/lists |

## Behavior

- **Folders** are free-form labels on `NOTE_ATTR.folder` (`docsFolder`); sidebar shows All / Unfiled / named folders.
- **Status** (`draft` / `evergreen` / `archived`); archived docs are hidden from the default list.
- **Font** defaults per document via `NOTE_ATTR.fontFamily`; highlight text to change family or size.
- **Images** are resized before insert; **PDFs** are ingested as editable HTML (best-effort for text PDFs). Telegram journal photos and forwarded PDFs also land here as notes in folder **From phone** (`lib/ingest/apply-scan-doc.ts`).
- **Links**: click to open, right-click to edit, Ctrl/Cmd+K, paste URL onto selection, type URL + space to auto-link.
- **Paste**: Cmd/Ctrl+V pastes plain text (no rich formatting), like Google Sheets.
- **Place**: refresh or switching tabs restores the open document (or folder homepage) and scrolls back to the last reading position. Hiding the Docs tab does not store a zeroed `scrollTop`.

Trip Itinerary module **Plan** views reuse `DocumentEditor` via the module `doc` view kind (`workspace/itinerary/DocPlanView.tsx`).
