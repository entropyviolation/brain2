/**
 * lib/people-self.ts — The "self" person on People I Know
 *
 * One item that stands for you, so links can say "Oey is your sister" (plan
 * `docs/PERSON_DETAIL_REDESIGN.md` 4.1, 7.1). Created once, after the task
 * vault hydrates and People I Know exists. Deleting it sticks: the id lands in
 * `removedTaskIds`, and a one-time flag stops it coming back either way.
 *
 * People sync (`lib/people-sync.ts`) only runs pen → item, so Self never makes
 * a Company pen.
 */
import { createPerson, ensurePeopleIKnowList } from "@/lib/people-i-know"
import { persistKey } from "@/lib/storage-keys"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

export const PEOPLE_SELF_ID = "person-self"
export const PEOPLE_SELF_FLAG = persistKey("people-self-v1")

export function isSelfPerson(task: Pick<Task, "id" | "personProfile"> | null | undefined): boolean {
  return !!task && (task.id === PEOPLE_SELF_ID || task.personProfile?.self === true)
}

function flagSet(): boolean {
  try {
    return localStorage.getItem(PEOPLE_SELF_FLAG) === "1"
  } catch {
    return false
  }
}

function setFlag(): void {
  try {
    localStorage.setItem(PEOPLE_SELF_FLAG, "1")
  } catch {
    // Storage blocked: the id check still stops duplicates.
  }
}

/** Create Self once. Returns its id, or null when it was skipped. */
export function ensureSelfPerson(): string | null {
  const store = useTaskStore.getState()
  const existing = store.tasks.find((task) => isSelfPerson(task))
  if (existing) {
    setFlag()
    return existing.id
  }
  if ((store.removedTaskIds ?? []).includes(PEOPLE_SELF_ID) || flagSet()) return null
  const listId = ensurePeopleIKnowList()
  store.addTask({
    ...createPerson("self", listId),
    id: PEOPLE_SELF_ID,
    personProfile: { nicknames: ["me"], self: true },
  })
  setFlag()
  return PEOPLE_SELF_ID
}
