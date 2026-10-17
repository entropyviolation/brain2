/**
 * lib/vocab-lists.ts — Languages folder and the 1000 most common words lists
 *
 * Lists gets a root folder **Languages** with one folder per target language
 * (French, Spanish, Italian, German, Japanese, Mandarin). Each language folder
 * holds two lists, named in that language:
 *
 * - the 1000 most common words (`vocab-1000-<lang>`), e.g. "1000 mots les plus
 *   courants en français". Ranked by wordfreq; data in
 *   `lib/vocab/frequency/<lang>.json` (`scripts/build-vocab-frequency.py`).
 * - my words (`vocab-mine-<lang>`): words added from a dictionary lookup.
 *
 * The folders and lists always exist. The 1000 word items are written only
 * for languages added to the Vocab widget, because the item vault shares
 * browser storage (about 0.35 MB per language). One word is one item with a
 * stable id (`vocab-<lang>-0001`), so a second device or a refill never makes
 * a copy, and a word deleted in Lists stays deleted (tombstones are skipped).
 *
 * Known is a boolean attribute on the item (`vocab-known`), so the Lists
 * table and the Vocab widget show and change the same tick. Items carry no
 * reward points and are never scheduled.
 */
"use client"

import { createListItem } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { AttributeDefinition, Folder, ItemRecord, List, Task } from "@/lib/types"
import type { VocabLang } from "@/lib/vocab/types"

/** Languages with a bundled 1000-word list. German keeps its daily word but has no list yet. */
export type ThousandLang = Exclude<VocabLang, "en" | "de">

export const THOUSAND_LANGS: ThousandLang[] = ["fr", "es", "it", "ja", "zh"]

export function isThousandLang(lang: VocabLang): lang is ThousandLang {
  return lang !== "en" && lang !== "de"
}

/** One ranked word as bundled. `reading` is kana or pinyin; `ipa` has no slashes. */
export type FrequencyWord = {
  rank: number
  word: string
  pos: string
  gloss: string
  ipa?: string
  reading?: string
  romanization?: string
}

export const LANGUAGES_FOLDER_ID = "vocab-languages"
export const LANGUAGES_FOLDER_NAME = "Languages"

const FOLDER_NAME: Record<ThousandLang, string> = {
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ja: "Japanese",
  zh: "Mandarin",
}

/** "1000 most common words in {language}", written in that language. */
export const THOUSAND_LIST_NAME: Record<ThousandLang, string> = {
  fr: "1000 mots les plus courants en français",
  es: "Las 1000 palabras más comunes en español",
  it: "Le 1000 parole più comuni in italiano",
  ja: "日本語で最もよく使われる1000語",
  zh: "中文最常用的1000个词",
}

/** "My words", written in that language. */
export const MINE_LIST_NAME: Record<ThousandLang, string> = {
  fr: "Mes mots",
  es: "Mis palabras",
  it: "Le mie parole",
  ja: "自分の単語",
  zh: "我的词汇",
}

const LIST_COLOR: Record<ThousandLang, string> = {
  fr: "#2e5cc4",
  es: "#b4233c",
  it: "#1f7a4d",
  ja: "#c0392b",
  zh: "#a8322d",
}

export const VOCAB_ATTR = {
  rank: "vocab-rank",
  gloss: "vocab-gloss",
  ipa: "vocab-ipa",
  reading: "vocab-reading",
  known: "vocab-known",
} as const

const RANK_DEF: AttributeDefinition = { id: VOCAB_ATTR.rank, name: "Rank", type: "number" }
const GLOSS_DEF: AttributeDefinition = { id: VOCAB_ATTR.gloss, name: "English", type: "string" }
const IPA_DEF: AttributeDefinition = { id: VOCAB_ATTR.ipa, name: "IPA", type: "string" }
const READING_DEF: AttributeDefinition = { id: VOCAB_ATTR.reading, name: "Reading", type: "string" }
const KNOWN_DEF: AttributeDefinition = { id: VOCAB_ATTR.known, name: "Known", type: "boolean", booleanDisplay: "checkbox" }

function hasReading(lang: ThousandLang): boolean {
  return lang === "ja" || lang === "zh"
}

function columnsFor(lang: ThousandLang, ranked: boolean): AttributeDefinition[] {
  return [
    ...(ranked ? [RANK_DEF] : []),
    ...(hasReading(lang) ? [READING_DEF] : []),
    IPA_DEF,
    GLOSS_DEF,
    KNOWN_DEF,
  ]
}

export const languageFolderId = (lang: ThousandLang) => `vocab-languages-${lang}`
export const thousandListId = (lang: ThousandLang) => `vocab-1000-${lang}`
export const mineListId = (lang: ThousandLang) => `vocab-mine-${lang}`
export const thousandItemId = (lang: ThousandLang, rank: number) => `vocab-${lang}-${String(rank).padStart(4, "0")}`

/** Bundled ranked words for a language, loaded on demand (each file is ~80 KB). */
export async function loadFrequencyWords(lang: ThousandLang): Promise<FrequencyWord[]> {
  switch (lang) {
    case "fr":
      return (await import("@/lib/vocab/frequency/fr.json")).default as FrequencyWord[]
    case "es":
      return (await import("@/lib/vocab/frequency/es.json")).default as FrequencyWord[]
    case "it":
      return (await import("@/lib/vocab/frequency/it.json")).default as FrequencyWord[]
    case "ja":
      return (await import("@/lib/vocab/frequency/ja.json")).default as FrequencyWord[]
    case "zh":
      return (await import("@/lib/vocab/frequency/zh.json")).default as FrequencyWord[]
  }
}

type VaultSlice = {
  lists: List[]
  folders: Folder[]
  addList: (list: List) => void
  updateList: (list: List) => void
  addFolder: (folder: Folder) => void
  updateFolder: (folder: Folder) => void
}

function ensureFolder(store: VaultSlice, folder: Omit<Folder, "createdAt" | "listIds"> & { listIds?: string[] }): void {
  const existing = store.folders.find((f) => f.id === folder.id)
  if (!existing) {
    store.addFolder({ ...folder, listIds: folder.listIds ?? [], createdAt: new Date() })
    return
  }
  const missing = (folder.listIds ?? []).filter((id) => !existing.listIds.includes(id))
  if (missing.length > 0) store.updateFolder({ ...existing, listIds: [...existing.listIds, ...missing] })
}

function ensureList(store: VaultSlice, list: Omit<List, "createdAt">): void {
  const existing = store.lists.find((l) => l.id === list.id)
  if (existing) {
    const attrs = existing.itemAttributes ?? []
    const missing = (list.itemAttributes ?? []).filter((def) => !attrs.some((a) => a.id === def.id))
    if (missing.length > 0) store.updateList({ ...existing, itemAttributes: [...attrs, ...missing] })
    return
  }
  store.addList({ ...list, createdAt: new Date() })
}

/**
 * Create (or top up) Languages → <language> → the two lists. Safe to call
 * on every load: existing folders and lists are left as the person arranged
 * them, apart from adding a missing list id or column.
 */
export function ensureVocabLanguageLists(): void {
  const read = () => useTaskStore.getState() as unknown as VaultSlice
  ensureFolder(read(), { id: LANGUAGES_FOLDER_ID, name: LANGUAGES_FOLDER_NAME, color: "#2e5cc4" })
  THOUSAND_LANGS.forEach((lang, index) => {
    const columns = columnsFor(lang, true)
    ensureList(read(), {
      id: thousandListId(lang),
      name: THOUSAND_LIST_NAME[lang],
      color: LIST_COLOR[lang],
      description: `The 1000 most frequent ${FOLDER_NAME[lang]} words, ranked by wordfreq (subtitles, Wikipedia, news, books, web). Add ${FOLDER_NAME[lang]} in the Home Vocab widget to fill it. Tick Known as you learn them.`,
      scheduleable: false,
      itemLabel: "word",
      order: 0,
      itemAttributes: columns,
      displayedAttributes: columns.map((c) => c.id),
      sheetConfig: { columnIds: columns.map((c) => c.id) },
    })
    const mine = columnsFor(lang, false)
    ensureList(read(), {
      id: mineListId(lang),
      name: MINE_LIST_NAME[lang],
      color: LIST_COLOR[lang],
      description: `${FOLDER_NAME[lang]} words you looked up and added from the Vocab widget's dictionary.`,
      scheduleable: false,
      itemLabel: "word",
      order: 1,
      itemAttributes: mine,
      displayedAttributes: mine.map((c) => c.id),
      sheetConfig: { columnIds: mine.map((c) => c.id) },
    })
    ensureFolder(read(), {
      id: languageFolderId(lang),
      name: FOLDER_NAME[lang],
      parentFolderId: LANGUAGES_FOLDER_ID,
      order: index,
      listIds: [thousandListId(lang), mineListId(lang)],
    })
  })
}

/** Item record for one ranked word. Exported for tests. */
export function thousandItem(lang: ThousandLang, word: FrequencyWord, createdAt: Date): ItemRecord {
  const base = createListItem(word.word, [thousandListId(lang)])
  const attributes: Record<string, string | number | boolean> = {
    [VOCAB_ATTR.rank]: word.rank,
    [VOCAB_ATTR.gloss]: word.gloss,
  }
  if (word.ipa) attributes[VOCAB_ATTR.ipa] = word.ipa
  const reading = [word.reading, word.romanization].filter(Boolean).join(" · ")
  if (reading) attributes[VOCAB_ATTR.reading] = reading
  return {
    ...base,
    id: thousandItemId(lang, word.rank),
    createdAt,
    rewardValue: 0,
    attributes,
  }
}

/** Words not yet in the vault and not deleted there. Pure; exported for tests. */
export function missingThousandItems(
  lang: ThousandLang,
  words: readonly FrequencyWord[],
  tasks: readonly Pick<Task, "id">[],
  removedTaskIds: readonly string[],
  now = new Date(),
): ItemRecord[] {
  const have = new Set(tasks.map((t) => t.id))
  const gone = new Set(removedTaskIds)
  const out: ItemRecord[] = []
  for (const word of words) {
    const id = thousandItemId(lang, word.rank)
    if (have.has(id) || gone.has(id)) continue
    out.push(thousandItem(lang, word, now))
  }
  return out
}

const filling = new Map<ThousandLang, Promise<number>>()

/** Write the missing word items for a language in one store update. Resolves to how many were added. */
export function fillThousandList(lang: ThousandLang): Promise<number> {
  const running = filling.get(lang)
  if (running) return running
  const job = loadFrequencyWords(lang)
    .then((words) => {
      ensureVocabLanguageLists()
      const state = useTaskStore.getState()
      const add = missingThousandItems(lang, words, state.tasks, state.removedTaskIds ?? [])
      if (add.length > 0) state.setTasks([...state.tasks, ...add])
      return add.length
    })
    .finally(() => filling.delete(lang))
  filling.set(lang, job)
  return job
}

export function isVocabKnown(item: Pick<Task, "attributes">): boolean {
  return item.attributes?.[VOCAB_ATTR.known] === true
}

export function setVocabKnown(id: string, known: boolean): void {
  const store = useTaskStore.getState()
  const item = store.tasks.find((t) => t.id === id)
  if (!item || isVocabKnown(item) === known) return
  store.updateTask({ ...item, attributes: { ...(item.attributes ?? {}), [VOCAB_ATTR.known]: known } })
}

/** A word studied from the 1000 list or My words, read back from its item. */
export type StudyWord = {
  id: string
  word: string
  rank?: number
  gloss: string
  ipa?: string
  reading?: string
  known: boolean
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined
}

export function studyWordOf(item: Pick<Task, "id" | "title" | "description" | "attributes">): StudyWord {
  const attrs = item.attributes ?? {}
  const rank = attrs[VOCAB_ATTR.rank]
  return {
    id: item.id,
    word: (typeof item.title === "string" && item.title) || (typeof item.description === "string" ? item.description : ""),
    rank: typeof rank === "number" ? rank : undefined,
    gloss: str(attrs[VOCAB_ATTR.gloss]) ?? "",
    ipa: str(attrs[VOCAB_ATTR.ipa]),
    reading: str(attrs[VOCAB_ATTR.reading]),
    known: attrs[VOCAB_ATTR.known] === true,
  }
}

/** Items on a list, as study words: ranked words by rank, the rest by when they were added. */
export function studyWordsOn(tasks: readonly Task[], listId: string): StudyWord[] {
  const words = tasks.filter((t) => t.lists?.includes(listId)).map(studyWordOf)
  return words.sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
}

/** Add a looked-up word to My words (or return the item already there). */
export function addMyWord(
  lang: ThousandLang,
  entry: { word: string; gloss?: string; ipa?: string; reading?: string },
): string {
  ensureVocabLanguageLists()
  const listId = mineListId(lang)
  const store = useTaskStore.getState()
  const wanted = entry.word.trim()
  const existing = store.tasks.find(
    (t) => t.lists?.includes(listId) && studyWordOf(t).word.toLowerCase() === wanted.toLowerCase(),
  )
  if (existing) return existing.id
  const item = createListItem(wanted, [listId])
  const attributes: Record<string, string | boolean> = {}
  if (entry.gloss) attributes[VOCAB_ATTR.gloss] = entry.gloss
  if (entry.ipa) attributes[VOCAB_ATTR.ipa] = entry.ipa
  if (entry.reading) attributes[VOCAB_ATTR.reading] = entry.reading
  store.addTask({ ...item, rewardValue: 0, attributes })
  return item.id
}
