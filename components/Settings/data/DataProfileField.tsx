/**
 * components/Settings/DataProfileField.tsx — Live vs Demo vault toggle
 *
 * Settings → Data. Demo is stock fiction (River Hale). Switching
 * reloads; Live keys are never rewritten by Demo.
 */
"use client"

import { useState } from "react"
import { Beaker, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { APP_NAV_KEYS, readStoredDate } from "@/lib/app-navigation"
import { fillDemoAround, type DemoFillResult } from "@/lib/demo-day-fill"
import {
  readDataProfile,
  resetDemoProfile,
  switchDataProfile,
  type DataProfile,
} from "@/lib/data-profile"

export function DataProfileField() {
  const [profile] = useState<DataProfile>(() => readDataProfile())
  const [filled, setFilled] = useState<DemoFillResult | null>(null)

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {profile === "demo" ? <Beaker className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
        <h3 className="font-semibold">Data profile</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Live is your real vault. Demo is a full fake person (River Hale — library desk, pottery studio)
        so you can explore features without touching your data. Switching reloads the app. Demo never
        writes Live keys.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Data profile">
        <Button
          type="button"
          variant={profile === "live" ? "default" : "outline"}
          className="gap-2"
          aria-pressed={profile === "live"}
          onClick={() => switchDataProfile("live")}
        >
          <UserRound className="h-4 w-4" />
          Live data
        </Button>
        <Button
          type="button"
          variant={profile === "demo" ? "default" : "outline"}
          className="gap-2"
          aria-pressed={profile === "demo"}
          onClick={() => switchDataProfile("demo")}
        >
          <Beaker className="h-4 w-4" />
          Demo data
        </Button>
      </div>
      {profile === "demo" ? (
        <Button type="button" variant="outline" size="sm" onClick={() => resetDemoProfile()}>
          Reset Demo vault
        </Button>
      ) : null}
      {profile === "demo" ? (
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="demo-fill-day"
            onClick={() => setFilled(fillDemoAround(readStoredDate(APP_NAV_KEYS.homeDate) ?? new Date()))}
          >
            Fill around the day I'm on
          </Button>
          <p className="text-xs text-muted-foreground">
            {filled
              ? `Added ${filled.days} days: ${filled.logs} log rows (spent, food, drink, events, thoughts, notes, switches), ${filled.tasks} items, ${filled.events} calendar events.`
              : "Adds invented past, present and future days: schedule, intake, spending, restaurants, places and links. Safe to press again."}
          </p>
        </div>
      ) : null}
    </div>
  )
}
