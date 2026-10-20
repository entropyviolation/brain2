/**
 * components/Home/widgets/gallery/gallery-about.tsx — The gallery's first page: how widgets work
 *
 * Explains kinds and installed copies, the three install rules, faces and
 * details, the gear, edit mode, and the two styles. Holds the two whole-
 * dashboard keys: Show every guide again, and Reset to my old layout
 * (`resetToLegacy`: the old strip's widgets, order, and Milled style; nothing
 * is uninstalled).
 */
"use client"

import { useState } from "react"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { allWidgetKinds, widgetKind } from "@/lib/widgets/kinds"

export function GalleryAbout({ onOpenKind }: { onOpenKind: (kind: string) => void }) {
  const copies = useDashboardStore((s) => s.copies)
  const unknown = useDashboardStore((s) => s.unknown)
  const style = useDashboardStore((s) => s.style)
  const legacy = useDashboardStore((s) => s.legacy)
  const resetToLegacy = useDashboardStore((s) => s.resetToLegacy)
  const markGuideSeen = useDashboardStore((s) => s.markGuideSeen)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState("")
  const kinds = allWidgetKinds()
  const showing = copies.filter((copy) => !copy.hidden).length
  const guided = copies.filter((copy) => widgetKind(copy.kind)?.guide)

  return (
    <article className="vdg-page vdg-about" data-view="about" aria-live="polite">
      <header className="vdg-head">
        <div className="vdg-head-text">
          <p className="vdg-group">Widget gallery</p>
          <h3 className="vdg-name">Widgets are little apps</h3>
          <p className="vdg-rule">
            <span className="vdg-chip">{kinds.length} kinds</span>
            <span className="vdg-chip">{copies.length} installed</span>
            <span className="vdg-chip">{showing} showing</span>
            <span className="vdg-chip">{style === "dash" ? "Dash style" : "Milled style"}</span>
          </p>
        </div>
      </header>
      {notice ? (
        <p className="vdg-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="vdg-section">
        <h4>Kinds and copies</h4>
        <p>
          Each page in this gallery is a <strong>kind</strong>: an app such as Points, Countdown, or Language study. Install
          puts an <strong>installed copy</strong> of it on your Visual dashboard. Every copy keeps its own settings, size,
          lamp, and place, so two copies of one kind can show different things.
        </p>
        <dl className="vdg-rules">
          <div>
            <dt>One copy</dt>
            <dd>
              Most kinds, like the{" "}
              <button type="button" className="vdg-link" onClick={() => onOpenKind("pet")}>
                Screen pet
              </button>
              . Install shows it; hiding keeps its settings.
            </dd>
          </div>
          <div>
            <dt>One per key</dt>
            <dd>
              <button type="button" className="vdg-link" onClick={() => onOpenKind("vocab")}>
                Language study
              </button>{" "}
              is one per language. Weather and Solar remainder are one per place.
            </dd>
          </div>
          <div>
            <dt>Many</dt>
            <dd>
              <button type="button" className="vdg-link" onClick={() => onOpenKind("daysuntil")}>
                Countdown
              </button>{" "}
              is one per date, as many as you like. Points can watch more than one period.
            </dd>
          </div>
        </dl>
      </section>

      <section className="vdg-section">
        <h4>Faces, details, and the gear</h4>
        <ol className="vdg-how">
          <li>A face is a glance, like a gauge on an old car dash: one reading and a short footer line.</li>
          <li>Click a face to open its detail. That is where the depth lives: charts, lists, quizzes, and keys.</li>
          <li>The gear in a detail opens that copy&apos;s own settings. Every setting changes what the face or detail shows.</li>
          <li>Some kinds bring a short guide the first time you open them. Skip is always there.</li>
        </ol>
      </section>

      <section className="vdg-section">
        <h4>Arranging</h4>
        <p>
          Turn on Edit beside Widgets on the date bar. While it is on, drag a face to move it and drag its corner to resize
          it, or use the arrow keys (Shift and an arrow resizes). Off, faces only open.
        </p>
      </section>

      <section className="vdg-section">
        <h4>Two styles</h4>
        <p>
          <strong>Dash</strong> draws small digital faces, like a 1980s dash meeting a 2011 hybrid display.{" "}
          <strong>Milled</strong> is the look you had before, kept as it was. Switch them in the Widgets menu. Each style
          keeps its own order and sizes.
        </p>
      </section>

      <section className="vdg-section">
        <h4>Your own widgets</h4>
        <p>
          Built-in kinds and future kinds you make share one manifest: a name, an install rule, sizes, settings, this
          gallery page, and an optional guide. Making your own is planned; the dashboard already keeps any kind it does
          not know{unknown.length > 0 ? ` (${unknown.length} kept safe now)` : ""} instead of dropping it.
        </p>
      </section>

      <section className="vdg-section vdg-reset">
        <h4>Start over</h4>
        <div className="home-widget-actions">
          <button
            type="button"
            className="home-review-key"
            disabled={guided.length === 0}
            onClick={() => {
              for (const copy of guided) markGuideSeen(copy.id, false)
              setNotice("Every guide will show again the next time you open its widget.")
            }}
          >
            Show the guide again
          </button>
          {confirmReset ? null : (
            <button
              type="button"
              className="home-review-key"
              disabled={!legacy}
              onClick={() => setConfirmReset(true)}
            >
              Reset to my old layout…
            </button>
          )}
        </div>
        {!legacy ? (
          <p className="home-widget-note">This vault started on the Visual dashboard, so there is no old layout to return to.</p>
        ) : null}
        {confirmReset ? (
          <div className="vd-remove-confirm" role="alert">
            <p className="home-widget-note">
              Put back the strip you had before the Visual dashboard: the same widgets showing, in the same order, in the
              Milled style at their original sizes. Widgets you had hidden are hidden again. Nothing is uninstalled and no
              settings are lost. Dash keeps its own order and sizes.
            </p>
            <div className="home-widget-actions">
              <button type="button" className="home-review-key" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="home-review-key is-on"
                onClick={() => {
                  resetToLegacy()
                  setConfirmReset(false)
                  setNotice("Your old layout is back, in the Milled style.")
                }}
              >
                Reset
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </article>
  )
}
