# `components/Lab/BabyFx/` — the Baby game effects lab

_Last mapped: 2026-11-02_

Route: `/lab/baby-fx` (`app/lab/baby-fx/page.tsx`). Step 1 of `docs/BABY_GAME_REDESIGN.md`.

Plays one effect draft at a time on a 304×192 canvas at 3×, looping. Pick the effect, pick a draft (`A`, `B`, `C` or the key), slow it to 0.5× or 0.25×, pause with Space, and **Record loop** to download one loop as a WebM. With reduced motion on, playback is held on frame 0.

```
BabyFxLab.tsx   the page body: switcher, loop clock, recorder
```

The effects are in `components/BabyGame/fx/` (`types.ts` has the shared tools; `index.ts` lists them). An effect is a pure function of the loop time with deterministic randomness, so it can be scrubbed and recorded. Starter set: shake and hit-stop, footstep dust, heart burst, rain v2, three drafts each.

Add an effect: one file in `fx/`, one line in `EFFECTS`. When a draft wins, move it into the game, delete the other drafts, and keep its note of why. None of the fx are wired into the game yet.
