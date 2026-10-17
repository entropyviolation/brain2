/**
 * lib/vocab-dictionary.ts — Full dictionary entries from Wiktionary, in the word's own language
 *
 * A French word is looked up on fr.wiktionary.org (Wiktionnaire), Spanish on
 * es., Italian on it., German on de., Japanese on ja., Mandarin on zh., and
 * English on en. — dictionaries written in that language, free, no key, and
 * open to any word, not only the bundled ones. The MediaWiki API is called
 * with `origin=*` (anonymous CORS). Two requests: the page's section list,
 * then the HTML of that language's section only.
 *
 * The HTML is rebuilt on an allowlist before it is shown: no scripts, styles,
 * images, forms, or event attributes; links become either an in-app lookup
 * (`data-vocab-word`) or an outside link that opens a new tab. Translation
 * tables, anagrams, and references are dropped. What stays is the whole
 * entry: pronunciation, every sense with examples, synonyms, antonyms,
 * derived words, and inflection tables where the page has them. A separate
 * conjugation page (Conjugaison:, Flexion:, Appendice:Coniugazioni) is found
 * and can be fetched on its own.
 *
 * The English gloss for adding a looked-up word comes from the English
 * Wiktionary REST definitions endpoint.
 *
 * Entries are cached in memory and in IndexedDB (`brain2-vocab-dictionary`)
 * for 30 days, never in localStorage (the vault needs that room).
 */

import type { VocabLang } from "@/lib/vocab/types"

export type DictionaryEntry = {
  lang: VocabLang
  /** Page title that matched (article stripped, case fixed). */
  title: string
  host: string
  url: string
  /** Sanitized HTML of the language section. */
  html: string
  ipa?: string
  /** Plain text of the first definition, for reading aloud. */
  firstDefinition?: string
  /** A conjugation / inflection page on the same wiki. */
  conjugationTitle?: string
}

export const DICTIONARY_HOST: Record<VocabLang, string> = {
  en: "en.wiktionary.org",
  fr: "fr.wiktionary.org",
  es: "es.wiktionary.org",
  it: "it.wiktionary.org",
  de: "de.wiktionary.org",
  ja: "ja.wiktionary.org",
  zh: "zh.wiktionary.org",
}

/** What the dictionary is called on its own wiki, for the source line. */
export const DICTIONARY_NAME: Record<VocabLang, string> = {
  en: "Wiktionary",
  fr: "Wiktionnaire",
  es: "Wikcionario",
  it: "Wikizionario",
  de: "Wiktionary (Deutsch)",
  ja: "ウィクショナリー",
  zh: "维基词典",
}

/** Level-2 heading of the language's own section on its own wiki. */
const SECTION_HEADING: Record<VocabLang, RegExp> = {
  en: /^English$/,
  fr: /^Français$/,
  es: /^Español$/,
  it: /^Italiano$/,
  de: /\(Deutsch\)$/,
  ja: /^日本語$/,
  zh: /^(漢語|汉语|中文|官話|官话|現代標準漢語|现代标准汉语)$/,
}

/** Sections that are noise on a study card: translations, anagrams, references. */
const DROP_SECTION = /^(Traductions?|Traducciones?|Traduzione|Traduzioni|Übersetzungen|翻訳|翻譯|翻译|Translations?|Anagrammes?|Anagramas?|Anagrammi|Anagramme|Références|Referencias?|Riferimenti|Referenzen|Quellen|Bibliographie|Voir aussi|Note|Fonti|参照|参考文献|参考|來源|来源|Further reading|References|Anagrams)\b/i

const CONJUGATION_TITLE = /^(Conjugaison:|Flexion:|Appendice:Coniugazioni|Apéndice:Conjugación|Annexe:Conjugaison)/

const ARTICLES: Partial<Record<VocabLang, RegExp>> = {
  fr: /^(?:le|la|les|un|une|des)\s+|^l['’]/i,
  es: /^(?:el|la|los|las|un|una)\s+/i,
  it: /^(?:il|lo|la|i|gli|le|un|uno|una)\s+|^(?:l|un)['’]/i,
  de: /^(?:der|die|das|ein|eine)\s+/i,
}

/** Forms worth trying for a bank word: the word, without its article and gender tag, then case variants. */
export function dictionaryForms(lang: VocabLang, word: string): string[] {
  const bare = word.replace(/\s*\((?:m|f|m\/f|n|pl)\)\s*$/i, "").trim()
  const noArticle = ARTICLES[lang] ? bare.replace(ARTICLES[lang]!, "").trim() : bare
  const forms = [noArticle, bare, word]
  if (lang === "de") forms.push(noArticle.charAt(0).toUpperCase() + noArticle.slice(1))
  forms.push(noArticle.toLowerCase())
  return [...new Set(forms.filter(Boolean))]
}

// ---------------------------------------------------------------- caching

const TTL_MS = 30 * 86_400_000
const memory = new Map<string, DictionaryEntry | null>()
const DB_NAME = "brain2-vocab-dictionary"
const STORE = "entries"

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function cacheGet(key: string): Promise<DictionaryEntry | null | undefined> {
  if (memory.has(key)) return memory.get(key)
  const db = await openDb()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key)
      req.onsuccess = () => {
        const row = req.result as { entry: DictionaryEntry | null; savedAt: number } | undefined
        if (!row || Date.now() - row.savedAt > TTL_MS) return resolve(undefined)
        memory.set(key, row.entry)
        resolve(row.entry)
      }
      req.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

async function cacheSet(key: string, entry: DictionaryEntry | null): Promise<void> {
  memory.set(key, entry)
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put({ entry, savedAt: Date.now() }, key)
  } catch {
    // Private mode or a full disk: the memory cache still holds it this session.
  }
}

// ---------------------------------------------------------------- fetching

async function api(host: string, params: Record<string, string>, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  const query = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", redirects: "1", ...params })
  const res = await fetch(`https://${host}/w/api.php?${query.toString()}`, { signal })
  if (!res.ok) throw new Error(`${host} answered ${res.status}`)
  const data = (await res.json()) as Record<string, unknown>
  if (data.error) return null
  return data
}

type ParseSections = { parse?: { title?: string; sections?: { level: string; line: string; index: string }[] } }
type ParseText = { parse?: { title?: string; text?: string } }

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim()
}

async function fetchEntry(lang: VocabLang, form: string, signal?: AbortSignal): Promise<DictionaryEntry | null> {
  const host = DICTIONARY_HOST[lang]
  const sections = (await api(host, { action: "parse", page: form, prop: "sections" }, signal)) as ParseSections | null
  const title = sections?.parse?.title
  const list = sections?.parse?.sections ?? []
  const heading = SECTION_HEADING[lang]
  const section = list.find((s) => (s.level === "2" || s.level === "1") && heading.test(plain(s.line)))
  if (!title || !section) return null
  const body = (await api(
    host,
    { action: "parse", page: title, section: section.index, prop: "text", disableeditsection: "1", disablelimitreport: "1" },
    signal,
  )) as ParseText | null
  const raw = body?.parse?.text
  if (!raw) return null
  const cleaned = sanitizeWiktionaryHtml(raw, host, title)
  return {
    lang,
    title,
    host,
    url: `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    html: cleaned.html,
    ipa: cleaned.ipa,
    firstDefinition: cleaned.firstDefinition,
    conjugationTitle: cleaned.conjugationTitle,
  }
}

/** Look a word up in its own language's Wiktionary. `null` when no wiki page has that language. */
export async function lookupDictionary(lang: VocabLang, word: string, signal?: AbortSignal): Promise<DictionaryEntry | null> {
  const key = `${lang}:${word}`
  const cached = await cacheGet(key)
  if (cached !== undefined) return cached
  for (const form of dictionaryForms(lang, word)) {
    let entry = await fetchEntry(lang, form, signal)
    const lemma = entry ? kanaLemmaOf(lang, entry.firstDefinition) : null
    if (lemma && lemma !== form) entry = (await fetchEntry(lang, lemma, signal)) ?? entry
    if (entry) {
      await cacheSet(key, entry)
      return entry
    }
  }
  await cacheSet(key, null)
  return null
}

/**
 * ja.wiktionary files most native words under the kana headword. The kanji
 * page (食べる) is one line, "たべるの漢字表記。", so follow it to たべる.
 */
export function kanaLemmaOf(lang: VocabLang, firstDefinition: string | undefined): string | null {
  if (lang !== "ja" || !firstDefinition) return null
  const match = /^([\u3040-\u30ffー]+)の(?:漢字)?表記/.exec(firstDefinition.trim())
  return match ? match[1]! : null
}

/** Sanitized HTML of a conjugation / inflection page (whole page). */
export async function lookupConjugation(lang: VocabLang, title: string, signal?: AbortSignal): Promise<string | null> {
  const key = `${lang}:conj:${title}`
  const cached = await cacheGet(key)
  if (cached !== undefined) return cached?.html ?? null
  const host = DICTIONARY_HOST[lang]
  const body = (await api(host, { action: "parse", page: title, prop: "text", disableeditsection: "1", disablelimitreport: "1" }, signal)) as ParseText | null
  const raw = body?.parse?.text
  const html = raw ? sanitizeWiktionaryHtml(raw, host).html : null
  await cacheSet(key, html ? { lang, title, host, url: `https://${host}/wiki/${encodeURIComponent(title)}`, html } : null)
  return html
}

/** Short English gloss for a word in `lang`, from English Wiktionary. */
export async function lookupEnglishGloss(lang: VocabLang, word: string, signal?: AbortSignal): Promise<string | null> {
  for (const form of dictionaryForms(lang, word)) {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(form)}`, { signal })
    if (!res.ok) continue
    const data = (await res.json()) as Record<string, { partOfSpeech?: string; definitions?: { definition?: string }[] }[]>
    const usages = (data[lang] ?? []).filter((u) => u.partOfSpeech !== "Proper noun")
    for (const usage of usages) {
      for (const def of usage.definitions ?? []) {
        const text = plain(def.definition ?? "").replace(/\s+/g, " ")
        if (text) return text.length > 90 ? `${text.slice(0, 88).trimEnd()}…` : text
      }
    }
  }
  return null
}

// ---------------------------------------------------------------- sanitizing

const KEEP_TAGS = new Set([
  "p", "ol", "ul", "li", "dl", "dt", "dd", "b", "strong", "i", "em", "span", "a", "table", "thead",
  "tbody", "tfoot", "tr", "th", "td", "caption", "h2", "h3", "h4", "h5", "h6", "small", "sup", "sub",
  "br", "abbr", "cite", "q", "blockquote", "div", "ruby", "rt", "rp", "bdi", "code",
])
const DROP_TAGS = new Set([
  "script", "style", "link", "meta", "img", "audio", "video", "source", "track", "iframe", "object",
  "embed", "form", "input", "button", "select", "textarea", "svg", "math", "noscript", "figure", "map",
])
const DROP_CLASSES = /\b(mw-editsection|reference|noprint|mw-empty-elt|navbox|metadata|mw-references-wrap|printfooter|catlinks|sister-wikipedia|interProject|toc|audio-pronunciation|mediaContainer|thumb)\b/
const IPA_CLASSES = /\b(API|IPA|ipa)\b/
const IPA_TEXT = /[/[]([^\]/\n]{0,40}[ˈˌəɛɔʁʎɲʃʒθðŋɾʝχçɐɨʊɪːɑøœɥɯʐʂɕʑ][^\]/\n]{0,40})[/\]]/

function headingLevel(el: Element): number | null {
  const tag = el.tagName.toLowerCase()
  if (/^h[2-6]$/.test(tag)) return Number(tag[1])
  if (el.classList.contains("mw-heading")) {
    const inner = el.querySelector("h2,h3,h4,h5,h6")
    return inner ? Number(inner.tagName[1]) : null
  }
  return null
}

function dropNoiseSections(root: Element): void {
  const headings = [...root.querySelectorAll("h2,h3,h4,h5,h6")]
  for (const h of headings) {
    if (!h.isConnected) continue
    if (!DROP_SECTION.test((h.textContent ?? "").trim())) continue
    const block = h.parentElement?.classList.contains("mw-heading") ? h.parentElement : h
    const level = Number(h.tagName[1])
    let next = block.nextElementSibling
    block.remove()
    while (next) {
      const lvl = headingLevel(next)
      if (lvl !== null && lvl <= level) break
      const after = next.nextElementSibling
      next.remove()
      next = after
    }
  }
}

/** Rebuild wiki HTML on an allowlist. Exported for tests. */
export function sanitizeWiktionaryHtml(
  raw: string,
  host: string,
  /** The page word. A conjugation page named after it beats a group explainer such as "premier groupe". */
  word?: string,
): { html: string; ipa?: string; firstDefinition?: string; conjugationTitle?: string } {
  if (typeof DOMParser === "undefined") return { html: "" }
  const doc = new DOMParser().parseFromString(`<div id="root">${raw}</div>`, "text/html")
  const root = doc.getElementById("root")
  if (!root) return { html: "" }

  for (const el of [...root.querySelectorAll("*")]) {
    if (!el.isConnected) continue
    const tag = el.tagName.toLowerCase()
    if (DROP_TAGS.has(tag) || DROP_CLASSES.test(el.getAttribute("class") ?? "")) el.remove()
  }
  dropNoiseSections(root)

  let ipa: string | undefined
  for (const el of root.querySelectorAll("[class]")) {
    if (IPA_CLASSES.test(el.getAttribute("class") ?? "")) {
      const text = (el.textContent ?? "").trim().replace(/^[/[\\]+|[/\]\\]+$/g, "")
      if (text && text.length < 60) {
        ipa = text
        break
      }
    }
  }
  if (!ipa) {
    const match = IPA_TEXT.exec(root.textContent ?? "")
    if (match) ipa = match[1]!.trim().replace(/^[/[\\]+|[/\]\\]+$/g, "")
  }

  const conjugationTitles = [...root.querySelectorAll("a[title]")]
    .map((a) => a.getAttribute("title") ?? "")
    .filter((title) => CONJUGATION_TITLE.test(title))
  const ownPage = word
    ? conjugationTitles.find((title) => title.split(/[/:]/).pop()?.toLowerCase() === word.toLowerCase())
    : undefined
  const conjugationTitle = ownPage ?? conjugationTitles[0]

  const firstLi = root.querySelector("ol > li")
  let firstDefinition: string | undefined
  if (firstLi) {
    const copy = firstLi.cloneNode(true) as Element
    for (const nested of copy.querySelectorAll("ul, ol, dl")) nested.remove()
    firstDefinition = (copy.textContent ?? "").replace(/\s+/g, " ").trim() || undefined
  }

  const clean = (node: Node, into: Element) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        into.appendChild(doc.createTextNode(child.textContent ?? ""))
        continue
      }
      if (child.nodeType !== 1) continue
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (!KEEP_TAGS.has(tag)) {
        clean(el, into)
        continue
      }
      if (tag === "a") {
        const href = el.getAttribute("href") ?? ""
        const title = el.getAttribute("title") ?? ""
        const isNew = /\bnew\b/.test(el.getAttribute("class") ?? "")
        if (isNew || !href || href.startsWith("#")) {
          clean(el, into)
          continue
        }
        const link = doc.createElement("a")
        const wiki = /^\/wiki\/([^#?]+)/.exec(href)
        if (wiki && !title.includes(":")) {
          link.setAttribute("href", "#")
          link.setAttribute("data-vocab-word", decodeURIComponent(wiki[1]!).replace(/_/g, " "))
        } else {
          const abs = href.startsWith("//") ? `https:${href}` : href.startsWith("/") ? `https://${host}${href}` : href
          if (!/^https:\/\//.test(abs)) {
            clean(el, into)
            continue
          }
          link.setAttribute("href", abs)
          link.setAttribute("target", "_blank")
          link.setAttribute("rel", "noopener noreferrer")
        }
        clean(el, link)
        into.appendChild(link)
        continue
      }
      const out = doc.createElement(tag)
      for (const attr of ["colspan", "rowspan", "lang"]) {
        const value = el.getAttribute(attr)
        if (value && /^[\w-]{1,12}$/.test(value)) out.setAttribute(attr, value)
      }
      if (IPA_CLASSES.test(el.getAttribute("class") ?? "")) out.setAttribute("data-ipa", "")
      clean(el, out)
      into.appendChild(out)
    }
  }
  const outRoot = doc.createElement("div")
  clean(root, outRoot)
  // Empty wrappers left behind by dropped boxes.
  for (const el of [...outRoot.querySelectorAll("div, span, p")].reverse()) {
    if (!el.textContent?.trim() && !el.querySelector("br, table")) el.remove()
  }
  return { html: outRoot.innerHTML, ipa, firstDefinition, conjugationTitle }
}
