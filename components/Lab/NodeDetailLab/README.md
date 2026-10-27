# Node detail lab

_Last mapped: 2026-10-20_

Four design studies for the task card's right bar (`components/Home/ToDo/task-card/TaskCardSide.tsx`).
Route: `/lab/node-detail/` (`app/lab/node-detail/page.tsx`). Nothing in the app links here or imports this folder.
In the Electron app, open it from the dev tools console: `location.href = "/lab/node-detail/"`.

## How it is wired

- `lab-store.ts` copies `useTaskStore` (tasks, lists, folders) into its own zustand store.
  - **Sandbox** (default): writes stay in the copy. While the copy is untouched, it follows the real store live.
  - **Live**: writes go through the real `updateTask` / `addTask`. It asks first.
  - With no task that has steps, it seeds a demo task (`lab-task-cds`).
  - Spent minutes from the ▶ clock are lab-only (`spent`).
- `model.ts` (`useNode`) builds one node (a step, or the whole task) and every verb. It uses the same helpers as the real bar: `taskPointsWithSource`, `node-needs`, `prereqs`, `isStepLocked`, `withNoticeAnswer`. The skins only draw it.
- `kit.tsx`: `Picker` (search or create; Enter picks), `AddNeed` (kind, then search), `useFlash`, `useCountUp`, `TypeOn`.
- The page takes `win95-app` off `<body>` while mounted, because the house skin restyles every button. The bench reset in `lab.css` uses `:where()` so each skin's single-class rules win.

## The four studies

| | File | Idea | Eggs |
|---|---|---|---|
| I | `MockDischarge.tsx`, `discharge.css` | Gas tubes for state and level (Xe done, Ar open, Ne locked), nixie est / spent / ends, a scope trace (red past est), chrome bearings with physics for points, a patch bay for needs and unlocks | Click a tube for its spectrum. Click the state tube 5× to strike |
| II | `MockIndex.tsx`, `index-card.css` | Card catalog drawer: Ident, Points, Needs, Notes cards with staggered tabs; rubber stamp state; typewriter keys; ERMA-style cross-reference tree | Wheel flips cards. Brass rod pulls every card out. Type `erma` for punch tape |
| III | `MockLace.tsx`, `lace.css` | One concentric dial cut like lace: ends ring, time ring, points knob (one turn = 20), needs as beads, unlocks as diamonds; legend rows under it | Flick the lace edge to spin it. Done blooms the lace |
| IV | `MockArcade.tsx`, `arcade.css` | Arcade cabinet: CRT marquee, TIME and ENDS bars, 7-segment counters, arcade buttons, inventory slots, quest log | CLEAR plays STAGE CLEAR. ↑↑↓↓←→←→BA turns on TURBO. SOUND switch |

Every study covers the real bar's verbs: points On done / By level / Each step with reset, the B / G / E rungs, needs in three kinds (search, create, open, remove, log), unlocks, step item, and notes with ⌘↩ and the notice dot. They add Done, Show the math (ρ / σ), and the ▶ clock.

Keys on the bench: 1–4 pick a study, 0 shows all four on the same node.

**Planned:** pick one direction, then fold it into `TaskCardSide.tsx`. Until then this folder is a sketchbook.
