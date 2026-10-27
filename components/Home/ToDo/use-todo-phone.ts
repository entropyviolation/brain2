/**
 * components/Home/ToDo/use-todo-phone.ts — Which To Do page is mounted
 *
 * Phone page at max-width 767px. From 768px up, the desktop fascia.
 * The server snapshot is desktop so hydration matches; the client snapshot
 * follows `matchMedia` after that.
 */
"use client"

import { useSyncExternalStore } from "react"

/** Mount `todo-phone-page.tsx`. Wider than this, mount the desktop tree only. */
export const TODO_PHONE_QUERY = "(max-width: 767px)"

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(TODO_PHONE_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

function snapshot() {
  return window.matchMedia(TODO_PHONE_QUERY).matches
}

export function useTodoPhone(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
