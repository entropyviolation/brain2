/**
 * components/Mobile/use-in-mobile-shell.ts — Is this tree the iOS shell?
 *
 * True only after paint, and only when `.cogs-mobile-app` is in the document.
 * The server snapshot is false, so a shared tile hydrates as the desktop
 * tree. Electron and the desktop page never mount that class.
 */
"use client"

import { useSyncExternalStore } from "react"

function subscribe() {
  return () => {}
}

function inShell() {
  return document.querySelector(".cogs-mobile-app") != null
}

export function useInMobileShell(): boolean {
  return useSyncExternalStore(subscribe, inShell, () => false)
}
