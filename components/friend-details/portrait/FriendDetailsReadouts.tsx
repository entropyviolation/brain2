/**
 * components/friend-details/portrait/FriendDetailsReadouts.tsx — Bond meter
 *
 * One meter: level, glass tubes, one willpower gem, streak from day two.
 * Met and worn sit under it, label left and value right.
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

function shortWhen(iso: string | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function FriendDetailsReadouts({
  bond,
  points,
  streak,
  teaser,
  wearCount,
  firstSeenAt,
}: {
  bond: BondProgress
  points: number
  streak: number
  teaser: string
  wearCount: number
  firstSeenAt?: string
}) {
  return (
    <section className="friend-meter" aria-label="Bond">
      <div className="friend-meter-row">
        <span className="friend-meter-level">Lv {bond.level}</span>
        <div className="friend-tube-row" role="img" aria-label={`${bond.into} of ${bond.need} toward the next level`}>
          {Array.from({ length: bond.need }, (_, index) => (
            <span key={index} className={`friend-capsule${index < bond.into ? " is-lit" : ""}`} />
          ))}
        </div>
        <p className="friend-points-numeral">
          {GEM ? <img src={GEM} alt="" className="friend-points-gem" /> : <span className="friend-points-gem is-fallback" aria-hidden="true" />}
          <span className="friend-nixie is-points">{points}</span>
        </p>
        {streak >= 2 ? (
          <p className={`friend-streak-tube ${streakGas(streak)}`}>
            <span className="friend-capsule is-lit" aria-hidden="true" />
            {streak}-day
          </p>
        ) : null}
      </div>
      <dl className="friend-captions">
        <div>
          <dt>Met</dt>
          <dd>{shortWhen(firstSeenAt)}</dd>
        </div>
        <div>
          <dt>Worn</dt>
          <dd>×{wearCount}</dd>
        </div>
        {teaser ? (
          <div>
            <dt>Next</dt>
            <dd>{teaser}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
