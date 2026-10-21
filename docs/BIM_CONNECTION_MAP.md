# BIM connection map

_Last mapped: 2026-10-20_

Every machine, every link, every secret, and where each one lives. Setup steps:
[`BIM_SETUP_FOR_BEGINNERS.md`](BIM_SETUP_FOR_BEGINNERS.md). Design:
[`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md).

```
 Phone ──Telegram servers──► [Oracle VM  brain2-capture]  (public IP: SSH only)
                                 capture-box.mjs, locks each text with the PUBLIC key
                                 listens on the Tailscale address only, :8788
                                      ▲   │ every minute: "still here" ping (outbound)
                      Tailscale tunnel│   └──────────────► Healthchecks.io ──► Telegram alert
                                      │
                          [Your Mac]  npm run phone:hub  (COGS_CAPTURE_BOX_URL)
                                 opens with the PRIVATE key → Brain2 vault → replies via Telegram
                                 pings the second Healthchecks check
```

## Links

| From → to | How | Open to the internet? |
| --- | --- | --- |
| VM → Telegram (`getUpdates`) | HTTPS, outbound | No (outbound only) |
| Mac ↔ VM queue | HTTP over Tailscale to `brain2-capture:8788` | No: bound to the 100.x address |
| You → VM admin | `ssh ubuntu@<public-ip>` (later: over Tailscale) | Port 22 only |
| VM → Healthchecks.io | HTTPS ping, outbound | No |
| Mac → Telegram (replies, file downloads) | HTTPS, outbound | No |

## Values

| Name | Example / where | Lives on | Secret? |
| --- | --- | --- | --- |
| Telegram bot token | `COGS_TELEGRAM_BOT_TOKEN` | Mac `.env.local`, VM `/etc/brain2-capture.env` | **Yes.** Revoke in @BotFather if the VM is suspect |
| Capture public key | `COGS_CAPTURE_PUBLIC_KEY` | VM env | No (only locks) |
| Capture private key | `~/.brain2/capture-private.key` | Mac only, plus an offline backup | **Yes. Never on the VM** |
| Pickup token | `COGS_CAPTURE_TOKEN` | Mac `.env.local`, VM env (same value) | Yes |
| Allowed chat id | `COGS_CAPTURE_CHAT_IDS=8902429750` | VM env | No |
| Box bind address | `COGS_CAPTURE_BIND=100.x.y.z` | VM env | No |
| Box URL | `COGS_CAPTURE_BOX_URL=http://brain2-capture:8788` | Mac `.env.local` | No |
| Box ping URL | `COGS_HEALTHCHECK_URL` | VM env | Treat as secret (anyone with it can fake a wave) |
| Drain ping URL | `COGS_DRAIN_HEALTHCHECK_URL` | Mac `.env.local` | Same |
| VM SSH key | `~/.ssh/id_ed25519` | Mac | **Yes** |

`phone:hub` reads `COGS_*` lines from `.env.local` itself, so nothing needs
exporting in the shell.

## Files on the VM

| Path | What |
| --- | --- |
| `/opt/brain2-capture/{capture-box,sealed-box,capture-filter}.mjs` | the program |
| `/etc/brain2-capture.env` | settings, mode 600 |
| `/etc/systemd/system/brain2-capture.service` | auto start, auto restart |
| `/var/lib/brain2-capture/queue.jsonl` | locked letters waiting for pickup |
| `/var/lib/brain2-capture/state.json` | Telegram position |

## Useful commands

| Where | Command | Tells you |
| --- | --- | --- |
| VM | `systemctl status brain2-capture` | running or not |
| VM | `journalctl -u brain2-capture -f` | live log |
| VM | `tailscale ip -4`, `tailscale status` | tunnel state |
| Mac | `curl http://brain2-capture:8788/health` | queue size, last poll |
| Mac | `tailscale status` | is the VM visible |
