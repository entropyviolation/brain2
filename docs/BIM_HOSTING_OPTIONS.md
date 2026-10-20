# BIM hosting options — keeping the phone hub always on

_Last mapped: 2026-10-20_

BIM only answers while `npm run phone:hub` (`scripts/phone-hub.ts`) runs. A
closed laptop cannot. Telegram holds unclaimed updates for about 24 hours, so a
short gap loses nothing; a longer one drops texts. This file lists where the hub
can live. The first pick is at the top. The rest are kept in case it falls through.

## What any host must give the hub

- Node 20+ and this repo checked out (`npm ci`).
- A **persistent** `data/` folder (`shared-persist.json`, ~13 MB, plus
  `recovery-backups/` and `telegram-update-offset.json`).
- `COGS_TELEGRAM_BOT_TOKEN`, and on any public host `COGS_PHONE_HUB_TOKEN`
  (bearer token for the vault API, see below).
- The process restarted on crash and on boot.
- Outbound HTTPS to `api.telegram.org`. Long-poll needs no inbound port at all.
  Webhook mode (`COGS_TELEGRAM_WEBHOOK`) needs a public HTTPS URL.
- The machine's timezone set to yours. Send-time clocks use the process zone.

## Options, cheapest first

| Option | Cost | Always on? | Catch |
| --- | --- | --- | --- |
| **Oracle Cloud Always Free VM** (ARM, up to 4 CPU / 24 GB) | $0 | Yes | Signup wants a card for verification. Idle accounts can be reclaimed. Run the hub under `pm2` or `systemd` yourself. |
| **Fly.io** with a small volume | About $0–3/month | Yes | No true free tier now. Needs a Dockerfile and a volume mounted at `data/`. |
| **Raspberry Pi or old Mac at home** | $0 after buying it | Only while home power and wifi hold | Easiest. Long-poll works with no public URL. |
| **Render / Railway free tiers** | $0 | No | They sleep, and disks are ephemeral. Fails "always store". |
| **Cloudflare Worker that only queues updates** | $0 | Yes | Telegram already holds updates ~24 h, so it only helps gaps longer than that. Means writing a second ingest path. |

Other ideas, not evaluated in depth: Hetzner / DigitalOcean / Vultr entry VPS
(about $4–6/month, no surprises), Google Cloud `e2-micro` free tier (US regions
only, small), a home NAS (Synology / Unraid) running the same Node process.

## Why not a serverless webhook-only design

Brain2 is offline-first. The vault is a file the hub rehydrates and writes back
(`lib/vault-guard.js` merges). A stateless function has no file to merge into,
so it would need a real database first. That is a larger rewrite than hosting
the existing process.

## Security: the vault API

The hub's `/api/persist` and `/api/recovery-backups` serve the **whole vault**.
They are unauthenticated unless `COGS_PHONE_HUB_TOKEN` is set. When set, those
routes need `Authorization: Bearer <token>` (`lib/ingest/hub-auth.ts`).
`/health`, `/api/ingest/status`, and the Telegram webhook (its own secret) stay
open. Settings → Message ingest → **Hub token** sends it on Sync vault. The hub
warns at startup when the token is unset. Alternative: bind to a private network
(Tailscale) and skip public exposure.

## Plan

See [`MESSAGE_INGEST.md`](MESSAGE_INGEST.md) for how the hub works. Steps:

1. **Pick the host** (open question: Oracle free VM vs a Pi at home).
2. **Auth on the vault API.** Done in code, 2026-10-20 (`COGS_PHONE_HUB_TOKEN`).
3. **Package it.** A `systemd` unit or `pm2` file, plus `Dockerfile` if Fly.io. **Planned.**
4. **Seed the host.** Copy `data/shared-persist.json`, set env, start, Sync vault from Settings.
5. **Verify.** Close the laptop, text `groc`, expect a reply. Text something, reopen the laptop, Sync vault, expect it in the Inbox.
6. **Back up.** Nightly copy of `data/` off the host. **Planned.**
7. **Watch.** A heartbeat (BIM texts you when the hub restarts, or an uptime ping on `/health`). **Planned.**
