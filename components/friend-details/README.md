# Friend instrument

One friend’s page, opened from the header photograph and from Gallery **Details**. The same component in both places: `FriendDetailsPanel`.

The page is one silver handheld. The photograph sits in a lace window whose shape follows the bubble effect. A bond tube panel sits beside it. Chat is the round key under the portrait. Today’s mission is a dark strip under that. Win98 tabs — Today, Personality, Keepsakes, Journal — replace the long scroll. The last tab is remembered per friend. The footer stays put.

```
friend-details.tsx                         re-export
friend-details/
  FriendDetailsPanel.tsx                   draft, Chat, save, close, tabs
  FriendDetailsPortrait.tsx                lace window, bond, pinned mission
  FriendDetailsReadouts.tsx                bond tubes, points gem, streak
  FriendDetailsVoice.tsx                   tone dial, effect swatches, whim windows
  FriendDetailsEqualizer.tsx               silver-cap faders, phosphor curve, beads, presets
  FriendMissionDetail.tsx                  mission card over the instrument
  FriendDetailsJournal.tsx                 playlist rows, opens the card
  FriendDetailsKeepsakes.tsx               cameo badges counted from the log
  FriendSpeechBubble.tsx                   shared with the header nest
  useFriendDraft.ts                        dirty check, presets, save
  friend-details.css                       --friend-silver, --friend-lace, --friend-glow, --friend-nixie
  friend-details.test.tsx
```

Pure counts live in `lib/friend-stats.ts`. Smaller-task writes shared with the mission sheet live in `lib/friend-mission-steps.ts`.

## What you see

- **Portrait.** Lace frames every friend. Plain and Bounce use an arch, Heart a heart, Stamp an oval, Whisper a round medallion, Sparkle a chrome tribal window. Jewel-case nubs sit on the glass. Sparkle washes iridescent. The bond halo brightens with each level. Thin green leaders read met date and times worn. Opening the page plays the same ~560ms CRT power-on, skipped when reduced motion is on.
- **Bond.** Lifetime friend points (finished missions) plus times worn. 20 points per level. Twenty tubes light one per point inside the level. Crossing a level flashes the name plate. A line under the panel names the next window.
- **Chat.** A round silver key under the portrait. A short bloom plays, then the preview bubble. Nothing is logged. With no preview, the well says “tap me ✦”. The header chat button is the one that logs an offer.
- **Today’s mission.** A dark strip. The title is a play row and opens the mission card. The countdown is red 7-segment digits. **Accept** and **I did it** sit on the strip. Finishing sends a few gems toward the points numeral. The card still walks through a smaller task, the first step, and a reason, and opens the item on top.
- **A click.** Tone is a four-detent dial. Bubble effects are small swatches. Whims sit in a two-column grid. Hovering or choosing one previews the line in the portrait bubble.
- **On their own.** Cadence and pushiness are recessed, with an unlit **saved** lamp. They are stored and do not change a click. **Celebrate** may glow: finishing already adds the extra warm line.
- **Tabs.** Today holds the newest journal rows. Personality holds voice and the equalizer. Keepsakes and Journal are their own tabs. The choice is stored per friend. Today is the default.
- **Equalizer.** Habits, To Do, Next, Urgency, Love, Whims, Reward, Suggest. Each track is a dark slot with a silver cap. A dB scale sits at the left. The Habits / To Do / Next curve is a green trace on a graticule. Under them, the share of picks (they add to 100). Suggest is dim. The scale 0 and 100 is engraved once. **Presets** opens Cuddly, Coach, Wanderer, and Drill sergeant. They fill voice and weights and leave title loves and list marks.
- **Beads.** Title loves are words you add and remove. The line under them counts how many current tasks match. Favorite lists are the `listBias` marks, 0–100, one bead per list you add.
- **Journal.** A dark playlist. Day headers are thin strips. Rows are numbered, time sits on the right, and the hovered row turns blue. Done rows show +N ◆ in gem green. The decline reason is one indented line. A row opens the same mission card as today’s strip.
- **Keepsakes.** Oval cameos when earned, a circuit outline until then, with progress and a tiny tube. New badges: Bond Lv 5, a 7-day streak, every tone tried, and a finished whim. A newly earned badge plays a short cursor flock.
- **Footer.** Save stays off until the draft changes. The lamp is amber while there are unsaved edits and green once saved.
- **Keepsakes.** First mission, took the first step, 3-day streak, worn 10 times, finished before noon. Unearned badges stay outlines. Nothing new is stored.
- **Footer.** Save personality is off until the draft differs. Save leaves the page open and lights **Saved**. Close and the corner × discard. A dirty close asks one question. Revert restores the saved overlay.

The glass shine and the bond bar each sweep once a minute, then hold. `prefers-reduced-motion: reduce` stops that sweep, the offered pulse, the power-on, and the bubble bounce.
