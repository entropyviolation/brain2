/**
 * lib/mobile-auth.ts — Simple session gate for the mobile Home shell.
 *
 * Hardcoded local credentials for now (admin / admin). Session is stored in
 * sessionStorage so closing the tab/app requires login again; never touches
 * desktop localStorage keys or app data stores.
 */

export const MOBILE_AUTH_USER = "admin"
export const MOBILE_AUTH_PASSWORD = "admin"

const SESSION_KEY = "cogs-mobile-auth-session"

export type MobileAuthSession = {
  username: string
  loggedInAt: string
}

export function validateMobileCredentials(username: string, password: string): boolean {
  return username.trim() === MOBILE_AUTH_USER && password === MOBILE_AUTH_PASSWORD
}

export function readMobileSession(): MobileAuthSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MobileAuthSession
    if (!parsed?.username || parsed.username !== MOBILE_AUTH_USER) return null
    return parsed
  } catch {
    return null
  }
}

export function writeMobileSession(username: string): MobileAuthSession {
  const session: MobileAuthSession = {
    username,
    loggedInAt: new Date().toISOString(),
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearMobileSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
