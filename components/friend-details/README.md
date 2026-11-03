# Friend instrument

One friend’s page, opened from the header photograph and from Gallery **Details**. The same component in both places: `FriendDetailsPanel`.

The page is a space homestead: a farm-sim page on a station hull. The hull is dark and riveted. The friend face and the tab page sit on pale steel plates with a dialogue-box border and a rivet in each corner. The photograph sits in a round chrome porthole: a conic-metal ring with four rivets, a glass lip, and a rainbow film around the rim of the glass; the middle stays clear. Bond is twenty pixel hearts. Little pixel icons (`PixelIcon.tsx`) sit beside the tabs, the keys, Met / Worn / Next, the name, and the mission letter. No yellow, no gold. _Last mapped: 2026-11-01._

The porthole and the bond meter share a top and a bottom. The name is the one large line, top-aligned with the window. Chat sits at the foot of that column. Today’s mission is a dark strip 16px under that pair. Tabs — Today, Personality, Keepsakes, Journal — meet the page with no gap. The stage and the footer stay put. Only the page scrolls. The last tab is remembered per friend.

_Last mapped: 2026-10-30._

Folders: `portrait/` is the lace window and the bond tubes beside it. `personality/` is the voice keys and the equalizer.

```
friend-details.tsx                         re-export
friend-details/
  FriendDetailsPanel.tsx                   draft, Chat, save, close, tabs
  FriendSpeechBubble.tsx                   shared with the header nest
  PixelIcon.tsx                            12×12 letter-grid sprites, three tones and a warm outline
  PixelOrb.tsx                             a task's orb photo as a 16×16 pixel sprite (canvas)
  use-item-detail-popup.ts                 shared lazy item-detail load with the header mission sheet
  FriendMissionDetail.tsx                  mission card over the instrument; item detail loads when the task opens
  FriendDetailsJournal.tsx                 playlist rows, opens the card
  FriendDetailsKeepsakes.tsx               cameo badges counted from the log
  useFriendDraft.ts                        dirty check, presets, save
  friend-details.css                       --friend-silver, --friend-lace, --friend-glow, --friend-nixie
  friend-details.test.tsx
  portrait/
    FriendDetailsPortrait.tsx              lace window, bond, pinned mission
    FriendDetailsReadouts.tsx              bond tubes, points gem, streak
  personality/
    FriendDetailsVoice.tsx                 tone dial, effect swatches, whim windows
    FriendDetailsEqualizer.tsx             eight equal fader rows, phosphor curve, beads, presets
```

Pure counts live in `lib/friend-stats.ts`. Smaller-task writes shared with the mission sheet live in `lib/friend-mission-steps.ts`. The item-detail popup load is `use-item-detail-popup.ts`, the same hook the header mission sheet uses. Home widgets keep their own hook.

The mission card loads the item detail popup when its task is opened. The header mission sheet (`components/friend-mission-sheet.tsx`) loads when the bubble opens a mission, then stays available. The friend jewel itself stays eager. A refresh should not parse those modules until they are opened.

## What you see

- **Portrait.** Every friend is round now: the porthole overrides the frame masks (arch, heart, cameo, medallion, tribal), and the lace layer is the glass lip. The four nubs are rivets on the ring. Every friend gets the rainbow film; Sparkle still adds its sweep. The ring's metal is the level unlock: polished chrome at level 1, then brushed steel (2), blue anodized (3), rose anodized (4), and rainbow titanium (5). That is `RINGS` in `portrait/FriendDetailsPortrait.tsx`, painted as `.is-ring-*`. **Next** names the next ring. The old shape masks in `public/friend-details/frames/` are no longer used. The bond halo brightens with each level. The name sits beside the window. Opening the page plays the same ~560ms CRT power-on, skipped when reduced motion is on. Change picture and Remove live on this page, not on the gallery card.
- **Bond.** One meter beside the window: level, twenty tubes, one willpower gem, and the streak from day two. Met and worn are a caption column under the meter, label left and value right. Lifetime friend points (finished missions) plus times worn. 20 points per level. Crossing a level flashes the name.
- **Chat.** A keycap at the foot of the bond column. A short bloom plays, then the preview bubble on the glass. Nothing is logged. The header chat button is the one that logs an offer.
- **Today’s mission.** A dark strip: one title, one countdown, one verb (**Accept mission** or **I did it**). Empty reads “No mission today.” The title opens the mission card, which covers the page. The card still walks through a smaller task, the first step, and a reason. Opening the task loads item detail on top; that module stays out of the first parse.
- **A click.** Tone is a four-detent dial. Bubble effects are small swatches. Whims sit in a two-column grid. Hovering or choosing one previews the line in the portrait bubble.
- **On their own.** Cadence and pushiness are recessed, with an unlit **saved** lamp. They are stored and do not change a click. **Celebrate** may glow: finishing already adds the extra warm line.
- **Tabs.** Today shows the newest two mission rows and no second heading. Personality holds voice and the equalizer. Keepsakes and Journal are their own tabs. The choice is stored per friend. Today is the default. On a phone the four tabs are equal 44px keys.
- **Equalizer.** Habits, To Do, Next, Urgency, Love, Whims, Reward, Suggest. Each is one row, 36px on the desktop and 44px on a phone. The green mix trace sits under the rows. Suggest is dim. **Presets** is one key. It opens Cuddly, Coach, Wanderer, and Drill sergeant. They fill voice and weights and leave title loves and list marks.
- **Beads.** Title loves are words you add and remove. The line under them counts how many current tasks match. Favorite lists are the `listBias` marks, 0–100, one bead per list. The lists themselves are a searchable multi `ListPicker` (tick to add, untick to drop). A new list starts at 50.
- **Task sprites.** _Last mapped: 2026-11-01._ Every task row, the mission strip, and the mission card lead with the sprite its title means: `matchTaskIcon` in `lib/pixel-icon-match.ts` (toothbrush, robot, spreadsheet, broom, phone, …, then the mission source). Rows and the strip end with the task's own orb as a pixel sprite (`PixelOrb`): its custom icon, else its stable orb; habits get a stable orb by id; whims and affection have none. **Planned:** an embedding pass for titles the word lists miss.
- **Journal.** A dark playlist. Day strips are 24px. Each mission is one row: lamp, source, title, time, and points on that same line. On a narrow width the source sits under the title. Done rows show +N in gem green. The decline reason is one indented line. A row covers the list with the mission card.
- **Keepsakes.** Every badge is the same 64px cell. Earned cells show the cameo. The rest stay outlines, with the fraction and a short tube inside. The longer hint is one line under the grid, and only for the selected cell. Nothing new is stored.
- **Footer.** Save personality and Revert appear only while the draft differs. A clean page shows Close. Save leaves the page open and lights **Saved**. The unsaved mark is navy. The corner Close and the footer Close both discard. A dirty close asks one question. Revert restores the saved overlay.

_Last mapped: 2026-10-30._

## Keys

_Last mapped: 2026-11-01._

Every word key on the page is the house keycap (`docs/DESIGN_STYLE.md` → Keycaps), painted on `.friend-key`. That includes Change picture, Remove, Chat, the corner Close, presets, mission verbs, and the footer. They are pale silver with a darker skirt and drop about 2px on press. A fixed action (Accept mission, I did it, Yes smaller, Yes first step, Save personality) is the primary cap: `.is-primary`, navy ring and lamp. A voice key that is chosen latches to CRT glass with a green legend: `.is-on`. The four tabs are the shared latching bay (`.b2-keycap-tab` with `data-state`), the same as other room switchers. The gallery and the header mission sheet share `.friend-key`, so they get the same caps.

The glass shine and the bond bar each sweep once a minute, then hold. `prefers-reduced-motion: reduce` stops that sweep, the offered pulse, the power-on, and the bubble bounce.
