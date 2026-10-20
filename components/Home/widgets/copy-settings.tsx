/**
 * components/Home/widgets/copy-settings.tsx — The gear: one copy's own settings
 *
 * Opened from the gear in a widget's detail. Everything here saves to that
 * copy alone, so two Points copies can show different periods. The panel is
 * built from the kind's manifest (`lib/widgets/kinds.ts`): the kind's own
 * fields first (plus a custom panel for Countdown and Language study), then
 * the face (title, lamp, footer, size), the day it reads, and the copy itself
 * (guide, hide, remove). Every setting changes what the face or detail shows.
 */
"use client"

import { useState, type ReactNode } from "react"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { dashSizeOf, milledSizeOf } from "@/lib/widgets/dashboard"
import { sizeLabel, widgetKind } from "@/lib/widgets/kinds"
import { WIDGET_LAMPS, type WidgetCopy, type WidgetDaySource, type WidgetLamp, type WidgetSettingField } from "@/lib/widgets/types"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"

export const LAMP_LABEL: Record<WidgetLamp, string> = {
  phosphor: "Phosphor",
  amber: "Amber",
  blue: "Prius blue",
  red: "Night red",
  white: "Cold white",
}

const DAY_SOURCE_LABEL: Record<WidgetDaySource, string> = {
  dashboard: "Same as the dashboard",
  clock: "Always the wall clock",
  viewed: "Always the day you are viewing",
}

export function CopySettingsPanel({
  copyId,
  custom,
  onRemoved,
  onShowGuide,
  removeNote,
}: {
  copyId: string
  /** The kind's own panel (Countdown, Language study), drawn above the shared fields. */
  custom?: ReactNode
  onRemoved?: () => void
  onShowGuide?: () => void
  /** What else Remove deletes, said before it happens. */
  removeNote?: string
}) {
  const copy = useDashboardStore((s) => s.copies.find((entry) => entry.id === copyId))
  const style = useDashboardStore((s) => s.style)
  const dash = useDashboardStore((s) => s.dash)
  const milled = useDashboardStore((s) => s.milled)
  const updateCopy = useDashboardStore((s) => s.updateCopy)
  const updateSettings = useDashboardStore((s) => s.updateCopySettings)
  const resizeCopy = useDashboardStore((s) => s.resizeCopy)
  const hideCopy = useDashboardStore((s) => s.hideCopy)
  const removeCopy = useDashboardStore((s) => s.removeCopy)
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!copy) return <p className="home-widget-note">This widget is no longer installed.</p>
  const kind = widgetKind(copy.kind)
  if (!kind) return null
  const size = style === "milled" ? milledSizeOf({ milled }, copy) : dashSizeOf({ dash }, copy)
  const sizes = style === "milled" ? (["auto", ...kind.sizes] as const) : kind.sizes

  return (
    <div className="vd-settings" data-testid="widget-copy-settings">
      {custom}
      {kind.settings.length > 0 ? (
        <section className="vd-settings-group" aria-label={`${kind.name} settings`}>
          <h4>{kind.name}</h4>
          {kind.settings.map((field) => (
            <SettingField
              key={field.key}
              field={field}
              copy={copy}
              onChange={(value) => updateSettings(copy.id, { [field.key]: value })}
            />
          ))}
        </section>
      ) : null}

      <section className="vd-settings-group" aria-label="Face">
        <h4>Face</h4>
        <label className="home-widget-field">
          Title
          <input
            value={copy.title}
            maxLength={40}
            placeholder={kind.name}
            onChange={(event) => updateCopy(copy.id, { title: event.target.value })}
          />
        </label>
        <p className="home-widget-note">Empty keeps the widget's own caption.</p>
        <fieldset className="home-widget-fieldset vd-lamps">
          <legend>Lamp</legend>
          {WIDGET_LAMPS.map((lamp) => (
            <label key={lamp} className="home-widget-choice vd-lamp-choice" data-lamp={lamp}>
              <input
                type="radio"
                name={`lamp-${copy.id}`}
                checked={copy.lamp === lamp}
                onChange={() => updateCopy(copy.id, { lamp })}
              />
              <span className="vd-lamp-swatch" aria-hidden="true" />
              {LAMP_LABEL[lamp]}
            </label>
          ))}
        </fieldset>
        <div className="vd-settings-switch">
          <CockpitSwitch
            checked={copy.showFoot}
            onCheckedChange={(on) => updateCopy(copy.id, { showFoot: on })}
            label="Footer line"
          />
        </div>
        <fieldset className="home-widget-fieldset">
          <legend>Size ({style === "milled" ? "Milled" : "Dash"})</legend>
          <div className="vd-size-keys">
            {sizes.map((option) => (
              <button
                key={option}
                type="button"
                className={size === option ? "home-review-key is-on" : "home-review-key"}
                aria-pressed={size === option}
                onClick={() => resizeCopy(copy.id, option)}
              >
                {option === "auto" ? "Original" : `${sizeLabel(option)} ${option}`}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="vd-settings-group" aria-label="Day">
        <h4>Day</h4>
        <fieldset className="home-widget-fieldset">
          <legend>Reads</legend>
          {(Object.keys(DAY_SOURCE_LABEL) as WidgetDaySource[]).map((source) => (
            <label key={source} className="home-widget-choice">
              <input
                type="radio"
                name={`day-${copy.id}`}
                checked={copy.daySource === source}
                onChange={() => updateCopy(copy.id, { daySource: source })}
              />
              {DAY_SOURCE_LABEL[source]}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="vd-settings-group" aria-label="This copy">
        <h4>This copy</h4>
        <div className="home-widget-actions">
          {kind.guide && onShowGuide ? (
            <button type="button" className="home-review-key" onClick={onShowGuide}>
              Show the guide
            </button>
          ) : null}
          <button type="button" className="home-review-key" onClick={() => hideCopy(copy.id)}>
            Hide from the dashboard
          </button>
          {confirmRemove ? null : (
            <button type="button" className="home-review-key" onClick={() => setConfirmRemove(true)}>
              Remove…
            </button>
          )}
        </div>
        {confirmRemove ? (
          <div className="vd-remove-confirm" role="alert">
            <p className="home-widget-note">
              Remove this {kind.name} copy and its settings? {removeNote ?? "Its data elsewhere in Brain2 stays."} You
              can install it again from the Widget gallery.
            </p>
            <div className="home-widget-actions">
              <button type="button" className="home-review-key" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="home-review-key"
                onClick={() => {
                  setConfirmRemove(false)
                  if (onRemoved) onRemoved()
                  else removeCopy(copy.id)
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}
        <p className="home-widget-note vd-copy-id">
          {kind.name} · {kind.installs === "once" ? "one copy" : kind.installs === "perKey" ? `one per ${kind.keyLabel?.toLowerCase() ?? "key"}` : "many copies"}
        </p>
      </section>
    </div>
  )
}

function SettingField({
  field,
  copy,
  onChange,
}: {
  field: WidgetSettingField
  copy: WidgetCopy
  onChange: (value: string | boolean) => void
}) {
  const value = copy.settings[field.key]
  if (field.type === "toggle") {
    return (
      <div className="vd-settings-switch">
        <CockpitSwitch
          checked={typeof value === "boolean" ? value : field.default}
          onCheckedChange={(on) => onChange(on)}
          label={field.label}
        />
        {field.help ? <p className="home-widget-note">{field.help}</p> : null}
      </div>
    )
  }
  if (field.type === "text") {
    return (
      <label className="home-widget-field">
        {field.label}
        <input
          value={typeof value === "string" ? value : field.default}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.help ? <span className="home-widget-optional">{field.help}</span> : null}
      </label>
    )
  }
  return (
    <fieldset className="home-widget-fieldset">
      <legend>{field.label}</legend>
      {field.options.map((option) => (
        <label key={option.value} className="home-widget-choice">
          <input
            type="radio"
            name={`${field.key}-${copy.id}`}
            checked={(typeof value === "string" ? value : field.default) === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
      {field.help ? <p className="home-widget-note">{field.help}</p> : null}
    </fieldset>
  )
}
