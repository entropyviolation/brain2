# Paper loop — printable sheets, booklets, scans, reMarkable

_Last mapped: 2026-11-02_

**Planned.** Nothing here is built. This is section 11 of [`STREAM_LOG_PLAN.md`](STREAM_LOG_PLAN.md) and part of Wave 16 in [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md).

## What you asked for

To-do lists, checklists, habit sheets, and blank three pages that you can print, carry, write on, and scan back, including small folded booklets. Tracking dots make scanning fast. Later, the same pages on a reMarkable ("common book") that sync back over Wi-Fi. It has to work before it replaces anything.

## Decisions (asked 2026-11-02)

You have, or will have, all four: a home printer (letter), a reMarkable, iPhone photo scans, and folded booklets. So the plan builds for all four, in that order.

## What already exists

| Piece | Where |
|---|---|
| Photos and PDFs sent to BIM are routed by caption: receipt, journal, outfit, log, inbox | `lib/ingest/apply-media.ts` |
| A scan parked as a real Docs note, PDF kept as an attachment | `lib/ingest/apply-scan-doc.ts` |
| Deskew and contrast on the canvas path; the Node hub reads the JPEG as-is | `lib/ingest/scan-page.ts` |
| Local Tesseract OCR, lazy-loaded | `lib/ingest/ocr.ts` (`tesseract.js`) |
| JPEG pages wrapped into a PDF with no extra library | `lib/ingest/jpeg-pdf.ts` |
| A barcode reader already in use (food scan) | `@zxing/browser`, `components/Home/Tracking/tracking-log/food/food-barcode-scan.tsx` |
| PDF rendering to images | `pdfjs-dist` |
| Printing | Only `window.print()` in Modules. No print sheets yet. |

## The one idea: a page that knows what it is

Every printed page carries:

- **Four corner marks** (solid squares), so a phone photo can be flattened to the page.
- **A QR code** in one corner holding a short page id. The page id points to a stored **sheet record**: what kind of sheet, which date or period, and the position of every box and every row.
- **Boxes in fixed places** for ticks, and ruled areas for writing.

Because the sheet record knows where each box is, a tick is found by darkness inside the box, not by OCR. OCR is only used for free writing.

## Sheets

| Sheet | Rows | Back into Brain2 as |
|---|---|---|
| Today | To-dos (assigned, required first), habits, a few blank lines | Ticks → Done, with the time unknown (same as rituals' "done, time unknown") |
| Week | Week to-dos, a habit grid (7 columns), week goals | Ticks per day cell |
| Checklist | Any list | Ticks → list items done |
| Three pages | Three ruled pages, dated | OCR text into that day's Three pages doc ([`WRITING_PLAN.md`](WRITING_PLAN.md)), marked `me` |
| Blank capture | Numbered ruled lines | Each line → Inbox |

## Booklets

A **booklet** is the same sheets laid out to fold: letter paper folded once makes half-letter pages (5.5 × 8.5 in), four pages per sheet when printed on both sides. A week booklet holds the week sheet, seven day pages, and three-pages pages. Each half-page has its own corner marks and QR, so one photo of an open spread reads both pages.

## Scanning back

1. Send the photo (or several) to BIM with no caption, or open **Scan sheet** in the app.
2. Before the receipt check in `apply-media.ts`, look for a page QR. Found → this is a sheet; skip receipt and journal routing.
3. Flatten the page with the corner marks (canvas path in `scan-page.ts`; the hub path needs the same step added, or hands the photo to the desk).
4. Read each box: ticked, empty, or unsure.
5. OCR the writing areas.
6. Show a **confirm sheet**: every change, with unsure boxes flagged. Nothing is written until you confirm. On the phone it answers in BIM with numbered changes (`ok`, or `ok but 3`).

## reMarkable

Same PDF out, annotated PDF back, same reader.

1. **By hand first.** Plug in by USB and use the tablet's USB web interface to upload the week booklet and download it after writing. Render the annotated pages with `pdfjs-dist` and run them through the reader. Do this for a week.
2. **Automate only if the week works.** Push and pull through reMarkable's cloud, with an unofficial client such as `rmapi`, run by the hub on a schedule. This depends on an unofficial API and can break; the by-hand path stays.
3. **No jailbreak** in this plan. Developer mode can come later if the cloud route is not enough.

## Steps

1. Sheet record and page id; the Today sheet as HTML with a print stylesheet; Print from To do.
2. The reader: QR, corner marks, box darkness; the confirm sheet in the app.
3. BIM path: QR check before receipt routing, the numbered confirm in chat.
4. Week, Checklist, and Blank capture sheets.
5. Three pages sheet and OCR into the day's doc.
6. Booklet layout, two-sided.
7. reMarkable by hand, for a week.
8. reMarkable automated, if step 7 held up.

## Done when

- A printed Today sheet, ticked with a pen and photographed, marks the right tasks done after one confirm.
- A folded week booklet scans back page by page.
- One week of reMarkable pages round-trips by USB with no wrong ticks.

## Open questions

- Does your printer print on both sides by itself? If not, booklets need a "flip and reinsert" step.
- Which reMarkable model do you have (2, Paper Pro)? It changes the page size and the cloud route.
- On the Today sheet, should habits show bare minimum / goal / exceptional as three boxes, or one box?
