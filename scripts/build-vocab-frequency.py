#!/usr/bin/env python3
"""
scripts/build-vocab-frequency.py — Build the 1000 most common words per language

Writes `lib/vocab/frequency/<lang>.json` for French, Spanish, Italian, German,
Japanese, and Mandarin, and `lib/vocab/bank-ipa.json` (IPA for the word-of-the-
day banks). Run it again only to refresh the data; the app never calls it.

Rank comes from wordfreq (Speer et al.), which blends subtitles, Wikipedia,
news, books, web text, Twitter, and Reddit, so it is the most even "how often
people actually use this word" measure that is free. Tokens are kept only when
a real dictionary has them as a word:

- French, Spanish, Italian, German: English Wiktionary, read as wikitext 50
  pages per request (the per-word REST API throttles a bulk build). Proper
  nouns, numbers, and elision fragments (l', d', qu') drop out. German nouns
  get their capital back when Wiktionary only has the capitalized page.
- Japanese: JMdict (common words). Bare inflection stems (なっ, まし) drop out.
- Mandarin: CC-CEDICT. Names (capitalized pinyin) drop out.

IPA: WikiPron (CUNY, scraped from Wiktionary) first, then ipa-dict
(open-dict-data). Japanese IPA is built from the kana; Mandarin IPA is built
from the CEDICT pinyin.

Licenses: wordfreq data CC BY-SA 4.0; Wiktionary CC BY-SA 4.0; JMdict
CC BY-SA 4.0 (EDRDG); CC-CEDICT CC BY-SA 4.0; WikiPron Apache 2.0 (data from
Wiktionary, CC BY-SA); ipa-dict MIT.

Usage:
  python3 -m venv /tmp/vocab-venv && /tmp/vocab-venv/bin/pip install wordfreq
  /tmp/vocab-venv/bin/python scripts/build-vocab-frequency.py --cache /tmp/vocab-cache
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import gzip
import hashlib
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

from wordfreq import top_n_list

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "lib" / "vocab" / "frequency"
BANK_IPA_OUT = ROOT / "lib" / "vocab" / "bank-ipa.json"
TARGET = 1000
WORKERS = 3
UA = "Brain2VocabBuilder/1.0 (personal study app; one-time build)"

IPA_DICT = {
    "fr": "fr_FR",
    "es": "es_ES",
    "de": "de",
    "en": "en_US",
    "zh": "zh_hans",
}
WIKT_LANG_NAME = {
    "fr": "French",
    "es": "Spanish",
    "it": "Italian",
    "de": "German",
    "en": "English",
    "ja": "Japanese",
    "zh": "Chinese",
}
JMDICT_URL = "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261012204142/jmdict-eng-common-3.6.2%2B20261012204142.json.zip"
CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"

# One-letter tokens that are words in their own right. Everything else one
# letter long is an elision fragment (l', d', j') or a stray initial.
SINGLE_OK = {
    "fr": {"a", "à", "y", "ô"},
    "es": {"a", "y", "o", "e", "u"},
    "it": {"a", "e", "è", "o", "i", "ò"},
    "de": set(),
}
FRAGMENTS = {
    "fr": {"qu", "jusqu", "lorsqu", "puisqu", "aujourd"},
    "es": set(),
    "it": {"dell", "nell", "sull", "all", "dall", "quell", "quest", "un'", "c'"},
    "de": set(),
}


# ---------------------------------------------------------------- fetching

class Fetcher:
    def __init__(self, cache: Path):
        self.cache = cache
        cache.mkdir(parents=True, exist_ok=True)

    def get(self, url: str, binary: bool = False, retries: int = 10):
        key = hashlib.sha1(url.encode()).hexdigest()
        path = self.cache / key
        if path.exists():
            data = path.read_bytes()
            return data if binary else data.decode("utf-8")
        delay = 4.0
        for attempt in range(retries):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
                with urllib.request.urlopen(req, timeout=60) as res:
                    data = res.read()
                path.write_bytes(data)
                return data if binary else data.decode("utf-8")
            except urllib.error.HTTPError as err:
                if err.code == 404:
                    path.write_bytes(b"")
                    return b"" if binary else ""
                if err.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                    wait = err.headers.get("Retry-After") if err.headers else None
                    time.sleep(float(wait) if wait and wait.isdigit() else delay)
                    delay = min(delay * 2, 120)
                    continue
                raise
            except (urllib.error.URLError, TimeoutError):
                if attempt < retries - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise
        return b"" if binary else ""


# ---------------------------------------------------------------- helpers

TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(TAG_RE.sub("", text))).strip()


def short_gloss(text: str, limit: int = 70) -> str:
    text = strip_html(text)
    text = re.sub(r"\s*\([^)]*\)\s*$", "", text) if len(text) > limit else text
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for mark in (";", ",", " "):
        at = cut.rfind(mark)
        if at > limit * 0.5:
            return cut[:at].strip() + "…"
    return cut.strip() + "…"


def load_ipa_dict(fetch: Fetcher, lang: str) -> dict[str, list[str]]:
    name = IPA_DICT.get(lang)
    if not name:
        return {}
    text = fetch.get(f"https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/{name}.txt")
    table: dict[str, list[str]] = {}
    for line in text.splitlines():
        if "\t" not in line:
            continue
        word, ipas = line.split("\t", 1)
        variants = [v.strip().strip("/") for v in ipas.split(",") if v.strip()]
        table.setdefault(word, []).extend(variants)
    return table


WIKIPRON = {
    "fr": "fra_latn_broad",
    "es": "spa_latn_ca_broad",
    "it": "ita_latn_broad",
    "de": "deu_latn_broad",
    "en": "eng_latn_us_broad",
}


class IpaTable:
    """WikiPron (Wiktionary) and ipa-dict side by side, so a pick can use both."""

    def __init__(self, wikipron: dict[str, list[str]], ipadict: dict[str, list[str]]):
        self.wikipron = wikipron
        self.ipadict = ipadict

    def get(self, word: str) -> list[str] | None:
        picked = self.pick(word)
        return [picked] if picked else None

    def pick(self, word: str) -> str | None:
        """Citation form: agreed variants first, shortest of those (est → ɛ, not ɛst);
        liaison variants (‿) never; WikiPron alone takes its fullest variant (elle → ɛl, not a)."""
        wp = [v for v in self.wikipron.get(word, []) if "‿" not in v]
        ipd = self.ipadict.get(word, [])
        if ipd:
            both = [v for v in ipd if v in wp]
            return min(both, key=len) if both else ipd[0]
        if wp:
            return max(wp, key=len)
        return None


def load_ipa(fetch: Fetcher, lang: str) -> IpaTable:
    wikipron: dict[str, list[str]] = {}
    name = WIKIPRON.get(lang)
    if name:
        text = fetch.get(f"https://raw.githubusercontent.com/CUNY-CL/wikipron/master/data/scrape/tsv/{name}.tsv")
        for line in text.splitlines():
            if "\t" not in line:
                continue
            word, phones = line.split("\t", 1)
            wikipron.setdefault(word, []).append(phones.replace(" ", ""))
    return IpaTable(wikipron, load_ipa_dict(fetch, lang))


# ------------------------------------------------- Wiktionary (Latin script)

POS_HEADERS = {
    "Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Determiner",
    "Article", "Interjection", "Particle", "Numeral", "Contraction", "Participle", "Phrase",
    "Prepositional phrase", "Adverbial phrase", "Postposition", "Pronominal adverb",
}
FORM_TEMPLATE_RE = re.compile(r"^(?:[a-z]{2,3}-)?(.+? of)$")


def wikitext_batch(fetch: Fetcher, titles: list[str]) -> dict[str, str]:
    """Wikitext for up to 50 pages, following `continue` when the payload is cut."""
    out: dict[str, str] = {}
    pending = list(titles)
    while pending:
        chunk, pending = pending[:50], pending[50:]
        url = (
            "https://en.wiktionary.org/w/api.php?action=query&format=json&formatversion=2"
            "&prop=revisions&rvprop=content&rvslots=main&titles="
            + urllib.parse.quote("|".join(chunk), safe="")
        )
        raw = fetch.get(url)
        time.sleep(0.4)
        data = json.loads(raw) if raw else {}
        got = set()
        for page in data.get("query", {}).get("pages", []):
            revs = page.get("revisions")
            if revs:
                out[page["title"]] = revs[0]["slots"]["main"]["content"]
                got.add(page["title"])
            elif page.get("missing"):
                got.add(page["title"])
        # Titles the API normalized (first letter case) map back.
        for norm in data.get("query", {}).get("normalized", []):
            if norm["to"] in out:
                out[norm["from"]] = out[norm["to"]]
                got.add(norm["from"])
        left = [t for t in chunk if t not in got and t not in out]
        if left and len(left) < len(chunk):
            pending = left + pending
    return out


def split_args(body: str) -> list[str]:
    parts, depth, cur = [], 0, ""
    i = 0
    while i < len(body):
        two = body[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur += two
            i += 2
            continue
        if two in ("}}", "]]"):
            depth -= 1
            cur += two
            i += 2
            continue
        if body[i] == "|" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += body[i]
        i += 1
    parts.append(cur)
    return parts


def render_template(body: str) -> str:
    args = split_args(body)
    name = args[0].strip()
    pos = [a for a in args[1:] if "=" not in a.split("[[")[0].split("{{")[0]]
    named = dict(a.split("=", 1) for a in args[1:] if "=" in a.split("[[")[0].split("{{")[0])
    if name in ("l", "m", "l-self", "ll", "mention", "link"):
        return (named.get("t") and (pos[1] if len(pos) > 1 else "")) or (pos[2] if len(pos) > 2 and pos[2] else (pos[1] if len(pos) > 1 else ""))
    if name in ("w", "pedia", "vern", "taxlink", "taxfmt"):
        return pos[1] if len(pos) > 1 and pos[1] else (pos[0] if pos else "")
    if name in ("gloss", "gl"):
        return f"({pos[0]})" if pos else ""
    if name in ("non-gloss definition", "n-g", "ngd", "non-gloss"):
        return pos[0] if pos else ""
    if name in ("lb", "lbl", "label", "q", "qualifier", "i", "qf", "sense", "s", "cln", "c", "C", "topics", "senseid", "anchor", "rfdef", "rfex", "defdate", "ux", "uxi", "syn", "ant", "cot", "tlb"):
        return ""
    form = FORM_TEMPLATE_RE.match(name)
    if form or name in ("infl of", "inflection of"):
        label = "inflection of" if name in ("infl of", "inflection of") else form.group(1)
        lemma = pos[1] if len(pos) > 1 else (pos[0] if pos else "")
        return f"{label} {lemma}".strip()
    return ""


def clean_wikitext(text: str) -> str:
    # Innermost templates first.
    for _ in range(6):
        new = re.sub(r"\{\{((?:(?!\{\{|\}\}).)*)\}\}", lambda m: render_template(m.group(1)), text)
        if new == text:
            break
        text = new
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text)
    text = re.sub(r"'{2,}", "", text)
    text = strip_html(text)
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s+([,;.])", r"\1", text)
    return re.sub(r"\s+", " ", text).strip(" ,;:")


def language_section(wikitext: str, name: str) -> str | None:
    match = re.search(rf"^==\s*{re.escape(name)}\s*==\s*$", wikitext, re.M)
    if not match:
        return None
    rest = wikitext[match.end():]
    nxt = re.search(r"^==[^=].*==\s*$", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def senses(section: str) -> list[tuple[str, str]]:
    """First (pos, gloss) under each part-of-speech header, in page order; proper nouns skipped."""
    out: list[tuple[str, str]] = []
    current = None
    for line in section.splitlines():
        head = re.match(r"^={3,6}\s*([^=]+?)\s*={3,6}\s*$", line)
        if head:
            title = head.group(1)
            current = title if title in POS_HEADERS else None
            continue
        if current and re.match(r"^#(?![:*#])\s*\S", line):
            gloss = clean_wikitext(line.lstrip("#").strip())
            if gloss:
                out.append((current.lower(), gloss.replace("inflection of ", "form of ")))
                current = None
    return out


def is_form_gloss(gloss: str) -> bool:
    return bool(re.match(r"^(form|.+ form|.+ of) ", gloss)) and " of " in gloss[:40]


def combined_gloss(found: list[tuple[str, str]]) -> tuple[str, str]:
    """Main sense, plus a second part of speech when the word has one (est: east; is)."""
    pos, gloss = found[0]
    other = next(((p, g) for p, g in found[1:] if p != pos), None)
    if other:
        return pos, f"{short_gloss(gloss, 48)}; {other[0]}: {short_gloss(other[1], 40)}"
    return pos, short_gloss(gloss, 90)


def latin_word_ok(lang: str, word: str) -> bool:
    if not re.fullmatch(r"[^\W\d_]+(?:['’-][^\W\d_]+)*", word):
        return False
    if len(word) == 1 and word not in SINGLE_OK[lang]:
        return False
    return word not in FRAGMENTS[lang]


def build_latin(fetch: Fetcher, lang: str, ipa_table: IpaTable) -> list[dict]:
    candidates = [w for w in top_n_list(lang, 3500) if latin_word_ok(lang, w)]
    titles = list(candidates)
    if lang == "de":
        titles += [w[:1].upper() + w[1:] for w in candidates if w[:1].islower()]
    pages = wikitext_batch(fetch, titles)
    name = WIKT_LANG_NAME[lang]

    def sense(form: str) -> list[tuple[str, str]]:
        text = pages.get(form)
        section = language_section(text, name) if text else None
        return senses(section) if section else []

    seen: set[str] = set()
    rows: list[dict] = []
    for word in candidates:
        found = sense(word)
        form = word
        if lang == "de" and word[:1].islower():
            upper = word[:1].upper() + word[1:]
            capital = sense(upper)
            only_forms = all(is_form_gloss(g) for _, g in found)
            if capital and (not found or (only_forms and not all(is_form_gloss(g) for _, g in capital))):
                found, form = capital, upper
        if not found or form in seen:
            continue
        seen.add(form)
        pos, gloss = combined_gloss(found)
        row = {"word": form, "pos": pos, "gloss": gloss}
        ipa = ipa_table.pick(form) or ipa_table.pick(form.lower())
        if ipa:
            row["ipa"] = ipa
        rows.append(row)
        if len(rows) >= TARGET:
            break
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank
    return rows


# ------------------------------------------------------------------ Japanese

HIRA = {}
_KANA_ROWS = """
あ a い i う u え e お o
か ka き ki く ku け ke こ ko が ga ぎ gi ぐ gu げ ge ご go
さ sa し shi す su せ se そ so ざ za じ ji ず zu ぜ ze ぞ zo
た ta ち chi つ tsu て te と to だ da ぢ ji づ zu で de ど do
な na に ni ぬ nu ね ne の no
は ha ひ hi ふ fu へ he ほ ho ば ba び bi ぶ bu べ be ぼ bo ぱ pa ぴ pi ぷ pu ぺ pe ぽ po
ま ma み mi む mu め me も mo
や ya ゆ yu よ yo
ら ra り ri る ru れ re ろ ro
わ wa ゐ i ゑ e を o ん n ゔ vu
ぁ a ぃ i ぅ u ぇ e ぉ o
"""
for chunk in re.findall(r"(\S)\s+([a-z]+)", _KANA_ROWS):
    HIRA[chunk[0]] = chunk[1]
YOON = {"ゃ": "a", "ゅ": "u", "ょ": "o"}

# Broad IPA per romaji syllable (Tokyo standard, simplified).
ROMAJI_IPA = {
    "shi": "ɕi", "chi": "tɕi", "tsu": "tsɯ", "fu": "ɸɯ", "ji": "dʑi", "zu": "zɯ",
    "u": "ɯ", "ku": "kɯ", "gu": "ɡɯ", "su": "sɯ", "nu": "nɯ", "mu": "mɯ", "yu": "jɯ",
    "ru": "ɾɯ", "bu": "bɯ", "pu": "pɯ", "ra": "ɾa", "ri": "ɾi", "re": "ɾe", "ro": "ɾo",
    "ya": "ja", "yo": "jo", "wa": "ɰa", "ga": "ɡa", "gi": "ɡi", "ge": "ɡe", "go": "ɡo",
    "vu": "vɯ", "hi": "çi",
}


def to_hiragana(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        out.append(chr(code - 0x60) if 0x30A1 <= code <= 0x30F6 else ch)
    return "".join(out)


def kana_syllables(kana: str) -> list[str]:
    """Hepburn syllables; っ doubles the next consonant; ー lengthens."""
    hira = to_hiragana(kana)
    out: list[str] = []
    i = 0
    geminate = False
    while i < len(hira):
        ch = hira[i]
        nxt = hira[i + 1] if i + 1 < len(hira) else ""
        if ch == "っ":
            geminate = True
            i += 1
            continue
        if ch == "ー":
            if out:
                out[-1] = out[-1] + out[-1][-1]
            i += 1
            continue
        base = HIRA.get(ch)
        if base is None:
            out.append(ch)
            i += 1
            continue
        if nxt in YOON and base.endswith("i") and len(base) > 1:
            stem = base[:-1]
            if stem in ("sh", "ch", "j"):
                base = stem + YOON[nxt]
            else:
                base = stem + "y" + YOON[nxt]
            i += 1
        if geminate and out:
            base = ("t" if base.startswith("ch") else base[0]) + base
        geminate = False
        out.append(base)
        i += 1
    return out


def kana_to_romaji(kana: str) -> str:
    syl = kana_syllables(kana)
    text = "".join(syl)
    return re.sub(r"n(?=[aiueoy])", "n'", text) if "n" in syl else text


def kana_to_ipa(kana: str) -> str:
    parts = []
    for s in kana_syllables(kana):
        if s == "n":
            parts.append("ɴ")
            continue
        double = len(s) > 1 and s[0] == s[1] and s[0] not in "aiueo"
        core = s[1:] if double else s
        ipa = ROMAJI_IPA.get(core)
        if ipa is None:
            if len(core) == 3 and core[1] == "y":
                ipa = ROMAJI_IPA.get(core[0] + "i", core[0] + "i")[:-1] + "j" + core[2]
                ipa = ipa.replace("jj", "j")
            elif core.startswith(("sh", "ch", "j")) and core[-1] in "auo":
                head = {"sh": "ɕ", "ch": "tɕ", "j": "dʑ"}[core[:-1]]
                ipa = head + ("ɯ" if core[-1] == "u" else core[-1])
            else:
                ipa = core.replace("u", "ɯ").replace("g", "ɡ").replace("r", "ɾ").replace("y", "j")
        parts.append(("ː" if double else "") + ipa)
    text = "".join(parts)
    text = re.sub(r"([aiueoɯ])\1", r"\1ː", text)
    return text.replace("ːː", "ː")


# Bare inflection stems that wordfreq's tokenizer splits off (なっ = なる, まし = ます).
JA_SKIP = {"まし", "なっ", "あっ", "いっ", "やっ", "思っ", "言っ", "だっ", "でき", "なかっ", "かっ", "ませ", "でしょ", "だろ", "れ", "せ", "っ", "ん", "ろ", "る", "う", "き", "み", "ず", "ー", "られ", "れる", "させ"}

# The top grammar words, where the first JMdict sense is the wrong one.
JA_OVERRIDE = {
    "て": ("て", "particle", "and (joins verbs and adjectives); te-form ending"),
    "で": ("で", "particle", "at; in; by; with (place or means of an action)"),
    "た": ("た", "auxiliary", "past tense / completed action"),
    "だ": ("だ", "copula", "is; be (plain form)"),
    "な": ("な", "particle", "don't (prohibition); attaches na-adjectives"),
    "し": ("し", "particle", "and what's more; and besides"),
    "と": ("と", "particle", "and; with; if; when (quotation marker)"),
    "いる": ("いる", "verb", "to be; to exist (of people and animals)"),
    "たい": ("たい", "auxiliary", "want to (attaches to verb stems)"),
    "って": ("って", "particle", "(casual quotation) they say; I said"),
    "ない": ("ない", "adjective", "not; there isn't; no"),
    "さ": ("さ", "particle", "you know (casual emphasis); -ness"),
    "よう": ("よう", "noun", "way; manner; seeming; so that"),
    "そう": ("そう", "adverb", "so; like that; I hear that"),
    "人": ("ひと", "noun", "person; people"),
    "年": ("とし", "noun", "year; age"),
    "日": ("ひ", "noun", "day; sun"),
    "者": ("もの", "noun", "person (formal)"),
    "的": ("てき", "suffix", "-ic; -al; -like (makes na-adjectives)"),
    "方": ("ほう", "noun", "direction; side; way of doing"),
    "中": ("なか", "noun", "inside; middle; among"),
    "時": ("とき", "noun", "time; when"),
    "前": ("まえ", "noun", "before; front"),
    "気": ("き", "noun", "spirit; mind; feeling"),
    "目": ("め", "noun", "eye"),
    "事": ("こと", "noun", "thing; matter"),
    "出": ("で", "noun", "coming out; origin"),
    "見": ("み", "verb stem", "see; look (stem of 見る)"),
    "一": ("いち", "number", "one"),
    "今": ("いま", "noun", "now"),
    "私": ("わたし", "pronoun", "I; me"),
    "何": ("なに", "pronoun", "what"),
    "月": ("つき", "noun", "moon; month"),
    "話": ("はなし", "noun", "talk; story; conversation"),
    "くれ": ("くれ", "verb", "give me (imperative of くれる)"),
    "ば": ("ば", "particle", "if; when (conditional)"),
    "たら": ("たら", "particle", "if; when; after (conditional)"),
    "じゃ": ("じゃ", "particle", "well then; is not (casual では)"),
    "ので": ("ので", "particle", "because; since"),
    "あり": ("あり", "verb stem", "being; there is (stem of ある)"),
    "もの": ("もの", "noun", "thing; object"),
    "ため": ("ため", "noun", "for the sake of; because of"),
    "よ": ("よ", "particle", "(sentence end) I tell you; you know"),
    "わ": ("わ", "particle", "(sentence end) soft emphasis"),
    "の": ("の", "particle", "'s; of (possessive); one (nominalizer)"),
    "は": ("は", "particle", "as for (marks the topic)"),
    "け": ("け", "particle", "was it? (trying to recall)"),
}

JA_POS = [
    ("prt", "particle"), ("v", "verb"), ("adj-i", "adjective"), ("adj-na", "adjective"),
    ("adj", "adjective"), ("adv", "adverb"), ("pn", "pronoun"), ("conj", "conjunction"),
    ("int", "interjection"), ("aux", "auxiliary"), ("exp", "phrase"), ("n", "noun"),
    ("ctr", "counter"), ("suf", "suffix"), ("pref", "prefix"),
]


def ja_pos(tags: list[str]) -> str:
    for prefix, name in JA_POS:
        if any(t == prefix or t.startswith(prefix + "-") or (prefix == "v" and t.startswith("v")) for t in tags):
            return name
    return "word"


def build_ja(fetch: Fetcher) -> list[dict]:
    raw = fetch.get(JMDICT_URL, binary=True)
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".json"))
        words = json.loads(zf.read(name))["words"]
    by_kanji: dict[str, list[dict]] = {}
    by_kana: dict[str, list[dict]] = {}
    for w in words:
        for k in w["kanji"]:
            if k["common"]:
                by_kanji.setdefault(k["text"], []).append(w)
        usually_kana = any("uk" in s["misc"] for s in w["sense"])
        for k in w["kana"]:
            if k["common"] and (not w["kanji"] or usually_kana):
                by_kana.setdefault(k["text"], []).append(w)

    def score(w: dict, token: str, kana_token: bool) -> tuple:
        pos = w["sense"][0]["partOfSpeech"]
        affix = any(p in ("suf", "pref", "ctr") for p in pos)
        grammar = any(p in ("prt", "aux", "aux-v", "aux-adj", "conj", "cop", "pn", "int") or p.startswith("aux") for p in pos)
        first = (w["kana"][0]["text"] == token) if kana_token else (bool(w["kanji"]) and w["kanji"][0]["text"] == token)
        return (not affix, grammar if kana_token else True, first, len(w["sense"]))

    def best(token: str):
        if token in by_kanji:
            return max(by_kanji[token], key=lambda w: score(w, token, False)), False
        if token in by_kana:
            return max(by_kana[token], key=lambda w: score(w, token, True)), True
        return None, False

    rows: list[dict] = []
    seen: set[str] = set()
    for token in top_n_list("ja", 20000):
        if token in seen or not re.search(r"[぀-ヿ一-鿿]", token):
            continue
        if re.search(r"[A-Za-z0-9０-９]", token):
            continue
        if token in JA_SKIP:
            continue
        entry, kana_token = best(token)
        if not entry and token not in JA_OVERRIDE:
            continue
        seen.add(token)
        if token in JA_OVERRIDE:
            reading, pos, gloss = JA_OVERRIDE[token]
        else:
            if kana_token:
                reading = token
            else:
                reading = next((k["text"] for k in entry["kana"] if k["common"] and ("*" in k["appliesToKanji"] or token in k["appliesToKanji"])), entry["kana"][0]["text"])
            sense = entry["sense"][0]
            pos = ja_pos(sense["partOfSpeech"])
            gloss = "; ".join(g["text"] for g in sense["gloss"][:2])
        row = {"word": token, "pos": pos, "gloss": short_gloss(gloss)}
        if reading != token:
            row["reading"] = reading
        row["romanization"] = kana_to_romaji(reading)
        if pos == "word":
            row["pos"] = ""
        row["ipa"] = kana_to_ipa(reading)
        rows.append(row)
        if len(rows) >= TARGET:
            break
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank
    return rows


# ------------------------------------------------------------------ Mandarin

TONE_MARKS = {
    "a": "āáǎà", "e": "ēéěè", "i": "īíǐì", "o": "ōóǒò", "u": "ūúǔù", "ü": "ǖǘǚǜ",
}
TONE_LETTERS = {"1": "˥˥", "2": "˧˥", "3": "˨˩˦", "4": "˥˩", "5": ""}


def pinyin_syllable(syl: str) -> str:
    match = re.fullmatch(r"([a-zü:]+)([1-5])", syl.lower())
    if not match:
        return syl
    body, tone = match.group(1).replace("u:", "ü").replace("v", "ü"), int(match.group(2))
    if tone == 5:
        return body
    for vowel in ("a", "e"):
        if vowel in body:
            return body.replace(vowel, TONE_MARKS[vowel][tone - 1], 1)
    if "ou" in body:
        return body.replace("o", TONE_MARKS["o"][tone - 1], 1)
    for i in range(len(body) - 1, -1, -1):
        if body[i] in TONE_MARKS:
            return body[:i] + TONE_MARKS[body[i]][tone - 1] + body[i + 1:]
    return body


PY_INITIALS = [
    ("zh", "ʈʂ"), ("ch", "ʈʂʰ"), ("sh", "ʂ"), ("b", "p"), ("p", "pʰ"), ("m", "m"), ("f", "f"),
    ("d", "t"), ("t", "tʰ"), ("n", "n"), ("l", "l"), ("g", "k"), ("k", "kʰ"), ("h", "x"),
    ("j", "tɕ"), ("q", "tɕʰ"), ("x", "ɕ"), ("r", "ʐ"), ("z", "ts"), ("c", "tsʰ"), ("s", "s"),
]
PY_FINALS = {
    "a": "a", "o": "o", "e": "ɤ", "ai": "aɪ", "ei": "eɪ", "ao": "ɑʊ", "ou": "oʊ", "an": "an",
    "en": "ən", "ang": "ɑŋ", "eng": "ɤŋ", "ong": "ʊŋ", "er": "aɻ", "i": "i", "ia": "ja",
    "ie": "jɛ", "iao": "jɑʊ", "iu": "joʊ", "ian": "jɛn", "in": "in", "iang": "jɑŋ", "ing": "iŋ",
    "iong": "jʊŋ", "u": "u", "ua": "wa", "uo": "wo", "uai": "waɪ", "ui": "weɪ", "uan": "wan",
    "un": "wən", "uang": "wɑŋ", "ueng": "wɤŋ", "ü": "y", "üe": "ɥɛ", "üan": "ɥɛn", "ün": "yn",
    "ue": "ɥɛ", "m": "m̩", "n": "n̩", "ng": "ŋ̍", "r": "ɻ",
}
PY_YW = {
    "yi": "i", "ya": "ja", "ye": "jɛ", "yao": "jɑʊ", "you": "joʊ", "yan": "jɛn", "yin": "in",
    "yang": "jɑŋ", "ying": "iŋ", "yong": "jʊŋ", "yu": "y", "yue": "ɥɛ", "yuan": "ɥɛn", "yun": "yn",
    "wu": "u", "wa": "wa", "wo": "wo", "wai": "waɪ", "wei": "weɪ", "wan": "wan", "wen": "wən",
    "wang": "wɑŋ", "weng": "wɤŋ", "yo": "jo",
}


def pinyin_syllable_ipa(syl: str) -> str:
    match = re.fullmatch(r"([a-zü:]+)([1-5])", syl.lower())
    if not match:
        return ""
    body, tone = match.group(1).replace("u:", "ü").replace("v", "ü"), match.group(2)
    if body in PY_YW:
        return PY_YW[body] + TONE_LETTERS[tone]
    for head, ipa in PY_INITIALS:
        if body.startswith(head):
            rest = body[len(head):]
            if head in ("j", "q", "x") and rest.startswith("u"):
                rest = "ü" + rest[1:]
            if rest == "i" and head in ("z", "c", "s"):
                final = "ɹ̩"
            elif rest == "i" and head in ("zh", "ch", "sh", "r"):
                final = "ɻ̩"
            else:
                final = PY_FINALS.get(rest)
            if final is None:
                return ""
            return ipa + final + TONE_LETTERS[tone]
    final = PY_FINALS.get(body)
    return final + TONE_LETTERS[tone] if final else ""


def pinyin_ipa(numbered: str) -> str | None:
    parts = [pinyin_syllable_ipa(s) for s in numbered.split()]
    return " ".join(parts) if parts and all(parts) else None


def pinyin_marks(numbered: str) -> str:
    return " ".join(pinyin_syllable(s) for s in numbered.split())


ZH_MARKED = re.compile(r"\((?:coll|dialect|literary|old|archaic|Taiwan|Cantonese|obsolete)[^)]*\)", re.I)


# Characters with several readings: the reading people mean most of the time.
ZH_READING = {
    "着": "zhe5", "得": "de5", "中": "zhong1", "与": "yu3", "会": "hui4", "吗": "ma5", "和": "he2",
    "只": "zhi3", "行": "xing2", "种": "zhong3", "重": "zhong4", "便": "bian4", "发": "fa1",
    "干": "gan4", "少": "shao3", "看": "kan4", "觉": "jue2", "数": "shu4", "差": "cha4",
    "当": "dang1", "相": "xiang1", "难": "nan2", "处": "chu4", "系": "xi4", "正": "zheng4",
    "长": "chang2", "还": "hai2", "都": "dou1", "地": "di4", "那": "na4", "哪": "na3", "呢": "ne5",
    "啊": "a5", "吧": "ba5", "么": "me5", "了": "le5", "的": "de5", "过": "guo4", "说": "shuo1",
    "大": "da4", "好": "hao3", "要": "yao4", "将": "jiang1", "没": "mei2", "把": "ba3", "给": "gei3",
    "为": "wei4", "上": "shang4", "下": "xia4", "家": "jia1", "得到": "de2 dao4", "觉得": "jue2 de5",
    "一": "yi1", "不": "bu4", "什么": "shen2 me5", "这个": "zhe4 ge5", "一个": "yi1 ge5",
    "分": "fen1", "朝": "chao2", "乐": "le4", "降": "jiang4", "传": "chuan2", "转": "zhuan3",
    "调": "tiao2", "空": "kong1", "似": "si4", "解": "jie3", "省": "sheng3", "藏": "cang2",
    "量": "liang4", "度": "du4", "提": "ti2", "应": "ying1", "应该": "ying1 gai1", "教": "jiao4",
    "参加": "can1 jia1", "参": "can1", "期": "qi1", "曾": "ceng2", "仍": "reng2", "背": "bei4",
    "便宜": "pian2 yi5", "银行": "yin2 hang2", "音乐": "yin1 yue4", "快乐": "kuai4 le4",
}


def zh_score(option: tuple[str, list[str]]) -> tuple:
    pinyin, defs = option
    usable = [d for d in defs if not ZH_MARKED.search(d) and not d.startswith("used in")]
    return (bool(usable), len(usable))


def zh_pick(token: str, options: list[tuple[str, list[str]]]) -> tuple[str, list[str]]:
    want = ZH_READING.get(token)
    if want:
        hit = next((o for o in options if o[0].lower() == want), None)
        if hit:
            return hit
    return max(options, key=zh_score)


def build_zh(fetch: Fetcher, ipa_table: dict[str, list[str]]) -> list[dict]:
    table = load_cedict(fetch)
    return zh_rows(table)


def load_cedict(fetch: Fetcher) -> dict[str, list[tuple[str, list[str]]]]:
    raw = gzip.decompress(fetch.get(CEDICT_URL, binary=True)).decode("utf-8")
    table: dict[str, list[tuple[str, list[str]]]] = {}
    for line in raw.splitlines():
        if line.startswith("#"):
            continue
        match = re.match(r"(\S+) (\S+) \[([^\]]+)\] /(.+)/$", line)
        if not match:
            continue
        simp, pinyin, defs = match.group(2), match.group(3), match.group(4).split("/")
        if re.search(r"[A-Z]", pinyin):
            continue
        defs = [d for d in defs if not re.match(r"(old )?variant of|surname |see [^ ]+\[|CL:", d)]
        if not defs:
            continue
        table.setdefault(simp, []).append((pinyin, defs))
    return table


def zh_rows(table: dict[str, list[tuple[str, list[str]]]]) -> list[dict]:
    rows: list[dict] = []
    for token in top_n_list("zh", 15000):
        if not re.fullmatch(r"[一-鿿]+", token):
            continue
        options = table.get(token)
        if not options:
            continue
        pinyin, defs = zh_pick(token, options)
        defs = [d for d in defs if not d.startswith("used in")] or defs
        ipa = pinyin_ipa(pinyin)
        row = {"word": token, "pos": "", "gloss": short_gloss("; ".join(defs[:2])), "reading": pinyin_marks(pinyin)}
        if ipa:
            row["ipa"] = ipa
        rows.append(row)
        if len(rows) >= TARGET:
            break
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank
    return rows


# -------------------------------------------------------------- bank IPA

ELISION = {"l'": "l", "d'": "d", "j'": "ʒ", "qu'": "k", "n'": "n", "s'": "s", "c'": "s", "m'": "m", "t'": "t", "un'": "un", "all'": "al", "dell'": "del", "nell'": "nel"}


def bank_words(lang: str) -> list[dict]:
    text = (ROOT / "lib" / "vocab" / f"{lang}.ts").read_text()
    out = []
    for block in re.finditer(r"\{\s*word: \"([^\"]+)\"(.*?)\n    \}", text, re.S):
        reading = re.search(r'reading: "([^"]+)"', block.group(2))
        out.append({"word": block.group(1), "reading": reading.group(1) if reading else None})
    return out


def phrase_ipa(lang: str, phrase: str, lookup) -> str | None:
    phrase = re.sub(r"\s*\((?:m|f|m/f|pl)\)", "", phrase).strip()
    whole = lookup(phrase)
    if whole:
        return whole
    parts: list[str] = []
    for token in re.split(r"\s+", phrase):
        lead = ""
        m = re.match(r"^([a-zà-ü]+')(.+)$", token, re.I)
        if m and m.group(1).lower() in ELISION:
            lead, token = ELISION[m.group(1).lower()], m.group(2)
        token = token.strip(",.!?¿¡")
        if not token:
            continue
        got = lookup(token) or lookup(token.lower())
        if not got:
            return None
        parts.append(lead + got)
    return " ".join(parts) if parts else None


def build_bank_ipa(fetch: Fetcher, ipa_tables: dict[str, IpaTable]) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for lang in ("en", "fr", "es", "it", "de", "ja", "zh"):
        words = bank_words(lang)
        out: dict[str, str] = {}
        if lang == "ja":
            for w in words:
                kana = w["reading"] or w["word"]
                if re.fullmatch(r"[぀-ヿー]+", kana):
                    out[w["word"]] = kana_to_ipa(kana)
        elif lang == "zh":
            cedict = load_cedict(fetch)
            for w in words:
                options = cedict.get(w["word"], [])
                want = re.sub(r"\s+", "", (w["reading"] or "")).lower()
                chosen = next((o for o in options if pinyin_marks(o[0]).replace(" ", "").lower() == want), None)
                chosen = chosen or (max(options, key=zh_score) if options else None)
                ipa = pinyin_ipa(chosen[0]) if chosen else None
                if ipa:
                    out[w["word"]] = ipa
        else:
            table = ipa_tables[lang]

            def lookup(token: str, table=table):
                return table.pick(token)

            found = [phrase_ipa(lang, w["word"], lookup) for w in words]
            for w, ipa in zip(words, found):
                if ipa:
                    out[w["word"]] = ipa
        result[lang] = out
        print(f"bank {lang}: IPA for {len(out)}/{len(words)}", file=sys.stderr)
    return result


# ------------------------------------------------------------------ main

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", default=os.environ.get("VOCAB_CACHE", "/tmp/vocab-cache"))
    parser.add_argument("--only", nargs="*", default=None, help="Languages to build (fr es it de ja zh bank)")
    args = parser.parse_args()
    fetch = Fetcher(Path(args.cache))
    # German builds only on request (`--only de`); the app ships no German list yet.
    wanted = set(args.only or ["fr", "es", "it", "ja", "zh", "bank"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ipa_tables = {lang: load_ipa(fetch, lang) for lang in ("fr", "es", "it", "de", "en")}

    for lang in ("fr", "es", "it", "de", "ja", "zh"):
        if lang not in wanted:
            continue
        started = time.time()
        if lang == "ja":
            rows = build_ja(fetch)
        elif lang == "zh":
            rows = build_zh(fetch, {})
        else:
            rows = build_latin(fetch, lang, ipa_tables[lang])
        with_ipa = sum(1 for r in rows if r.get("ipa"))
        (OUT_DIR / f"{lang}.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(f"{lang}: {len(rows)} words, IPA {with_ipa}, {time.time() - started:.0f}s", file=sys.stderr)

    if "bank" in wanted:
        BANK_IPA_OUT.write_text(json.dumps(build_bank_ipa(fetch, ipa_tables), ensure_ascii=False, indent=0, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
