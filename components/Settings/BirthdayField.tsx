/**
 * components/Settings/BirthdayField.tsx — Birthday for the Star Lord Report
 *
 * Month and day open the birthday rite. The year is kept so the date input
 * can show it; the match itself ignores the year. February 29 is read on
 * March 1 in a common year (`lib/star-lord.ts`).
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useUserSettingsStore } from "@/lib/user-settings-store"

export function BirthdayField() {
  const birthday = useUserSettingsStore((s) => s.birthday)
  const setBirthday = useUserSettingsStore((s) => s.setBirthday)
  const value = /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : ""

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4" data-ui-name="Birthday">
      <div>
        <h3 className="font-semibold">Birthday</h3>
        <p className="text-sm text-muted-foreground">
          The Star Lord Report opens on this day, and on each new moon and full moon. A February 29 birthday is
          read on March 1 in a year without that day.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="birthday-date" className="text-xs text-muted-foreground">
            Date
          </Label>
          <Input
            id="birthday-date"
            type="date"
            value={value}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>
        {birthday ? (
          <Button type="button" variant="outline" onClick={() => setBirthday("")}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
