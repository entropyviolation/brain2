/**
 * TidyView — House Cleaning App (port of /Users/otherworld/house-cleaning)
 *
 * Self-contained mini-app stored on `module.config.houseCleaning`. Internal
 * navigation (home / area / whole house / needed / stuck / plan) lives here so
 * it does not collide with the app hash pop-out route.
 */
"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useModulesStore, type ModuleInstance } from "@/lib/modules-store"
import {
  IMPORTANCE,
  PLAN_TIERS,
  TIME_FILTERS,
  actOf,
  addSidequest,
  addSubarea,
  addSubareaCheck,
  addTask,
  allAreas,
  allLeaves,
  areaById,
  beginSidequestPick,
  byId,
  childrenOf,
  commitTimer,
  completePlan,
  completeSidequest,
  completeTask,
  cycleTheme,
  deleteArea,
  deleteSidequest,
  deleteSubarea,
  deleteSubareaCheck,
  deleteTask,
  doneOf,
  emptyPlan,
  dismissSidequest,
  endPlan,
  endStuckMode,
  endSubareaSession,
  expireSidequest,
  estOf,
  filterAndSort,
  fmtClock,
  fmtMin,
  freezeClocks,
  importBulk,
  importanceLabel,
  isLeaf,
  isRunning,
  leavesOf,
  listSummary,
  liveSec,
  mono,
  normalizeHouseCleaning,
  openSidequests,
  normalizeStuck,
  parseEst,
  planAdd,
  planAncestorIn,
  planContains,
  planEst,
  planLive,
  planPause,
  planRemoveId,
  planResume,
  planSec,
  planTasks,
  rootsOf,
  seedHouseCleaning,
  selectSidequest,
  SIDEQUEST_SESSIONS_TO_UNLOCK,
  SIDEQUEST_TASKS_TO_UNLOCK,
  shuffleSidequestPick,
  sidequestLive,
  sidequestsOf,
  startPlan,
  startSidequest,
  startStuckMode,
  startSubareaSession,
  startTaskTimer,
  stuckComplete,
  stuckLive,
  stuckParamLabel,
  stuckPause,
  stuckRange,
  stuckStartClock,
  stuckSwitch,
  subareaCanAdvance,
  subareaCheckDone,
  subareaComplete,
  subareaEffectiveThreshold,
  subareaProgress,
  subareaSessionChecks,
  subareasOf,
  tidyUid,
  todayProgress,
  toggleDone,
  toggleSubareaCheck,
  type HouseCleaningState,
  type HouseStuckTask,
  type HouseSubareaCheck,
  type HouseTask,
  type Importance,
  type PlanTier,
} from "@/lib/house-cleaning"
import "./tidy.css"

type Route =
  | { view: "home" }
  | { view: "area"; id: string }
  | { view: "all" }
  | { view: "needed" }
  | { view: "stuck" }
  | { view: "plan" }

type PlanMode = "normal" | "plan-edit" | "plan-run"

const PLAY = (
  <svg viewBox="0 0 10 12" aria-hidden="true">
    <path d="M0 0l10 6-10 6z" />
  </svg>
)
const PAUSE = (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <rect x="1" y="1" width="3.5" height="10" rx="1" />
    <rect x="7.5" y="1" width="3.5" height="10" rx="1" />
  </svg>
)
const CHECK = (
  <svg viewBox="0 0 14 12" aria-hidden="true">
    <path d="M5.2 11.6L0 6.6l1.9-1.9 3.3 3.2L12.1.4 14 2.2z" />
  </svg>
)
const ICON_SYS = (
  <svg viewBox="0 0 16 16">
    <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H9v1h2v1H5v-1h2v-1H2a1 1 0 01-1-1V3a1 1 0 011-1zm0 1.5v7.2h12V3.5H2z" />
  </svg>
)
const ICON_LIGHT = (
  <svg viewBox="0 0 16 16">
    <path d="M8 4.6A3.4 3.4 0 108 11.4 3.4 3.4 0 008 4.6zm0-4.1a.7.7 0 01.7.7v1.4a.7.7 0 11-1.4 0V1.2A.7.7 0 018 .5zm0 12.4a.7.7 0 01.7.7v1.4a.7.7 0 11-1.4 0v-1.4a.7.7 0 01.7-.7zM15.5 8a.7.7 0 01-.7.7h-1.4a.7.7 0 110-1.4h1.4a.7.7 0 01.7.7zM3.1 8a.7.7 0 01-.7.7H1a.7.7 0 010-1.4h1.4a.7.7 0 01.7.7zm10.2-5.3a.7.7 0 010 1L12.3 4.7a.7.7 0 11-1-1l1-1a.7.7 0 011 0zM4.7 11.3a.7.7 0 010 1l-1 1a.7.7 0 01-1-1l1-1a.7.7 0 011 0zm8.6 2a.7.7 0 01-1 0l-1-1a.7.7 0 011-1l1 1a.7.7 0 010 1zM4.7 4.7a.7.7 0 01-1 0l-1-1a.7.7 0 011-1l1 1a.7.7 0 010 1z" />
  </svg>
)
const ICON_DARK = (
  <svg viewBox="0 0 16 16">
    <path d="M13.9 10.4A6.2 6.2 0 015.6 2.1a6.3 6.3 0 108.3 8.3z" />
  </svg>
)

function loadTidyFonts() {
  if (typeof document === "undefined") return
  if (document.getElementById("tidy-fonts")) return
  const link = document.createElement("link")
  link.id = "tidy-fonts"
  link.rel = "stylesheet"
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
  document.head.appendChild(link)
}

function formData(e: FormEvent<HTMLFormElement>): FormData {
  return new FormData(e.currentTarget)
}

function ImpSelect({ value }: { value: Importance }) {
  return (
    <select name="importance" aria-label="Importance" defaultValue={value}>
      {IMPORTANCE.map((i) => (
        <option key={i.k} value={i.k}>
          {i.label}
        </option>
      ))}
    </select>
  )
}

export function TidyView({ module }: { module?: ModuleInstance }) {
  const updateModule = useModulesStore((s) => s.updateModule)
  const moduleId = module?.id
  const storeReadyRef = useRef(false)
  const stateRef = useRef<HouseCleaningState>(
    module?.config?.houseCleaning ? normalizeHouseCleaning(module.config.houseCleaning) : seedHouseCleaning(),
  )
  const [state, setState] = useState<HouseCleaningState>(stateRef.current)
  const [now, setNow] = useState(() => Date.now())
  const [route, setRoute] = useState<Route>({ view: "home" })
  const [scrolled, setScrolled] = useState(false)
  const [ui, setUi] = useState({
    addSub: null as string | null,
    editing: null as string | null,
    needArea: "all",
    hideGot: false,
    bulk: false,
    bulkMsg: "",
    stuckKind: "repeat" as "repeat" | "timed",
    stuckTimeMode: "fixed" as "fixed" | "random",
    stuckNMode: "none" as "none" | "fixed" | "random",
    editingStuck: null as string | null,
    stuckEditKind: null as "repeat" | "timed" | null,
    stuckMsg: "",
    subareaMsg: "",
    sidequestMsg: "",
    sidequestSeeAll: false,
    planOpen: false,
    planPicker: null as PlanTier | null,
    planNew: null as PlanTier | null,
    planPickScope: "all",
    planPickQ: "",
    goalEdit: false,
    stuckFreshKey: "",
    addCheckSub: null as string | null,
    sessionOverlay: true,
  })

  useEffect(() => {
    loadTidyFonts()
  }, [])

  useEffect(() => {
    storeReadyRef.current = true
    if (!moduleId) return
    if (!module?.config?.houseCleaning) {
      updateModule(moduleId, { config: { houseCleaning: stateRef.current } })
    }
  }, [moduleId, module?.config?.houseCleaning, updateModule])

  useEffect(() => {
    if (!module?.config?.houseCleaning) return
    const next = normalizeHouseCleaning(module.config.houseCleaning)
    stateRef.current = next
    setState(next)
  }, [module?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once per module

  const persist = useCallback(
    (next: HouseCleaningState) => {
      stateRef.current = next
      setState(next)
      if (!moduleId || !storeReadyRef.current) return
      updateModule(moduleId, { config: { houseCleaning: next } })
    },
    [moduleId, updateModule],
  )

  const patch = useCallback(
    (fn: (s: HouseCleaningState) => HouseCleaningState) => {
      persist(fn(stateRef.current))
    },
    [persist],
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = stateRef.current
      const running =
        !!s.timer ||
        !!(s.stuckSession && s.stuckSession.phase === "task" && s.stuckSession.clock?.running) ||
        !!(s.plan && s.plan.phase === "run" && s.plan.clock?.running) ||
        !!(s.sidequestSession && s.sidequestSession.phase === "run" && s.sidequestSession.clock?.running)
      if (!running) return
      const t = Date.now()
      setNow(t)
      if (s.stuckSession?.phase === "task") {
        const item = s.stuckSession.items[s.stuckSession.index]
        if (item?.kind === "timed" && s.stuckSession.clock?.running && stuckLive(s, t) <= 0) {
          persist(stuckComplete(s, t))
        }
      }
      if (s.plan?.phase === "run" && s.plan.clock?.running && planLive(s, t) <= 0) {
        persist(completePlan(s))
      }
      if (s.sidequestSession?.phase === "run" && s.sidequestSession.clock?.running && sidequestLive(s, t) <= 0) {
        persist(expireSidequest(s))
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [persist])

  useEffect(() => {
    const arm = () => {
      const n = new Date()
      const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1)
      return window.setTimeout(() => {
        setNow(Date.now())
        arm()
      }, Math.max(1000, next.getTime() - n.getTime()))
    }
    const id = arm()
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    return () => {
      const frozen = freezeClocks(stateRef.current)
      if (moduleId && storeReadyRef.current) {
        updateModule(moduleId, { config: { houseCleaning: frozen } })
      }
    }
  }, [moduleId, updateModule])

  const hideSessionOverlay = () => setUi((u) => ({ ...u, sessionOverlay: false }))
  const resumeSessionOverlay = () => setUi((u) => ({ ...u, sessionOverlay: true }))

  const goHome = () => {
    setUi((u) => ({
      ...u,
      sessionOverlay: false,
      addSub: null,
      editing: null,
      editingStuck: null,
      stuckEditKind: null,
      planOpen: false,
      planPicker: null,
      planNew: null,
      goalEdit: false,
      addCheckSub: null,
    }))
    setRoute({ view: "home" })
  }

  const routeKey = route.view === "area" ? `area:${route.id}` : route.view
  const prevRouteKey = useRef(routeKey)
  useEffect(() => {
    if (prevRouteKey.current === routeKey) return
    prevRouteKey.current = routeKey
    setUi((u) => ({ ...u, sessionOverlay: false }))
  }, [routeKey])

  useEffect(() => {
    const live = !!(state.stuckSession || state.subareaSession || state.sidequestSession)
    if (!ui.sessionOverlay || !live) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      hideSessionOverlay()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ui.sessionOverlay, state.stuckSession, state.subareaSession, state.sidequestSession])

  useEffect(() => {
    if (state.stuckSession?.phase !== "done" && state.subareaSession?.phase !== "done") return
    setUi((u) => (u.sessionOverlay ? u : { ...u, sessionOverlay: true }))
  }, [state.stuckSession?.phase, state.subareaSession?.phase])

  const header = (eyebrow: string, title: string, sub?: string, back?: boolean) => (
    <div className={`top${scrolled ? " scrolled" : ""}`}>
      <div className="top-row">
        {back ? (
          <button className="back" type="button" onClick={goHome}>
            ‹ Back
          </button>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {sub ? <div className="sub">{sub}</div> : null}
        </div>
        <div className="spacer" />
        <button
          className="iconbtn"
          type="button"
          title={`Theme: ${state.theme || "system"} — click to change`}
          aria-label={`Theme: ${state.theme || "system"}`}
          onClick={() => patch((s) => ({ ...s, theme: cycleTheme(s.theme) }))}
        >
          {state.theme === "light" ? ICON_LIGHT : state.theme === "dark" ? ICON_DARK : ICON_SYS}
        </button>
      </div>
    </div>
  )

  const filterBar = () => {
    const f = state.filters
    return (
      <div className="filters">
        {IMPORTANCE.map((i) => (
          <button
            key={i.k}
            className={`chip ${i.k}`}
            type="button"
            aria-pressed={!!f.imp[i.k]}
            onClick={() => patch((s) => ({ ...s, filters: { ...s.filters, imp: { ...s.filters.imp, [i.k]: !s.filters.imp[i.k] } } }))}
          >
            <span className="dot" />
            {i.label}
          </button>
        ))}
        <span className="sep" />
        <select
          aria-label="Filter by estimated time"
          value={f.maxMin}
          onChange={(e) => patch((s) => ({ ...s, filters: { ...s.filters, maxMin: Number(e.target.value) || 0 } }))}
        >
          {TIME_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          className={`chip ${f.hideDone ? "on" : ""}`}
          type="button"
          aria-pressed={f.hideDone}
          onClick={() => patch((s) => ({ ...s, filters: { ...s.filters, hideDone: !s.filters.hideDone } }))}
        >
          {f.hideDone ? "Completed hidden" : "Showing completed"}
        </button>
      </div>
    )
  }

  const addTaskForm = (areaId: string, parentId: string | null, noImp?: boolean) => {
    const sub = !!parentId
    return (
      <form
        className={`add ${sub ? "sub" : ""}`}
        onSubmit={(e) => {
          e.preventDefault()
          const d = formData(e)
          const title = String(d.get("title") || "").trim()
          if (!title) return
          patch((s) => {
            const { state: next } = addTask(s, {
              areaId,
              parentId,
              title,
              importance: noImp ? "unset" : ((d.get("importance") as Importance) || "important"),
              estMin: parseEst(d.get("estMin")),
            })
            if (parentId) {
              return { ...next, tasks: next.tasks.map((t) => (t.id === parentId ? { ...t, collapsed: false } : t)) }
            }
            return next
          })
          e.currentTarget.reset()
          if (parentId) setUi((u) => ({ ...u, addSub: parentId }))
        }}
      >
        <input type="text" name="title" required autoComplete="off" placeholder={sub ? "Add a subtask…" : "Add a task…"} autoFocus={sub} />
        {noImp ? null : <ImpSelect value={sub ? "important" : "crucial"} />}
        <input type="number" name="estMin" min={0} step={1} placeholder="min" aria-label="Estimated minutes" />
        <button className="btn primary" type="submit">
          Add
        </button>
        {sub ? (
          <button className="btn ghost sm" type="button" onClick={() => setUi((u) => ({ ...u, addSub: null }))}>
            Cancel
          </button>
        ) : null}
      </form>
    )
  }

  const taskItem = (t: HouseTask, showArea: boolean, mode: PlanMode = "normal", planRoot = false): ReactNode => {
    const planEdit = mode === "plan-edit"
    const planRun = mode === "plan-run"
    const hideImp = planEdit || planRun
    const leaf = isLeaf(state, t)
    const done = doneOf(state, t)
    const running = isRunning(state, t.id)
    const kids = hideImp ? childrenOf(state, t.id) : filterAndSort(state, childrenOf(state, t.id))
    const est = estOf(state, t)
    const act = actOf(state, t, now)
    const cls = `task ${t.parentId ? "sub" : ""} ${hideImp ? "" : t.importance} ${done ? "done" : ""} ${running ? "running" : ""}`

    if (ui.editing === t.id) {
      return (
        <li key={t.id} className={cls} data-id={t.id}>
          <div className="row">
            <form
              className="add sub"
              style={{ flex: 1, border: "none", background: "transparent", padding: 0 }}
              onSubmit={(e) => {
                e.preventDefault()
                const d = formData(e)
                patch((s) => ({
                  ...s,
                  tasks: s.tasks.map((x) =>
                    x.id === t.id
                      ? {
                          ...x,
                          title: String(d.get("title") || "").trim() || x.title,
                          importance: d.has("importance") ? (d.get("importance") as Importance) : x.importance,
                          estMin: d.has("estMin") ? parseEst(d.get("estMin")) : x.estMin,
                        }
                      : x,
                  ),
                }))
                setUi((u) => ({ ...u, editing: null }))
              }}
            >
              <input type="text" name="title" required defaultValue={t.title} autoFocus />
              {planEdit ? null : <ImpSelect value={t.importance} />}
              {leaf ? (
                <input type="number" name="estMin" min={0} step={1} placeholder="min" defaultValue={t.estMin || ""} aria-label="Estimated minutes" />
              ) : null}
              <button className="btn primary" type="submit">
                Save
              </button>
              <button className="btn ghost sm" type="button" onClick={() => setUi((u) => ({ ...u, editing: null }))}>
                Cancel
              </button>
            </form>
          </div>
        </li>
      )
    }

    let ctl: ReactNode = null
    if (!leaf) {
      ctl = (
        <button
          className="chev"
          type="button"
          aria-label={t.collapsed ? "Expand subtasks" : "Collapse subtasks"}
          onClick={() => patch((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, collapsed: !x.collapsed } : x)) }))}
        >
          {t.collapsed ? "▶" : "▼"}
        </button>
      )
    } else if (planEdit) {
      ctl = null
    } else if (running) {
      ctl = (
        <div className="runctl">
          <button className="pause" type="button" title="Stop — worked on, not finished" aria-label="Stop timer" onClick={() => patch((s) => commitTimer(s))}>
            {PAUSE}
          </button>
          <button className="fin" type="button" title="Complete" aria-label="Complete task" onClick={() => patch((s) => completeTask(s, t.id))}>
            {CHECK}
          </button>
        </div>
      )
    } else if (!done) {
      ctl = (
        <button className="play" type="button" title="Start timing this task" aria-label={`Start ${t.title}`} onClick={() => patch((s) => startTaskTimer(s, t.id))}>
          {PLAY}
        </button>
      )
    } else {
      ctl = (
        <button className="check" type="button" aria-label="Mark not done" onClick={() => patch((s) => toggleDone(s, t.id))}>
          {CHECK}
        </button>
      )
    }

    const bits: ReactNode[] = []
    if (!hideImp) bits.push(<span key="imp" className={`tag ${t.importance}`}>{importanceLabel(t.importance)}</span>)
    if (est) bits.push(<span key="est">Est <span className="val">{fmtMin(est)}</span></span>)
    if (running) bits.push(<span key="live" className="live">{fmtClock(act)}</span>)
    else if (act >= 1) bits.push(<span key="act">Actual <span className="act">{fmtClock(act)}</span></span>)
    if (!leaf) {
      const ls = leavesOf(state, t)
      bits.push(
        <span key="sub" className="val">
          {ls.filter((l) => l.done).length}/{ls.length}
        </span>,
      )
      bits.push(
        <span key="subl" style={{ marginLeft: -6 }}>
          subtasks
        </span>,
      )
    }
    if (showArea) {
      const a = areaById(state, t.areaId)
      if (a) bits.push(<span key="area">{a.name}</span>)
    }

    const checkBtn =
      !planEdit && leaf && !done ? (
        <button className="check" type="button" aria-label="Mark done" onClick={() => patch((s) => toggleDone(s, t.id))}>
          {CHECK}
        </button>
      ) : null

    let rowbtns: ReactNode = null
    if (planEdit) {
      const move = planRoot
        ? PLAN_TIERS.filter((x) => !state.plan?.tiers[x.k].includes(t.id)).map((x) => (
            <button key={x.k} type="button" title={`Move to ${x.label}`} onClick={() => patch((s) => planAdd(s, x.k, t.id))}>
              {x.label[0]}
            </button>
          ))
        : null
      rowbtns = (
        <div className="rowbtns">
          <button type="button" title="Break into subtasks" aria-label="Add subtask" onClick={() => setUi((u) => ({ ...u, addSub: u.addSub === t.id ? null : t.id, editing: null }))}>
            +
          </button>
          <button type="button" title="Edit" aria-label="Edit task" onClick={() => setUi((u) => ({ ...u, editing: t.id, addSub: null }))}>
            ✎
          </button>
          {move}
          {planRoot ? (
            <button className="del" type="button" title="Remove from plan" onClick={() => patch((s) => planRemoveId(s, t.id))}>
              ✕
            </button>
          ) : (
            <button className="del" type="button" title="Delete" aria-label="Delete" onClick={() => tryDeleteTask(t)}>
              ✕
            </button>
          )}
        </div>
      )
    } else {
      rowbtns = (
        <div className="rowbtns">
          <button type="button" title="Break into subtasks" aria-label="Add subtask" onClick={() => setUi((u) => ({ ...u, addSub: u.addSub === t.id ? null : t.id, editing: null }))}>
            +
          </button>
          <button type="button" title="Edit" aria-label="Edit task" onClick={() => setUi((u) => ({ ...u, editing: t.id, addSub: null }))}>
            ✎
          </button>
          <button className="del" type="button" title="Delete" aria-label="Delete" onClick={() => tryDeleteTask(t)}>
            ✕
          </button>
        </div>
      )
    }

    return (
      <li key={t.id} className={cls} data-id={t.id}>
        <div className="row">
          {ctl}
          {checkBtn}
          <div className="body">
            <div className="title">{t.title}</div>
            <div className="meta">{bits}</div>
          </div>
          {rowbtns}
        </div>
        {t.collapsed && kids.length ? null : (
          <>
            {kids.length ? <ul className="tasks">{kids.map((k) => taskItem(k, false, mode, false))}</ul> : null}
            {ui.addSub === t.id ? addTaskForm(t.areaId, t.id, planEdit) : null}
          </>
        )}
      </li>
    )
  }

  function tryDeleteTask(t: HouseTask) {
    const kids = childrenOf(state, t.id).length
    if (isLeaf(state, t) || window.confirm(`Delete "${t.title}" and its ${kids} subtasks?`)) {
      patch((s) => deleteTask(s, t.id))
    }
  }

  const taskList = (roots: HouseTask[], showArea: boolean) => {
    const list = filterAndSort(state, roots)
    if (!list.length) return <div className="empty">No tasks match the current filters.</div>
    return <ul className="tasks">{list.map((t) => taskItem(t, showArea))}</ul>
  }

  const neededSection = (areaId: string | null) => {
    const global = areaId === null
    let items = global ? state.needed.slice() : state.needed.filter((n) => n.areaId === areaId)
    if (global && ui.needArea !== "all") items = items.filter((n) => n.areaId === ui.needArea)
    if (ui.hideGot) items = items.filter((n) => !n.got)
    items.sort((a, b) => Number(a.got) - Number(b.got) || a.createdAt - b.createdAt)
    return (
      <>
        {global ? (
          <div className="filters">
            <button className={`chip ${ui.needArea === "all" ? "on" : ""}`} type="button" onClick={() => setUi((u) => ({ ...u, needArea: "all" }))}>
              All areas
            </button>
            {allAreas(state).map((a) => (
              <button key={a.id} className={`chip ${ui.needArea === a.id ? "on" : ""}`} type="button" onClick={() => setUi((u) => ({ ...u, needArea: a.id }))}>
                {a.name}
              </button>
            ))}
            <span className="sep" />
            <button className={`chip ${ui.hideGot ? "on" : ""}`} type="button" aria-pressed={ui.hideGot} onClick={() => setUi((u) => ({ ...u, hideGot: !u.hideGot }))}>
              {ui.hideGot ? "Purchased hidden" : "Showing purchased"}
            </button>
          </div>
        ) : null}
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault()
            const d = formData(e)
            const text = String(d.get("text") || "").trim()
            if (!text) return
            const aid = areaId || String(d.get("areaId") || "general")
            patch((s) => ({
              ...s,
              needed: [...s.needed, { id: tidyUid(), areaId: aid, text, got: false, createdAt: Date.now() }],
            }))
            e.currentTarget.reset()
          }}
        >
          <input type="text" name="text" required autoComplete="off" placeholder="Something you need to buy or find…" />
          {global ? (
            <select name="areaId" aria-label="Area" defaultValue="general">
              {allAreas(state).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : null}
          <button className="btn primary" type="submit">
            Add
          </button>
        </form>
        <div style={{ height: 10 }} />
        {items.length ? (
          <ul className="needed">
            {items.map((n) => {
              const a = areaById(state, n.areaId)
              return (
                <li key={n.id} className={`need ${n.got ? "got" : ""}`}>
                  <button
                    className="check"
                    type="button"
                    aria-label={n.got ? "Mark as not gotten" : "Mark as gotten"}
                    onClick={() => patch((s) => ({ ...s, needed: s.needed.map((x) => (x.id === n.id ? { ...x, got: !x.got } : x)) }))}
                  >
                    {CHECK}
                  </button>
                  <span className="txt">{n.text}</span>
                  {global && a ? <span className="where">{a.name}</span> : null}
                  <div className="rowbtns">
                    <button className="del" type="button" aria-label="Remove" onClick={() => patch((s) => ({ ...s, needed: s.needed.filter((x) => x.id !== n.id) }))}>
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="empty">Nothing yet — add anything you notice while cleaning.</div>
        )}
      </>
    )
  }

  const goalCard = () => {
    const g = state.goal
    const p = todayProgress(state, now)
    const set = g.total > 0 || g.crucial > 0
    if (ui.goalEdit || !set) {
      return (
        <div className="goal-card">
          <div className="section-head">
            <h2>Today’s goal</h2>
          </div>
          <form
            className="goal-form"
            onSubmit={(e) => {
              e.preventDefault()
              const d = formData(e)
              const total = Math.max(0, Math.round(Number(d.get("total")) || 0))
              let crucial = Math.max(0, Math.round(Number(d.get("crucial")) || 0))
              if (total && crucial > total) crucial = total
              patch((s) => ({ ...s, goal: { total, crucial } }))
              setUi((u) => ({ ...u, goalEdit: false }))
            }}
          >
            <label>
              Finish <input type="number" name="total" min={0} step={1} defaultValue={g.total || ""} placeholder="20" aria-label="Total tasks" /> tasks
            </label>
            <label>
              including <input type="number" name="crucial" min={0} step={1} defaultValue={g.crucial || ""} placeholder="10" aria-label="Crucial tasks" /> crucial
            </label>
            <button className="btn primary" type="submit">
              Save
            </button>
            {set ? (
              <button className="btn ghost sm" type="button" onClick={() => setUi((u) => ({ ...u, goalEdit: false }))}>
                Cancel
              </button>
            ) : null}
          </form>
          <div className="hint">Counts only what you complete today. The tally resets at midnight — your lists stay as they are.</div>
        </div>
      )
    }
    const allMet = (g.total ? p.total >= g.total : true) && (g.crucial ? p.crucial >= g.crucial : true)
    const bar = (done: number, target: number, label: string) => {
      const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0
      const met = target > 0 && done >= target
      return (
        <div className={`goal-row ${met ? "met" : ""}`}>
          <div className="goal-row-top">
            <span>{label}</span>
            <span className="val">
              {done}
              {target ? ` / ${target}` : ""} · {pct}%
            </span>
          </div>
          <div className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      )
    }
    return (
      <div className={`goal-card ${allMet ? "hit" : ""}`}>
        <div className="section-head">
          <h2>Today’s goal</h2>
          <span className="count">
            <button className="btn sm" type="button" onClick={() => setUi((u) => ({ ...u, goalEdit: true }))}>
              Edit
            </button>
          </span>
        </div>
        {g.total ? bar(p.total, g.total, "Tasks completed") : null}
        {g.crucial ? bar(p.crucial, g.crucial, "Crucial completed") : null}
        <div className="hint">{allMet ? "Goal hit. Nice work." : "Progress is for today only. Completed tasks themselves stay checked after midnight."}</div>
      </div>
    )
  }

  const tryDeleteArea = (id: string) => {
    const a = areaById(state, id)
    if (!a || !window.confirm(`Delete ${a.name} with all of its tasks and needed items?`)) return
    patch((s) => deleteArea(s, id))
    if (route.view === "area" && route.id === id) goHome()
  }

  const startStuck = () => {
    if (stateRef.current.stuckSession) {
      setUi((u) => ({ ...u, sessionOverlay: true, stuckMsg: "" }))
      return
    }
    const next = startStuckMode(stateRef.current)
    if ("error" in next) {
      setUi((u) => ({ ...u, stuckMsg: next.error }))
      setRoute({ view: "stuck" })
      return
    }
    persist(next)
    setUi((u) => ({ ...u, stuckFreshKey: `${next.stuckSession?.phase}-${next.stuckSession?.index}`, sessionOverlay: true }))
  }

  const startSubareas = (areaId: string) => {
    if (stateRef.current.subareaSession) {
      setUi((u) => ({ ...u, sessionOverlay: true, subareaMsg: "", addCheckSub: null }))
      return
    }
    const next = startSubareaSession(stateRef.current, areaId)
    if ("error" in next) {
      setUi((u) => ({ ...u, subareaMsg: next.error }))
      return
    }
    persist(next)
    setUi((u) => ({ ...u, subareaMsg: "", addCheckSub: null, sessionOverlay: true }))
  }

  const subareaCheckControls = (c: HouseSubareaCheck, nested: boolean, done: boolean) => (
    <>
      <button
        className={`check ${done ? "on" : ""}`}
        type="button"
        aria-pressed={done}
        aria-label={done ? `Mark ${c.title} not done` : `Mark ${c.title} done`}
        onClick={() => persist(toggleSubareaCheck(stateRef.current, c.id))}
      >
        {CHECK}
      </button>
      <span className="txt">{c.title}</span>
      <div className="rowbtns">
        {nested ? null : (
          <button
            type="button"
            title="Add subtask"
            aria-label={`Add subtask under ${c.title}`}
            onClick={() => setUi((u) => ({ ...u, addCheckSub: u.addCheckSub === c.id ? null : c.id }))}
          >
            +
          </button>
        )}
        <button
          className="del"
          type="button"
          aria-label={`Remove ${c.title}`}
          onClick={() => persist(deleteSubareaCheck(stateRef.current, c.id))}
        >
          ✕
        </button>
      </div>
    </>
  )

  const subareaCheckItem = (c: HouseSubareaCheck, nested = false): ReactNode => {
    const kids = c.checks || []
    const done = subareaCheckDone(c)
    if (nested) {
      return (
        <li key={c.id} className={`need ${done ? "got" : ""}`}>
          {subareaCheckControls(c, true, done)}
        </li>
      )
    }
    return (
      <li key={c.id} className="subarea-check">
        <div className={`need ${done ? "got" : ""}`}>{subareaCheckControls(c, false, done)}</div>
        {kids.length ? <ul className="needed subarea-checks-nested">{kids.map((k) => subareaCheckItem(k, true))}</ul> : null}
        {ui.addCheckSub === c.id ? (
          <form
            className="add sub"
            onSubmit={(e) => {
              e.preventDefault()
              const title = String(formData(e).get("title") || "").trim()
              if (!title) return
              persist(addSubareaCheck(stateRef.current, title, c.id))
              e.currentTarget.reset()
              setUi((u) => ({ ...u, addCheckSub: c.id }))
            }}
          >
            <input type="text" name="title" required autoComplete="off" placeholder="Add a subtask…" autoFocus />
            <button className="btn primary" type="submit">
              Add
            </button>
            <button className="btn ghost sm" type="button" onClick={() => setUi((u) => ({ ...u, addCheckSub: null }))}>
              Cancel
            </button>
          </form>
        ) : null}
      </li>
    )
  }

  const openSidequestPicker = () => {
    if (stateRef.current.sidequestSession) {
      setUi((u) => ({ ...u, sessionOverlay: true, sidequestMsg: "", sidequestSeeAll: false }))
      return
    }
    const next = beginSidequestPick(stateRef.current)
    if ("error" in next) {
      setUi((u) => ({ ...u, sidequestMsg: next.error }))
      return
    }
    persist(next)
    setUi((u) => ({ ...u, sidequestMsg: "", sidequestSeeAll: false, sessionOverlay: true }))
  }

  const sidequestProgressHint = () => {
    const earn = state.sidequestEarn
    return `${earn?.tasks ?? 0}/${SIDEQUEST_TASKS_TO_UNLOCK} tasks · ${earn?.sessions ?? 0}/${SIDEQUEST_SESSIONS_TO_UNLOCK} sessions`
  }

  const stuckTimeFields = (st: HouseStuckTask | null) => {
    const mode = st ? st.timeMode : ui.stuckTimeMode
    const fixed = st ? st.fixedMin : 15
    const lo = st ? st.randomMin : 5
    const hi = st ? st.randomMax : 20
    return (
      <>
        <div className="stuck-time">
          <label className={`stuck-mode ${mode === "fixed" ? "on" : ""}`}>
            <input type="radio" name="timeMode" value="fixed" defaultChecked={mode === "fixed"} onChange={() => setUi((u) => ({ ...u, stuckTimeMode: "fixed" }))} />
            Fixed <input type="number" name="fixedMin" min={1} step={1} defaultValue={fixed} aria-label="Fixed minutes" /> min
          </label>
          <label className={`stuck-mode ${mode === "random" ? "on" : ""}`}>
            <input type="radio" name="timeMode" value="random" defaultChecked={mode === "random"} onChange={() => setUi((u) => ({ ...u, stuckTimeMode: "random" }))} />
            Random <input type="number" name="randomMin" min={1} step={1} defaultValue={lo} aria-label="Random minimum minutes" /> to{" "}
            <input type="number" name="randomMax" min={1} step={1} defaultValue={hi} aria-label="Random maximum minutes" /> min
          </label>
        </div>
        <div className="hint">
          Put <code>{"{n}"}</code> in the title where the minutes should appear — or leave it out and the timer will show the time.
        </div>
      </>
    )
  }

  const stuckCountFields = (st: HouseStuckTask | null) => {
    const mode = st ? st.nMode || "none" : ui.stuckNMode
    const fixed = st ? st.nFixed : 5
    const lo = st ? st.nMin : 5
    const hi = st ? st.nMax : 100
    return (
      <>
        <div className="stuck-time">
          <label className={`stuck-mode ${mode === "none" ? "on" : ""}`}>
            <input type="radio" name="nMode" value="none" defaultChecked={mode === "none"} onChange={() => setUi((u) => ({ ...u, stuckNMode: "none" }))} />
            No number
          </label>
          <label className={`stuck-mode ${mode === "fixed" ? "on" : ""}`}>
            <input type="radio" name="nMode" value="fixed" defaultChecked={mode === "fixed"} onChange={() => setUi((u) => ({ ...u, stuckNMode: "fixed" }))} />
            Fixed <input type="number" name="nFixed" min={1} step={1} defaultValue={fixed} aria-label="Fixed count" />
          </label>
          <label className={`stuck-mode ${mode === "random" ? "on" : ""}`}>
            <input type="radio" name="nMode" value="random" defaultChecked={mode === "random"} onChange={() => setUi((u) => ({ ...u, stuckNMode: "random" }))} />
            Random <input type="number" name="nMin" min={1} step={1} defaultValue={lo} aria-label="Random minimum" /> to{" "}
            <input type="number" name="nMax" min={1} step={1} defaultValue={hi} aria-label="Random maximum" />
          </label>
        </div>
        <div className="hint">
          Optional. Put <code>{"{n}"}</code> in the title — e.g. “Pick up {"{n}"} items” with a range of 5–100.
        </div>
      </>
    )
  }

  const stuckFieldsFromForm = (d: FormData, kind: "repeat" | "timed"): Omit<HouseStuckTask, "id" | "actuals" | "createdAt"> => {
    const [tLo, tHi] = stuckRange(Number(d.get("randomMin")), Number(d.get("randomMax")), 5, 20)
    const [nLo, nHi] = stuckRange(Number(d.get("nMin")), Number(d.get("nMax")), 5, 100)
    const nMode = String(d.get("nMode") || "")
    return normalizeStuck({
      title: String(d.get("title") || "").trim(),
      kind,
      timeMode: d.get("timeMode") === "random" ? "random" : "fixed",
      fixedMin: Math.max(1, Number(d.get("fixedMin")) || 15),
      randomMin: tLo,
      randomMax: tHi,
      nMode: nMode === "random" || nMode === "fixed" ? nMode : "none",
      nFixed: Math.max(1, Number(d.get("nFixed")) || 5),
      nMin: nLo,
      nMax: nHi,
    })
  }

  const addStuckForm = () => {
    const timed = ui.stuckKind === "timed"
    const vary = !timed && ui.stuckNMode !== "none"
    return (
      <form
        className="add stuck-add"
        onSubmit={(e) => {
          e.preventDefault()
          const fields = stuckFieldsFromForm(formData(e), ui.stuckKind)
          if (!fields.title) return
          patch((s) => ({ ...s, stuckTasks: [...s.stuckTasks, { ...fields, id: tidyUid(), actuals: [], createdAt: Date.now() }] }))
          setUi((u) => ({ ...u, stuckMsg: "" }))
          e.currentTarget.reset()
        }}
      >
        <div className="stuck-kinds">
          <button type="button" className={`chip ${!timed ? "on" : ""}`} aria-pressed={!timed} onClick={() => setUi((u) => ({ ...u, stuckKind: "repeat" }))}>
            Anytime
          </button>
          <button type="button" className={`chip ${timed ? "on" : ""}`} aria-pressed={timed} onClick={() => setUi((u) => ({ ...u, stuckKind: "timed" }))}>
            Timed stretch
          </button>
        </div>
        <input
          type="text"
          name="title"
          required
          autoComplete="off"
          placeholder={timed ? "Get this area as close to perfect as you can in {n} minutes" : vary ? "Pick up {n} items" : "Put 5 things away"}
        />
        {timed ? stuckTimeFields(null) : stuckCountFields(null)}
        <button className="btn primary" type="submit">
          Add
        </button>
      </form>
    )
  }

  const planTierBlock = (tier: PlanTier, mode: PlanMode) => {
    const info = PLAN_TIERS.find((x) => x.k === tier)!
    const tasks = planTasks(state, tier)
    const est = planEst(state, tier)
    const edit = mode === "plan-edit" || (mode === "plan-run" && state.plan?.phase !== "done")
    return (
      <div className={`plan-tier ${tier}`} key={tier}>
        <div className="plan-tier-head">
          <h2>{info.label}</h2>
          <span className="count">{est ? fmtMin(est) : "0m"} est</span>
        </div>
        {edit ? (
          <div className="plan-tier-add">
            <button className={`btn sm ${ui.planPicker === tier ? "on" : ""}`} type="button" onClick={() => setUi((u) => ({ ...u, planPicker: u.planPicker === tier ? null : tier, planNew: null, planPickQ: "" }))}>
              From lists
            </button>
            <button className={`btn sm ${ui.planNew === tier ? "on" : ""}`} type="button" onClick={() => setUi((u) => ({ ...u, planNew: u.planNew === tier ? null : tier, planPicker: null }))}>
              New task
            </button>
          </div>
        ) : null}
        {edit && ui.planPicker === tier ? planPickerHtml(tier) : null}
        {edit && ui.planNew === tier ? (
          <form
            className="add"
            onSubmit={(e) => {
              e.preventDefault()
              const d = formData(e)
              const title = String(d.get("title") || "").trim()
              if (!title) return
              const areaId = String(d.get("areaId") || "general")
              patch((s) => {
                const { state: next, task } = addTask(s, { areaId, title, importance: "unset", estMin: parseEst(d.get("estMin")) })
                return planAdd(next, tier, task.id)
              })
              setUi((u) => ({ ...u, planNew: null }))
            }}
          >
            <input type="text" name="title" required autoComplete="off" placeholder="New task…" autoFocus />
            <select name="areaId" aria-label="Area">
              {allAreas(state).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input type="number" name="estMin" min={0} step={1} placeholder="min" aria-label="Estimated minutes" />
            <button className="btn primary" type="submit">
              Add
            </button>
            <button className="btn ghost sm" type="button" onClick={() => setUi((u) => ({ ...u, planNew: null }))}>
              Cancel
            </button>
          </form>
        ) : null}
        {tasks.length ? <ul className="tasks">{tasks.map((t) => taskItem(t, true, mode, true))}</ul> : <div className="empty">{edit ? "Add tasks you want in this tier." : "Nothing in this tier."}</div>}
      </div>
    )
  }

  const planPickerHtml = (tier: PlanTier) => {
    const scope = ui.planPickScope || "all"
    const q = ui.planPickQ.trim().toLowerCase()
    const scopes = [{ id: "all", name: "Whole house" }, ...allAreas(state)]
    const areas = scope === "all" ? allAreas(state) : [allAreas(state).find((a) => a.id === scope)].filter(Boolean)
    const matches = (t: HouseTask): boolean => {
      if (!q) return true
      if (t.title.toLowerCase().includes(q)) return true
      return childrenOf(state, t.id).some(matches)
    }
    const row = (t: HouseTask, depth: number): ReactNode => {
      if (q && !matches(t)) return null
      const taken = planContains(state, t.id) || planAncestorIn(state, t.id)
      return (
        <span key={t.id}>
          <button
            type="button"
            className={`plan-pick ${taken ? "off" : ""} ${t.done ? "got" : ""}`}
            disabled={taken}
            style={{ paddingLeft: 10 + depth * 16 }}
            onClick={() => patch((s) => planAdd(s, tier, t.id))}
          >
            <span>{t.title}</span>
            <span className="val">{estOf(state, t) ? fmtMin(estOf(state, t)) : ""}</span>
          </button>
          {childrenOf(state, t.id).map((c) => row(c, depth + 1))}
        </span>
      )
    }
    return (
      <div className="plan-picker">
        <div className="plan-pick-tools">
          <div className="filters">
            {scopes.map((s) => (
              <button key={s.id} type="button" className={`chip ${scope === s.id ? "on" : ""}`} onClick={() => setUi((u) => ({ ...u, planPickScope: s.id }))}>
                {s.name}
              </button>
            ))}
          </div>
          <input type="search" value={ui.planPickQ} placeholder="Search in this list…" aria-label="Search tasks" onChange={(e) => setUi((u) => ({ ...u, planPickQ: e.target.value }))} />
        </div>
        <div className="hint">Already-planned items are dimmed. Stuck-list tasks are not shown.</div>
        <div className="plan-pick-list">
          {areas.map((a) => {
            if (!a) return null
            const roots = rootsOf(state, a.id).filter(matches)
            if (!roots.length) return null
            return (
              <div className="plan-pick-area" key={a.id}>
                <div className="eyebrow">{a.name}</div>
                {roots.map((t) => row(t, 0))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const openPlan = () => {
    if (state.plan?.phase === "run") {
      setRoute({ view: "plan" })
      return
    }
    patch((s) => {
      let plan = s.plan
      if (plan?.phase === "done") plan = null
      if (!plan) {
        plan = emptyPlan()
      }
      return { ...s, plan }
    })
    setUi((u) => ({ ...u, planOpen: true, planPicker: null, planNew: null, planPickScope: "all", planPickQ: "" }))
  }

  const doStartPlan = () => {
    persist(startPlan(stateRef.current))
    setUi((u) => ({ ...u, planOpen: false, planPicker: null, planNew: null }))
    setRoute({ view: "plan" })
  }

  const homeView = () => {
    const ls = allLeaves(state)
    const left = ls.filter((l) => !l.done)
    const crucialLeft = left.filter((l) => l.importance === "crucial").length
    const mins = left.reduce((n, l) => n + (l.estMin || 0), 0)
    const needLeft = state.needed.filter((n) => !n.got).length
    const card = (a: { id: string; name: string }, isGeneral: boolean) => {
      const roots = rootsOf(state, a.id)
      const lv = roots.flatMap((t) => leavesOf(state, t))
      const d = lv.filter((l) => l.done).length
      const pct = lv.length ? Math.round((d / lv.length) * 100) : 0
      const cru = lv.filter((l) => !l.done && l.importance === "crucial").length
      const m = lv.filter((l) => !l.done).reduce((n, l) => n + (l.estMin || 0), 0)
      return (
        <div key={a.id} className="area-card" onClick={() => setRoute({ view: "area", id: a.id })}>
          {cru ? <span className="flag">{cru} crucial</span> : null}
          <div className="tile">{mono(a.name)}</div>
          <div className="name">{a.name}</div>
          <div className="metrics">
            <span>
              <b>{lv.length - d}</b> open
            </span>
            <span>
              <b>{m ? fmtMin(m) : "—"}</b> est
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="barline">
            <span>{pct}% COMPLETE</span>
            <span>
              {d}/{lv.length}
            </span>
          </div>
          {isGeneral ? null : (
            <button
              className="kill"
              type="button"
              aria-label={`Delete ${a.name}`}
              onClick={(e) => {
                e.stopPropagation()
                tryDeleteArea(a.id)
              }}
            >
              ✕
            </button>
          )}
        </div>
      )
    }
    return (
      <>
        {header("Overview", "Tidy", "Pick an area, or start with one small task.")}
        <div className="stats">
          <div className="stat">
            <b>{left.length}</b>
            <span>Tasks open</span>
          </div>
          <div className={`stat ${crucialLeft ? "alert" : ""}`}>
            <b>{crucialLeft}</b>
            <span>Crucial left</span>
          </div>
          <div className="stat">
            <b>{mins ? fmtMin(mins) : "—"}</b>
            <span>Est. remaining</span>
          </div>
          <div className="stat">
            <b>{needLeft}</b>
            <span>Items needed</span>
          </div>
        </div>
        {goalCard()}
        <div className="stuck-cta">
          <div className="mode-btns">
            <button className="btn stuck-go" type="button" title={state.stuckTasks.length ? "Start stuck mode" : "Add stuck tasks first"} onClick={startStuck}>
              Stuck
            </button>
            {state.plan?.phase === "run" ? (
              <button className="btn plan-go" type="button" onClick={() => setRoute({ view: "plan" })}>
                Open plan
              </button>
            ) : (
              <button className="btn plan-go" type="button" onClick={openPlan}>
                {state.plan?.phase === "draft" ? "Continue plan" : "Create a plan"}
              </button>
            )}
          </div>
          <div className="stuck-cta-copy">
            <div className="name">Don't know where to start?</div>
            <div className="hint">
              Stuck mode picks a few anytime tasks and walks you through them one by one.{" "}
              <button type="button" onClick={() => setRoute({ view: "stuck" })}>
                Edit the stuck list
              </button>
            </div>
          </div>
        </div>
        <div className="stuck-cta sidequest-cta">
          <button
            className="btn sidequest-go"
            type="button"
            disabled={!state.sidequestEarn?.unlocked}
            title={state.sidequestEarn?.unlocked ? "Start a sidequest" : "Keep cleaning to unlock"}
            onClick={openSidequestPicker}
          >
            Sidequest unlocked
          </button>
          <div className="stuck-cta-copy">
            <div className="name">{state.sidequestEarn?.unlocked ? "You've earned a break" : "Earn a sidequest"}</div>
            <div className="hint">{sidequestProgressHint()}</div>
          </div>
        </div>
        {ui.sidequestMsg ? <div className="toast">{ui.sidequestMsg}</div> : null}
        <div className="section">
          <div className="section-head">
            <h2>All lists</h2>
          </div>
          <div className="grid">
            <button className="area-card link" type="button" onClick={() => setRoute({ view: "all" })}>
              <div className="tile">☰</div>
              <div className="name">Whole house</div>
              <div className="metrics">
                <span>Every task across all areas</span>
              </div>
            </button>
            <button className="area-card link" type="button" onClick={() => setRoute({ view: "needed" })}>
              <div className="tile">＋</div>
              <div className="name">Needed</div>
              <div className="metrics">
                <span>{needLeft ? `${needLeft} to pick up` : "Nothing needed yet"}</span>
              </div>
            </button>
            <button className="area-card link stuck" type="button" onClick={() => setRoute({ view: "stuck" })}>
              <div className="tile">ST</div>
              <div className="name">Stuck list</div>
              <div className="metrics">
                <span>{state.stuckTasks.length ? `${state.stuckTasks.length} stuck task${state.stuckTasks.length === 1 ? "" : "s"}` : "Build a list for stuck mode"}</span>
              </div>
            </button>
          </div>
        </div>
        <div className="section">
          <div className="section-head">
            <h2>Bulk add</h2>
            <span className="count">
              <button className="btn sm" type="button" onClick={() => setUi((u) => ({ ...u, bulk: !u.bulk, bulkMsg: "" }))}>
                {ui.bulk ? "Close" : "Paste a list"}
              </button>
            </span>
          </div>
          {ui.bulkMsg ? <div className="toast">{ui.bulkMsg}</div> : null}
          {ui.bulk ? (
            <div className="bulk">
              <textarea id="tidy-bulk-text" spellCheck={false} placeholder={"Kitchen:\ndo dishes\nclear counters\ntake out trash\n\nLiving room:\nclear desk surface\nclean rug"} />
              <div className="bulk-foot">
                <span>
                  A line ending in <code>:</code> starts an area — every line under it becomes a task there. Areas you already have are reused; duplicate tasks are skipped.
                </span>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => {
                    const ta = document.getElementById("tidy-bulk-text") as HTMLTextAreaElement | null
                    if (!ta) return
                    const { state: next, message } = importBulk(stateRef.current, ta.value)
                    persist(next)
                    setUi((u) => ({ ...u, bulk: false, bulkMsg: message }))
                  }}
                >
                  Import
                </button>
              </div>
            </div>
          ) : (
            <div className="hint">Paste rooms and tasks straight from your notes — one area header per block, one task per line.</div>
          )}
        </div>
        <div className="section">
          <div className="section-head">
            <h2>Areas</h2>
            <span className="count">{state.areas.length + 1} lists</span>
          </div>
          <div className="grid">
            {card({ id: "general", name: "General" }, true)}
            {state.areas.map((a) => card(a, false))}
          </div>
          <div style={{ height: 10 }} />
          <form
            className="add"
            onSubmit={(e) => {
              e.preventDefault()
              const name = String(formData(e).get("name") || "").trim()
              if (!name) return
              patch((s) => ({ ...s, areas: [...s.areas, { id: tidyUid(), name }] }))
              e.currentTarget.reset()
            }}
          >
            <input type="text" name="name" required autoComplete="off" placeholder="Add an area — Office, Garage, Car…" />
            <button className="btn primary" type="submit">
              Add area
            </button>
          </form>
        </div>
      </>
    )
  }

  const subareasSection = (areaId: string) => {
    const subs = subareasOf(state, areaId)
    const n = subs.length
    return (
      <div className="section" style={{ marginTop: 16 }}>
        <div className="section-head">
          <h2>Subareas</h2>
          <span className="count">
            {n} {n === 1 ? "spot" : "spots"}
          </span>
        </div>
        <div className="stuck-cta subarea-cta">
          <button
            className="btn subarea-go"
            type="button"
            title={n ? "Perfect 2–3 random subareas" : "Add subareas first"}
            onClick={() => startSubareas(areaId)}
          >
            Perfect
          </button>
          <div className="stuck-cta-copy">
            <div className="name">{n ? "Ready when you are" : "Name the spots first"}</div>
            <div className="hint">
              {n
                ? "Picks 2–3 random subareas. Sweep and a miscellaneous box show up on their own 1–3 cadences — never first."
                : "Add spots you can perfect — sink, stove, nightstand — then start a session."}
            </div>
          </div>
        </div>
        {ui.subareaMsg ? <div className="toast">{ui.subareaMsg}</div> : null}
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault()
            const name = String(formData(e).get("name") || "").trim()
            if (!name) return
            patch((s) => addSubarea(s, areaId, name))
            setUi((u) => ({ ...u, subareaMsg: "" }))
            e.currentTarget.reset()
          }}
        >
          <input type="text" name="name" required autoComplete="off" placeholder="Add a subarea — Sink, Closet, Nightstand…" />
          <button className="btn primary" type="submit">
            Add subarea
          </button>
        </form>
        <div style={{ height: 10 }} />
        {subs.length ? (
          <ul className="needed">
            {subs.map((sa) => (
              <li key={sa.id} className={`need ${sa.done ? "got" : ""}`}>
                <span className="txt">{sa.name}</span>
                <div className="rowbtns">
                  <button className="del" type="button" aria-label={`Remove ${sa.name}`} onClick={() => patch((s) => deleteSubarea(s, sa.id))}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">No subareas yet — add as many spots in this area as you want.</div>
        )}
      </div>
    )
  }

  const areaView = (id: string) => {
    const a = areaById(state, id)
    if (!a) {
      goHome()
      return null
    }
    const roots = rootsOf(state, id)
    const isGen = id === "general"
    return (
      <>
        {header(isGen ? "List" : "Area", a.name, isGen ? "Tasks that are not tied to one room." : listSummary(state, roots) || "No tasks yet.", true)}
        {isGen ? null : (
          <div className="area-tools">
            <button className="btn ghost sm" type="button" onClick={() => tryDeleteArea(id)}>
              Delete area
            </button>
          </div>
        )}
        {subareasSection(id)}
        <div className="section" style={{ marginTop: 16 }}>
          <div className="section-head">
            <h2>To do</h2>
            <span className="count">{listSummary(state, roots)}</span>
          </div>
          {addTaskForm(id, null)}
          <div style={{ height: 14 }} />
          {filterBar()}
          {taskList(roots, false)}
        </div>
        <div className="section">
          <div className="section-head">
            <h2>Needed{isGen ? "" : " here"}</h2>
          </div>
          {neededSection(id)}
        </div>
        {sidequestsSection(id)}
      </>
    )
  }

  const sidequestsSection = (areaId: string) => {
    const items = sidequestsOf(state, areaId)
    return (
      <div className="section">
        <div className="section-head">
          <h2>Sidequests</h2>
          <span className="count">
            {items.filter((q) => !q.done).length} open
          </span>
        </div>
        <form
          className="add"
          onSubmit={(e) => {
            e.preventDefault()
            const title = String(formData(e).get("title") || "").trim()
            if (!title) return
            patch((s) => addSidequest(s, areaId, title))
            setUi((u) => ({ ...u, sidequestMsg: "" }))
            e.currentTarget.reset()
          }}
        >
          <input type="text" name="title" required autoComplete="off" placeholder="Paint that mug, sort CDs…" />
          <button className="btn primary" type="submit">
            Add
          </button>
        </form>
        <div style={{ height: 10 }} />
        {items.length ? (
          <ul className="needed">
            {items.map((q) => (
              <li key={q.id} className={`need ${q.done ? "got" : ""}`}>
                <span className="txt">{q.title}</span>
                <div className="rowbtns">
                  <button className="del" type="button" aria-label={`Remove ${q.title}`} onClick={() => patch((s) => deleteSidequest(s, q.id))}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">Extras you notice while cleaning — not required for the house to be clean.</div>
        )}
      </div>
    )
  }

  const allView = () => {
    const total = state.tasks.filter((t) => !t.parentId)
    return (
      <>
        {header("Aggregate", "Whole house", listSummary(state, total) || "No tasks yet.", true)}
        <div style={{ height: 10 }} />
        {filterBar()}
        {allAreas(state).map((a) => {
          const roots = filterAndSort(state, rootsOf(state, a.id))
          if (!roots.length) return null
          return (
            <div className="section" key={a.id}>
              <div className="section-head">
                <h2>{a.name}</h2>
                <span className="count">{listSummary(state, rootsOf(state, a.id))}</span>
              </div>
              <ul className="tasks">{roots.map((t) => taskItem(t, false))}</ul>
            </div>
          )
        })}
      </>
    )
  }

  const neededView = () => {
    const left = state.needed.filter((n) => !n.got).length
    return (
      <>
        {header("Shopping", "Needed", `${left} item${left === 1 ? "" : "s"} to pick up, from every area`, true)}
        <div className="section" style={{ marginTop: 16 }}>
          {neededSection(null)}
        </div>
      </>
    )
  }

  const stuckView = () => {
    const n = state.stuckTasks.length
    const list = state.stuckTasks.slice().sort((a, b) => a.createdAt - b.createdAt)
    return (
      <>
        {header("Mode", "Stuck list", "Repeatable jobs for when you freeze — anytime tasks, or a timed stretch.", true)}
        <div className="stuck-cta">
          <button className="btn stuck-go" type="button" title={n ? "Start stuck mode" : "Add stuck tasks first"} onClick={startStuck}>
            Stuck
          </button>
          <div className="stuck-cta-copy">
            <div className="name">{n ? "Ready when you are" : "Build the list first"}</div>
            <div className="hint">
              {n ? "Starts a session and shows one task at a time. You will not see how many are left." : "Add things you can do on repeat, like “put 5 things away”, or a timed clean."}
            </div>
          </div>
        </div>
        <div className="section">
          <div className="section-head">
            <h2>Tasks</h2>
            <span className="count">
              {n} {n === 1 ? "item" : "items"}
            </span>
          </div>
          {ui.stuckMsg ? <div className="toast">{ui.stuckMsg}</div> : null}
          {addStuckForm()}
          <div style={{ height: 14 }} />
          {list.length ? (
            <ul className="stuck-list">
              {list.map((st) => (
                <li className="stuck-item" key={st.id}>
                  {ui.editingStuck === st.id ? (
                    <form
                      className="add stuck-add"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const fields = stuckFieldsFromForm(formData(e), ui.stuckEditKind || st.kind)
                        if (!fields.title) return
                        patch((s) => ({
                          ...s,
                          stuckTasks: s.stuckTasks.map((x) =>
                            x.id === st.id
                              ? { ...x, ...fields, id: st.id, actuals: x.actuals, createdAt: x.createdAt }
                              : x,
                          ),
                        }))
                        setUi((u) => ({ ...u, editingStuck: null, stuckEditKind: null }))
                      }}
                    >
                      <div className="stuck-kinds">
                        <button type="button" className={`chip ${(ui.stuckEditKind || st.kind) !== "timed" ? "on" : ""}`} onClick={() => setUi((u) => ({ ...u, stuckEditKind: "repeat" }))}>
                          Anytime
                        </button>
                        <button type="button" className={`chip ${(ui.stuckEditKind || st.kind) === "timed" ? "on" : ""}`} onClick={() => setUi((u) => ({ ...u, stuckEditKind: "timed" }))}>
                          Timed stretch
                        </button>
                      </div>
                      <input type="text" name="title" required defaultValue={st.title} autoFocus />
                      {(ui.stuckEditKind || st.kind) === "timed" ? stuckTimeFields(st) : stuckCountFields(st)}
                      <button className="btn primary" type="submit">
                        Save
                      </button>
                      <button className="btn ghost sm" type="button" onClick={() => setUi((u) => ({ ...u, editingStuck: null, stuckEditKind: null }))}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="row">
                      <div className="body">
                        <div className="title">{st.title}</div>
                        <div className="meta">
                          <span className="tag stuck">{st.kind === "timed" ? "Timed" : "Anytime"}</span>
                          <span>{stuckParamLabel(st)}</span>
                          {st.actuals.length ? (
                            <span>
                              {st.actuals.length} completion{st.actuals.length === 1 ? "" : "s"} · avg{" "}
                              <span className="act">{fmtClock(st.actuals.reduce((n, a) => n + a.sec, 0) / st.actuals.length)}</span>
                            </span>
                          ) : (
                            <span>No completions yet</span>
                          )}
                          {st.actuals.length ? (
                            <span className="stuck-times">
                              {st.actuals.map((a, i) => (
                                <span key={i} className="act">
                                  {i ? " · " : ""}
                                  {fmtClock(a.sec)}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="rowbtns">
                        <button type="button" title="Edit" aria-label="Edit stuck task" onClick={() => setUi((u) => ({ ...u, editingStuck: st.id, stuckEditKind: st.kind, stuckMsg: "" }))}>
                          ✎
                        </button>
                        <button
                          className="del"
                          type="button"
                          title="Delete"
                          onClick={() => {
                            if (!window.confirm(`Delete “${st.title}” from the stuck list?`)) return
                            patch((s) => ({ ...s, stuckTasks: s.stuckTasks.filter((x) => x.id !== st.id) }))
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">Nothing here yet. Add an anytime task — optionally with a number range like “pick up {"{n}"} items” — or a timed stretch.</div>
          )}
        </div>
      </>
    )
  }

  const planView = () => {
    const p = state.plan
    if (!p) {
      return (
        <>
          {header("Plan", "No plan", "Create one from the home screen.", true)}
          <div className="stuck-cta">
            <button className="btn plan-go" type="button" onClick={openPlan}>
              Create a plan
            </button>
          </div>
        </>
      )
    }
    if (p.phase === "draft") {
      return (
        <>
          {header("Plan", "Draft", "Finish the plan, then start the timer.", true)}
          <div className="stuck-cta">
            <div className="mode-btns">
              <button className="btn plan-go" type="button" onClick={openPlan}>
                Edit plan
              </button>
              <button className="btn primary" type="button" onClick={doStartPlan}>
                Start
              </button>
            </div>
          </div>
          <div className="plan-tiers run">{PLAN_TIERS.map((t) => planTierBlock(t.k, "plan-run"))}</div>
        </>
      )
    }
    const done = p.phase === "done"
    const running = !!(p.clock && p.clock.running)
    const left = done ? 0 : planLive(state, now)
    return (
      <>
        {header(
          "Plan",
          done ? "Plan complete" : "Working the plan",
          done ? "The timer ran out. Completions and actual time are saved on your lists." : "Countdown is the plan. Start, pause, and complete tasks as usual.",
          true,
        )}
        <div className={`plan-run-clock ${done ? "done" : ""} ${!done && left <= 60 ? "urgent" : ""}`}>
          <div className={`stuck-clock ${running ? "live" : ""}`}>{fmtClock(left)}</div>
          <div className="stuck-clock-label">{done ? "Finished" : running ? "Time left" : "Paused"}</div>
          {done ? (
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                persist(endPlan(stateRef.current))
                goHome()
              }}
            >
              Back to Tidy
            </button>
          ) : (
            <div className="stuck-controls">
              {running ? (
                <button className="btn stuck-pause" type="button" onClick={() => persist(planPause(stateRef.current))}>
                  {PAUSE} Pause
                </button>
              ) : (
                <button className="btn primary stuck-start" type="button" onClick={() => persist(planResume(stateRef.current))}>
                  {PLAY} Resume
                </button>
              )}
              <button
                className="btn ghost sm"
                type="button"
                onClick={() => {
                  if (state.plan?.phase === "run" && !window.confirm("End the plan? Completions you already made stay saved.")) return
                  persist(endPlan(stateRef.current))
                  goHome()
                }}
              >
                End plan
              </button>
            </div>
          )}
        </div>
        <div className="plan-tiers run">{PLAN_TIERS.map((t) => planTierBlock(t.k, "plan-run"))}</div>
      </>
    )
  }

  const runningTask = state.timer ? byId(state, state.timer.taskId) : null
  const ses = state.stuckSession
  const subSes = state.subareaSession
  const sqSes = state.sidequestSession
  const sqPick = sqSes?.phase === "pick"
  const sqRun = sqSes?.phase === "run"
  const sqOpen = !!(sqPick || sqRun)
  const sqLeft = sqRun ? sidequestLive(state, now) : 0
  const sqUrgent = sqRun && sqLeft <= 60
  const subItem = subSes && subSes.phase === "task" ? subSes.items[subSes.index] : null
  const subChecks = subareaSessionChecks(state)
  const subProgress = subareaProgress(state)
  const subThreshold = subareaEffectiveThreshold(state)
  const subGenerated = subItem && Number.isFinite(subItem.threshold) ? subItem.threshold : 100
  const subBank = subSes?.bank ?? 0
  const subCanNext = subareaCanAdvance(state)
  const subCopy =
    subItem?.kind === "sweep"
      ? {
          eyebrow: "Sweep",
          lead: "A quick sweep of this area — hit the bar to go next. Extra past the bar banks into later stops.",
        }
      : subItem?.kind === "box"
        ? {
            eyebrow: "Misc bin",
            lead: "Hit the bar to go next — you don't need every item. If the list is empty, go next now. Extra past the bar banks into later stops.",
          }
        : {
            eyebrow: "Perfect",
            lead: "Get through every stop at the bar, not 100% every room. Next unlocks at the minimum; you can keep going and bank the extra.",
          }
  const stuckItem = ses && ses.phase === "task" ? ses.items[ses.index] : null
  const stuckRunning = !!(ses?.clock && ses.clock.running)
  const stuckStarted = !!(ses?.clock && (ses.clock.running || (stuckItem?.kind === "repeat" ? (ses.clock.baseSec || 0) > 0 : (ses.clock.baseSec || 0) < (stuckItem?.durationSec || 0))))
  const stuckClock = fmtClock(stuckLive(state, now))
  const stuckUrgent = stuckItem?.kind === "timed" && stuckLive(state, now) <= 30
  const sessionLive = !!(ses || subSes || sqOpen)
  const overlayOpen = ui.sessionOverlay && sessionLive
  const sessionTitle =
    subItem?.title ||
    stuckItem?.title ||
    (sqOpen && sqSes ? sqSes.title : "") ||
    (subSes?.phase === "done" || ses?.phase === "done" ? "That's enough for now." : "Session")
  const sessionKind = subSes ? (subItem ? subCopy.eyebrow : "Subareas") : ses ? "Stuck" : sqOpen ? "Sidequest" : ""
  const sessionClock =
    ses?.phase === "task" && stuckItem?.kind === "timed" && stuckRunning
      ? stuckClock
      : sqRun && sqSes?.clock?.running
        ? fmtClock(sqLeft)
        : null
  const overlayCloseBtn = (
    <button className="overlay-close" type="button" aria-label="Close" onClick={hideSessionOverlay}>
      ×
    </button>
  )

  let body: ReactNode
  if (route.view === "area") body = areaView(route.id)
  else if (route.view === "all") body = allView()
  else if (route.view === "needed") body = neededView()
  else if (route.view === "stuck") body = stuckView()
  else if (route.view === "plan") body = planView()
  else body = homeView()

  const theme = state.theme === "light" || state.theme === "dark" ? state.theme : undefined

  return (
    <div
      className={`tidy${(ses || subSes) && overlayOpen ? " stuck-open" : ""}${sqOpen && overlayOpen ? " sidequest-open" : ""}${ui.planOpen ? " plan-open" : ""}`}
      data-theme={theme}
      onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 6)}
      style={{ maxHeight: "calc(100vh - 180px)", overflow: "auto" }}
    >
      <div className="tidy-app">{body}</div>

      <div className="tidy-focusbar" aria-live="polite">
        {sessionLive && !overlayOpen ? (
          <div className="inner session-resume">
            <span className="pulse" />
            <div className="what">
              <div className="t">{sessionTitle}</div>
              <div className="w">{sessionKind}</div>
            </div>
            {sessionClock ? <div className="clock">{sessionClock}</div> : null}
            <button className="btn primary sm" type="button" onClick={resumeSessionOverlay}>
              Resume
            </button>
          </div>
        ) : ses || subSes || sqRun || !runningTask ? null : (
          <div className="inner">
            <span className="pulse" />
            <div className="what">
              <div className="t">{runningTask.title}</div>
              <div className="w">
                {areaById(state, runningTask.areaId)?.name || ""}
                {runningTask.estMin ? ` · ${fmtMin(runningTask.estMin)} est` : ""}
              </div>
            </div>
            <div className="clock">{fmtClock(liveSec(state, runningTask, now))}</div>
            <div className="runctl">
              <button
                className="pause"
                type="button"
                aria-label="Stop"
                onClick={() => persist(commitTimer(stateRef.current))}
              >
                {PAUSE}
              </button>
              <button className="fin" type="button" aria-label="Complete" onClick={() => persist(completeTask(stateRef.current, runningTask.id))}>
                {CHECK}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`tidy-stucklayer${(ses || subSes) && overlayOpen ? " on" : ""}`}>
        {ses?.phase === "done" ? (
          <>
            <div className="stuck-veil" onClick={hideSessionOverlay} />
            <div className="stuck-card" role="dialog" aria-modal="true">
              {overlayCloseBtn}
              <div className="eyebrow">Stuck</div>
              <h2>That's enough for now.</h2>
              <p className="stuck-lead">Every completion is saved on the stuck list, including how long it actually took.</p>
              <button className="btn primary" type="button" onClick={() => persist(endStuckMode(stateRef.current))}>
                Back to Tidy
              </button>
            </div>
          </>
        ) : stuckItem ? (
          <>
            <div className="stuck-veil" onClick={hideSessionOverlay} />
            <div className={`stuck-card ${ui.stuckFreshKey ? "fresh" : ""}`} role="dialog" aria-modal="true">
              {overlayCloseBtn}
              <div className="eyebrow">{stuckItem.random ? "Stuck · random" : "Stuck"}</div>
              <h2>{stuckItem.title}</h2>
              <div className={`stuck-clock ${stuckItem.kind} ${stuckRunning ? "live" : ""} ${stuckUrgent ? "urgent" : ""}`}>{stuckClock}</div>
              <div className="stuck-clock-label">
                {stuckItem.kind === "timed" ? (stuckRunning ? "Time left" : stuckStarted ? "Paused" : "Countdown") : stuckRunning ? "Working" : stuckStarted ? "Paused" : "Ready"}
              </div>
              <div className="stuck-controls">
                {stuckItem.kind === "timed" ? (
                  stuckRunning ? (
                    <button className="btn stuck-pause" type="button" onClick={() => persist(stuckPause(stateRef.current))}>
                      {PAUSE} Pause
                    </button>
                  ) : (
                    <button className="btn primary stuck-start" type="button" onClick={() => persist(stuckStartClock(stateRef.current))}>
                      {PLAY} {stuckStarted ? "Resume" : "Start"}
                    </button>
                  )
                ) : stuckRunning ? (
                  <>
                    <button className="btn stuck-pause" type="button" onClick={() => persist(stuckPause(stateRef.current))}>
                      {PAUSE} Pause
                    </button>
                    <button className="btn stuck-fin" type="button" onClick={() => persist(stuckComplete(stateRef.current))}>
                      {CHECK} Complete
                    </button>
                  </>
                ) : stuckStarted ? (
                  <>
                    <button className="btn primary stuck-start" type="button" onClick={() => persist(stuckStartClock(stateRef.current))}>
                      {PLAY} Resume
                    </button>
                    <button className="btn stuck-fin" type="button" onClick={() => persist(stuckComplete(stateRef.current))}>
                      {CHECK} Complete
                    </button>
                  </>
                ) : (
                  <button className="btn primary stuck-start" type="button" onClick={() => persist(stuckStartClock(stateRef.current))}>
                    {PLAY} Start
                  </button>
                )}
              </div>
              {stuckItem.random ? (
                <button className="btn stuck-switch" type="button" onClick={() => persist(stuckSwitch(stateRef.current))}>
                  Switch
                </button>
              ) : null}
              <button
                className="btn ghost sm stuck-leave"
                type="button"
                onClick={() => {
                  if (ses?.phase === "task" && !window.confirm("End stuck mode? This task will not be saved as a completion.")) return
                  persist(endStuckMode(stateRef.current))
                }}
              >
                End session
              </button>
            </div>
          </>
        ) : subSes?.phase === "done" ? (
          <>
            <div className="stuck-veil" onClick={hideSessionOverlay} />
            <div className="stuck-card" role="dialog" aria-modal="true">
              {overlayCloseBtn}
              <div className="eyebrow">Subareas</div>
              <h2>That's enough for now.</h2>
              <p className="stuck-lead">You made it through every stop at the bar. Come back anytime for another round.</p>
              <button className="btn primary" type="button" onClick={() => persist(endSubareaSession(stateRef.current))}>
                Back to Tidy
              </button>
            </div>
          </>
        ) : subItem ? (
          <>
            <div className="stuck-veil" onClick={hideSessionOverlay} />
            <div className="stuck-card subarea-card" role="dialog" aria-modal="true">
              {overlayCloseBtn}
              <div className="eyebrow">{subCopy.eyebrow}</div>
              <h2>{subItem.title}</h2>
              <p className="stuck-lead">{subCopy.lead}</p>
              <div className={`subarea-progress ${subCanNext && subProgress.totalLeaves ? "met" : ""}`}>
                <div className="goal-row-top">
                  <span>{subProgress.totalLeaves ? "This stop" : "Nothing to do"}</span>
                  <span className="val">
                    {subProgress.totalLeaves
                      ? `${subProgress.doneLeaves} / ${subProgress.totalLeaves} · ${subProgress.percent}%`
                      : "Complete"}
                  </span>
                </div>
                <div
                  className="goal-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={subProgress.percent}
                  aria-label="Checklist progress"
                >
                  <i style={{ width: `${subProgress.percent}%` }} />
                  <span className="subarea-threshold-mark" style={{ left: `${subThreshold}%` }} aria-hidden="true" />
                </div>
                <div className="subarea-stats">
                  <span>
                    Bar {subGenerated}%
                  </span>
                  <span>
                    Banked {subBank}%
                  </span>
                  <span>
                    Next at {subThreshold}%
                  </span>
                  <span>
                    Now {subProgress.percent}%
                  </span>
                </div>
                {subGenerated !== subThreshold ? (
                  <div className="subarea-threshold-label">
                    {subGenerated}% − {subBank}% = Next at {subThreshold}%
                  </div>
                ) : null}
              </div>
              {subChecks.length ? (
                <ul className="needed subarea-checks">{subChecks.map((c) => subareaCheckItem(c))}</ul>
              ) : (
                <div className="empty">Nothing on the list — add tasks, or go next if this is already done.</div>
              )}
              <form
                className="add"
                onSubmit={(e) => {
                  e.preventDefault()
                  const title = String(formData(e).get("title") || "").trim()
                  if (!title) return
                  persist(addSubareaCheck(stateRef.current, title))
                  e.currentTarget.reset()
                }}
              >
                <input
                  type="text"
                  name="title"
                  required
                  autoComplete="off"
                  placeholder="What this spot needs — sort books, clean shelves, declutter…"
                />
                <button className="btn primary" type="submit">
                  Add to list
                </button>
              </form>
              <div className="stuck-controls">
                <button
                  className="btn primary subarea-next"
                  type="button"
                  disabled={!subCanNext}
                  title={subCanNext ? "Move to the next stop" : "Reach the bar to go next, or leave the list empty"}
                  onClick={() => {
                    setUi((u) => ({ ...u, addCheckSub: null }))
                    persist(subareaComplete(stateRef.current))
                  }}
                >
                  Next
                </button>
              </div>
              <button
                className="btn ghost sm stuck-leave"
                type="button"
                onClick={() => {
                  if (subSes?.phase === "task" && !window.confirm("End this session? Completions you already made stay saved.")) return
                  persist(endSubareaSession(stateRef.current))
                  setUi((u) => ({ ...u, addCheckSub: null }))
                }}
              >
                End session
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className={`tidy-sidequestlayer${sqOpen && overlayOpen ? " on" : ""}`}>
        {sqPick && sqSes ? (
          <>
            <div className="sidequest-veil" onClick={hideSessionOverlay} />
            <div className="sidequest-card" role="dialog" aria-modal="true" aria-label="Sidequest picker">
              {overlayCloseBtn}
              <div className="eyebrow">Sidequest</div>
              <h2>{sqSes.title}</h2>
              <p className="stuck-lead">{areaById(state, sqSes.areaId)?.name || "Somewhere in the house"}</p>
              {ui.sidequestSeeAll ? (
                <ul className="needed sidequest-all">
                  {openSidequests(state).map((q) => (
                    <li key={q.id} className={`need ${q.id === sqSes.sidequestId ? "on" : ""}`}>
                      <button
                        type="button"
                        className="sidequest-pick"
                        onClick={() => persist(selectSidequest(stateRef.current, q.id))}
                      >
                        <span className="txt">{q.title}</span>
                        <span className="where">{areaById(state, q.areaId)?.name || ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="stuck-controls">
                <button className="btn" type="button" onClick={() => persist(shuffleSidequestPick(stateRef.current))}>
                  Shuffle
                </button>
                <button
                  className={`btn ${ui.sidequestSeeAll ? "on" : ""}`}
                  type="button"
                  onClick={() => setUi((u) => ({ ...u, sidequestSeeAll: !u.sidequestSeeAll }))}
                >
                  {ui.sidequestSeeAll ? "Hide list" : "See all sidequests"}
                </button>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => {
                    const next = startSidequest(stateRef.current)
                    if ("error" in next) {
                      setUi((u) => ({ ...u, sidequestMsg: next.error }))
                      return
                    }
                    persist(next)
                    setUi((u) => ({ ...u, sidequestSeeAll: false, sidequestMsg: "" }))
                  }}
                >
                  Start
                </button>
              </div>
              <button
                className="btn ghost sm stuck-leave"
                type="button"
                onClick={() => {
                  persist(dismissSidequest(stateRef.current))
                  setUi((u) => ({ ...u, sidequestSeeAll: false }))
                }}
              >
                Not now
              </button>
            </div>
          </>
        ) : sqRun && sqSes ? (
          <>
            <div className="sidequest-veil" onClick={hideSessionOverlay} />
            <div className="sidequest-card" role="dialog" aria-modal="true" aria-label="Sidequest timer">
              {overlayCloseBtn}
              <div className="eyebrow">Sidequest</div>
              <h2>{sqSes.title}</h2>
              <p className="stuck-lead">{areaById(state, sqSes.areaId)?.name || ""} — max time, then back to work.</p>
              <div className={`stuck-clock ${sqUrgent ? "urgent" : ""}`}>{fmtClock(sqLeft)}</div>
              <div className="stuck-clock-label">{sqUrgent ? "Wrap up" : "Time left"}</div>
              <div className="stuck-controls">
                <button className="btn stuck-fin" type="button" onClick={() => persist(completeSidequest(stateRef.current))}>
                  {CHECK} Done
                </button>
                <button className="btn ghost" type="button" onClick={() => persist(dismissSidequest(stateRef.current))}>
                  Back to work
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className={`tidy-planlayer${ui.planOpen ? " on" : ""}`}>
        {ui.planOpen && state.plan ? (
          <>
            <div className="plan-veil" onClick={() => setUi((u) => ({ ...u, planOpen: false, planPicker: null, planNew: null }))} />
            <div className="plan-sheet" role="dialog" aria-modal="true">
              <div className="plan-sheet-top">
                <div>
                  <div className="eyebrow">Normal mode</div>
                  <h2>Create a plan</h2>
                </div>
                <button className="btn ghost sm" type="button" onClick={() => setUi((u) => ({ ...u, planOpen: false, planPicker: null, planNew: null }))}>
                  Close
                </button>
              </div>
              <div className="plan-dur">
                <span>Timer</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={state.plan.durationHr}
                  aria-label="Hours"
                  onChange={(e) =>
                    patch((s) => {
                      if (!s.plan) return s
                      const durationHr = Math.max(0, Number(e.target.value) || 0)
                      const next = { ...s.plan, durationHr }
                      return { ...s, plan: { ...next, durationSec: planSec(next) } }
                    })
                  }
                />
                <span>hr</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={state.plan.durationMin}
                  aria-label="Minutes"
                  onChange={(e) =>
                    patch((s) => {
                      if (!s.plan) return s
                      const durationMin = Math.max(0, Math.min(59, Number(e.target.value) || 0))
                      const next = { ...s.plan, durationMin }
                      return { ...s, plan: { ...next, durationSec: planSec(next) } }
                    })
                  }
                />
                <span>min</span>
              </div>
              <div className="hint">Pick tasks from any to-do list, or create new ones. Edits to title, estimate, and subtasks save on the real tasks. Importance stays off this screen.</div>
              <div className="plan-tiers">{PLAN_TIERS.map((t) => planTierBlock(t.k, "plan-edit"))}</div>
              <div className="plan-sheet-foot">
                <button className="btn primary plan-start" type="button" onClick={doStartPlan}>
                  Start
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
