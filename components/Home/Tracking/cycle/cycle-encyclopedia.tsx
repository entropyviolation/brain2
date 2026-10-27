/**
 * components/Home/Tracking/cycle-encyclopedia.tsx — cycle reference page
 *
 * Presentational library under the short sections. Chapters, entries, herbs,
 * and citations arrive as props. Empty chapters are omitted. `tone="tcm"`
 * keeps the paper page and the five-phases plate. `tone="clinical"` is a
 * cool sans reference and does not render that plate. Cycle detail mounts
 * this behind Extra detail.
 */
"use client"

import { useEffect, useId, useRef, useState, type ReactElement } from "react"
import fivePhases from "./cycle-figures/five-phases.png"
import { FindText, useCycleFindRestamp } from "./cycle-reading-find"
import "./cycle-encyclopedia.css"

export type EncyclopediaHerb = {
  name: string
  pinyin: string
  chinese: string
  traditionalRole: string
  sourceId: string
}

export type EncyclopediaEntry = {
  id: string
  title: string
  paragraphs: readonly string[]
  herbs?: readonly EncyclopediaHerb[]
  sourceIds: readonly string[]
}

export type EncyclopediaChapter = {
  id: string
  title: string
  entries: readonly EncyclopediaEntry[]
}

export type EncyclopediaSource = {
  id: string
  citation: string
}

type EncyclopediaView = ReactElement

function assetSrc(asset: { src: string } | string): string {
  return typeof asset === "string" ? asset : asset.src
}

function citedSources(
  ids: readonly string[],
  byId: ReadonlyMap<string, EncyclopediaSource>,
): EncyclopediaSource[] {
  const cited: EncyclopediaSource[] = []
  for (const id of ids) {
    const source = byId.get(id)
    if (source) cited.push(source)
  }
  return cited
}

function scrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null
  while (current) {
    const { overflowY } = getComputedStyle(current)
    if (overflowY === "auto" || overflowY === "scroll") return current
    current = current.parentElement
  }
  return null
}

export function CycleEncyclopedia({
  chapters,
  sources,
  lensLabel,
  tone,
}: {
  chapters: readonly EncyclopediaChapter[]
  sources: readonly EncyclopediaSource[]
  lensLabel: string
  tone: "clinical" | "tcm"
}): EncyclopediaView {
  const scope = useId().replace(/:/g, "")
  const visibleChapters = chapters.filter((chapter) => chapter.entries.length > 0)
  const chapterKey = visibleChapters.map((chapter) => chapter.id).join("\0")
  const [chosenId, setChosenId] = useState<string | null>(null)
  const activeId = visibleChapters.some((chapter) => chapter.id === chosenId)
    ? chosenId
    : (visibleChapters[0]?.id ?? null)
  const rootRef = useRef<HTMLElement>(null)
  useCycleFindRestamp()

  const byId = new Map(sources.map((source) => [source.id, source]))

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === "undefined") return
    const nodes = [...root.querySelectorAll<HTMLElement>("[data-chapter-id]")]
    if (nodes.length === 0) return
    const observer = new IntersectionObserver(
      (observed) => {
        const best = observed
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const id = best?.target.getAttribute("data-chapter-id")
        if (id) setChosenId(id)
      },
      {
        root: scrollParent(root),
        rootMargin: "-8% 0px -55% 0px",
        threshold: [0.15, 0.4, 0.75],
      },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [chapterKey])

  function reveal(id: string) {
    const node = document.getElementById(id)
    if (!node || typeof node.scrollIntoView !== "function") return
    try {
      node.scrollIntoView({ block: "start" })
    } catch {
      /* jsdom */
    }
  }

  return (
    <article
      ref={rootRef}
      className={tone === "clinical" ? "cycle-encyclopedia cycle-encyclopedia-clinical" : "cycle-encyclopedia"}
      data-tone={tone}
      aria-label={lensLabel || undefined}
    >
      <header className="cycle-encyclopedia-mast">
        <p className="cycle-encyclopedia-kicker"><FindText text={lensLabel} /></p>
        {tone === "tcm" ? (
          <figure className="cycle-encyclopedia-plate">
            <img
              src={assetSrc(fivePhases)}
              width={581}
              height={466}
              alt="Five phases — wood, fire, earth, metal, and water — with the generating cycle around the outside and the controlling cycle across the inside."
            />
            <figcaption>
              <FindText text="Five phases, generating and controlling cycles. Nnh, CC0 1.0, via Wikimedia Commons." />
            </figcaption>
          </figure>
        ) : null}
      </header>
      {visibleChapters.length > 0 ? (
        <div className="cycle-encyclopedia-spread">
          <nav className="cycle-encyclopedia-toc" aria-label="Contents">
            <ol>
              {visibleChapters.map((chapter) => {
                const domId = `${scope}-${chapter.id}`
                return (
                  <li key={chapter.id}>
                    <a
                      href={`#${domId}`}
                      aria-current={activeId === chapter.id ? "true" : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        setChosenId(chapter.id)
                        reveal(domId)
                      }}
                    >
                      {chapter.title}
                    </a>
                  </li>
                )
              })}
            </ol>
          </nav>
          <div className="cycle-encyclopedia-reading">
            {visibleChapters.map((chapter) => {
              const domId = `${scope}-${chapter.id}`
              return (
                <section
                  key={chapter.id}
                  className="cycle-encyclopedia-chapter"
                  data-chapter-id={chapter.id}
                  aria-labelledby={domId}
                >
                  <h4 id={domId}><FindText text={chapter.title} /></h4>
                  {chapter.entries.map((entry) => {
                    const cited = citedSources(entry.sourceIds, byId)
                    const herbs = entry.herbs ?? []
                    return (
                      <section key={entry.id} className="cycle-encyclopedia-entry" aria-labelledby={`${domId}-${entry.id}`}>
                        <h5 id={`${domId}-${entry.id}`}><FindText text={entry.title} /></h5>
                        {entry.paragraphs.map((paragraph, index) =>
                          paragraph.trim().length === 0 ? null : (
                            <p key={index} className="cycle-encyclopedia-prose">
                              <FindText text={paragraph} />
                            </p>
                          ),
                        )}
                        {herbs.length > 0 ? (
                          <dl className="cycle-encyclopedia-herbs">
                            {herbs.map((herb, index) => (
                              <div key={`${herb.sourceId}-${herb.chinese}-${index}`} className="cycle-encyclopedia-herb">
                                <dt>
                                  <span className="cycle-encyclopedia-han" lang="zh">
                                    <FindText text={herb.chinese} />
                                  </span>
                                  <span className="cycle-encyclopedia-pinyin"><FindText text={herb.pinyin} /></span>
                                  <span className="cycle-encyclopedia-herb-name"><FindText text={herb.name} /></span>
                                </dt>
                                <dd><FindText text={herb.traditionalRole} /></dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        {cited.length > 0 ? (
                          <footer className="cycle-encyclopedia-sources">
                            <p className="cycle-encyclopedia-sources-label"><FindText text="Sources" /></p>
                            <ul>
                              {cited.map((source, index) => (
                                <li key={`${source.id}-${index}`}><FindText text={source.citation} /></li>
                              ))}
                            </ul>
                          </footer>
                        ) : null}
                      </section>
                    )
                  })}
                </section>
              )
            })}
          </div>
        </div>
      ) : null}
    </article>
  )
}
