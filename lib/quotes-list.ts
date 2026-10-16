/**
 * lib/quotes-list.ts — The "Quotes" list behind BIM's quote of the day
 *
 * `ensureQuotesList` creates a list named Quotes when none exists. Each open
 * item on it is one quote, written the way it should be shown
 * (`“…” — Author`). `pickQuote` draws one at random. `QUOTE_HEROES` is the
 * roster the list is meant to be filled from; it is names only.
 */
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isClearedFromWork } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { List } from "@/lib/types"

export const QUOTES_LIST_NAME = "Quotes"

export const QUOTE_HEROES: readonly string[] = [
  "Slavoj Žižek", "Ada Lovelace", "Erwin Schrödinger", "David Bohm", "Max Tegmark", "Carl Jung",
  "Douglas Hofstadter", "Marilyn Monroe", "Nikola Tesla", "Lex Fridman", "Fritjof Capra",
  "Alfred Korzybski", "Hugh Everett", "Stanley Kubrick", "Richard Feynman", "David Lynch",
  "Joseph Campbell", "Alan Watts", "Marshall McLuhan", "Alan Turing", "Carl Sagan", "Lynn Margulis",
  "James Clerk Maxwell", "Ludwig Boltzmann", "Thomas Kuhn", "Kurt Gödel", "John von Neumann",
  "Norbert Wiener", "Evelyne Andreewsky", "Pille Bunnell", "Margaret Mead", "Eva Jablonka",
  "Barbara Ann Brennan", "Jean Piaget", "William James", "Hypatia of Alexandria", "Bernie Sanders",
  "Leonhard Euler", "Björk", "Brian Eno", "Alejandro Jodorowsky", "Carl Friedrich Gauss",
  "Benoit Mandelbrot", "Alexander Shulgin", "Edward Snowden", "Julian Assange", "Hedy Lamarr",
  "Buckminster Fuller", "Terence McKenna", "Gregory Bateson", "Rupert Sheldrake", "John C. Lilly",
  "Manfred Clynes", "Vilayanur S. Ramachandran", "Ilya Prigogine", "Robert Anton Wilson",
  "Paul Feyerabend", "Jacques Vallée", "John Archibald Wheeler", "Julian Jaynes", "Emanuel Swedenborg",
  "Philip K. Dick", "Werner Heisenberg", "Ervin László", "Nassim Haramein", "Jiddu Krishnamurti",
  "Aldous Huxley", "Austin Osman Spare", "Hilma af Klint", "Israel Regardie", "G.I. Gurdjieff",
  "Peter J. Carroll", "Robert Monroe", "John Dee", "Immanuel Velikovsky", "Charles Fort",
  "R.A. Schwaller de Lubicz", "Idries Shah", "Dion Fortune", "Colin Wilson", "Kenneth Grant",
  "Oswald Spengler", "Nikolai Fyodorov", "Franz Bardon", "René Guénon", "Julius Evola",
  "Andrew Chumbley", "Srinivasa Ramanujan", "Emmy Noether", "Hildegard of Bingen", "Ban Zhao",
  "George Washington Carver", "Rosalind Franklin", "Ibn al-Haytham", "Zora Neale Hurston",
  "Nikolai Vavilov", "Gauri Ma", "Chien-Shiung Wu", "Octavia Butler", "Fe del Mundo", "Wang Zhenyi",
]

export function findQuotesList(): List | null {
  const want = QUOTES_LIST_NAME.toLowerCase()
  return (
    useTaskStore
      .getState()
      .lists.find((list) => !isFolderAllItemsCategoryId(list.id) && list.name.trim().toLowerCase() === want) ?? null
  )
}

export function ensureQuotesList(now = new Date()): List {
  const existing = findQuotesList()
  if (existing) return existing
  const list: List = {
    id: `list-quotes-${now.getTime().toString(36)}`,
    name: QUOTES_LIST_NAME,
    color: "#64748b",
    description: "One quote per item, shown as BIM's quote of the day",
    createdAt: now,
    scheduleable: false,
  }
  useTaskStore.getState().addList(list)
  return useTaskStore.getState().lists.find((l) => l.id === list.id) ?? list
}

export function quoteLines(): string[] {
  const list = findQuotesList()
  if (!list) return []
  return useTaskStore
    .getState()
    .tasks.filter((task) => task.lists?.includes(list.id) && !isClearedFromWork(task))
    .map((task) => itemTitleOrUntitled(task).trim())
    .filter(Boolean)
}

/** One open quote at random, or null when the list is empty. */
export function pickQuote(random: () => number = Math.random): string | null {
  const lines = quoteLines()
  if (!lines.length) return null
  return lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))]!
}
