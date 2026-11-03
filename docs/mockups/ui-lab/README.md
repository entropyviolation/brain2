# Experimental UI lab

_Last mapped: 2026-10-27_

Twenty-two pages in the browser. Nine rooms use the app’s real CSS, one room each. The header and the Home widgets stay out. Reset on a page returns that room to the current app. Thirteen more pages are experiment benches: three popups, and one bench for each item-detail tab.

From the repo root, `npm run ui-lab` runs `scripts/ui-lab-server.mjs`, serves this folder at [http://127.0.0.1:4173/docs/mockups/ui-lab/index.html](http://127.0.0.1:4173/docs/mockups/ui-lab/index.html), and opens it. `file://` cannot load `/fonts/…` from `public/`. That port is also the screenshot reel’s default; only one of them can listen.

| Page | Room |
|---|---|
| [`habits.html`](habits.html) | Habits |
| [`plan.html`](plan.html) | Plan |
| [`todo.html`](todo.html) | To do |
| [`goals.html`](goals.html) | Goals |
| [`tracking.html`](tracking.html) | Tracking |
| [`lists.html`](lists.html) | Lists |
| [`docs.html`](docs.html) | Docs |
| [`scheduler.html`](scheduler.html) | Scheduler |
| [`operations.html`](operations.html) | Operations |
| [`pen-settings.html`](pen-settings.html) | Pen settings |
| [`timeblock.html`](timeblock.html) | Timeblock |
| [`baby-animal.html`](baby-animal.html) | Baby animal friend |
| [`item-detail-details.html`](item-detail-details.html) | Item detail · Details |
| [`item-detail-body.html`](item-detail-body.html) | Item detail · Body |
| [`item-detail-subtasks.html`](item-detail-subtasks.html) | Item detail · Subtasks |
| [`item-detail-scheduling.html`](item-detail-scheduling.html) | Item detail · Scheduling |
| [`item-detail-time.html`](item-detail-time.html) | Item detail · Time |
| [`item-detail-dependencies.html`](item-detail-dependencies.html) | Item detail · Dependencies |
| [`item-detail-links.html`](item-detail-links.html) | Item detail · Links |
| [`item-detail-resources.html`](item-detail-resources.html) | Item detail · Resources |
| [`item-detail-history.html`](item-detail-history.html) | Item detail · History |
| [`item-detail-analysis.html`](item-detail-analysis.html) | Item detail · Analysis |

Experiments depart from the house. They do not replace it. Item-detail benches draw their own tab bars: the default rest face is the latching keycap, and the selected key stays the CRT with its lamp. Room pages that load the app CSS pick up `.b2-keycap-tab` from that CSS.
