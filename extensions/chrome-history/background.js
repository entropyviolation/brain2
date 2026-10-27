/**
 * extensions/chrome-history/background.js — Yesterday's Chrome history, each night.
 *
 * At 00:05 local time the day that just ended is read from chrome.history,
 * posted to Brain2 on 127.0.0.1:3000, and saved as JSON in Downloads.
 * If Chrome was closed, the missed alarm runs on the next launch and each
 * missing day is exported in turn. Visits stay in chrome.storage until Brain2
 * accepts them.
 */
import { addDays, dayBounds, daysThrough, exportFileName, nextClose, safeProfile, yesterdayKey } from "./export-day.mjs"

const BRAIN2_ORIGIN = "http://127.0.0.1:3000"
const ALARM_CLOSE = "brain2-day-close"
const ALARM_WORK = "brain2-history-work"
const SEARCH_CAP = 10000

async function load() {
  const stored = await chrome.storage.local.get(["profile", "saveFiles", "done", "pending", "catchupFrom", "lastError"])
  return {
    profile: safeProfile(stored.profile || "Chrome"),
    saveFiles: stored.saveFiles !== false,
    done: stored.done && typeof stored.done === "object" ? stored.done : {},
    pending: stored.pending && typeof stored.pending === "object" ? stored.pending : {},
    catchupFrom: typeof stored.catchupFrom === "string" ? stored.catchupFrom : "",
    lastError: typeof stored.lastError === "string" ? stored.lastError : "",
  }
}

async function save(patch) {
  await chrome.storage.local.set(patch)
}

function statusOf(state) {
  const days = Object.keys(state.done).sort()
  return {
    profile: state.profile,
    saveFiles: state.saveFiles,
    lastDay: days.length ? days[days.length - 1] : "",
    pending: Object.keys(state.pending).length,
    lastError: state.lastError,
  }
}

async function visitsForDay(day) {
  const { start, end } = dayBounds(day)
  const items = await chrome.history.search({ text: "", startTime: start, maxResults: SEARCH_CAP })
  const rows = []
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++]
      if (!item || typeof item.url !== "string" || !item.url) continue
      let visits = []
      try {
        visits = await chrome.history.getVisits({ url: item.url })
      } catch {
        continue
      }
      for (const visit of visits) {
        if (typeof visit.visitTime !== "number" || visit.visitTime < start || visit.visitTime >= end) continue
        rows.push({
          url: item.url,
          title: typeof item.title === "string" ? item.title : "",
          visitTime: Math.round(visit.visitTime),
          transition: typeof visit.transition === "string" ? visit.transition : "link",
        })
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()))
  rows.sort((a, b) => a.visitTime - b.visitTime || a.url.localeCompare(b.url))
  return { rows, capped: items.length >= SEARCH_CAP }
}

async function notifyTabs(type) {
  const tabs = await chrome.tabs.query({ url: ["http://localhost:3000/*", "http://127.0.0.1:3000/*"] })
  await Promise.all(tabs.map((tab) => (tab.id == null ? null : chrome.tabs.sendMessage(tab.id, { type }).catch(() => {}))))
}

async function postDay(state, day, visits) {
  const res = await fetch(`${BRAIN2_ORIGIN}/api/chrome-history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brain2: "chrome-history", profile: state.profile, day, visits }),
  })
  if (!res.ok) throw new Error(`Brain2 answered ${res.status}`)
}

async function saveFile(state, day, visits) {
  // The service worker has URL, but not URL.createObjectURL. A data URL is the download.
  const json = JSON.stringify({ brain2: "chrome-history", profile: state.profile, day, visits })
  await chrome.downloads.download({
    url: "data:application/json;charset=utf-8," + encodeURIComponent(json),
    filename: exportFileName(state.profile, day),
    saveAs: false,
    conflictAction: "overwrite",
  })
}

async function deliver(state, day) {
  const held = state.pending[day]
  if (!held) return state
  const problems = []
  try {
    await postDay(state, day, held.visits)
    delete state.pending[day]
    await notifyTabs("poll")
  } catch (err) {
    problems.push(err instanceof Error ? err.message : "Brain2 was not open.")
    await notifyTabs("push")
  }
  if (state.saveFiles && !held.saved) {
    try {
      await saveFile(state, day, held.visits)
      if (state.pending[day]) state.pending[day].saved = true
    } catch (err) {
      problems.push(err instanceof Error ? err.message : "Could not save the JSON file.")
    }
  }
  const error = problems.join(" ")
  state.lastError = error
  await save({ pending: state.pending, lastError: error })
  return state
}

async function exportDay(day) {
  const state = await load()
  if (!state.done[day]) {
    const { rows, capped } = await visitsForDay(day)
    state.done[day] = { visits: rows.length, at: Date.now(), capped }
    if (rows.length) state.pending[day] = { profile: state.profile, visits: rows, saved: false }
    await save({ done: state.done, pending: state.pending, lastError: rows.length ? state.lastError : "" })
  }
  if (state.pending[day]) await deliver(state, day)
  return load()
}

function nextUndone(state, now = Date.now()) {
  const yesterday = yesterdayKey(now)
  const start = state.catchupFrom && state.catchupFrom < yesterday ? state.catchupFrom : yesterday
  return daysThrough(start, yesterday).find((day) => !state.done[day]) || ""
}

async function workOne() {
  const state = await load()
  const day = nextUndone(state)
  if (day) await exportDay(day)
  else {
    const waiting = Object.keys(state.pending).sort()
    if (waiting[0]) await deliver(state, waiting[0])
  }
  const next = await load()
  if (nextUndone(next)) chrome.alarms.create(ALARM_WORK, { when: Date.now() + 1000 })
  else if (Object.keys(next.pending).length) chrome.alarms.create(ALARM_WORK, { when: Date.now() + 15 * 60 * 1000 })
  return next
}

function scheduleClose() {
  chrome.alarms.create(ALARM_CLOSE, { when: nextClose() })
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleClose()
  chrome.alarms.create(ALARM_WORK, { when: Date.now() + 1500 })
})

chrome.runtime.onStartup.addListener(() => {
  scheduleClose()
  chrome.alarms.create(ALARM_WORK, { when: Date.now() + 1500 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_CLOSE) {
    scheduleClose()
    chrome.alarms.create(ALARM_WORK, { when: Date.now() + 500 })
    return
  }
  if (alarm.name === ALARM_WORK) void workOne()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message && message.type
  if (type === "status") {
    load().then((state) => sendResponse(statusOf(state)))
    return true
  }
  if (type === "pending") {
    load().then((state) => {
      const files = Object.entries(state.pending).map(([day, held]) => ({
        day,
        profile: held.profile || state.profile,
        visits: held.visits,
      }))
      sendResponse({ files })
    })
    return true
  }
  if (type === "ack" && Array.isArray(message.days)) {
    load().then(async (state) => {
      for (const day of message.days) delete state.pending[day]
      await save({ pending: state.pending, lastError: "" })
      sendResponse(statusOf(state))
    })
    return true
  }
  if (type === "setProfile") {
    const profile = safeProfile(message.profile)
    save({ profile }).then(() => load().then((state) => sendResponse(statusOf(state))))
    return true
  }
  if (type === "setSaveFiles") {
    save({ saveFiles: Boolean(message.saveFiles) }).then(() => load().then((state) => sendResponse(statusOf(state))))
    return true
  }
  if (type === "exportYesterday") {
    exportDay(yesterdayKey()).then((state) => {
      if (Object.keys(state.pending).length) chrome.alarms.create(ALARM_WORK, { when: Date.now() + 15 * 60 * 1000 })
      sendResponse(statusOf(state))
    })
    return true
  }
  if (type === "backfill") {
    const from = addDays(yesterdayKey(), -89)
    save({ catchupFrom: from }).then(() => workOne().then((state) => sendResponse(statusOf(state))))
    return true
  }
  return false
})
