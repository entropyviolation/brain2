/**
 * components/Home/widgets/gallery/sample-faces.tsx — A kind's faces, in both styles
 *
 * Dash shows the kind's registered Dash face (`dash-face-registry.ts`) at
 * every size it draws, in the Dash style's `.dash-sample` cells, with
 * default settings and today's date. A kind with no Dash face yet, or a
 * face that fails outside a cell, falls back to the manifest's static
 * `gallery.preview`. Milled shows that static preview in
 * today's tile look.
 */
"use client"

import { Component, useState, type ReactNode } from "react"
import { defaultWidgetSettings, parseSize, sizeLabel } from "@/lib/widgets/kinds"
import type { DashboardStyle, WidgetKind } from "@/lib/widgets/types"
import { dashFaceFor } from "@/components/Home/widgets/dash-face-registry"

class FaceFallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function StaticSample({ kind, style }: { kind: WidgetKind; style: DashboardStyle }) {
  const { preview } = kind.gallery
  return (
    <div className="home-catalog-sample vdg-static" data-style={style} aria-hidden="true">
      <div className="home-catalog-sample-caption">
        <span className="home-widgets-lamp" data-on="true" />
        <span>{preview.caption}</span>
      </div>
      <div className="home-catalog-sample-crt">{preview.crt}</div>
      <div className="home-catalog-sample-foot">{preview.footer}</div>
    </div>
  )
}

export function SampleFaces({ kind, initialStyle }: { kind: WidgetKind; initialStyle: DashboardStyle }) {
  const [style, setStyle] = useState<DashboardStyle>(initialStyle)
  const Face = dashFaceFor(kind.id)
  const settings = defaultWidgetSettings(kind.id)
  const now = new Date()

  return (
    <section className="vdg-samples" data-style={style} aria-label="What the face looks like">
      <div className="vdg-sample-switch" role="group" aria-label="Style">
        {(["dash", "milled"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={style === option ? "home-review-key is-on" : "home-review-key"}
            aria-pressed={style === option}
            onClick={() => setStyle(option)}
          >
            {option === "dash" ? "Dash" : "Milled"}
          </button>
        ))}
      </div>
      {style === "dash" ? (
        <div className="dash-sample vdg-faces" data-style="dash">
          {kind.sizes.map((size) => {
            const [cols, rows] = parseSize(size)
            return (
              <figure key={size} className="vdg-face-sample" data-size={size} data-default={size === kind.defaultSize ? "true" : undefined}>
                <div
                  className="dash-sample-cell"
                  data-kind={kind.id}
                  data-size={size}
                  style={{ ["--cols" as string]: cols, ["--rows" as string]: rows }}
                  aria-hidden="true"
                >
                  {Face ? (
                    <FaceFallback fallback={<StaticSample kind={kind} style="dash" />}>
                      <Face
                        size={size}
                        currentDate={now}
                        settings={settings}
                        copy={{ id: `gallery-${kind.id}`, kind: kind.id, title: "", lamp: "phosphor", showFoot: true }}
                      />
                    </FaceFallback>
                  ) : (
                    <StaticSample kind={kind} style="dash" />
                  )}
                </div>
                <span className="dash-sample-size">
                  {sizeLabel(size)} · {size}
                  {size === kind.defaultSize ? " · default" : ""}
                </span>
              </figure>
            )
          })}
        </div>
      ) : (
        <div className="vdg-faces" data-style="milled">
          <figure className="vdg-face-sample">
            <StaticSample kind={kind} style="milled" />
            <figcaption>Today&apos;s look · {kind.milledSize}</figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}
