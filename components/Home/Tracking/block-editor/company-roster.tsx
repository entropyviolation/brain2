/**
 * components/Home/Tracking/company-roster.tsx — Who was on a Company block
 *
 * One list, one row per person: color, name, a Present | Talking switch, and ×.
 * The block's first person is marked **main** and has no ×, because removing the
 * primary pen is a repaint, not an edit. **+ Add someone** opens the people
 * picker under the list; it stays open so several people go in a row.
 *
 * Presence is `talkingPenIds` on the entry: omitted means everyone is present.
 */
"use client"

import { penColorDoubleClick } from "@/components/Home/Tracking/open-pen-settings"

export interface RosterPerson {
  id: string
  name: string
  color?: string
}

interface CompanyRosterProps {
  scopeId: string
  /** Main person first, then the extras. */
  people: RosterPerson[]
  talking: string[]
  onToggleTalking: (penId: string) => void
  onRemove: (penId: string) => void
  adding: boolean
  onToggleAdding: () => void
  /** The picker, shown under the list while `adding`. */
  children?: React.ReactNode
}

/** Present | Talking, one switch per person. */
function PresenceSwitch({ on, name, onChange }: { on: boolean; name: string; onChange: (talking: boolean) => void }) {
  return (
    <span className="trk-company-presence" role="group" aria-label={`${name}: ${on ? "talking with" : "present"}`}>
      <button
        type="button"
        data-no95=""
        aria-pressed={!on}
        title="Just there"
        onClick={() => on && onChange(false)}
      >
        Present
      </button>
      <button
        type="button"
        data-no95=""
        aria-pressed={on}
        title="You talked with them"
        onClick={() => !on && onChange(true)}
      >
        Talking
      </button>
    </span>
  )
}

export function CompanyRoster({
  scopeId,
  people,
  talking,
  onToggleTalking,
  onRemove,
  adding,
  onToggleAdding,
  children,
}: CompanyRosterProps) {
  return (
    <div className="trk-company-people" role="group" aria-label="People on this Company block">
      <ul className="trk-company-list">
        {people.map((person, index) => (
          <li key={person.id} className="trk-company-person">
            <span
              className="trk-company-name"
              title="Double-click to open pen settings"
              onDoubleClick={penColorDoubleClick(scopeId, person.id)}
            >
              <span className="trk-company-dot" style={{ background: person.color }} aria-hidden />
              {person.name}
              {index === 0 && people.length > 1 ? (
                <span className="trk-company-main" title="First person on the block">
                  main
                </span>
              ) : null}
            </span>
            <PresenceSwitch
              on={talking.includes(person.id)}
              name={person.name}
              onChange={() => onToggleTalking(person.id)}
            />
            {index === 0 ? (
              <span className="trk-company-x-gap" aria-hidden />
            ) : (
              <button
                type="button"
                data-no95=""
                className="trk-company-x"
                aria-label={`Remove ${person.name}`}
                title={`Remove ${person.name}`}
                onClick={() => onRemove(person.id)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" data-no95="" className="trk-company-add" aria-expanded={adding} onClick={onToggleAdding}>
        {adding ? "Done adding" : "+ Add someone"}
      </button>
      {adding ? children : null}
    </div>
  )
}
