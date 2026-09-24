# `public/pen-tray/` — Tracking pen-well photographs

Photoreal stills served as the **pen container** background (the well of beads
plus the selected-pen strip). Source files live in
[`designrefs/`](../../designrefs/); these copies are the URLs CSS can load.
`designrefs/` itself is not a static asset folder.

Default is **Cat traces** (`cat.jpg`) — a navy instrument plate, not velvet.

| File | Mode | Source |
|------|------|--------|
| `cat.jpg` | Cat traces (default) | `designrefs/e624b3aca52ff4d3f8cfe5fe476d3a7e.jpg` |
| `pewter.jpg` | Pewter book | `designrefs/28003c286757ff410d03de24bc24c898.jpg` |
| `jewel.jpg` | Jewel PCB | `designrefs/f54430419ed206fa1bea7b27a4ff6a9e.jpg` |
| `bloom.jpg` | Iridescent bloom | `designrefs/5934b2e94f44ba6bdf53382877091c3c.jpg` |
| `fr4.jpg` | FR4 classic | `designrefs/5f3b8feaa2e9037ae0323d6635e28bb5.jpg` |
| `xray.jpg` | X-ray PCB | `designrefs/2dc0e2cd6390065e28da01f96665db4a.jpg` |

Modes, ink, and the View settings picker: `components/Home/Tracking/pen-tray-bg.ts`,
`pen-tray-bg.css`, `tracking-view-prefs.ts`, `tracking-view-settings-dialog.tsx`.
Choice persists on `brain2-tracking-view-prefs` (`penTray`).
