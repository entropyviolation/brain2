/**
 * scripts/phone-hub-polyfill.mjs — Browser globals so Zustand persist can run in Node
 */
const store = new Map()

const localStorage = {
  getItem(key) {
    const value = store.get(String(key))
    return value === undefined ? null : value
  },
  setItem(key, value) {
    store.set(String(key), String(value))
  },
  removeItem(key) {
    store.delete(String(key))
  },
  clear() {
    store.clear()
  },
  key(index) {
    return [...store.keys()][index] ?? null
  },
  get length() {
    return store.size
  },
}

const listeners = new Map()

function addEventListener(type, fn) {
  const list = listeners.get(type) || []
  list.push(fn)
  listeners.set(type, list)
}

function removeEventListener(type, fn) {
  const list = listeners.get(type)
  if (!list) return
  listeners.set(
    type,
    list.filter((row) => row !== fn),
  )
}

/**
 * The installed localStorage. phone-hub.mjs imports this file natively and
 * phone-hub.ts imports it again through jiti, so there are two module copies.
 * Fill and dump must use the one the stores see, not this copy's own map.
 */
function installedLocalStorage() {
  return globalThis.__cogsPhoneHubGlobals && globalThis.localStorage ? globalThis.localStorage : localStorage
}

export function installPhoneHubGlobals() {
  if (globalThis.__cogsPhoneHubGlobals) return installedLocalStorage()
  const windowLike = {
    localStorage,
    location: { protocol: "file:", hostname: "", href: "file:///", origin: "file://" },
    addEventListener,
    removeEventListener,
    dispatchEvent: () => false,
    matchMedia: () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
    navigator: { userAgent: "Brain2PhoneHub" },
    document: {
      addEventListener,
      removeEventListener,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      body: { appendChild() {} },
    },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
  }
  globalThis.localStorage = localStorage
  globalThis.window = windowLike
  globalThis.document = windowLike.document
  // Node 21+ has a getter-only navigator global; plain assignment throws.
  Object.defineProperty(globalThis, "navigator", { value: windowLike.navigator, configurable: true, writable: true })
  globalThis.self = windowLike
  globalThis.__cogsPhoneHubGlobals = true
  return localStorage
}

export function fillLocalStorage(items) {
  const ls = installPhoneHubGlobals()
  if (!items || typeof items !== "object") return
  for (const [name, value] of Object.entries(items)) {
    if (typeof name === "string" && typeof value === "string") ls.setItem(name, value)
  }
}

export function dumpLocalStorage() {
  const ls = installedLocalStorage()
  const items = {}
  for (let i = 0; i < ls.length; i += 1) {
    const name = ls.key(i)
    if (!name) continue
    const value = ls.getItem(name)
    if (typeof value === "string") items[name] = value
  }
  return items
}

installPhoneHubGlobals()
