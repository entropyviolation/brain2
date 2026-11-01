# Oracle interim sync — a temporary relay until the home server exists

_Last mapped: 2026-10-31_

> **Bandaid.** This use of Oracle is a stopgap, not the design. It exists only
> until Brain2 has a reliable always-on device (Boa revived, or a Mac mini).
> Do not build new features that depend on it. Anything that matters long term
> goes on the home server. It is also optional: if the Mac stays awake, Tailscale
> (tier 0) covers most away-from-home sync, and Oracle only fills gaps when the
> Mac is off for a long time.

**Temporary.** Decision (2026-10-31): the Oracle Free VM is a relay for the time before Brain2 has a home server. It never holds the vault in the clear, never runs the language model, and never holds bulk storage. When the home server is up, the relay is retired (see Exit plan). Nothing here is built unless a row says **Built**. Everything else is **Planned**.

Goal while waiting: the iPhone app and the desktop app stay in sync, and the iPhone works when you are not home.

## Names

- **Home server.** The machine that will hold the vault file, bulk storage, `phone:hub`, and the local language models. Target: an Apple silicon Mac mini (an M1 with 16 GB runs 7–8B models at chat speed). Not bought yet.
- **Boa** (Brain Operations Annex). The old MacBook Pro, label `A1990`: a 15-inch, 2018 or 2019 Intel model with a T2 chip. Its screen is broken. On 2026-10-30 it stopped powering on after a charger swap. It may be revived as the first home server, or replaced by the Mac mini. Plans that say "the spare Mac" ([`PHONE_WINDOW_PLAN.md`](PHONE_WINDOW_PLAN.md)) mean Boa or whatever takes its place.
- **Relay.** The Oracle VM running `scripts/capture-box.mjs`, as set up in [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md).

## The three jobs and where each one lives

| Job | Now (interim) | Later (home server) |
| --- | --- | --- |
| The vault file `data/shared-persist.json` | The coding Mac, running `npm run phone:hub`, while it is awake | Home server |
| Reach it when away from home | Tailscale on the iPhone; the relay when the Mac is off | Tailscale, or a tunnel; no relay |
| Local language models | Not available. Do not run them on the VM (CPU only, no GPU). | Home server (Ollama or MLX) — [`analytics-plan/13-local-readings.md`](analytics-plan/13-local-readings.md), [`TUTORIAL_PLAN.md`](TUTORIAL_PLAN.md) |
| Bulk storage (photos, audio, the message archive, backups) | The coding Mac and its backups ([`BIM_BACKUP.md`](BIM_BACKUP.md)) | Home server plus an external drive |

## Four tiers

Each tier ships on its own. Later tiers assume the earlier ones.

| Tier | What it gives | Needs Oracle | State |
| --- | --- | --- | --- |
| **0. Tailscale on the iPhone** | The phone reads and writes the Mac hub from anywhere while the Mac is awake. Set the phone's hub URL to the Mac's tailnet name, port 8787, with `BRAIN2_PHONE_HUB_TOKEN`. | No | **Planned** (config only; see Check first) |
| **1. Sealed capture** | Telegram texts, location, and Health uploads queue while the Mac is off, sealed to the public key. The Mac drains them when it wakes. | Yes | **Built**. Texts are built. The location upload route is built but **not deployed**. |
| **2. Sealed patch outbox** | Phone edits made while the Mac is unreachable wait on the relay and land in the vault later. | Yes | **Planned** |
| **3. Sealed snapshot** | The phone can read a recent copy of the vault while the Mac is off. | Yes | **Planned**, and optional |

Do tier 0 first. Do tier 2 next. Build tier 3 only if the phone's own cache is too stale (see below).

### Tier 0 — Tailscale on the iPhone

The hub already listens on `0.0.0.0:8787` and checks `Authorization: Bearer` ([`BIM_HOSTING_OPTIONS.md`](BIM_HOSTING_OPTIONS.md) → Security). The phone window already fetches, caches, and patches through `/api/persist` ([`PHONE_WINDOW_PLAN.md`](PHONE_WINDOW_PLAN.md)). The only change is the hub URL: use `http://<mac-tailnet-name>:8787` instead of the LAN address.

Check first:

- Set `BRAIN2_PHONE_HUB_TOKEN` on the Mac before the phone connects over any network.
- App Transport Security may refuse plain `http://` to a tailnet name. The location doc marks this as untested ([`phone-sync/03-location.md`](phone-sync/03-location.md)). If it is refused, serve the hub over HTTPS with `tailscale serve` on the Mac.
- The Mac must stay awake. The always-on jobs in [`../deploy/mac/README.md`](../deploy/mac/README.md) (`com.brain2.awake`, `com.brain2.hub`) keep it so.
- The free-Apple-ID app expires every 7 days. The reinstall job handles it ([`PHONE_SYNC_PLAN.md`](PHONE_SYNC_PLAN.md) → Status). A reinstall wipes the phone's cache, so the baked `public/mobile-hub.json` must point at a hub the phone can reach.

#### Tier 0 findings and steps

_Last mapped: 2026-10-31_ Checked on the coding Mac and in the repo.

- **Tailscale is not installed on the Mac.** `tailscale` is not on the path and there is no `Tailscale.app`.
- **`BRAIN2_PHONE_HUB_TOKEN` is set** in `.env.local`. The hub is **not running** now (nothing listens on 8787) and no `com.brain2.*` launchd job is loaded.
- **Plain `http` from the web view is allowed.** `ios/App/App/Info.plist` sets `NSAllowsArbitraryLoadsInWebContent`. The phone's `fetch` to `http://<tailnet-name>:8787` should pass App Transport Security. The native location upload does not use the web view, so it stays untested (see [`phone-sync/03-location.md`](phone-sync/03-location.md)).
- **The phone keeps one saved hub URL and falls back to the baked LAN address** in `public/mobile-hub.json` (`phoneHubCandidates` in `lib/mobile-sync.ts`). A tailnet name works at home and away, so it is the better saved URL. Keep the LAN bake as the fallback.
- **Gap: the phone has no place to type the hub token.** `lib/phone-window.ts` reads `phoneHubToken` from the ingest store (`brain2-ingest-store`). Only Settings → Message ingest on the desktop writes it (`components/Settings/imports/MessageIngestPanel.tsx`). With the token set on the Mac and empty on the phone, the fetch gets a 401 and the app shows "(hub token)". **Built 2026-10-31:** the phone's Hub card (`components/Mobile/MobilePullCard.tsx`) has a Hub token field, kept as a `localStorage` pin and sent as `Authorization: Bearer` (`lib/phone-window.ts`). Test: `lib/phone-window.test.ts`. The pin is needed because the vault that holds the ingest store is itself behind the token.
- **Hub checked 2026-10-31.** `npm run phone:hub` ran on the coding Mac. `/health` answered. `/api/persist?canon=1` gave 401 with no token and 200 (about 15 MB) with it, by `http://others-macbook-pro:8787` over the tailnet. MagicDNS resolved the name. Not yet tested from the iPhone.
- **Full Disk Access.** The hub's text and call readers failed to open `chat.db` and Call History from this shell. Give the app that launches the hub Full Disk Access, or run it from the launchd job.

Steps:

1. **Mac.** Install Tailscale from tailscale.com or the Mac App Store and sign in. In the admin console turn on MagicDNS and disable key expiry for this Mac.
2. **Mac.** Start the hub: `npm run phone:hub`, or install the always-on jobs ([`../deploy/mac/README.md`](../deploy/mac/README.md)). Check `curl http://localhost:8787/health`.
3. **iPhone.** Install Tailscale from the App Store. Sign in with the same account. Turn it on.
4. **iPhone.** Set the hub URL to `http://<mac-name>:8787` (the Mac's MagicDNS name, or its `100.x` address). Settle the token gap above first.
5. **Test away from home.** Turn Wi-Fi off, keep Tailscale on, open the app. Expect the Mac's rows to load. Then edit a to-do and check it lands in `data/shared-persist.json`.
6. **Test with the Mac asleep.** Expect the app to paint from its cache and say the Mac is not answering. That is the gap tier 2 fills.

### Tier 2 — Sealed patch outbox

The phone already keeps edits in an outbox of patches (`{ name, patch, source: "phone" }`, [`PHONE_WINDOW_PLAN.md`](PHONE_WINDOW_PLAN.md) phase 3). Today it flushes only when the Mac answers. Tier 2 adds a second place to flush.

- **Phone.** If the hub does not answer and a relay is set, seal the patch to the capture public key and `POST /upload` with kind `patch`. This is the path the location batches already use (`scripts/capture-upload.mjs`, add-only token). Keep the patch in the outbox until the hub confirms it, then drop it. A `patchId` on each patch lets the hub ignore a patch it already applied.
- **Relay.** Stores sealed patches in the existing `uploads.jsonl` queue under their own kind. It cannot read them. No new route is needed.
- **Mac.** A `patch-drain` beside `lib/phone-sync/location-drain.ts` pulls `GET /uploads?kind=patch`, opens each with the private key, applies it through the same `applyVaultPatch` and guards `/api/persist` uses (`scripts/persist-api.mjs`, `lib/vault-guard.js`), then acks. It acks only after the write. A crash re-reads and never skips.
- **Not a new sync protocol.** The relay carries the same patches over a different pipe. `/api/persist` stays the one door into the file.

Open question, to settle before building: a patch made yesterday and applied today can overwrite a newer desk edit to the same field. The plan says the later flush wins that field, and the recovery journal keeps the previous blob. Decide whether the patch carries a per-field edit time and the hub skips fields that are newer on file. Read what `applyVaultPatch` stamps (`Task.modifiedAt`) first.

### Tier 3 — Sealed snapshot (optional)

The phone already caches the slices its shell paints on launch in IndexedDB (`lib/phone-window-cache.ts`, phase 2, built). With tier 0 and tier 2 the cache is usually fresh enough. Build tier 3 only if it is not.

- The Mac seals a read copy of the vault (about 13 MB) to a **phone public key** and uploads it as kind `snapshot`. The relay keeps only the latest.
- The phone needs its own keypair, kept in the Keychain. The capture key cannot be reused: its private half must never leave the Mac.
- The phone fetches and opens the snapshot when the hub does not answer, and marks the screen stale with an age. Read only. Saves go through tier 2.
- This is ciphertext of the whole vault on Oracle. [`PHONE_WINDOW_PLAN.md`](PHONE_WINDOW_PLAN.md) says the vault is not copied onto the VM. Tier 3 would amend that line to say "not in the clear." That is why it waits for a reason.

## The desktop app

Electron needs no relay. When the coding Mac is the hub, the desktop and the hub share one file. If the desktop is ever on a different machine from the hub, Settings → Sync vault pushes to the hub URL ([`MESSAGE_INGEST.md`](MESSAGE_INGEST.md)), and that machine needs Tailscale too.

## What stays off Oracle

- The plaintext vault, the private key, and every other secret except the bot token ([`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md) → What Oracle can and cannot see).
- The message archive (`data/phone-sync/messages.jsonl`, about 302k texts), recovery backups, photos, audio, and PDFs. Files travel as Telegram `file_id`s and the device downloads them.
- Language models. A CPU-only ARM VM runs a 7–8B model at a few tokens a second. Small models are possible, but they are a different product.
- Other people's data. The relay seals to one public key, so it serves one person. A second person needs their own key, vault, and account: a home server job. Not planned here.

Disk: the Always Free tier gives a limited amount of block storage (about 200 GB across volumes as of this writing; check the console). The queue is tens of megabytes at most. The box reports `/fail` when its cap fills.

## Risks

- **Idle reclaim.** Oracle may reclaim idle Always Free instances. Keep the Healthchecks pings running. Upgrading the account to pay-as-you-go (Always Free resources stay free) is commonly reported to prevent this. Verify on Oracle's current terms before relying on it.
- **Account loss.** Oracle can suspend the account. You lose queued items, not the vault. Texts wait about a day on Telegram's side, so act on the alert quickly.
- **Moving parts.** Tailscale and the relay each add a failure mode. If the relay is down, tier 0 still works while the Mac is awake. Every device keeps its own copy.
- **Duplicate pollers.** One Telegram consumer only. The relay polls Telegram, so Message ingest stays off in the desktop app ([`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md) → Tradeoffs).

## Marking it temporary

- **Done 2026-10-31:** this doc, [`../deploy/oracle/README.md`](../deploy/oracle/README.md), and a banner on [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md).
- **Planned:** `BRAIN2_HOST_ROLE=relay` in `/etc/brain2-capture.env`. The box logs it at start and reports it on `/health`. The home server sets `home`. No behavior depends on it yet. It makes the role visible in logs and status.

## Exit plan

When the home server is running `phone:hub` and holds the vault file:

1. Drain the relay to zero: `queued` and the uploads queue both empty on `/health`.
2. Point the phone's hub URL at the home server. Rebuild the app so `public/mobile-hub.json` matches.
3. Move `capture-box.mjs` (same four files) to the home server, or retire it and let `phone:hub` poll Telegram directly. Change `BRAIN2_CAPTURE_BOX_URL` or unset it.
4. Revoke the bot token in BotFather and mint a new one. Revoke the upload and drain tokens.
5. Stop and delete the VM. Remove its Tailscale node. Pause its Healthchecks checks.
6. Back up `~/.brain2/capture-private.key` first. It still opens anything sealed and not yet drained.

No vault data moves, because the relay never held it in the clear.

## Steps, in order

1. **Mac.** Set `BRAIN2_PHONE_HUB_TOKEN`. Install the always-on jobs ([`../deploy/mac/README.md`](../deploy/mac/README.md)).
2. **Phone.** Install Tailscale on the iPhone. Point the hub URL at the Mac's tailnet name. Check that App Transport Security allows it. This is tier 0.
3. **Relay.** Finish [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md) → Setup, then deploy the upload route (steps 1–3 in [`PHONE_SYNC_PLAN.md`](PHONE_SYNC_PLAN.md) → To do, in order). This finishes tier 1.
4. **Settle the patch-replay question**, then build tier 2: `lib/phone-sync/patch-drain.ts`, the phone outbox fallback, tests with fixtures under `tests/fixtures/phone-sync/`.
5. **Decide on tier 3** after a week of use.
6. **Buy the home server.** Run the Exit plan.

You do: the Oracle account and VM, Healthchecks, Tailscale sign-ins, the Mac token and installers. I can do: the code and docs for tiers 2 and 3, the `BRAIN2_HOST_ROLE` change, and the exit-plan script.

## Where this plan is mentioned

[`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md), [`BIM_HOSTING_OPTIONS.md`](BIM_HOSTING_OPTIONS.md), [`BIM_ALWAYS_ON_PLAN.md`](BIM_ALWAYS_ON_PLAN.md), [`BIM_CONNECTION_MAP.md`](BIM_CONNECTION_MAP.md), [`BIM_SETUP_FOR_BEGINNERS.md`](BIM_SETUP_FOR_BEGINNERS.md), [`PHONE_SYNC_PLAN.md`](PHONE_SYNC_PLAN.md), [`PHONE_WINDOW_PLAN.md`](PHONE_WINDOW_PLAN.md), [`phone-sync/README.md`](phone-sync/README.md), [`MESSAGE_INGEST.md`](MESSAGE_INGEST.md), [`SPEC_MAPPING.md`](SPEC_MAPPING.md), [`../deploy/oracle/README.md`](../deploy/oracle/README.md), [`../deploy/mac/README.md`](../deploy/mac/README.md), `lib/phone-sync/README.md`, and the root `README.md`.
