# Language study

Kind id: `vocab` (unchanged, so saved layouts keep it). Installs: `perKey`, one copy per language. Replaces the **Vocab** widget.

## How it works now

_Last mapped: 2026-10-20_

Each installed Language study copy holds one language. The copy's `key` and `settings.lang` are the language code (`fr`, `es`, `it`, `de`, `ja`, `zh`, `en`). Vocab is one mode inside it.

- **Face.** `home-vocab-tile.tsx` with a `lang` prop, through `renderWidgetTile`. The caption is the language's own name. The face shows today's word, or (gear **Face shows**) the level and a meter: known words for a studied language, favorites for a native one.
- **Detail.** The Vocab detail for that language only: word of the day, **1000 words**, **Flashcards**, and **Look up**, plus the dictionary fold, **Say it**, Translate, and Earlier this week. The language switcher is gone inside a copy, because another language is another copy.
- **Gear.** `components/Home/widgets/language-study-settings.tsx`: the role, the CEFR level, the placement quiz, what the face shows, and the mode. Then the shared face, day, and copy settings. **Remove** keeps favorites, shuffles, and known words, so installing the language again picks up where you left off.
- **Guide.** Four cards on first open: one per language, levels, placement quiz, and Vocab mode.
- **Gallery.** Language study asks for the language, and whether it is native or studied, before it installs (`hasSetup`). **Planned:** the setup step itself, with the Widget gallery.

## Roles

| Role | Who | What it has |
| --- | --- | --- |
| `studied` | A language you are learning. Every language but English by default. | A CEFR level, the optional placement quiz, and the whole Vocab mode: word of the day, 1000 words (French, Spanish, Italian, Japanese, Mandarin), flashcards, and look-up. |
| `native` | A language you already speak. English by default. | Vocab building only: word of the day from Everyday through SAT / Word Power and Advanced to Extremely advanced, favorites, and flashcards. No level, no quiz, no 1000 words. |

## Levels

A studied language sits on the CEFR ladder, A1 to C2 (`lib/widgets/language-levels.ts`). The level picks the word pool from the existing banks (`vocabLevelForCefr`): A1 and A2 read common words, B1 everyday words, and B2 and up the harder banks where that language has them. Setting the level in the gear also writes the bank level in `brain2-home-vocab` (`applyCefrLevel`).

## Placement quiz

Optional, from the gear. Its format follows the real exam for that language, and the gear names the exam's level beside each CEFR level.

| Language | Exam | Run by |
| --- | --- | --- |
| French | DELF / DALF | France Éducation international |
| Spanish | DELE | Instituto Cervantes |
| Italian | CELI | Università per Stranieri di Perugia |
| German | Goethe-Zertifikat | Goethe-Institut |
| Japanese | JLPT (N5–N1) | Japan Foundation and JEES |
| Mandarin | HSK | Chinese Testing International |
| English | Cambridge English | Cambridge University Press & Assessment |

The questions are written for Brain2 in the exam's format; no exam content is copied. The result sets the level, and you can change it any time. The copy keeps when it was placed and the score (`placedAt`, `placedScore`).

**Planned:** the quiz itself, in its own thread. It will live in `components/Home/language-study/` and register through `registerPlacementQuiz` (`components/Home/widgets/placement-registry.ts`). Until then the gear says the quiz is not in this build, and the level is set by hand.

## Modes

Vocab is the only mode today. **Planned:** reading, listening, and grammar drills join as more modes in the same copy, not as more widgets.

## Where the data lives

Nothing moved. Favorites and today's shuffle stay in `brain2-home-vocab` (`lib/vocab-store.ts`), keyed by language. Known words stay as the `vocab-known` attribute on `vocab-1000-<lang>` items, and My words stay in `vocab-mine-<lang>`, so Lists still sees them. The copy holds only `lang`, `role`, `cefr`, `face`, and the placement result.

## Migration from Vocab

_Last mapped: 2026-10-20_

`dashboardFromLegacy` makes one Language study copy per language in the old Vocab list (English alone when the list is empty). The active language takes Vocab's place and shows; the others install hidden, so the dashboard does not grow overnight. English gets role `native`; the rest get `studied`, with the old bank level mapped to CEFR (`cefrFromVocabLevel`: common → A1, everyday → B1, SAT and advanced → B2, rare → C2). Copy ids are `vocab:<lang>`. `reconcileLanguages` gives any language added later a hidden copy, so no language is lost.

## Gaps

- German has a daily word but no 1000-word list (`THOUSAND_LANGS` leaves out `de`).
- English has only the native-style levels, so a studied English copy reads the closest bank.
- The Cambridge ladder has no A1 name, so English A1 shows as plain A1.

Plan: [`docs/WIDGETS_REDESIGN.md`](../WIDGETS_REDESIGN.md#language-study-replaces-vocab).
