# Spotify listening

_Last mapped: 2026-10-23_

**Planned, partly built.** Brain2 will track what you listen to. Built so far: Settings → Imports → **Spotify accounts** (log into more than one account; refresh tokens sealed with the OS keychain). Nothing reads listening data yet.

Related: `components/Settings/README.md`, `electron/README.md` (`spotify-accounts.js`), `docs/INSTAGRAM_DATA_SOURCES.md` (the same login pattern for Instagram).

## Sources

| Source | What it gives | Limits | State |
|---|---|---|---|
| Web API, recently played (`/me/player/recently-played`) | Each play with its time | Only the last 50 plays, so it has to be read at least every few hours to miss nothing | Planned |
| Web API, currently playing | The track now, and how far in | A snapshot; needs polling | Planned |
| Web API, top tracks and artists | Rankings over about 4 weeks, 6 months, all time | No play counts | Planned |
| Extended streaming history (Account → Privacy settings) | Every play since the account began, with ms played, skips, platform | A request; Spotify says it can take up to 30 days | Planned import |

The plan: import the extended history once for the past, then read recently played on a schedule from the desktop main process for everything after. Plays are keyed by account, track URI and start time, so the two sources merge without double counting.

## Login (built)

_Last mapped: 2026-10-23_

- Official Web API, Authorization Code with PKCE. No client secret.
- You register your own Spotify app on developer.spotify.com, add the redirect URI `http://127.0.0.1:43821/callback`, and paste the Client ID. Spotify allows plain http only for loopback IP literals, so it is `127.0.0.1`, not `localhost`.
- Since February 2026, a development-mode app works only while its owner has Premium, and allows five users, each added under User Management. Spotify's `/me` no longer returns email, country or plan.
- **Log into Spotify** opens Spotify's own page in a window on an in-memory partition. Main catches the redirect (no local server listens), checks `state`, trades the code for tokens, reads `/me`, and seals the refresh token in `userData/spotify-accounts.json` (mode 600). The Client ID is not a secret and is stored plain.
- Scopes are read-only: `user-read-recently-played`, `user-top-read`, `user-read-currently-playing`, `user-read-playback-state`.
- The same Spotify user id logging in again replaces its token. **Check login** refreshes the access token (keeping a rotated refresh token) and reads `/me`.
- Without OS encryption Brain2 refuses to store a login. The renderer never gets a token. Web and iOS show "Logging in works in the desktop app only."
