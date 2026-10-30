/**
 * components/Home/Habits/habit-form/tracking-fill.tsx — Auto-fill from Tracking.
 *
 * Mounts only while the Tracking-tags source is on (`showTracking`). Tag
 * toggles, the link, and tag creation stay in `TaskForm`.
 */
"use client"

import { HabitTagCatalog } from "@/components/Home/Habits/habit-tag-catalog"
import type { PenField } from "@/lib/pen-fields"
import type { TrackTag } from "@/lib/time-tracking-store"
import { TaskType, type HabitTrackingLink, type HabitTrackingMode, type HabitTrackingUnit, type WeeklyTask } from "@/lib/types"
import { NativeSelect } from "@/components/ui/native-select"
import { TRACKING_MODES } from "./model"

export function HabitFormTrackingFill({
  showTracking,
  periodWord,
  trackingTags,
  link,
  toggleLinkTag,
  createTrackingTag,
  noteCatalogEdit,
  task,
  setLink,
  trackingNumberFields,
  linkedPenCount,
}: {
  showTracking: boolean
  periodWord: string
  trackingTags: readonly TrackTag[]
  link: HabitTrackingLink
  toggleLinkTag: (id: string) => void
  createTrackingTag: (name: string) => void
  noteCatalogEdit: (result: import("@/lib/catalog-tag").CatalogTagEdit) => void
  task: WeeklyTask
  setLink: (patch: Partial<HabitTrackingLink>) => void
  trackingNumberFields: PenField[]
  linkedPenCount: number
}) {
  if (!showTracking) return null
  return (
        <fieldset id="habit95-sec-fill" tabIndex={-1} className="habit95-group habit95-sec-fill">
          <legend>Auto-fill from Tracking</legend>
          <p className="habit95-hint">
            Pick tags from the Tracking tab. Every minute you paint with a pen carrying one of them counts toward this
            habit {periodWord} — no typing.
          </p>
          <p className="habit95-hint">
            These chips are those same Tracking tags. Picking one here counts its minutes. It does not change which
            single tag counts as a done task.
          </p>

          <HabitTagCatalog
            tags={trackingTags}
            groupLabel="Tracking tags, shared with Tags"
            newTagAriaLabel="New tracking tag"
            emptyHint="No tracking tags yet. Name one here and it shows up in Tracking too."
            pressedMark="minutes"
            pressed={(tag) => link.tagIds.includes(tag.id)}
            onToggle={(tag) => toggleLinkTag(tag.id)}
            onCreate={createTrackingTag}
            onEdited={noteCatalogEdit}
          />

          {link.tagIds.length > 0 && (
            <>
              {task.type === TaskType.BOOLEAN ? (
                <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
                  <div className="habit95-field">
                    <label htmlFor="tracking-threshold">Minutes needed to check it off</label>
                    <input
                      id="tracking-threshold"
                      className="habit95-input"
                      type="number"
                      min="0"
                      step="5"
                      value={link.threshold ?? ""}
                      onChange={(e) => setLink({ threshold: Number.parseFloat(e.target.value) || undefined })}
                      placeholder="any tracked time"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
                    <div className="habit95-field">
                      <label htmlFor="tracking-unit">Count tracked blocks as</label>
                      <NativeSelect
                        id="tracking-unit"
                        className="habit95-input"
                        value={link.fieldId ? `field:${link.fieldId}` : (link.unit ?? "minutes")}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value.startsWith("field:")) setLink({ fieldId: value.slice(6) })
                          else setLink({ unit: value as HabitTrackingUnit, fieldId: undefined })
                        }}
                      >
                        <optgroup label="Time">
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                        </optgroup>
                        {trackingNumberFields.length ? (
                          <optgroup label="Pen detail field">
                            {trackingNumberFields.map((field) => (
                              <option key={field.id} value={`field:${field.id}`}>
                                {field.name}
                                {field.unit ? ` (${field.unit})` : ""}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </NativeSelect>
                    </div>
                    <div className="habit95-field">
                      <label htmlFor="tracking-mode">Combine with manual entries</label>
                      <NativeSelect
                        id="tracking-mode"
                        className="habit95-input"
                        value={link.mode ?? "add"}
                        onChange={(e) => setLink({ mode: e.target.value as HabitTrackingMode })}
                      >
                        {TRACKING_MODES.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                  <p className="habit95-hint">{TRACKING_MODES.find((m) => m.value === (link.mode ?? "add"))?.desc}</p>
                  <p className="habit95-hint">
                    {link.fieldId
                      ? `Sums ${trackingNumberFields.find((f) => f.id === link.fieldId)?.name ?? "that field"} typed on each block with these tags — Reading · 12 pages puts 12 here.`
                      : trackingNumberFields.length
                        ? "Or pick a pen detail field, such as Pages read, to count what you typed on the block instead of its minutes."
                        : "Give a pen a number detail field in Tracking (pen settings → Detail fields), such as Pages read, to count that instead of minutes."}
                  </p>
                </>
              )}

              <p className="habit95-hint">
                {linkedPenCount === 0
                  ? "No pen carries these tags yet — tag one in Tracking → Edit pens or nothing will come through."
                  : `${linkedPenCount} pen${linkedPenCount === 1 ? "" : "s"} currently feed${
                      linkedPenCount === 1 ? "s" : ""
                    } this habit.`}
              </p>

              <label className="habit95-check">
                <input
                  type="checkbox"
                  checked={link.enabled !== false}
                  onChange={(e) => setLink({ enabled: e.target.checked })}
                />
                Auto-fill is on
              </label>
            </>
          )}
        </fieldset>
  )
}
