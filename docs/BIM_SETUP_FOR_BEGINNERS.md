# BIM always-on: setup for beginners

_Last mapped: 2026-10-20_

No jargon. Do the parts in order. Each part says how you know it worked.
Why it is built this way: [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md).
Every secret and where it lives: [`BIM_CONNECTION_MAP.md`](BIM_CONNECTION_MAP.md).

## The idea, like you are five

Your Mac is a house. When the Mac is asleep, the house is closed, and BIM
(your Telegram helper) cannot answer the door.

So we rent a tiny always-open **mailbox** far away (the Oracle computer). People
drop letters in. Every letter is put in a **locked envelope** the moment it
arrives. Only you have the key, and the key never leaves your Mac. Oracle holds
envelopes it cannot open.

When your Mac wakes up, it picks up the envelopes, opens them with your key, and
files them in Brain2.

**Tailscale** is a private tunnel between your Mac and the mailbox. Nobody else
can walk down it.

**Healthchecks.io** is a friend who expects a "still here!" wave from the mailbox
every minute. If the waves stop, the friend texts you on Telegram.

## What is already done

- Your lock and key exist. Key: `~/.brain2/capture-private.key` (stays on your Mac).
- Your chat id is `8902429750`. The mailbox only keeps letters from that chat.
- A folder of ready-to-copy files is at `~/.brain2/vm-bundle/`. It has the mailbox
  program and a settings file with your secrets already filled in.
- Your Mac's `.env.local` already has the pickup password (`BRAIN2_CAPTURE_TOKEN`).

**Still to do:** back up the key (Part 1), Healthchecks (2), Tailscale (3),
Oracle (4), put the mailbox on Oracle (5), connect the Mac (6), test (7).

## Part 1: back up the key (5 minutes)

If you lose the key, every locked envelope in the mailbox becomes junk.

1. In Terminal run: `cat ~/.brain2/capture-private.key`
2. It prints one line of letters and numbers. Copy it.
3. Paste it into your password manager as a new note called "Brain2 capture key".
   No password manager? Write it in a note on paper and keep it somewhere safe.
   Do **not** put it in email, a chat, or a public place.
4. Never put this key on the Oracle computer.

You are done when you could rebuild the file from your saved copy.

## About "Paired chats" (Settings → Message ingest)

Pairing tells Brain2 which Telegram chats are allowed to talk to BIM.
Strangers get no reply.

- Open Settings → Message ingest. **Paired chats** lists chats BIM trusts.
- To add one: press **Generate pairing code**, then in Telegram send the bot
  `/start 123456` (your real code). Or if you texted the bot before and were
  refused, it appears under **Texted but not paired**: press **Pair**.
- The number shown for your chat is your chat id. Yours is `8902429750`. That
  number goes in `BRAIN2_CAPTURE_CHAT_IDS` on the mailbox. Done already.
- Brain2 pairing and the mailbox list are two separate locks. A chat needs to be
  on both to get through.

## Part 2: Healthchecks.io, the friend who waves (15 minutes)

You make **two** checks: one for the mailbox, one for your Mac picking up.

1. Go to https://healthchecks.io and press **Sign Up**. Use your email. Confirm it.
2. First connect Telegram so it can text you:
   - Top menu → **Integrations** → **Add Integration** → **Telegram** → **Add Integration**.
   - It shows a link to a Telegram bot called something like `@ChecksBot`. Open it
     in Telegram, press **Start**, and follow what it says. It says the chat is linked.
   - Back on the website, name it "My phone" and save.
3. Make the first check:
   - **Checks** → **Add Check**.
   - Name: `BIM mailbox (Oracle)`.
   - **Period**: 1 minute. **Grace Time**: 5 minutes. (It waits 5 minutes after a
     missed wave before bothering you.)
   - Save. At the top you will see a **ping URL** like
     `https://hc-ping.com/xxxxxxxx-xxxx-...`. Copy it.
   - On the check page, turn on the Telegram integration ("My phone").
4. Make the second check the same way: name `BIM Mac pickup`, Period 5 minutes,
   Grace 30 minutes (your Mac sleeps, so be gentle), Telegram on. Copy its URL too.
5. Put the URLs in:
   - Mailbox URL: open `~/.brain2/vm-bundle/brain2-capture.env` and put it after
     `BRAIN2_HEALTHCHECK_URL=`.
   - Mac URL: in `.env.local` add a line `BRAIN2_DRAIN_HEALTHCHECK_URL=<second url>`.

You are done when both checks show on the site as "New" (grey). They turn green
after the first wave.

## Part 3: Tailscale on your Mac (10 minutes)

1. Go to https://tailscale.com/download and install the Mac app (or
   `brew install --cask tailscale`).
2. Open it and press **Log in**. Sign in with Google, Microsoft, or Apple.
   Remember which one. You need the same account on the Oracle computer.
3. The Tailscale icon in the menu bar should say "Connected".
4. Open https://login.tailscale.com/admin/machines in the browser. You should see
   your Mac listed.

## Part 4: the Oracle computer (30–60 minutes, patience)

Oracle's website changes its screens often. If a button name below does not match,
look for the nearest one.

1. **Sign up** at https://www.oracle.com/cloud/free/ ("Start for free").
   - You need a credit or debit card. It is only to prove you are a person. The
     "Always Free" things do not charge.
   - **Home region**: pick one near you. You cannot change it later.
   - Verification can take a while. Wait for the "welcome" email.
2. **Make a key to log in.** In Terminal:
   ```bash
   ssh-keygen -t ed25519 -C "brain2-oracle"
   ```
   Press Enter for every question. Then `cat ~/.ssh/id_ed25519.pub` and copy the
   single line it prints. That is the **public** half; safe to share.
3. **Create the computer.** In the Oracle Cloud console: menu → **Compute** →
   **Instances** → **Create instance**.
   - Name: `brain2-capture`.
   - **Image**: Canonical **Ubuntu 24.04**. (The commands in these docs use 24.04.)
   - **Shape**: choose one marked **Always Free eligible**. The small AMD one
     (`VM.Standard.E2.1.Micro`) is enough for a mailbox.
   - **Networking**: leave defaults; make sure it gets a **public IPv4 address**.
   - **SSH keys**: choose "Paste public keys" and paste the line from step 2.
   - Press **Create**. After a minute it says RUNNING. Copy its **Public IP address**.
4. **Log in to it from your Mac:**
   ```bash
   ssh ubuntu@PUBLIC_IP
   ```
   (Replace `PUBLIC_IP`.) Say `yes` if it asks about authenticity. A prompt like
   `ubuntu@brain2-capture:~$` means you are inside the Oracle computer.
   If it just hangs, the Oracle network is blocking SSH: in the console open the
   instance's subnet → Security List and make sure TCP 22 is allowed. That is the
   only port we want open.

## Part 5: put the mailbox on Oracle (20 minutes)

1. **Tailscale on the Oracle computer** (you are inside it from step 4):
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --hostname=brain2-capture
   ```
   It prints a web link. Open it on your Mac, sign in with the **same** account as
   Part 3, and press **Connect**. Then on the Oracle computer:
   ```bash
   tailscale ip -4
   ```
   It prints something like `100.101.102.103`. Write it down. Call it `TAILIP`.
2. **Keep it from falling off.** In https://login.tailscale.com/admin/machines find
   `brain2-capture` → the `...` menu → **Disable key expiry**. (Otherwise it quietly
   leaves your tunnel after a few months.)
3. **Install Node** (the engine the mailbox runs on). Still on the Oracle computer:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node --version
   ```
   It should print `v20.something` or higher.
4. **Copy the files from your Mac.** Open a *second* Terminal tab on your Mac (not
   the Oracle one):
   ```bash
   scp -r ~/.brain2/vm-bundle ubuntu@PUBLIC_IP:~
   ```
5. **Set it up** (back in the Oracle tab):
   ```bash
   sudo useradd -r -s /usr/sbin/nologin brain2
   sudo mkdir -p /opt/brain2-capture /var/lib/brain2-capture
   sudo cp ~/vm-bundle/capture-box.mjs ~/vm-bundle/sealed-box.mjs ~/vm-bundle/capture-filter.mjs /opt/brain2-capture/
   sudo chown brain2 /var/lib/brain2-capture
   sudo cp ~/vm-bundle/brain2-capture.env /etc/brain2-capture.env
   sudo chmod 600 /etc/brain2-capture.env
   sudo nano /etc/brain2-capture.env
   ```
   In the editor, put your `TAILIP` after `BRAIN2_CAPTURE_BIND=` (and check the
   Healthchecks URL is there). Save with Ctrl+O, Enter, then exit with Ctrl+X.
6. **Start it and make it always start:**
   ```bash
   sudo cp ~/vm-bundle/brain2-capture.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now brain2-capture
   systemctl status brain2-capture
   ```
   You want green text saying `active (running)`. Press `q` to leave.
   If it says failed: `journalctl -u brain2-capture -n 30` shows why.
7. **Clean up the secrets copy** on the Oracle computer:
   ```bash
   rm -rf ~/vm-bundle
   ```
   And on your Mac, once everything works, delete the copy that has your bot token:
   `rm ~/.brain2/vm-bundle/brain2-capture.env`.
8. **Close the front door.** In the Oracle console: your instance's subnet →
   Security List. Keep only SSH (TCP 22) for the way in. Do **not** open 8788; the
   mailbox is only reachable through Tailscale. (Later you can close 22 too and
   use `ssh ubuntu@brain2-capture` through Tailscale.)

## Part 6: connect your Mac (5 minutes)

1. In `.env.local` (in the brain2 folder) uncomment/add:
   ```
   BRAIN2_CAPTURE_BOX_URL=http://brain2-capture:8788
   ```
   (`BRAIN2_CAPTURE_TOKEN` is already there. It must match the one on the VM; it does,
   they came from the same file.)
2. **Turn off the desktop app's own Telegram listening** (Settings → Message
   ingest → switch it off). Two listeners at once fight each other.
3. Start the pickup: `npm run phone:hub`.

## Part 7: test (10 minutes)

1. On your Mac: `curl http://brain2-capture:8788/health` → should show `"ok":true`.
2. Stop `phone:hub` (Ctrl+C in its Terminal).
3. Text BIM from your phone: `log: test from the mailbox`.
4. Run the health check again; `queued` should be at least 1. (This means the letter
   is sitting in the mailbox, locked.)
5. Start `npm run phone:hub`. BIM replies, and the line shows up in Brain2.
6. After a couple of minutes both Healthchecks checks turn green.
7. For the alarm test: on the Oracle computer `sudo systemctl stop brain2-capture`.
   After about 6 minutes your Telegram gets a message from Healthchecks. Then
   `sudo systemctl start brain2-capture`.

## When something goes wrong

| What you see | Try |
| --- | --- |
| `curl` to the box times out | Is Tailscale connected on the Mac? `tailscale status` on both machines. |
| `401` from the box | The pickup password differs. Compare `BRAIN2_CAPTURE_TOKEN` in `.env.local` and `/etc/brain2-capture.env`. |
| Box exits at start | `journalctl -u brain2-capture -n 30`. Usually `BRAIN2_CAPTURE_CHAT_IDS` or `BRAIN2_CAPTURE_BIND` is empty. |
| BIM never replies | Is `phone:hub` running? Is the desktop app's own listener off? |
| 409 errors | Two things are listening to Telegram. Stop the extras. |
| Lost the key | The locked envelopes are gone. Make a new key (`mv` the old file first), update the public key on the VM. New letters work. |
| Want to stop everything | `sudo systemctl disable --now brain2-capture`, revoke the bot token in Telegram's @BotFather, remove the node from the Tailscale admin page. |
