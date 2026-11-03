/**
 * components/Home/ToDo/todo-panel.tsx — To Do door
 *
 * Switches the phone page and the desk. At max-width 767px it mounts
 * `TodoPhonePage` and does not mount the desk. From 768px up it mounts
 * `TodoDeskPanel` and does not mount the phone page.
 */
"use client"

import { useTodoPhone } from "./use-todo-phone"
import { TodoPhonePage } from "./todo-phone-page"
import { TodoDeskPanel } from "./desk/todo-desk-panel"

/** Desktop page or phone page. The two trees are never mounted together. */
export function TodoPanel({
  currentDate,
  setCurrentDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  const phone = useTodoPhone()
  if (phone) return <TodoPhonePage currentDate={currentDate} setCurrentDate={setCurrentDate} />
  return <TodoDeskPanel currentDate={currentDate} setCurrentDate={setCurrentDate} />
}
