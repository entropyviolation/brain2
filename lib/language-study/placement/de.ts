/**
 * lib/language-study/placement/de.ts — German placement bank (Goethe-Zertifikat format)
 *
 * Original items in the shape of Goethe-Zertifikat tasks: Lesen, Hören, and
 * Sprachbausteine gaps. Five per level; a run draws four. The right option
 * is first.
 */

import type { PlacementBank } from "@/lib/language-study/placement/types"

const LESEN = "Lesen"
const HOEREN = "Hören"
const SPRACHE = "Sprachbausteine"

export const DE_PLACEMENT: PlacementBank = {
  lang: "de",
  questions: [
    // A1
    { id: "de-a1-1", level: "A1", skill: "listening", task: HOEREN, ask: "Listen, then answer.",
      passage: "Hallo, ich bin Jonas. Ich komme aus Österreich und wohne jetzt in Berlin.",
      stem: "Woher kommt Jonas?", choices: ["Aus Österreich", "Aus Berlin", "Aus der Schweiz", "Aus Italien"],
      why: "„Ich komme aus Österreich“." },
    { id: "de-a1-2", level: "A1", skill: "reading", task: LESEN, ask: "Read the sign, then answer.",
      passage: "Praxis Dr. Weber – Sprechzeiten: Montag bis Freitag 8–12 Uhr. Mittwochnachmittag 15–18 Uhr.",
      stem: "Wann ist die Praxis am Mittwochnachmittag offen?", choices: ["Von 15 bis 18 Uhr", "Von 8 bis 12 Uhr", "Gar nicht", "Von 12 bis 15 Uhr"],
      why: "„Mittwochnachmittag 15–18 Uhr“." },
    { id: "de-a1-3", level: "A1", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Wir ___ Kaffee.", choices: ["trinken", "trinkt", "trinke", "trinkst"],
      why: "Wir takes the -en ending." },
    { id: "de-a1-4", level: "A1", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Ich habe ___ Bruder und zwei Schwestern.", choices: ["einen", "ein", "eine", "einer"],
      why: "Haben takes the accusative; Bruder is masculine: einen." },
    { id: "de-a1-5", level: "A1", skill: "vocabulary", task: SPRACHE, ask: "Fill the gap.",
      stem: "Ich esse ein Brot mit ___.", choices: ["Käse", "Stuhl", "Tasche", "Fenster"],
      why: "Bread with cheese." },

    // A2
    { id: "de-a2-1", level: "A2", skill: "listening", task: HOEREN, ask: "Listen to the announcement, then answer.",
      passage: "Achtung an Gleis vier: Der Zug nach Hamburg fährt heute von Gleis sieben ab.",
      stem: "Was ist anders?", choices: ["Das Gleis", "Die Uhrzeit", "Das Ziel", "Der Zug fällt aus"],
      why: "It leaves from platform seven, not four." },
    { id: "de-a2-2", level: "A2", skill: "reading", task: LESEN, ask: "Read the message, then answer.",
      passage: "Liebe Sara, ich kann am Samstag leider nicht zu deiner Party kommen. Meine Großeltern besuchen uns. Wollen wir am Sonntag zusammen frühstücken? Viele Grüße, Tim",
      stem: "Warum kommt Tim nicht?", choices: ["Seine Großeltern kommen zu Besuch", "Er ist krank", "Er muss arbeiten", "Er frühstückt mit Sara"],
      why: "„Meine Großeltern besuchen uns“." },
    { id: "de-a2-3", level: "A2", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Gestern ___ ich ins Kino gegangen.", choices: ["bin", "habe", "werde", "hatte"],
      why: "Gehen forms the Perfekt with sein." },
    { id: "de-a2-4", level: "A2", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Ich helfe ___ Mutter.", choices: ["meiner", "meine", "meinen", "mein"],
      why: "Helfen takes the dative: meiner Mutter." },
    { id: "de-a2-5", level: "A2", skill: "vocabulary", task: SPRACHE, ask: "Fill the gap.",
      stem: "Im Winter fahren wir in die Berge zum ___.", choices: ["Skifahren", "Schwimmen", "Sonnenbaden", "Tauchen"],
      why: "Winter in the mountains: skiing." },

    // B1
    { id: "de-b1-1", level: "B1", skill: "listening", task: HOEREN, ask: "Listen to the voicemail, then answer.",
      passage: "Guten Tag, hier ist die Autowerkstatt Müller. Ihr Wagen ist fertig, aber wir mussten auch die Bremsen wechseln. Das kostet hundertzwanzig Euro mehr.",
      stem: "Was erfährt der Kunde?", choices: ["Die Reparatur wird teurer", "Das Auto ist noch nicht fertig", "Die Bremsen sind in Ordnung", "Er muss nichts bezahlen"],
      why: "„Das kostet hundertzwanzig Euro mehr“." },
    { id: "de-b1-2", level: "B1", skill: "reading", task: LESEN, ask: "Read the article, then answer.",
      passage: "Immer mehr Firmen bieten ihren Mitarbeitern ein Jobticket an. Damit können sie günstig mit Bus und Bahn zur Arbeit fahren. Die Firmen hoffen, dass weniger Parkplätze gebraucht werden.",
      stem: "Was hoffen die Firmen?", choices: ["Dass sie weniger Parkplätze brauchen", "Dass die Mitarbeiter mehr verdienen", "Dass Busse billiger werden", "Dass mehr Leute Auto fahren"],
      why: "„dass weniger Parkplätze gebraucht werden“." },
    { id: "de-b1-3", level: "B1", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Ich weiß nicht, ob er morgen ___.", choices: ["kommt", "kommen", "komme", "gekommen"],
      why: "In an ob clause the conjugated verb goes last: kommt." },
    { id: "de-b1-4", level: "B1", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Wenn ich mehr Zeit ___, würde ich reisen.", choices: ["hätte", "habe", "hatte", "haben"],
      why: "An unreal condition takes Konjunktiv II: hätte." },
    { id: "de-b1-5", level: "B1", skill: "vocabulary", task: SPRACHE, ask: "Fill the gap.",
      stem: "Ich muss den Termin leider ___, weil ich krank bin.", choices: ["absagen", "aussagen", "ansagen", "zusagen"],
      why: "Absagen — to cancel." },

    // B2
    { id: "de-b2-1", level: "B2", skill: "reading", task: LESEN, ask: "Read, then answer.",
      passage: "Zwar gilt Homeoffice als flexibel, doch Studien zeigen, dass viele Beschäftigte länger arbeiten als im Büro, weil die Grenze zwischen Beruf und Freizeit verschwimmt.",
      stem: "Was zeigen die Studien?", choices: ["Viele arbeiten zu Hause länger", "Homeoffice verkürzt die Arbeitszeit", "Alle wollen ins Büro zurück", "Freizeit und Beruf sind klarer getrennt"],
      why: "„dass viele Beschäftigte länger arbeiten“." },
    { id: "de-b2-2", level: "B2", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Das ist der Kollege, ___ Hilfe ich mich verlassen kann.", choices: ["auf dessen", "dessen", "auf den", "dem"],
      why: "Sich verlassen auf + the genitive relative dessen." },
    { id: "de-b2-3", level: "B2", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Der Bericht muss bis Freitag ___ werden.", choices: ["fertiggestellt", "fertigstellen", "fertigstellt", "fertiggestellen"],
      why: "Passive with a modal: Partizip II + werden." },
    { id: "de-b2-4", level: "B2", skill: "vocabulary", task: SPRACHE, ask: "Fill the gap.",
      stem: "Die Verhandlungen sind leider ___: Es gab keine Einigung.", choices: ["gescheitert", "gescheitelt", "gestiegen", "geschafft"],
      why: "Scheitern — to fail." },
    { id: "de-b2-5", level: "B2", skill: "listening", task: HOEREN, ask: "Listen, then answer.",
      passage: "Entgegen den Erwartungen ist die Zahl der Besucher im Museum nach der Preiserhöhung nicht gesunken, sondern sogar leicht gestiegen.",
      stem: "Was ist nach der Preiserhöhung passiert?", choices: ["Es kamen etwas mehr Besucher", "Es kamen weniger Besucher", "Das Museum hat geschlossen", "Die Preise sind gesunken"],
      why: "„sondern sogar leicht gestiegen“." },

    // C1
    { id: "de-c1-1", level: "C1", skill: "reading", task: LESEN, ask: "Read, then answer.",
      passage: "Der Autor bestreitet nicht den Nutzen von Ranglisten; er kritisiert vielmehr, dass Hochschulen ihr Handeln zunehmend daran ausrichten, statt an der Qualität der Lehre.",
      stem: "Was kritisiert der Autor?", choices: ["Dass Hochschulen sich nach Ranglisten richten", "Dass es Ranglisten gibt", "Die Qualität der Studenten", "Dass Ranglisten nutzlos sind"],
      why: "„dass Hochschulen ihr Handeln zunehmend daran ausrichten“." },
    { id: "de-c1-2", level: "C1", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "___ der schlechten Wetterlage fand das Konzert statt.", choices: ["Trotz", "Wegen", "Dank", "Statt"],
      why: "Concession with the genitive: trotz." },
    { id: "de-c1-3", level: "C1", skill: "vocabulary", task: SPRACHE, ask: "Fill the gap.",
      stem: "Die Entscheidung wurde ohne ___ der Betroffenen getroffen.", choices: ["Mitwirkung", "Mitleid", "Mitgift", "Mittel"],
      why: "Mitwirkung — participation." },
    { id: "de-c1-4", level: "C1", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Hätte ich das gewusst, ___ ich anders gehandelt.", choices: ["hätte", "habe", "würde", "wäre"],
      why: "Past unreal: hätte + Partizip II." },
    { id: "de-c1-5", level: "C1", skill: "listening", task: HOEREN, ask: "Listen, then answer.",
      passage: "Man sollte die neuen Zahlen nicht überbewerten: Ein einzelnes gutes Quartal macht noch keine Trendwende.",
      stem: "Was meint der Sprecher?", choices: ["Ein gutes Quartal ist noch kein echter Wandel", "Die Wirtschaft hat sich dauerhaft erholt", "Die Zahlen sind falsch", "Das Quartal war schlecht"],
      why: "One good quarter is not yet a turnaround." },

    // C2
    { id: "de-c2-1", level: "C2", skill: "reading", task: LESEN, ask: "Read, then answer.",
      passage: "Was auf den ersten Blick wie bloße Nostalgie anmutet, entpuppt sich bei näherem Hinsehen als scharfsinnige Kritik an der Gegenwart.",
      stem: "Wie ist das Werk zu verstehen?", choices: ["Als Gegenwartskritik hinter scheinbarer Nostalgie", "Als reine Nostalgie", "Als Lob der Gegenwart", "Als historische Dokumentation"],
      why: "„entpuppt sich … als scharfsinnige Kritik an der Gegenwart“." },
    { id: "de-c2-2", level: "C2", skill: "vocabulary", task: SPRACHE, ask: "Choose the meaning.",
      stem: "„Jemandem reinen Wein einschenken“ bedeutet:", choices: ["jemandem die Wahrheit sagen", "jemanden betrunken machen", "ein Fest feiern", "jemanden einladen"],
      why: "To pour someone pure wine: to tell them the plain truth." },
    { id: "de-c2-3", level: "C2", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "Er tat so, als ___ er nichts davon gewusst.", choices: ["hätte", "hat", "hatte", "wird"],
      why: "Als (= als ob) takes the Konjunktiv, verb right after als." },
    { id: "de-c2-4", level: "C2", skill: "vocabulary", task: SPRACHE, ask: "Fill the gap.",
      stem: "Seine Argumentation ist ___: Sie widerspricht sich selbst.", choices: ["inkonsistent", "inkontinent", "inkompetent", "indifferent"],
      why: "Contradicting itself is inconsistent." },
    { id: "de-c2-5", level: "C2", skill: "grammar", task: SPRACHE, ask: "Fill the gap.",
      stem: "___ man es auch dreht und wendet, das Problem bleibt.", choices: ["Wie", "Was", "Ob", "Wenn"],
      why: "Fixed phrase: wie man es auch dreht und wendet." },
  ],
}
