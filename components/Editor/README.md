# Editor

A small, **dependency-light** rich-text/markdown editor for document-type items
(Brain2 Feature 4 — document items / rich notes; #184/#84). It stores plain
**markdown** in `Item.body` so the content is portable and diffable, and renders
a live HTML preview through an in-house safe renderer — no third-party markdown
or editor libraries. Honors the global Windows 95 skin (`app/win95.css`) via
scoped `.rte` styles in `editor.css`.

Optional **`docsMode`** extends the toolbar with Google Fonts, image, and embed
helpers (markdown markers) for hosts that still want the markdown split/preview
surface. The top-level **Docs** tab uses the HTML WYSIWYG
`components/Docs/DocumentEditor` instead — see `components/Docs/README.md`.

## Files

| File | Purpose |
|------|---------|
| `markdown.ts` | Pure, tested helpers. `renderMarkdown(src)` — minimal **safe** markdown → HTML (escapes all input first via `escapeHtml`, re-introduces only known-good tags: headings, emphasis, strikethrough, inline + fenced code, ordered/unordered lists, blockquotes, links with scheme allow-listing, images/embeds, `{font:…}` spans, horizontal rules). Selection-aware transforms `applyInlineWrap` / `applyLinePrefix` / `applyInsert` (returning an `EditResult`) back the toolbar. No React/DOM/store imports. |
| `markdown.test.ts` | Vitest coverage for the renderer (blocks, inline, XSS/scheme safety, font/image/embed markers) and the edit transforms. |
| `RichTextEditor.tsx` | Controlled editor. Win95 toolbar (bold/italic/code/heading/list/ordered list/quote/link), Edit / Split / Preview switch, markdown textarea + live preview, word/char status bar, `Ctrl/Cmd+B`/`I` shortcuts. With `docsMode`: document font picker, span font, image, embed. Props: `value`, `onChange`, `placeholder?`, `readOnly?`, `onBlur?`, `defaultView?`, `documentFont?`, `onDocumentFontChange?`, `docsMode?`, `className?`. |
| `editor.css` | Win95-scoped styles (reuses `--w95-raised/-sunken/-field` tokens with fallbacks). All rules under the `.rte` root so nothing leaks; Docs-mode font/embed card styles live here too. |

## Storage format

The editor's value is **markdown text** (the same string stored in `Item.body` for
ItemDetail). The host owns persistence; `RichTextEditor` keeps no persisted state.
The "Body" detail panel that wires this to the store is
`components/ItemDetail/BodyPanel.tsx` (writes via `useTaskStore.updateTask`,
debounced).

The Docs tab stores **sanitized HTML** via `DocumentEditor` + `lib/doc-html.ts`
(older markdown notes convert once on load).

## Safety

`renderMarkdown` escapes the five HTML-significant characters before any
transformation and only emits a fixed tag set; link `href`s are limited to
`http(s):` / `mailto:` / relative URLs (so `javascript:`/`data:` render inert).
This makes the preview safe to inject as HTML.
