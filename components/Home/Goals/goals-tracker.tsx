/**
 * components/Home/Goals/goals-tracker.tsx — Objectives & Goals home tab
 *
 * Milled fascia: all-time Objectives (prioritizable), quantifiable Goals, and
 * the Direction report. Same language as the header and To Do. The title jewel also sits at photograph size on the desktop
 * under the window.
 *
 * At the room's 720px phone query, `GoalsPhone` mounts instead. The desktop
 * tree below stays the fascia.
 */
"use client"

import { orbFor } from "@/components/Icons"
import { useGoalsStore } from "@/lib/goals-store"
import { ObjectivesPanel } from "./ObjectivesPanel"
import { GoalsContainer } from "./GoalsContainer"
import { DirectionReport } from "./DirectionReport"
import { GolRose, GolStar } from "./goals-ornaments"
import { GoalsPhone } from "./goals-phone"
import { useGoalsPhone } from "./use-goals-phone"
import "./goals-chrome.css"

export function GoalsTracker() {
  const phone = useGoalsPhone()
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const activeObjectives = objectives.filter((o) => !o.archived).length

  if (phone) return <GoalsPhone />

  return (
    <div
      className="gol95"
      data-ui-name="Goals"
      data-ui-help="Objectives to prioritize, measurable goals, and a direction report."
      data-ui-docs="components/Home/Goals/README.md"
    >
      <div className="gol-window">
        <div className="gol-fascia">
          <span className="gol-fascia-sky" aria-hidden />
          <GolRose className="gol-fascia-rose" />
          <div className="gol-mark">
            <img src={orbFor("home-goals")} alt="" className="gol-title-orb" />
            <h2>Objectives & Goals</h2>
          </div>
          <p className="gol-mark-note">Directions, then the numbers that move them.</p>
        </div>

        <div className="gol-body">
          <ObjectivesPanel />
          <GoalsContainer />
          <DirectionReport />
        </div>

        <div className="gol-status">
          <GolStar className="gol-status-star" />
          <span>
            {activeObjectives} objective{activeObjectives === 1 ? "" : "s"} · {goals.length} goal
            {goals.length === 1 ? "" : "s"}
          </span>
          <GolStar className="gol-status-star" />
        </div>
      </div>

      <div className="gol-desk-plate" data-desk-plate="goals" aria-hidden="true">
        <img src={orbFor("home-goals")} alt="" draggable={false} />
      </div>
    </div>
  )
}
