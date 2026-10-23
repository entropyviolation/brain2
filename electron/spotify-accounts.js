/**
 * electron/spotify-accounts.js — Spotify logins kept by the desktop app
 *
 * Settings → Spotify accounts. Official Web API, Authorization Code with PKCE,
 * so there is no client secret. The person registers their own Spotify app
 * (developer.spotify.com), adds the redirect URI below, and pastes its Client
 * ID. Login opens Spotify's own page in a window on an in-memory partition;
 * main catches the redirect, trades the code for tokens, and seals the refresh
 * token with `safeStorage` in `userData/spotify-accounts.json`.
 *
 * The renderer only gets the public view. Nothing here polls or fetches
 * listening data yet. Plan: docs/SPOTIFY_LISTENING.md.
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { safeStorageCipher } = require("./instagram-accounts")

const CHANNELS = {
  status: "cogs:spotify:status",
  list: "cogs:spotify:list",
  setClientId: "cogs:spotify:setClientId",
  login: "cogs:spotify:login",
  update: "cogs:spotify:update",
  remove: "cogs:spotify:remove",
  check: "cogs:spotify:check",
}

const FILE_NAME = "spotify-accounts.json"
// Spotify allows plain http only for loopback IP literals, never "localhost".
const REDIRECT_URI = "http://127.0.0.1:43821/callback"
const AUTH_URL = "https://accounts.spotify.com/authorize"
const TOKEN_URL = "https://accounts.spotify.com/api/token"
const ME_URL = "https://api.spotify.com/v1/me"
// Read-only listening scopes. Nothing that changes the library or playback.
const SCOPES = ["user-read-recently-played", "user-top-read", "user-read-currently-playing", "user-read-playback-state"]
const LOGIN_HOSTS = ["spotify.com", "scdn.co", "spotifycdn.com", "facebook.com", "google.com", "apple.com", "appleid.apple.com"]

function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function createPkce(random = crypto.randomBytes) {
  const verifier = base64url(random(48))
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest())
  const state = base64url(random(16))
  return { verifier, challenge, state }
}

function isPlausibleClientId(id) {
  return /^[0-9a-f]{32}$/i.test(String(id || "").trim())
}

function authorizeUrl({ clientId, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES.join(" "),
    state,
    show_dialog: "true",
  })
  return `${AUTH_URL}?${q.toString()}`
}

/** `{ code }`, `{ error }`, or null when the URL is not our redirect. */
function readRedirect(url, expectedState) {
  if (!String(url || "").startsWith(REDIRECT_URI)) return null
  const q = new URL(url).searchParams
  if (q.get("state") !== expectedState) return { error: "The login answer did not match this request." }
  if (q.get("error")) return { error: q.get("error") === "access_denied" ? "Spotify access was declined." : q.get("error") }
  const code = q.get("code")
  return code ? { code } : { error: "Spotify sent no code." }
}

function hostAllowed(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return LOGIN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

async function postToken(body, fetchImpl) {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (res.status !== 200 || !json || !json.access_token) {
    const why = json && (json.error_description || json.error)
    const err = new Error(why ? `Spotify refused the token request: ${why}` : `Spotify token request failed (HTTP ${res.status}).`)
    err.code = json && json.error
    throw err
  }
  return json
}

function exchangeCode({ clientId, code, verifier, fetchImpl = globalThis.fetch }) {
  return postToken(
    { grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: clientId, code_verifier: verifier },
    fetchImpl,
  )
}

function refreshAccess({ clientId, refreshToken, fetchImpl = globalThis.fetch }) {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId }, fetchImpl)
}

async function fetchMe(accessToken, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(ME_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status !== 200) {
    const err = new Error(
      res.status === 403
        ? "Spotify refused (HTTP 403). In development mode the app owner needs Premium, and this user must be on the app's user list."
        : `Spotify answered HTTP ${res.status} for the profile.`,
    )
    err.status = res.status
    throw err
  }
  return res.json()
}

function createSpotifyStore({ dir, cipher, now = () => new Date() }) {
  const file = path.join(dir, FILE_NAME)

  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
      return {
        version: 1,
        clientId: typeof parsed.clientId === "string" ? parsed.clientId : "",
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      }
    } catch {
      return { version: 1, clientId: "", accounts: [] }
    }
  }

  function write(data) {
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  function seal(text) {
    if (!cipher.available()) throw new Error("No OS keychain encryption on this computer, so Brain2 will not store a login.")
    return cipher.encrypt(String(text)).toString("base64")
  }

  function open(sealed) {
    if (!sealed || !cipher.available()) return null
    try {
      return cipher.decrypt(Buffer.from(sealed, "base64"))
    } catch {
      return null
    }
  }

  function publicView(a) {
    return {
      id: a.id,
      spotifyId: a.spotifyId,
      displayName: a.displayName || a.spotifyId,
      label: a.label || "",
      addedAt: a.addedAt,
      loggedInAt: a.loggedInAt,
      scopes: Array.isArray(a.scopes) ? a.scopes : [],
      hasSession: Boolean(a.secrets && a.secrets.refresh),
      lastCheck: a.lastCheck || null,
    }
  }

  return {
    file,
    clientId: () => read().clientId,
    setClientId(id) {
      const data = read()
      data.clientId = String(id || "").trim()
      write(data)
      return data.clientId
    },
    list: () => read().accounts.map(publicView),
    find(id) {
      const a = read().accounts.find((x) => x.id === id)
      return a ? publicView(a) : null
    },
    /** Same Spotify user id replaces its old token. */
    saveLogin({ me, tokens, label }) {
      if (!tokens || !tokens.refresh_token) throw new Error("Spotify sent no refresh token.")
      const sealed = seal(tokens.refresh_token)
      const data = read()
      const stamp = now().toISOString()
      let a = data.accounts.find((x) => x.spotifyId === String(me.id))
      if (!a) {
        a = { id: crypto.randomUUID(), spotifyId: String(me.id), addedAt: stamp, secrets: {} }
        data.accounts.push(a)
      }
      a.displayName = me.display_name || String(me.id)
      if (typeof label === "string") a.label = label.trim().slice(0, 60)
      a.loggedInAt = stamp
      a.scopes = String(tokens.scope || "").split(" ").filter(Boolean)
      a.secrets = { ...(a.secrets || {}), refresh: sealed }
      a.lastCheck = null
      write(data)
      return publicView(a)
    },
    /** Spotify may rotate the refresh token on refresh. */
    replaceRefresh(id, refreshToken) {
      const data = read()
      const a = data.accounts.find((x) => x.id === id)
      if (!a || !refreshToken) return
      a.secrets = { ...(a.secrets || {}), refresh: seal(refreshToken) }
      write(data)
    },
    update(id, patch) {
      const data = read()
      const a = data.accounts.find((x) => x.id === id)
      if (!a) return null
      if (patch && typeof patch.label === "string") a.label = patch.label.trim().slice(0, 60)
      if (patch && patch.lastCheck) a.lastCheck = patch.lastCheck
      write(data)
      return publicView(a)
    },
    remove(id) {
      const data = read()
      const next = data.accounts.filter((x) => x.id !== id)
      if (next.length === data.accounts.length) return false
      write({ ...data, accounts: next })
      return true
    },
    /** Main-process only. */
    refreshToken(id) {
      const a = read().accounts.find((x) => x.id === id)
      return a && a.secrets ? open(a.secrets.refresh) : null
    },
  }
}

/** Refresh the access token and read /me. Says whether the login still works. */
async function checkLogin({ store, account, fetchImpl = globalThis.fetch, now = () => new Date() }) {
  const at = now().toISOString()
  const refreshToken = store.refreshToken(account.id)
  if (!refreshToken) return { at, state: "no-session", note: "No saved login. Log in again." }
  const clientId = store.clientId()
  if (!clientId) return { at, state: "error", note: "No Client ID saved." }
  try {
    const tokens = await refreshAccess({ clientId, refreshToken, fetchImpl })
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) store.replaceRefresh(account.id, tokens.refresh_token)
    const me = await fetchMe(tokens.access_token, fetchImpl)
    if (String(me.id) !== String(account.spotifyId)) {
      return { at, state: "mismatch", note: "This login belongs to a different Spotify account." }
    }
    return { at, state: "ok", note: "Login works." }
  } catch (err) {
    if (err && err.code === "invalid_grant") {
      return { at, state: "expired", note: "Spotify no longer accepts this login. Log in again." }
    }
    return { at, state: "error", note: String(err && err.message ? err.message : err) }
  }
}

let loginInFlight = null

/** Opens Spotify's login and resolves with `{ code }`, `{ error }`, or null if closed. */
function openLoginWindow({ BrowserWindow, session, shell, parent, url, state }) {
  if (loginInFlight) {
    if (!loginInFlight.win.isDestroyed()) loginInFlight.win.focus()
    return loginInFlight.promise
  }
  const partition = `spotify-login-${crypto.randomUUID()}`
  const ses = session.fromPartition(partition, { cache: false })
  const win = new BrowserWindow({
    width: 480,
    height: 760,
    title: "Log into Spotify",
    parent: parent || undefined,
    autoHideMenuBar: true,
    webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  })
  const promise = new Promise((resolve) => {
    let done = false
    const finish = async (answer) => {
      if (done) return
      done = true
      try {
        await ses.clearStorageData()
      } catch {
        /* in-memory partition goes away with the window */
      }
      if (!win.isDestroyed()) win.close()
      loginInFlight = null
      resolve(answer)
    }
    const watch = (event, target) => {
      const answer = readRedirect(target, state)
      if (answer) {
        event.preventDefault()
        finish(answer)
        return
      }
      if (!hostAllowed(target)) {
        event.preventDefault()
        shell.openExternal(target)
      }
    }
    win.webContents.on("will-redirect", watch)
    win.webContents.on("will-navigate", watch)
    win.webContents.setWindowOpenHandler(({ url: opened }) => {
      if (/^https?:/i.test(opened)) shell.openExternal(opened)
      return { action: "deny" }
    })
    win.on("closed", () => finish(null))
    win.loadURL(url)
  })
  loginInFlight = { win, promise }
  return promise
}

function registerSpotifyAccountsIpc({ ipcMain, app, safeStorage, BrowserWindow, session, shell, getWindow }) {
  const cipher = safeStorageCipher(safeStorage)
  const store = createSpotifyStore({ dir: app.getPath("userData"), cipher })

  ipcMain.handle(CHANNELS.status, () => ({
    ok: true,
    encryption: cipher.available(),
    clientId: store.clientId(),
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
  }))
  ipcMain.handle(CHANNELS.list, () => ({ ok: true, accounts: store.list() }))
  ipcMain.handle(CHANNELS.setClientId, (_e, id) => {
    const trimmed = String(id || "").trim()
    if (trimmed && !isPlausibleClientId(trimmed)) return { ok: false, error: "A Client ID is 32 letters and digits." }
    return { ok: true, clientId: store.setClientId(trimmed) }
  })
  ipcMain.handle(CHANNELS.login, async (_e, req) => {
    if (!cipher.available()) {
      return { ok: false, error: "No OS keychain encryption on this computer, so Brain2 will not store a login." }
    }
    const clientId = store.clientId()
    if (!clientId) return { ok: false, error: "Save your Spotify app's Client ID first." }
    const pkce = createPkce()
    const answer = await openLoginWindow({
      BrowserWindow,
      session,
      shell,
      parent: getWindow && getWindow(),
      url: authorizeUrl({ clientId, challenge: pkce.challenge, state: pkce.state }),
      state: pkce.state,
    })
    if (!answer) return { ok: false, cancelled: true, error: "The login window closed before Spotify logged in." }
    if (answer.error) return { ok: false, error: answer.error }
    try {
      const tokens = await exchangeCode({ clientId, code: answer.code, verifier: pkce.verifier })
      const me = await fetchMe(tokens.access_token)
      return { ok: true, account: store.saveLogin({ me, tokens, label: req && req.label }) }
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) }
    }
  })
  ipcMain.handle(CHANNELS.update, (_e, id, patch) => {
    const account = store.update(String(id), { label: patch && patch.label })
    return account ? { ok: true, account } : { ok: false, error: "No such account." }
  })
  ipcMain.handle(CHANNELS.remove, (_e, id) => ({ ok: store.remove(String(id)) }))
  ipcMain.handle(CHANNELS.check, async (_e, id) => {
    const account = store.find(String(id))
    if (!account) return { ok: false, error: "No such account." }
    const check = await checkLogin({ store, account })
    return { ok: true, account: store.update(account.id, { lastCheck: check }), check }
  })

  return store
}

module.exports = {
  CHANNELS,
  FILE_NAME,
  REDIRECT_URI,
  SCOPES,
  createPkce,
  isPlausibleClientId,
  authorizeUrl,
  readRedirect,
  hostAllowed,
  exchangeCode,
  refreshAccess,
  createSpotifyStore,
  checkLogin,
  registerSpotifyAccountsIpc,
}
