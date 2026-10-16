/**
 * lib/people-self.ts — The person this vault belongs to
 *
 * After the task vault hydrates, People I Know gets one item titled "self"
 * with the nickname "me" (`personProfile.self`). It is made once. Deleting it
 * sticks: the hard-delete tombstone and a one-time flag both stop it coming
 * back. Self's links from each person's Relation word are derived in
 * `lib/self-relations.ts`, not stored.
 */
import { createPerson, ensurePeopleIKnowList } from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import { demoPhysicalKey, isDemoProfile } from "@/lib/storage-keys"
import type { Task } from "@/lib/types"

export const PEOPLE_SELF_ID = "person-self"
export const PEOPLE_SELF_TITLE = "self"
export const PEOPLE_SELF_FLAG = "brain2-people-self-v1"

export function isSelfPerson(task: Pick<Task, "id" | "personProfile"> | null | undefined): boolean {
  return !!task && (task.id === PEOPLE_SELF_ID || task.personProfile?.self === true)
}

export function findSelfPerson(tasks: Task[]): Task | undefined {
  return tasks.find((task) => task.id === PEOPLE_SELF_ID) ?? tasks.find((task) => task.personProfile?.self === true)
}

/** Demo keeps its own flag so a Live self does not stop the Demo one. */
function flagKey(): string {
  return isDemoProfile() ? demoPhysicalKey(PEOPLE_SELF_FLAG) : PEOPLE_SELF_FLAG
}

function readFlag(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(flagKey()) === "1"
  } catch {
    return false
  }
}

function writeFlag(): void {
  try {
    localStorage.setItem(flagKey(), "1")
  } catch {
    /* private mode: the tombstone still holds */
  }
}

/** Create "self" once. Returns its id, or null when it was deleted on purpose. */
export function ensureSelfPerson(): string | null {
  const store = useTaskStore.getState()
  const existing = findSelfPerson(store.tasks)
  if (existing) {
    writeFlag()
    return existing.id
  }
  if (readFlag() || (store.removedTaskIds ?? []).includes(PEOPLE_SELF_ID)) return null
  const listId = ensurePeopleIKnowList()
  store.addTask({
    ...createPerson(PEOPLE_SELF_TITLE, listId),
    id: PEOPLE_SELF_ID,
    personProfile: { nicknames: ["me"], self: true },
  })
  writeFlag()
  return PEOPLE_SELF_ID
}
