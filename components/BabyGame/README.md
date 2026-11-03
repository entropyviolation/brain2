# `components/BabyGame/` — the Baby animal game UI

_Last mapped: 2026-11-02_

Opened by the **Baby animal game** key in `components/friend-details/FriendDetailsPanel.tsx`, which lazy-loads `BabyGame`. A wide dialog in the friend instrument's own look: dark riveted hull, pale steel plates, CRT-green readouts, house keycaps (`.friend-key`). The rules are in `lib/baby-game/` (read its `README.md` first).

```
BabyGame.tsx    dialog + canvas loop + keys + the glue between the engine and the plates
render.ts       paints the 304×192 view: cached map, live water, nodes, stations, friends and player by their feet, light, rain
panels.tsx      Talk, Bag, Workbench, Trade Stump, Notice Board, Lamp, Journal, Menu, StoryCard, TimingGame
pixel.tsx       PixelSprite (16×16 species) and ItemIcon (8×8 shapes) as small canvases
BabyGame.css    hull, HUD, plates, hearts, timing bar, phone pad
```

## What you see

- **HUD.** The companion and its perk, day and clock, energy bar, buttons, Bag / Journal / Menu keys. A game day is about six real minutes.
- **World.** The canvas is shown at 3× with `image-rendering: pixelated`. A dusk tint comes on after five. The lamp and campfire glow after dark once one part is in. Rain falls on rain days and non-rain friends hold a leaf over their heads.
- **Prompt.** `E` and the thing nearest you. Friends come first. `Shift` runs; quiet friends jump if you run near them.
- **Panels.** Open over the world and pause it. `Esc` closes them. A friend's panel is the heart of play: portrait, ten hearts, mood, their line (typed out, in their bubble effect), what they want, and keys for Talk, Gift, Approach, Favor, Chat, and Give or Ask.
- **Chat** shows a chip, **answered by the local model** or **scripted answer**, so you always know which.
- **Night.** Sleep (bed, or Menu after six) shows the companion's diary page and says if a model wrote it.
- **Back home.** The Notice Board shows the real mission the friend has open, read-only. The game never completes or writes it.

## Behavior that is easy to miss

- The canvas lives in state (`setCanvas`), not a ref: the dialog portals its children after the first render, so a ref is null when the loop effect first runs.
- A slow frame is walked in 50ms steps (up to half a second), and the clock runs on real time, so a low frame rate does not slow the day.
- Friends start where they would be *now* (`newSim`), so a saved evening opens with everyone at the fire.
- Saves: every state change writes `brain2-baby-game`. **Start over** is in the Menu.
- Desktop first. A touch pad shows when `pointer: coarse`, but this is not yet a `docs/MOBILE_STYLE.md` screen.
