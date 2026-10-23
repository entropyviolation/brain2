/**
 * electron/instagram-accounts.js — Instagram logins kept by the desktop app
 *
 * Settings → Instagram accounts. The person logs in on Instagram's own page in
 * a separate window. Main copies the session cookies out of that window,
 * encrypts them with `safeStorage` (OS keychain), and writes them to
 * `userData/instagram-accounts.json`. The login window uses an in-memory
 * partition, so Chromium keeps no second copy on disk.
 *
 * The renderer only ever gets the public view (username, label, dates,
 * status). Cookies and an opted-in password stay in main. Nothing here runs
 * on its own: no lookups, no polling. Plan: docs/INSTAGRAM_DATA_SOURCES.md.
 */
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const CHANNELS = {
  status: "cogs:instagram-accounts:status",
  list: "cogs:instagram-accounts:list",
  login: "cogs:instagram-accounts:login",
  update: "cogs:instagram-accounts:update",
  remove: "cogs:instagram-accounts:remove",
  setPassword: "cogs:instagram-accounts:setPassword",
  check: "cogs:instagram-accounts:check",
}

const FILE_NAME = "instagram-accounts.json"
const LOGIN_URL = "https://www.instagram.com/accounts/login/"
// Same public web app id profiles.py sends for web_profile_info.
const WEB_APP_ID = "936619743392459"
// Cookies a later request needs. Anything else in the jar is dropped.
const KEEP_COOKIES = ["sessionid", "csrftoken", "ds_user_id", "mid", "ig_did", "datr", "rur"]
// Hosts the login window may navigate to (login, two-factor, checkpoint, Facebook login).
const LOGIN_HOSTS = ["instagram.com", "facebook.com", "fbcdn.net", "cdninstagram.com"]

function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
}

function hostAllowed(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return LOGIN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/**
 * Pick the session cookies out of an Electron cookie list.
 * Returns null until `sessionid` and `ds_user_id` are both there (logged in).
 */
function pickSessionCookies(list) {
  const jar = {}
  let expiresAt = null
  for (const c of Array.isArray(list) ? list : []) {
    if (!c || !KEEP_COOKIES.includes(c.name) || !c.value) continue
    const domain = String(c.domain || "")
    if (domain && !/(^|\.)instagram\.com$/i.test(domain.replace(/^\./, ""))) continue
    jar[c.name] = String(c.value)
    if (c.name === "sessionid" && typeof c.expirationDate === "number") {
      expiresAt = new Date(c.expirationDate * 1000).toISOString()
    }
  }
  if (!jar.sessionid || !jar.ds_user_id) return null
  return { cookies: jar, userId: String(jar.ds_user_id), expiresAt }
}

function cookieHeaderFrom(jar) {
  return Object.entries(jar || {})
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
}

/**
 * `cipher` is `{ available(): boolean, encrypt(text): Buffer, decrypt(Buffer): text }`.
 * When it is not available the store reads and lists, but refuses to save a secret.
 */
function createAccountStore({ dir, cipher, now = () => new Date() }) {
  const file = path.join(dir, FILE_NAME)

  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
      return { version: 1, accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [] }
    } catch {
      return { version: 1, accounts: [] }
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
      username: a.username,
      userId: a.userId,
      label: a.label || "",
      addedAt: a.addedAt,
      loggedInAt: a.loggedInAt,
      sessionExpiresAt: a.sessionExpiresAt || null,
      hasSession: Boolean(a.secrets && a.secrets.session),
      hasPassword: Boolean(a.secrets && a.secrets.password),
      lastCheck: a.lastCheck || null,
    }
  }

  function list() {
    return read().accounts.map(publicView)
  }

  /** Save a fresh login. The same Instagram user id replaces its old session. */
  function saveLogin({ username, label, picked, expectUserId }) {
    if (!picked || !picked.cookies || !picked.cookies.sessionid) throw new Error("No Instagram session to save.")
    const sealed = seal(JSON.stringify(picked.cookies))
    const data = read()
    const stamp = now().toISOString()
    let account = data.accounts.find((a) => a.userId === picked.userId)
    if (!account) {
      account = { id: crypto.randomUUID(), userId: picked.userId, addedAt: stamp, secrets: {} }
      data.accounts.push(account)
    }
    // The session cookie decides who logged in. A typed name only fills a row that has none, and
    // "Log in again" on one row must not stamp its name on a different account's session.
    const name = normalizeUsername(username)
    const nameFits = !expectUserId || String(expectUserId) === picked.userId
    if (name && nameFits && !account.username) account.username = name
    if (!account.username) account.username = `user ${picked.userId}`
    if (typeof label === "string") account.label = label.trim().slice(0, 60)
    account.loggedInAt = stamp
    account.sessionExpiresAt = picked.expiresAt || null
    account.secrets = { ...(account.secrets || {}), session: sealed }
    account.lastCheck = null
    write(data)
    return publicView(account)
  }

  function update(id, patch) {
    const data = read()
    const account = data.accounts.find((a) => a.id === id)
    if (!account) return null
    if (patch && typeof patch.label === "string") account.label = patch.label.trim().slice(0, 60)
    if (patch && typeof patch.username === "string" && normalizeUsername(patch.username)) {
      account.username = normalizeUsername(patch.username)
    }
    if (patch && patch.lastCheck) account.lastCheck = patch.lastCheck
    write(data)
    return publicView(account)
  }

  function remove(id) {
    const data = read()
    const next = data.accounts.filter((a) => a.id !== id)
    if (next.length === data.accounts.length) return false
    write({ ...data, accounts: next })
    return true
  }

  /** Opt-in. An empty value forgets the password. */
  function setPassword(id, password) {
    const data = read()
    const account = data.accounts.find((a) => a.id === id)
    if (!account) return null
    const secrets = { ...(account.secrets || {}) }
    if (password) secrets.password = seal(password)
    else delete secrets.password
    account.secrets = secrets
    write(data)
    return publicView(account)
  }

  /** Main-process only. Never send this to a renderer. */
  function sessionCookies(id) {
    const account = read().accounts.find((a) => a.id === id)
    const text = account && account.secrets ? open(account.secrets.session) : null
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  /** Main-process only. */
  function password(id) {
    const account = read().accounts.find((a) => a.id === id)
    return account && account.secrets ? open(account.secrets.password) : null
  }

  function find(id) {
    const account = read().accounts.find((a) => a.id === id)
    return account ? publicView(account) : null
  }

  return { file, list, find, saveLogin, update, remove, setPassword, sessionCookies, password }
}

/**
 * One web_profile_info request for the account's own username, sent with its
 * session. Says whether the session still works and is the account we think.
 */
async function checkSession({ account, cookies, fetchImpl = globalThis.fetch, now = () => new Date() }) {
  const at = now().toISOString()
  if (!cookies) return { at, state: "no-session", note: "No saved session. Log in again." }
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(account.username)}`
  let res
  try {
    res = await fetchImpl(url, {
      redirect: "manual",
      headers: {
        "x-ig-app-id": WEB_APP_ID,
        "X-CSRFToken": cookies.csrftoken || "",
        Cookie: cookieHeaderFrom(cookies),
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    })
  } catch (err) {
    return { at, state: "error", note: `Could not reach Instagram: ${err && err.message ? err.message : err}` }
  }
  const status = res.status
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const message = body && typeof body.message === "string" ? body.message : ""
  if (status === 401 || (status >= 300 && status < 400) || /login_required/i.test(message)) {
    return { at, state: "expired", note: "Instagram asked for a login. Log in again." }
  }
  if (/checkpoint|challenge/i.test(message) || (body && body.checkpoint_url)) {
    return { at, state: "checkpoint", note: "Instagram wants you to confirm it's you. Open Instagram, then log in again." }
  }
  if (status === 429 || status === 403) {
    return { at, state: "limited", note: `Instagram refused the request (HTTP ${status}). Wait before trying again.` }
  }
  const user = body && body.data && body.data.user
  if (status === 200 && user) {
    if (String(user.id) !== String(account.userId)) {
      return { at, state: "mismatch", note: `This session belongs to a different account than @${account.username}.` }
    }
    return { at, state: "ok", note: "Session works." }
  }
  if (status === 404 || (status === 200 && body && body.data && !user)) {
    return { at, state: "mismatch", note: `Instagram has no account @${account.username}. Fix the username.` }
  }
  return { at, state: "error", note: `Unexpected answer from Instagram (HTTP ${status}).` }
}

function safeStorageCipher(safeStorage) {
  return {
    available() {
      if (!safeStorage || !safeStorage.isEncryptionAvailable()) return false
      // On Linux without a keyring Chromium falls back to a hard-coded key.
      if (typeof safeStorage.getSelectedStorageBackend === "function") {
        try {
          if (safeStorage.getSelectedStorageBackend() === "basic_text") return false
        } catch {
          /* not Linux */
        }
      }
      return true
    },
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (buf) => safeStorage.decryptString(buf),
  }
}

let loginInFlight = null

/** Opens Instagram's login page and resolves with the picked cookies, or null if closed. */
function openLoginWindow({ BrowserWindow, session, shell, parent }) {
  if (loginInFlight) {
    if (!loginInFlight.win.isDestroyed()) loginInFlight.win.focus()
    return loginInFlight.promise
  }
  const partition = `ig-login-${crypto.randomUUID()}`
  const ses = session.fromPartition(partition, { cache: false })
  const win = new BrowserWindow({
    width: 460,
    height: 720,
    title: "Log into Instagram",
    parent: parent || undefined,
    autoHideMenuBar: true,
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  const promise = new Promise((resolve) => {
    let done = false
    const finish = async (picked) => {
      if (done) return
      done = true
      ses.cookies.removeListener("changed", onCookie)
      try {
        await ses.clearStorageData()
      } catch {
        /* in-memory partition goes away with the window anyway */
      }
      if (!win.isDestroyed()) win.close()
      loginInFlight = null
      resolve(picked)
    }
    const tryPick = async () => {
      try {
        const picked = pickSessionCookies(await ses.cookies.get({ domain: "instagram.com" }))
        if (picked) finish(picked)
      } catch {
        /* keep waiting */
      }
    }
    const onCookie = (_event, cookie, _cause, removed) => {
      if (!removed && cookie && (cookie.name === "sessionid" || cookie.name === "ds_user_id")) tryPick()
    }
    ses.cookies.on("changed", onCookie)
    win.on("closed", () => finish(null))
    win.webContents.on("will-navigate", (event, url) => {
      if (!hostAllowed(url)) {
        event.preventDefault()
        shell.openExternal(url)
      }
    })
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) shell.openExternal(url)
      return { action: "deny" }
    })
    win.loadURL(LOGIN_URL)
  })
  loginInFlight = { win, promise }
  return promise
}

function registerInstagramAccountsIpc({ ipcMain, app, safeStorage, BrowserWindow, session, shell, getWindow }) {
  const cipher = safeStorageCipher(safeStorage)
  const store = createAccountStore({ dir: app.getPath("userData"), cipher })

  ipcMain.handle(CHANNELS.status, () => ({ ok: true, encryption: cipher.available(), loggingIn: Boolean(loginInFlight) }))
  ipcMain.handle(CHANNELS.list, () => ({ ok: true, accounts: store.list() }))
  ipcMain.handle(CHANNELS.login, async (_e, req) => {
    if (!cipher.available()) {
      return { ok: false, error: "No OS keychain encryption on this computer, so Brain2 will not store a login." }
    }
    if (loginInFlight) {
      if (!loginInFlight.win.isDestroyed()) loginInFlight.win.focus()
      return { ok: false, error: "An Instagram login window is already open." }
    }
    const picked = await openLoginWindow({ BrowserWindow, session, shell, parent: getWindow && getWindow() })
    if (!picked) return { ok: false, cancelled: true, error: "The login window closed before Instagram logged in." }
    try {
      const account = store.saveLogin({
        username: req && req.username,
        label: req && req.label,
        expectUserId: req && req.expectUserId,
        picked,
      })
      return { ok: true, account }
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) }
    }
  })
  ipcMain.handle(CHANNELS.update, (_e, id, patch) => {
    const account = store.update(String(id), {
      label: patch && patch.label,
      username: patch && patch.username,
    })
    return account ? { ok: true, account } : { ok: false, error: "No such account." }
  })
  ipcMain.handle(CHANNELS.remove, (_e, id) => ({ ok: store.remove(String(id)) }))
  ipcMain.handle(CHANNELS.setPassword, (_e, id, pw) => {
    try {
      const account = store.setPassword(String(id), typeof pw === "string" ? pw : "")
      return account ? { ok: true, account } : { ok: false, error: "No such account." }
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) }
    }
  })
  ipcMain.handle(CHANNELS.check, async (_e, id) => {
    const account = store.find(String(id))
    if (!account) return { ok: false, error: "No such account." }
    const result = await checkSession({ account, cookies: store.sessionCookies(account.id) })
    const updated = store.update(account.id, { lastCheck: result })
    return { ok: true, account: updated, check: result }
  })

  return store
}

module.exports = {
  CHANNELS,
  FILE_NAME,
  normalizeUsername,
  hostAllowed,
  pickSessionCookies,
  cookieHeaderFrom,
  createAccountStore,
  checkSession,
  safeStorageCipher,
  registerInstagramAccountsIpc,
}
