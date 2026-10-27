# Oracle capture box — always-on BIM that cannot read your data

_Last mapped: 2026-10-20_

Decision (2026-10-20): the Oracle Free VM runs a **sealed capture box**, not the
full hub. It long-polls Telegram and stores each text **encrypted to your public
key**. The private key and the vault stay on your devices. Your device pulls the
queue, decrypts, and applies it. Options and fallbacks:
[`BIM_HOSTING_OPTIONS.md`](BIM_HOSTING_OPTIONS.md). Goal: move this to a device
you own as soon as you have one.

Second decision (2026-10-20): the Mac reaches the box over **Tailscale**. No
public port is open on the VM. The box also keeps only texts from your own chat id.

```
Phone → Telegram → [VM: scripts/capture-box.mjs] seals + queues (encrypted)
                          ↑ pulls over the tailnet, acks only after the vault write
Your Mac: npm run phone:hub  (BRAIN2_CAPTURE_BOX_URL) opens with private key → vault → reply
```

Files on the VM (Node 20, no npm): `scripts/capture-box.mjs`,
`scripts/sealed-box.mjs`, `scripts/capture-filter.mjs`, `scripts/capture-upload.mjs`. On your Mac:
`scripts/capture-keygen.mjs` and the drain in `scripts/phone-hub.ts` (`drainLoop`).
Deploy files: `deploy/oracle/`.

## What Oracle can and cannot see

_Last mapped: 2026-10-20_

| | |
| --- | --- |
| Texts, photos' captions, locations on disk | Encrypted. Unreadable without your private key. |
| The vault, lists, habits, tracking | Never on the VM. |
| Your private key | Never on the VM. |
| **The bot token** | On the VM. Whoever holds it can send as the bot and read *new* messages. It cannot read history. Revoke in BotFather if the VM is ever suspect. |
| Message plaintext in RAM | Present for milliseconds while sealing. A hostile hypervisor could in theory read it. Telegram itself also sees every text (bot chats are not end-to-end encrypted). |
| Metadata | Timing, sizes, how often you text, your chat id. |

Photos, PDFs and voice are queued as their Telegram `file_id` only. Your device
downloads the file when it drains, so file contents never touch the VM.

## Threats

_Last mapped: 2026-10-20_

| Threat | What stops it | What does not |
| --- | --- | --- |
| Internet scanner hits port 8788 | No public listener: the box binds the tailnet IP, the VCN and ufw block 8788 | Nothing needed; SSH on 22 is still public unless you restrict it |
| Someone else texts the bot | `BRAIN2_CAPTURE_CHAT_IDS` drops other chats (unless `BRAIN2_CAPTURE_ALLOW_ANY_CHAT=1`) | A stranger can still message the bot; it is dropped, not silent to Telegram |
| Someone reads the queue on disk | Sealed to your public key | Metadata (timing, sizes) |
| Someone sniffs the drain | The tailnet is encrypted (WireGuard); the body is also sealed | Tailscale sees which nodes talk, not content |
| Another tailnet device calls the box | Bearer token `BRAIN2_CAPTURE_TOKEN`; optional ACL (below) | Any device you add to the tailnet can reach the port unless an ACL says otherwise |
| Bot token stolen from the VM | Revoke in BotFather | Messages sent while it was exposed |
| Mac drain is off | Queue grows to the cap, box reports `/fail` | Late replies (see tradeoffs) |
| Tailscale account compromised | 2FA on the identity provider you log in with | An attacker who joins the tailnet could reach the box, but still needs the bearer token and cannot decrypt the queue |
| VM dies | Healthchecks alert | Texts sent between the last drain and the death |

## Tradeoffs you accepted

- **No reply while your devices are off.** Texts are stored and replied to when
  `phone:hub` next runs. The pinned grocery and to-do cards still work as the read path.
- **Late replies.** A `groc` sent three hours ago is answered when the Mac wakes.
- **One consumer.** The VM polls Telegram. Turn **off** Message ingest in the
  desktop app's Settings (its own poller would fight the VM with 409 errors) and
  run the drain with `npm run phone:hub` instead.
- **Your Mac must be on the tailnet** to drain. Away from Tailscale means no drain.

## Setup

_Last mapped: 2026-10-20_

1. **Keys, on your Mac.** `node scripts/capture-keygen.mjs`. Back up
   `~/.brain2/capture-private.key` in your password manager; without it the queue is lost.
2. **Healthchecks.io** (free). New check, period 1 min, grace 5 min. Add the
   Telegram integration (it gives you a bot link; this is its own channel, separate from BIM).
   Copy the ping URL.
3. **Oracle VM** (you do this in their console; I can't create accounts).
   Always Free Ampere A1 or AMD micro, Ubuntu. Do **not** add an ingress rule
   for 8788. Keep only what SSH needs (see "Close the public port").
4. **Tailscale on the Mac.** Install it from tailscale.com (or the Mac App Store)
   and sign in. Turn on **MagicDNS** in the admin console if it is not on.
5. **Tailscale on the VM.** Over SSH. Replace `noble` with your release
   (`lsb_release -cs`). These are the steps from Tailscale's Ubuntu install page;
   if a URL fails, check the current docs at tailscale.com/kb.
   ```bash
   curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
   curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list
   sudo apt-get update && sudo apt-get install -y tailscale
   sudo tailscale up --hostname=brain2-capture
   ```
   `tailscale up` prints a login URL. Open it on your Mac and approve the node.
6. **Find the address and name.**
   ```bash
   tailscale ip -4        # 100.x.y.z  → BRAIN2_CAPTURE_BIND
   tailscale status       # lists the node and its short name
   ```
   The full MagicDNS name looks like `brain2-capture.<your-tailnet>.ts.net`
   (shown in the admin console). The short name `brain2-capture` also works from
   your Mac when MagicDNS is on.
7. **Disable key expiry for the VM node.** In the Tailscale admin console, open
   Machines, the menu on `brain2-capture`, and choose to disable key expiry. Nodes
   expire by default, and an expired VM silently drops off the tailnet. Check the
   current default period in the admin console. Do the same for the Mac if you do
   not want to re-auth it.
8. **Install Node 20+ on the VM,** then:
   ```bash
   sudo useradd -r -s /usr/sbin/nologin brain2
   sudo mkdir -p /opt/brain2-capture /var/lib/brain2-capture
   sudo chown brain2 /var/lib/brain2-capture
   # copy these four from scripts/ into /opt/brain2-capture:
   #   capture-box.mjs  sealed-box.mjs  capture-filter.mjs  capture-upload.mjs
   sudo cp deploy/oracle/capture.env.example /etc/brain2-capture.env   # fill it in
   sudo chmod 600 /etc/brain2-capture.env
   ```
   In `/etc/brain2-capture.env` set `BRAIN2_CAPTURE_BIND` to the 100.x address,
   `BRAIN2_CAPTURE_CHAT_IDS` to your chat id (**required**; the file says how to find
   it), plus the token, public key and Healthchecks URL.
   ```bash
   sudo cp deploy/oracle/brain2-capture.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now brain2-capture
   ```
   The unit starts after `tailscaled` and waits up to about two minutes for the
   tailnet address before launching the box.
9. **Close the public port** (next section).
10. **On your Mac,** in `.env.local`:
    `BRAIN2_CAPTURE_BOX_URL=http://brain2-capture:8788` (or the full `.ts.net` name),
    `BRAIN2_CAPTURE_TOKEN=<same>`, plus `BRAIN2_TELEGRAM_BOT_TOKEN`. Then `npm run phone:hub`.
    Plain `http` is fine here: the tailnet encrypts the hop and the body is sealed.
11. **Test:** from the Mac, `curl http://brain2-capture:8788/health` →
    `{"ok":true,...}`. Quit the hub, text BIM, check `queued` rises, restart the
    hub, expect the reply and the Inbox item.

## Tailscale

_Last mapped: 2026-10-20_

### Close the public port

Three layers, so one mistake does not expose the box:

1. **The box itself** binds only `BRAIN2_CAPTURE_BIND` (the 100.x address). It is not
   listening on the public interface.
2. **Oracle VCN security list.** Make sure there is no ingress rule for TCP 8788.
   Remove it if you added one earlier. Menu names change, so check the current
   Oracle console for where the instance's security list or network security
   group lives.
3. **Ubuntu ufw.** Allow the tailnet interface only, keep SSH:
   ```bash
   sudo ufw allow OpenSSH            # or: sudo ufw allow 22/tcp
   sudo ufw allow in on tailscale0 to any port 8788 proto tcp
   sudo ufw enable
   sudo ufw status verbose
   ```
   Oracle's Ubuntu images often come with their own iptables rules. Run
   `sudo iptables -S` and read it before you trust ufw alone. Do not enable ufw
   until SSH is allowed, or you lock yourself out.

**SSH:** keep it reachable. Either leave port 22 open in the VCN and rely on key
auth with password login off, or restrict it to your home IP. Do not close it
until you have confirmed another way in (the Oracle console's own recovery access,
if your instance offers it, or Tailscale SSH via `sudo tailscale up --ssh`). Check
the current docs for both before relying on them.

Verify from outside the tailnet (a phone on mobile data, no VPN):
`curl -m 5 http://<vm-public-ip>:8788/health` must time out or be refused.

### Tailnet ACL

By default a tailnet allows every device you own to reach every other. If you add
more devices later, tighten it in the admin console's access controls: allow only
the Mac to reach `brain2-capture` on port 8788, using a tag or the user. The
bearer token still applies either way. Check the current Tailscale ACL docs for
syntax; do not paste a policy from memory.

### What Tailscale does and does not protect

- **Does:** removes the public attack surface, encrypts the Mac-to-VM hop, and ties
  access to your Tailscale identity.
- **Does not:** protect the bot token on the VM, hide the box from Oracle, or make
  Telegram private. Sealing is what keeps Oracle out of your texts. Tailscale is
  only the door.
- **Adds a dependency:** your Tailscale account and its coordination service. If
  your login account is taken over, an attacker could add a node. Use 2FA there.

### If Tailscale is down

- **Capture keeps working** while the VM has internet: the box polls Telegram
  outbound and pings Healthchecks outbound. Neither uses the tailnet.
- **The Mac cannot drain,** so the queue grows and replies are late. Nothing is lost.
  Fix: reconnect Tailscale on the Mac, then the hub catches up.
- **If `tailscaled` is down on the VM** at boot, the unit waits then fails and
  retries. The box does not start, Healthchecks pings stop, and you get the alert.
  Telegram holds undelivered bot updates only for a limited time (about a day;
  check Telegram's docs), so act on the alert. SSH in, run
  `sudo systemctl status tailscaled`, `sudo tailscale up`, then
  `sudo systemctl restart brain2-capture`.
- **If the node was removed or the key expired,** the 100.x address may change.
  Re-run `tailscale up`, `tailscale ip -4`, update `BRAIN2_CAPTURE_BIND` and restart.
  Re-check `BRAIN2_CAPTURE_BOX_URL` on the Mac if you changed the name.

## Down alerts

The VM pings Healthchecks every minute (`/fail` when polling errors or stalls
over 90 s). Pings are outbound, so the closed port and Tailscale change nothing
here. If pings stop (VM dead, network gone, process crashed) Healthchecks
messages you on Telegram. It sees only "alive"; no content.
Not covered: your Mac's drain being off. The queue grows (cap 50 MB, then the
box reports `/fail`), and nothing is lost for as long as the VM lives.

## Go-live checklist

_Last mapped: 2026-10-20_

- [ ] Private key backed up in your password manager.
- [ ] `BRAIN2_CAPTURE_CHAT_IDS` set to your chat id; a text from another account is not queued.
- [ ] `BRAIN2_CAPTURE_BIND` is the VM's 100.x address; `ss -ltn` on the VM shows 8788 only there.
- [ ] No VCN ingress rule for 8788; ufw allows 8788 only on `tailscale0`; SSH still works.
- [ ] Public-IP `curl` to 8788 from outside the tailnet times out.
- [ ] Key expiry disabled for the VM node.
- [ ] Mac `curl http://brain2-capture:8788/health` returns ok.
- [ ] Desktop Message ingest is **off**; `npm run phone:hub` is running.
- [ ] Text BIM with the hub stopped, then start it: reply and Inbox item arrive.
- [ ] Stop the service on purpose; the Healthchecks Telegram alert arrives. Start it again.
- [ ] Reboot the VM once; the box comes back by itself (tailnet wait works).

## Rollback

_Last mapped: 2026-10-20_

1. On the VM: `sudo systemctl disable --now brain2-capture`.
2. In BotFather, revoke the bot token and issue a new one. The old token is dead
   everywhere, including the VM.
3. In the Tailscale admin console, delete the `brain2-capture` node (and remove
   the VM's Tailscale: `sudo tailscale down`, `sudo apt-get remove tailscale`).
4. Put the new token in the Mac's `.env.local`, unset `BRAIN2_CAPTURE_BOX_URL`, and
   turn Message ingest back on in the desktop app.
5. Anything left in `/var/lib/brain2-capture` is sealed. Delete it, or drain it
   first with the Mac if you still want those texts.

## Open items

- **Planned:** a `phone:hub` heartbeat so a dead drain also alerts you.
- **Planned:** have the drain skip or mark replies for texts older than a set age.
- **Planned:** nightly off-box backup of `data/` on the Mac.
- Moving to your own device: run the same three files on a Pi; nothing else changes.
