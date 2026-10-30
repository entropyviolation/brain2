/**
 * components/friend-details/FriendDetailsKeepsakes.tsx — Inventory of earned marks
 *
 * Every badge is the same cell. Earned cells show the cameo. The rest stay
 * outlines. The longer hint appears only for the selected cell.
 */
"use client"

import { useEffect, useState } from "react"
import { friendBadges, type FriendBadge } from "@/lib/friend-stats"
import type { FriendMission } from "@/lib/friend-mission"

const SEEN_KEY = "brain2-friend-badges"

const HINT: Record<FriendBadge["id"], string> = {
  "first-mission": "A mission has been offered.",
  "first-step": "Accepted as only the first step.",
  "streak-3": "Finished on three days in a row.",
  "worn-10": "Worn ten times.",
  "before-noon": "A mission finished before noon.",
  "bond-5": "Bond reaches level 5.",
  "streak-7": "Finished on seven days in a row.",
  "every-tone": "Each tone has been chosen once.",
  "whim-done": "A whim was finished.",
}

export function FriendDetailsKeepsakes({
  missions,
  wearCount,
  points,
  tonesTried,
  now,
}: {
  missions: FriendMission[]
  wearCount: number
  points: number
  tonesTried: number
  now: Date
}) {
  const badges = friendBadges(missions, wearCount, now, { points, tonesTried })
  const earnedKey = badges
    .filter((badge) => badge.earned)
    .map((badge) => badge.id)
    .join(",")
  const [flock, setFlock] = useState<string[]>([])
  const [picked, setPicked] = useState<FriendBadge["id"] | null>(null)

  useEffect(() => {
    const earned = earnedKey ? earnedKey.split(",") : []
    let seen: string[] = []
    try {
      seen = JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]") as string[]
    } catch {
      seen = []
    }
    const fresh = earned.filter((id) => !seen.includes(id))
    if (fresh.length === 0) return
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (motion) setFlock(fresh)
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, ...earned])]))
      setFlock([])
    }, motion ? 900 : 0)
    return () => window.clearTimeout(timer)
  }, [earnedKey])

  const hint = picked ? HINT[picked] : ""

  return (
    <section className="friend-keeps" aria-label="Keepsakes">
      <ul>
        {badges.map((badge) => (
          <li key={badge.id} className={flock.includes(badge.id) ? "is-flock" : ""}>
            <button
              type="button"
              data-no95=""
              className={badge.earned ? "is-earned" : "is-trace"}
              aria-pressed={picked === badge.id}
              onClick={() => setPicked((current) => (current === badge.id ? null : badge.id))}
            >
              <span className="friend-cameo" aria-hidden="true" />
              <span className="friend-keeps-name">{badge.label}</span>
              <span className="friend-cameo-progress">
                {badge.progress}/{badge.goal}
                <span className="friend-cameo-tube" style={{ ["--fill" as string]: String(badge.goal ? badge.progress / badge.goal : 0) }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hint ? <p className="friend-keeps-hint">{hint}</p> : null}
    </section>
  )
}
