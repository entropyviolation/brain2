/**
 * components/Home/Goals/goals-tracker.tsx — Objectives & Goals home tab
 *
 * Top: all-time Objectives (clickable, prioritizable per period). Middle: the
 * quantifiable Goals container (filterable by period). Bottom: the Direction
 * report showing how recent actions served your objectives/goals.
 */
"use client"

import { ObjectivesPanel } from "./ObjectivesPanel"
import { GoalsContainer } from "./GoalsContainer"
import { DirectionReport } from "./DirectionReport"

export function GoalsTracker() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Objectives & Goals</h2>
        <p className="text-muted-foreground">
          Objectives are your all-time directions; goals are the measurable steps toward them.
        </p>
      </div>

      <ObjectivesPanel />

      <div className="border-t pt-6">
        <GoalsContainer />
      </div>

      <div className="border-t pt-6">
        <DirectionReport />
      </div>
    </div>
  )
}
