import { describe, expect, it } from "vitest"
import { dictionaryForms, kanaLemmaOf, sanitizeWiktionaryHtml } from "@/lib/vocab-dictionary"

const PAGE = `
<div class="mw-heading mw-heading3"><h3 id="Étymologie">Étymologie</h3></div>
<p>Du latin <i>mansio</i>.<img src="x.png" onerror="alert(1)"></p>
<div class="mw-heading mw-heading3"><h3 id="Nom_commun">Nom commun</h3></div>
<p><b>maison</b> <a href="/wiki/Annexe:Prononciation/fran%C3%A7ais" title="Annexe:Prononciation/français"><span class="API" title="Prononciation API">\\mɛ.zɔ̃\\</span></a> féminin</p>
<ol><li>Bâtiment servant de logis. <ul><li><i>Une maison de campagne.</i></li></ul></li><li>Famille.</li></ol>
<div class="mw-heading mw-heading4"><h4 id="Synonymes">Synonymes</h4></div>
<ul><li><a href="/wiki/demeure" title="demeure">demeure</a></li><li><a href="/w/index.php?title=x&action=edit&redlink=1" class="new" title="x">x</a></li></ul>
<div class="mw-heading mw-heading4"><h4 id="Traductions">Traductions</h4></div>
<div class="boite"><ul><li>Anglais : house</li></ul></div>
<p>after translations</p>
<div class="mw-heading mw-heading3"><h3 id="Verbe">Verbe</h3></div>
<p><a href="/wiki/Conjugaison:fran%C3%A7ais/maisonner" title="Conjugaison:français/maisonner">conjugaison</a></p>
<script>alert(2)</script><a href="javascript:alert(3)">bad</a>
<span class="mw-editsection">[modifier]</span>
`

describe("vocab dictionary sanitizer", () => {
  const out = sanitizeWiktionaryHtml(PAGE, "fr.wiktionary.org")

  it("drops scripts, images, handlers, javascript links, and edit links", () => {
    expect(out.html).not.toMatch(/script|onerror|<img|javascript:|modifier|alert/)
  })

  it("drops the translations section up to the next heading of its level or higher", () => {
    expect(out.html).not.toContain("Traductions")
    expect(out.html).not.toContain("Anglais")
    expect(out.html).not.toContain("after translations")
    expect(out.html).toContain("Verbe")
  })

  it("keeps senses, examples, and synonyms; wiki words become in-app lookups", () => {
    expect(out.html).toContain("Bâtiment servant de logis.")
    expect(out.html).toContain("Une maison de campagne.")
    expect(out.html).toContain('data-vocab-word="demeure"')
    expect(out.html).not.toContain("redlink")
    expect(out.html).toContain('href="https://fr.wiktionary.org/wiki/Annexe:Prononciation/fran%C3%A7ais"')
    expect(out.html).toContain('target="_blank"')
  })

  it("finds the IPA, the first definition, and the conjugation page", () => {
    expect(out.ipa).toBe("mɛ.zɔ̃")
    expect(out.firstDefinition).toBe("Bâtiment servant de logis.")
    expect(out.conjugationTitle).toBe("Conjugaison:français/maisonner")
  })

  it("prefers the conjugation page named after the word over a group explainer", () => {
    const html = `<p>manger 1er groupe (<a href="/wiki/Conjugaison:fran%C3%A7ais/premier_groupe" title="Conjugaison:français/premier groupe">voir</a>,
      <a href="/wiki/Conjugaison:fran%C3%A7ais/manger" title="Conjugaison:français/manger">conjugaison</a>)</p>`
    expect(sanitizeWiktionaryHtml(html, "fr.wiktionary.org", "manger").conjugationTitle).toBe("Conjugaison:français/manger")
  })
})

describe("dictionary forms", () => {
  it("strips articles and gender tags before looking a bank word up", () => {
    expect(dictionaryForms("fr", "l'eau (f)")[0]).toBe("eau")
    expect(dictionaryForms("fr", "la pomme")[0]).toBe("pomme")
    expect(dictionaryForms("de", "der Hund")[0]).toBe("Hund")
    expect(dictionaryForms("es", "el gato")[0]).toBe("gato")
    expect(dictionaryForms("ja", "猫")).toEqual(["猫"])
  })
})

describe("Japanese kana lemma", () => {
  it("follows a kanji spelling page to its kana headword", () => {
    expect(kanaLemmaOf("ja", "たべるの漢字表記。")).toBe("たべる")
    expect(kanaLemmaOf("ja", "食物を口に入れて噛み、飲み込む。")).toBeNull()
    expect(kanaLemmaOf("fr", "たべるの漢字表記。")).toBeNull()
  })
})
