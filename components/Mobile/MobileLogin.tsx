/**
 * components/Mobile/MobileLogin.tsx — Login gate for the mobile Home shell.
 *
 * Credentials are hardcoded for now (admin / admin). Auth state lives in
 * sessionStorage only and never mutates desktop data stores.
 */
"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { validateMobileCredentials, writeMobileSession } from "@/lib/mobile-auth"

type Props = {
  onLoggedIn: () => void
}

export function MobileLogin({ onLoggedIn }: Props) {
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!validateMobileCredentials(username, password)) {
      setError("Invalid username or password.")
      return
    }
    writeMobileSession(username.trim())
    setError(null)
    onLoggedIn()
  }

  return (
    <div className="cogs-mobile-login">
      <form className="cogs-mobile-login-card" onSubmit={handleSubmit}>
        <h1>COGS Mobile</h1>
        <p>Sign in to open the Home tab on this device.</p>

        <label htmlFor="cogs-mobile-username">Username</label>
        <input
          id="cogs-mobile-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label htmlFor="cogs-mobile-password">Password</label>
        <input
          id="cogs-mobile-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <p className="cogs-mobile-login-error">{error}</p> : null}

        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  )
}
