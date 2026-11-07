# `components/Docs/` — Docs tab

_Last mapped: 2026-10-28._

On a phone (`max-width: 767px`) the window fits the width, fields are 16px, and the link sheet scrolls inside the screen. Desktop chrome is unchanged.

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

## Public door

`app/page.tsx` mounts `DocsPanel`. Trip Itinerary Plan
(`components/Modules/workspace/itinerary/DocPlanView.tsx`) mounts `DocumentEditor`
and calls `documentFont`, `loadDocumentBody`, `setDocumentBody`, and `setDocumentFont`
from `doc-actions.ts`.

Those helpers write `note` items through `useTaskStore` (`addTask`, `updateTask`,
`deleteTask`; type `NOTE_TYPE_ID`) and the HTML body through `lib/doc-persist.ts`
(`putPersistedDoc`, `deletePersistedDoc`).

Interiors: `DocumentEditor` and `LinkDialog`.

## Files

| File | Purpose |
|------|---------|
| `DocsPanel.tsx` | Tab orchestrator: folder sidebar, document list, title/folder fields, auto-save, archive/delete. Caption **Brain2 Docs**. Recent rows show orb/thumbnail identity (`orbFor` / `.docs-doc-orb`). `data-ui-name="Docs"` — this tab is **user notes**, not the repo manual Help/Inspect would load. |
| `DocsHome.tsx` | Empty / home face: **Blank** and **Upload** as milled keys (`.docs-milled-key`). |
| `text-mirror-host.tsx` | _Last mapped: 2026-11-07._ Mounted in `app/layout.tsx`. While a `typed-text` rule is on (BIM Chat adds it, `lib/rules/`), watches real keystrokes in every input, textarea, and contenteditable. On blur, Enter/submit that clears the field, removal, or page hide, it raises one `typed-text` event (`fireRuleEvent`); the rules engine adds text over each rule's threshold to that rule's Docs note under a bold "source › field · time" header and a blank line. Skipped: pastes and drops, password fields, `.docs-editor` (a Docs page would re-add itself whole), `data-text-mirror="off"`. A field is added once per identical text. Source comes from the open dialog and the field's aria-label, label, placeholder, or `data-mirror-source`. If the target note is open in the editor it will not show new entries until reopened. |
| `selection-menu.tsx` | _Last mapped: 2026-11-07._ Right-click menu for highlighted text in a document: Add to Quick Add, Add to BIM chat, Add to list, Attach to item as note, Turn into log. Each send is recorded per document. |
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

_Last mapped: 2026-11-02_ The toolbar has a **Secret** checkbox. A secret document is left out of search and BIM answers unless secrets are unlocked (`lib/secrets-store.ts`). It still shows in the Docs list.

_Last mapped: 2026-11-07_ **Selection doors.** Highlight text and right-click (a link still opens the link dialog). `components/Docs/selection-menu.tsx` offers five doors:

- **Quick Add** and **BIM chat** go over window events (`lib/doc-selection/doc-selection-bus.ts`). `hooks/useQuickCaptureHotkey.ts` opens Quick Add seeded with the exact text. `components/Bim/bim-key.tsx` opens the console and `use-bim-chat.ts` shows the text in the compose well. It is not sent; the person sends it.
- **Add to list** makes an item (`createListItem`) in a list picked with `ListPicker`.
- **Attach to item as note** appends a dated `noteLog` entry to an item picked with `ItemPicker`.
- **Turn into log** reads a clock out of the text (`lib/doc-selection/detect-clock.ts`, "10:30 walked outside"), prefills time, day and text, and writes through `applyDiscreteLog` at that minute.

Every send adds a record to `useDocOutLinks` (`lib/doc-selection/doc-out-links.ts`): doc id, kind, text, target id and label. The target keeps its own copy, so the record is only a map of where a doc's text went. **Planned:** an editor sidebar that lists those records and jumps to the target, and removal of a doc's records when it is deleted.
