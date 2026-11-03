# Share any HTML file with someone far away

Reference guide. Works for any `.html` file on a Mac. Gives you a link you can text to a friend in another state.

_Last mapped: 2026-10-30_

## The idea

Two things run on your Mac at the same time:

1. **A tiny web server.** It hands your HTML file to anyone who asks.
2. **A tunnel.** It gives your server a public `https://…` address on the internet.

Your friend opens the address. Their browser asks the tunnel, the tunnel asks your Mac, your Mac sends the file. When you stop either one, the link dies.

```
friend's browser ──▶ https://random.trycloudflare.com ──▶ tunnel ──▶ localhost:8000 ──▶ your file
```

## Do it once: install the tunnel tool

```bash
brew install cloudflared
```

Do not run `brew services start cloudflared`. You only want a temporary tunnel, not a background service.

## Fastest way: paste the path, run one command

### Step 1. Set your file path

Type `FILE=` and a space-free quote, then drag the file from Finder into the terminal. Terminal pastes the full path. Close the quote and press Return.

```bash
FILE="/Users/otherworld/Downloads/CHAOS Jewel Case.html"
```

Replace the path with yours. Keep the quotes. They make spaces in names safe.

### Step 2. Copy it into its own folder

Why: the server shares a whole folder. If you serve `~/Downloads`, your friend can browse everything in it. A fresh folder with only your file is safe.

```bash
SHARE_DIR="$(mktemp -d)" && cp "$FILE" "$SHARE_DIR/index.html" && echo "Sharing from: $SHARE_DIR"
```

The copy is named `index.html` so the link opens it directly, with no filename in the address.

### Step 3. Start the server (leave it running)

```bash
python3 -m http.server 8000 --directory "$SHARE_DIR"
```

Test it: open http://localhost:8000 on your Mac. You should see your page.

This terminal tab is now busy. Leave it alone.

### Step 4. Open a new terminal tab and start the tunnel

```bash
cloudflared tunnel --url http://localhost:8000
```

After a few seconds it prints a box with a line like:

```
https://random-words-here.trycloudflare.com
```

That is your link. Text it to your friend.

### Step 5. Check it from the outside

Open the link on your phone with **Wi-Fi turned off** (cell data only). If it loads, it works from anywhere. If it says the site can't be reached, wait 10 seconds and refresh. New tunnels take a moment.

### Step 6. Stop sharing

Press `Ctrl+C` in both terminal tabs. The link stops working at once.

## Even faster: one reusable command

Install this once. After that, sharing any file is `share-html "path"`.

### Install

```bash
mkdir -p ~/bin && cat > ~/bin/share-html <<'EOF'
#!/usr/bin/env bash
# Usage: share-html "/path/to/file.html" [port]
set -e
FILE="$1"
PORT="${2:-8000}"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: share-html \"/path/to/file.html\" [port]"
  exit 1
fi
command -v cloudflared >/dev/null || { echo "Run: brew install cloudflared"; exit 1; }

DIR="$(mktemp -d)"
cp "$FILE" "$DIR/index.html"

python3 -m http.server "$PORT" --directory "$DIR" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; rm -rf "$DIR"; echo "Stopped. Link is dead."' EXIT

sleep 1
echo "Look for the https://….trycloudflare.com line below. Ctrl+C to stop."
cloudflared tunnel --url "http://localhost:$PORT"
EOF
chmod +x ~/bin/share-html
```

Make sure `~/bin` is on your PATH. If `share-html` says "command not found", run this once, then open a new terminal tab:

```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
```

### Use

```bash
share-html "/Users/otherworld/Downloads/CHAOS Jewel Case.html"
```

Drag a file from Finder onto the terminal to fill in the path. Press `Ctrl+C` to stop. The script stops the server and deletes its temp copy for you.

If port 8000 is taken ("Address already in use"), pick another:

```bash
share-html "/path/to/file.html" 8123
```

## Alternative: VS Code port forwarding

Use this if you would rather click than type, or you want a stable link tied to your GitHub account.

1. Start the server (Step 3 above).
2. In VS Code, open the **Ports** tab in the bottom panel. If it's missing, press `Cmd+Shift+P` and run **Ports: Focus on Ports View**.
3. Click **Forward a Port**, type `8000`, press Return. Sign in with GitHub or Microsoft if asked.
4. Right-click the port, then **Port Visibility**, then **Public**. If you skip this, only people logged into your GitHub account can open it.
5. Copy the forwarded `https://…devtunnels.ms` address and send it.

## When your HTML is more than one file

The steps above copy **one file**. That is enough if the HTML is self-contained (everything inlined, or loaded from public CDNs like Google Fonts or jsDelivr).

If the page loads local files (`./style.css`, `images/pic.png`, `app.js`), copy the whole project folder instead of one file:

```bash
SHARE_DIR="$(mktemp -d)" && cp -R "/path/to/project-folder/." "$SHARE_DIR/"
```

The main page must be called `index.html` inside that folder, or your friend must add the filename to the link: `https://…trycloudflare.com/mypage.html`.

Check that the folder holds nothing private (`.env`, keys, notes). Everything in it is public while the tunnel is up.

## How to tell if a file is self-contained

```bash
grep -oE '(src|href)="[^"]+' "/path/to/file.html" | sort -u | head -20
```

- Lines starting `https://` are public CDNs. Fine.
- Lines like `./thing.css` or `images/x.png` are local files. Use the whole-folder method.

## Safety

- The link is public. Anyone who has it can open it. Send it only to the person it is for.
- Quick tunnel links are random and change every run. Nothing about them is permanent.
- Only the folder you served is exposed. Not the rest of your Mac.
- Stop the tunnel when done.
- Your Mac must stay awake while sharing. Closing the lid or sleeping drops the link.

## Troubleshooting

| What you see | Fix |
| --- | --- |
| `command not found: cloudflared` | `brew install cloudflared` |
| `command not found: share-html` | Add `~/bin` to PATH (see above), open a new tab |
| `Address already in use` | Another server holds the port. Use a different one, e.g. `8123`, in both commands |
| Link shows an error page right away | Wait 10 seconds, refresh |
| Page loads but is blank or unstyled | It needs local files. Use the whole-folder method |
| Friend sees a "Not Found" | Your file isn't named `index.html` in the shared folder |
| Link worked, then died | Your Mac slept, or a terminal tab was closed. Start again. You get a new link |

## Cheat sheet

```bash
# one-time
brew install cloudflared

# every time (manual)
FILE="/path/to/file.html"
SHARE_DIR="$(mktemp -d)" && cp "$FILE" "$SHARE_DIR/index.html"
python3 -m http.server 8000 --directory "$SHARE_DIR"        # tab 1
cloudflared tunnel --url http://localhost:8000              # tab 2

# every time (with the share-html script)
share-html "/path/to/file.html"
```
