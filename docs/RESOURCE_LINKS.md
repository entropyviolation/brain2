# Linked resources — plan

_Last mapped: 2026-10-16_

Item Detail → **Resources** copies every file into the attachments IndexedDB
(`lib/attachments.ts`). That doubles disk use for a 2 GB Photoshop file and
puts every byte into the full backup as base64. It also cannot hold a folder.

A **linked** resource stores where the file lives instead of its bytes. It is
desktop only: a browser never learns a file's real path, and the phone cannot
reach the computer's disk.

## What ships

1. **Data.** `ItemResource.link` (`ResourceLink` in `lib/types.ts`): `path`,
   `isDir`, `fileId` (`dev:ino`), `mtimeMs`, optional macOS `bookmark`, and for
   folders `fileCount` / `truncated`. `uri` is `link:<id>`, so nothing that
   reads `idb:` URIs touches it. Linked bytes are not in backups.
2. **Bridge.** `window.desktop.fileLinks` (`electron/preload.js` →
   `electron/file-links.js`): `pathForFile`, `pick`, `stat`, `resolve`, `open`,
   `reveal`, `extractText`, `previewUrl`. Renderer helpers live in
   `lib/resource-links.ts`.
3. **Panel.** On desktop the tray has **Auto / Copy / Link**. Auto links
   folders and files of 50 MB or more and copies the rest. **Link file** and
   **Link folder** open the system picker. Cards and the viewer show
   **Linked** or **Missing**. The viewer has Open, Show in folder, and
   **Locate…** when the file is missing.
4. **Preview.** Images, PDFs, audio, video, and text stream from disk through
   the `brain2-link://` scheme. Main hands out one token per path; the scheme
   serves only tokens it issued.
5. **Search.** Text is pulled out of the original once and kept in
   `extractedText`: PDF text, the head of a text file, or a folder's file
   list.
6. **Following a move.** `resolve` runs when the Resources tab opens:
   1. The stored path still exists → keep it.
   2. macOS: resolve the bookmark (Finder alias data, through `osascript`
      JXA). It follows moves and renames on the same disk.
   3. Look for the same file ID (`dev:ino`): Spotlight (`mdfind -name`) on
      macOS, then a shallow walk of the old folder's parent and grandparent.
      With no ID match, one candidate with the same name and size is taken.
   4. Otherwise the card says **Missing** and offers **Locate…**.
   A repaired path goes through the item draft, so Save keeps it. Missing is
   shown only and not saved.

## Not in this pass (Planned)

- A check of every link at app start. Today a link is checked when its
  item's Resources tab opens.
- Live `fs.watch` of linked folders.
- "Copy into Brain2" for a linked file, and "Link instead" for a stored one.
- Showing a linked file's preview on the phone.

## Trust boundary

`open`, `previewUrl`, and `extractText` act on a path the renderer sends. The
renderer is our own code, but these channels widen what a script injected
into it could read. `open` refuses executables and app bundles, and every
channel wants an absolute path. The bookmark JXA is best-effort and has not
been run on macOS from CI; if it fails, resolve falls through to the ID
search.
