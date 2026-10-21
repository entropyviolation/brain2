# Widget gallery

_Last mapped: 2026-10-20_

The Widget gallery is where widget kinds are explained and installed. It opens from the Widgets menu as `HomeWidgetCatalog` (`components/Home/home-widget-catalog.tsx`). Kinds come from the manifest in `lib/widgets/kinds.ts`, and installed copies come from `useDashboardStore` (`lib/widgets/dashboard-store.ts`). Plan: `docs/WIDGETS_REDESIGN.md`.

## Files

| File | What it does |
|------|--------------|
| `widget-gallery.tsx` | The rail and the page. The rail starts with **How widgets work**, then every kind grouped as Day, Score, Clock, Sky, Study, Money, and Capture (Money holds Budget). A lamp is lit while any copy of that kind shows, and a count appears at 2 or more copies. Up and Down step the rail unless focus is inside a page. |
| `gallery-about.tsx` | The first page. It explains kinds and installed copies, the three install rules, faces, details and the gear, edit mode, the Dash and Milled styles, and the room left for user-made kinds. **Show the guide again** re-arms every copy's first-run guide. **Reset to my old layout…** confirms, then calls `resetToLegacy`. That brings back the old strip's showing set and order in Milled at original sizes. It doesn't uninstall anything or lose any settings. It's disabled when the vault started on the Visual dashboard. |
| `gallery-page.tsx` | One kind's page. Header (group, name, install rule, showing and installed counts, and the Install key), sample faces, What it does, How it works, Worth it when, and Settings for each copy (manifest fields, plus the Countdown and Language study panel settings from `PANEL_SETTINGS`, plus Face and Day). Then the First-run guide (**Play the guide**, **Show the guide again**) and Installed copies (Show/Hide, Settings, Remove…). Settings opens `CopySettingsPanel` with the kind's own panel (`CountdownSettings`, `LanguageStudySettings`) for that copy alone. Language study adds a CEFR × exam table (`LANGUAGE_EXAMS`). |
| `sample-faces.tsx` | Dash shows the registered Dash face (`dashFaceFor`) at every size the kind draws, in the style thread's `.dash-sample` cells. Milled shows the manifest's static `gallery.preview`. An error boundary falls back to the static preview. |
| `install-setup.tsx` | Install with setup. Countdown asks for a name, date, direction, and repeat. Language study asks for the language (one per language; a hidden copy is shown again), the role (learning or native), and a CEFR level, then can run the placement quiz (`placementQuiz()`). Weather and Solar ask for a place: follow the pinned city (empty key), or a city from `searchCities`. A kind with a guide offers a switch to skip it. |
| `install.ts` | Store logic for install and remove. Countdown adds a Days Until mark, and the reconcile makes the copy. Language study adds the language to Vocab, then sets `role`, `cefr`, and the Vocab level (`applyCefrLevel`). Places use `key` = the city label and settings `place`/`lat`/`lng`. `removeInstalledCopy` also deletes a Countdown's mark. |
| `widget-gallery.test.tsx` | Covers the about page, a kind page, and installs for Points, Countdown (and remove), Language study, and Weather. It also covers show and hide, settings, the guide again, and reset. |

## Notes

- The gallery adds no CSS. It reuses `.home-catalog*` from `home-chrome.css`. The Dash style thread styles the `vdg-*` hooks in `components/Home/visual-dashboard.css` and `dash/dash.css`. The class list is in the project's `visual-dashboard/dom-contract.md`.
- Hiding from the gallery doesn't ask "Are you sure?" because Show is right there. Remove does confirm.
- Adding a language through setup also makes it Vocab's active language (`addLanguage`).
