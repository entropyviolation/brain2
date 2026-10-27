/**
 * components/friend-details/FriendDetailsReadouts.tsx — Bond tube panel
 *
 * Twenty glass tubes fill one per point inside the current level.
 * Points are a numeral and a willpower gem. The streak tube only appears
 * from day two, and its gas shifts as the streak grows.
 */
"use client"

import { GEM_IMAGES } from "@/lib/gems-manifest"
import type { BondProgress } from "@/lib/friend-stats"

const GEM = GEM_IMAGES[4] ? `/gems-removebackground/${GEM_IMAGES[4]}` : ""

function streakGas(streak: number): string {
  if (streak >= 14) return "is-xenon"
  if (streak >= 7) return "is-argon"
  return "is-neon"
}

export function FriendDetailsReadouts({
  bond,
  points,
  streak,
  teaser,
}: {
  bond: BondProgress
  points: number
  streak: number
  teaser: string
}) {
  return (
    <section className="friend-bond-panel" aria-label="Bond">
      <p className="friend-bond-panel-kicker">Bond Lv {bond.level}</p>
      <div className="friend-tube-row" role="img" aria-label={`${bond.into} of ${bond.need} toward the next level`}>
        {Array.from({ length: bond.need }, (_, index) => (
          <span key={index} className={`friend-capsule${index < bond.into ? " is-lit" : ""}`} />
        ))}
      </div>
      <p className="friend-points-numeral">
        {GEM ? <img src={GEM} alt="" className="friend-points-gem" /> : <span className="friend-points-gem is-fallback" aria-hidden="true" />}
        <span className="friend-nixie is-points">{points}</span>
        <span className="friend-points-caption">friend points</span>
      </p>
      {streak >= 2 ? (
        <p className={`friend-streak-tube ${streakGas(streak)}`}>
          <span className="friend-capsule is-lit" aria-hidden="true" />
          {streak}-day streak
        </p>
      ) : null}
      {teaser ? <p className="friend-unlock">{teaser}</p> : null}
    </section>
  )
}
