# `public/pcb/` — Optional app-desktop PCB plates

Photoreal circuit-board photographs for the **application backdrop**.
The fresh default is plain Win95 teal (`pcbMode: "teal"`) with no file here.
These copies are the URLs CSS loads when the user picks a plate.

Source stills live in [`designrefs/`](../../designrefs/).

| File | Mode | Source |
|------|------|--------|
| `ceramic.jpg` | Silver / white ceramic | `designrefs/cfd93985b7a2a76aa69823561c8525d1.jpg` |
| `mint.jpg` | Pale mint snowflake-circuitry | `designrefs/d09ee9b9432fa21ba8db4f1400a533e9.jpg` |
| `ice.jpg` | Inverted icy blue | `designrefs/07e703d6f9fda08564ed32ba1eea8295.jpg` |
| `xray.jpg` | Black / lime x-ray | `designrefs/2dc0e2cd6390065e28da01f96665db4a.jpg` |
| `fr4.jpg` | Classic dark-green FR4 | `designrefs/5f3b8feaa2e9037ae0323d6635e28bb5.jpg` |

Modes, overlays, and the Settings picker: `lib/pcb-backdrop.ts`,
`app/pcb-backdrop.css`, `components/Settings/PcbBackdropField.tsx`.
Choice persists on `brain2-theme-store` (`pcbMode`); `cogs-theme-store` is
still dual-written. Saved plates are never migrated onto teal.
