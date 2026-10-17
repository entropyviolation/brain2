import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import {
  LANGUAGES_FOLDER_ID,
  THOUSAND_LANGS,
  THOUSAND_LIST_NAME,
  addMyWord,
  ensureVocabLanguageLists,
  fillThousandList,
  languageFolderId,
  loadFrequencyWords,
  mineListId,
  missingThousandItems,
  setVocabKnown,
  studyWordsOn,
  thousandItemId,
  thousandListId,
  type FrequencyWord,
} from "@/lib/vocab-lists"

const WORDS: FrequencyWord[] = [
  { rank: 1, word: "de", pos: "preposition", gloss: "of; from", ipa: "də" },
  { rank: 2, word: "la", pos: "article", gloss: "the" },
  { rank: 3, word: "le", pos: "article", gloss: "the", ipa: "lə" },
]

describe("vocab language lists", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("creates Languages with one folder and two lists per language, named in that language", () => {
    ensureVocabLanguageLists()
    const { folders, lists } = useTaskStore.getState()
    const root = folders.find((f) => f.id === LANGUAGES_FOLDER_ID)
    expect(root?.name).toBe("Languages")
    for (const lang of THOUSAND_LANGS) {
      const folder = folders.find((f) => f.id === languageFolderId(lang))
      expect(folder?.parentFolderId).toBe(LANGUAGES_FOLDER_ID)
      expect(folder?.listIds).toEqual([thousandListId(lang), mineListId(lang)])
      expect(lists.find((l) => l.id === thousandListId(lang))?.name).toBe(THOUSAND_LIST_NAME[lang])
    }
    expect(THOUSAND_LIST_NAME.fr).toBe("1000 mots les plus courants en français")
  })

  it("is idempotent and keeps a renamed list", () => {
    ensureVocabLanguageLists()
    const list = useTaskStore.getState().lists.find((l) => l.id === thousandListId("es"))!
    useTaskStore.getState().updateList({ ...list, name: "Mi lista" })
    ensureVocabLanguageLists()
    const state = useTaskStore.getState()
    expect(state.folders.filter((f) => f.id === LANGUAGES_FOLDER_ID)).toHaveLength(1)
    expect(state.lists.filter((l) => l.id === thousandListId("es"))).toHaveLength(1)
    expect(state.lists.find((l) => l.id === thousandListId("es"))?.name).toBe("Mi lista")
  })

  it("plans only words that are missing and not deleted", () => {
    const add = missingThousandItems("fr", WORDS, [{ id: thousandItemId("fr", 1) }], [thousandItemId("fr", 2)])
    expect(add.map((item) => item.id)).toEqual(["vocab-fr-0003"])
    expect(add[0]).toMatchObject({
      title: "le",
      lists: [thousandListId("fr")],
      rewardValue: 0,
      completed: false,
      attributes: { "vocab-rank": 3, "vocab-gloss": "the", "vocab-ipa": "lə" },
    })
  })

  it("reads study words in rank order and writes Known on the item", () => {
    const items = missingThousandItems("fr", [...WORDS].reverse(), [], [])
    useTaskStore.getState().setTasks(items)
    expect(studyWordsOn(useTaskStore.getState().tasks, thousandListId("fr")).map((w) => w.word)).toEqual(["de", "la", "le"])
    setVocabKnown(thousandItemId("fr", 2), true)
    const words = studyWordsOn(useTaskStore.getState().tasks, thousandListId("fr"))
    expect(words.map((w) => w.known)).toEqual([false, true, false])
  })

  it("fills a whole bundled list once", async () => {
    const words = await loadFrequencyWords("ja")
    const added = await fillThousandList("ja")
    expect(added).toBe(words.length)
    expect(await fillThousandList("ja")).toBe(0)
    expect(studyWordsOn(useTaskStore.getState().tasks, thousandListId("ja"))).toHaveLength(words.length)
  })

  it("files a looked-up word in My words once", () => {
    const first = addMyWord("it", { word: "Magari", gloss: "maybe; if only", ipa: "maˈɡari" })
    const again = addMyWord("it", { word: "magari" })
    expect(again).toBe(first)
    const mine = studyWordsOn(useTaskStore.getState().tasks, mineListId("it"))
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ word: "Magari", gloss: "maybe; if only", ipa: "maˈɡari", known: false })
  })
})

describe("bundled frequency words", () => {
  it.each(["fr", "es", "it", "ja", "zh"] as const)("%s has 1000 ranked words with glosses", async (lang) => {
    const words = await loadFrequencyWords(lang)
    expect(words).toHaveLength(1000)
    expect(words.map((w) => w.rank)).toEqual(Array.from({ length: 1000 }, (_, i) => i + 1))
    expect(new Set(words.map((w) => w.word)).size).toBe(1000)
    for (const w of words) expect(w.gloss.trim(), `${lang} ${w.word}`).not.toBe("")
    expect(words.filter((w) => w.ipa).length).toBeGreaterThan(900)
  })
})
