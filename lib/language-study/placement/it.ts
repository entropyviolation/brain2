/**
 * lib/language-study/placement/it.ts — Italian placement bank (CELI format)
 *
 * Original items in the shape of CELI tasks: Comprensione della lettura,
 * Comprensione dell'ascolto, and Competenza linguistica gaps. Five per level;
 * a run draws four. The right option is first.
 */

import type { PlacementBank } from "@/lib/language-study/placement/types"

const LETTURA = "Comprensione della lettura"
const ASCOLTO = "Comprensione dell'ascolto"
const LINGUA = "Competenza linguistica"

export const IT_PLACEMENT: PlacementBank = {
  lang: "it",
  questions: [
    // A1
    { id: "it-a1-1", level: "A1", skill: "listening", task: ASCOLTO, ask: "Listen, then answer.",
      passage: "Ciao, sono Giulia. Sono di Napoli, ma abito a Milano con mia sorella.",
      stem: "Dove abita Giulia?", choices: ["A Milano", "A Napoli", "A Roma", "A Torino"],
      why: "«abito a Milano» — she is from Naples but lives in Milan." },
    { id: "it-a1-2", level: "A1", skill: "reading", task: LETTURA, ask: "Read the sign, then answer.",
      passage: "Farmacia Centrale. Aperta dal lunedì al sabato, ore 8.30–19.30. Domenica chiusa.",
      stem: "Quando è chiusa la farmacia?", choices: ["La domenica", "Il lunedì", "Il sabato", "Ogni mattina"],
      why: "«Domenica chiusa»." },
    { id: "it-a1-3", level: "A1", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Io ___ italiano.", choices: ["parlo", "parli", "parla", "parlano"],
      why: "Io takes the -o ending: parlo." },
    { id: "it-a1-4", level: "A1", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Loro ___ due figli.", choices: ["hanno", "sono", "ha", "avete"],
      why: "Avere for having children; loro hanno." },
    { id: "it-a1-5", level: "A1", skill: "vocabulary", task: LINGUA, ask: "Fill the gap.",
      stem: "Ho sete. Vorrei un bicchiere d'___.", choices: ["acqua", "olio", "aria", "oro"],
      why: "Sete is thirst; a glass of water." },

    // A2
    { id: "it-a2-1", level: "A2", skill: "listening", task: ASCOLTO, ask: "Listen to the announcement, then answer.",
      passage: "Il treno regionale per Firenze è in ritardo di quindici minuti. Ci scusiamo per il disagio.",
      stem: "Che problema c'è?", choices: ["Il treno è in ritardo", "Il treno è cancellato", "Il treno parte da un altro binario", "Il treno è pieno"],
      why: "«in ritardo di quindici minuti»." },
    { id: "it-a2-2", level: "A2", skill: "reading", task: LETTURA, ask: "Read the note, then answer.",
      passage: "Cara Marta, domenica festeggio il mio compleanno al ristorante «Da Pino» alle 20. Non portare regali, basta la tua presenza! Se non puoi venire, mandami un messaggio. Luca",
      stem: "Cosa chiede Luca a Marta?", choices: ["Di avvisarlo se non può venire", "Di portare un regalo", "Di prenotare il ristorante", "Di arrivare alle 18"],
      why: "«Se non puoi venire, mandami un messaggio»." },
    { id: "it-a2-3", level: "A2", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Ieri sera ___ al cinema con Paolo.", choices: ["sono andata", "ho andato", "vado", "andrò"],
      why: "Andare takes essere in the passato prossimo." },
    { id: "it-a2-4", level: "A2", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Questo libro è ___ Maria.", choices: ["di", "da", "a", "con"],
      why: "Possession: il libro di Maria." },
    { id: "it-a2-5", level: "A2", skill: "vocabulary", task: LINGUA, ask: "Fill the gap.",
      stem: "Per tagliare il pane uso un ___.", choices: ["coltello", "cucchiaio", "bicchiere", "piatto"],
      why: "Un coltello is a knife." },

    // B1
    { id: "it-b1-1", level: "B1", skill: "listening", task: ASCOLTO, ask: "Listen to the announcement, then answer.",
      passage: "Gentili clienti, il supermercato chiuderà tra quindici minuti. Vi preghiamo di recarvi alle casse.",
      stem: "Cosa devono fare i clienti?", choices: ["Andare a pagare", "Uscire subito", "Tornare domani", "Prendere un carrello"],
      why: "«recarvi alle casse» — go to the checkouts." },
    { id: "it-b1-2", level: "B1", skill: "reading", task: LETTURA, ask: "Read the article, then answer.",
      passage: "Negli ultimi anni molti giovani italiani hanno lasciato le grandi città per tornare nei piccoli paesi d'origine. Lavorare a distanza permette loro di mantenere il proprio impiego e di vivere con costi più bassi.",
      stem: "Perché i giovani tornano nei paesi?", choices: ["Possono lavorare a distanza e spendere meno", "Le città sono chiuse", "Hanno perso il lavoro", "I paesi offrono stipendi più alti"],
      why: "Remote work keeps the job; costs are lower." },
    { id: "it-b1-3", level: "B1", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Se ___ tempo, verrei con te.", choices: ["avessi", "avrei", "ho", "avevo"],
      why: "Se + congiuntivo imperfetto pairs with the condizionale." },
    { id: "it-b1-4", level: "B1", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "È necessario che tu ___ presto.", choices: ["parta", "parti", "partirai", "partivi"],
      why: "È necessario che takes the congiuntivo." },
    { id: "it-b1-5", level: "B1", skill: "vocabulary", task: LINGUA, ask: "Fill the gap.",
      stem: "Ho perso il portafoglio: devo fare ___ alla polizia.", choices: ["denuncia", "domanda", "dieta", "dimissioni"],
      why: "Fare denuncia — to report to the police." },

    // B2
    { id: "it-b2-1", level: "B2", skill: "reading", task: LETTURA, ask: "Read, then answer.",
      passage: "Benché il turismo porti ricchezza, molte città d'arte cercano di limitarne gli effetti: a Venezia, per esempio, è stato introdotto un contributo d'accesso per i visitatori giornalieri.",
      stem: "Che cosa ha fatto Venezia?", choices: ["Ha introdotto una tassa per chi visita in giornata", "Ha vietato il turismo", "Ha abbassato i prezzi", "Ha chiuso i musei"],
      why: "«un contributo d'accesso per i visitatori giornalieri»." },
    { id: "it-b2-2", level: "B2", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Benché ___ stanco, ha finito il lavoro.", choices: ["fosse", "era", "sarà", "sarebbe"],
      why: "Benché takes the congiuntivo." },
    { id: "it-b2-3", level: "B2", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Se l'avessi saputo, te l'___.", choices: ["avrei detto", "avessi detto", "ho detto", "direi"],
      why: "Past unreal condition: condizionale passato." },
    { id: "it-b2-4", level: "B2", skill: "vocabulary", task: LINGUA, ask: "Fill the gap.",
      stem: "Dopo la riunione, il direttore ha ___ una decisione importante.", choices: ["preso", "fatto", "dato", "messo"],
      why: "In Italian you prendere una decisione." },
    { id: "it-b2-5", level: "B2", skill: "listening", task: ASCOLTO, ask: "Listen, then answer.",
      passage: "Non è tanto il prezzo a scoraggiare i clienti, quanto la lentezza delle consegne.",
      stem: "Cosa scoraggia i clienti?", choices: ["La lentezza delle consegne", "Il prezzo", "La qualità", "Il servizio clienti"],
      why: "Non tanto… quanto: not so much the price as the slow delivery." },

    // C1
    { id: "it-c1-1", level: "C1", skill: "reading", task: LETTURA, ask: "Read, then answer.",
      passage: "L'autore non contesta l'utilità della tecnologia in classe, bensì l'idea che basti introdurla per migliorare l'apprendimento, senza ripensare il ruolo dell'insegnante.",
      stem: "Che cosa contesta l'autore?", choices: ["L'idea che la tecnologia basti da sola", "L'uso della tecnologia", "Il ruolo degli studenti", "Il costo dei computer"],
      why: "«bensì l'idea che basti introdurla»." },
    { id: "it-c1-2", level: "C1", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Qualora ___ problemi, contattateci.", choices: ["sorgessero", "sorgono", "sorgeranno", "sorsero"],
      why: "Qualora takes the congiuntivo." },
    { id: "it-c1-3", level: "C1", skill: "vocabulary", task: LINGUA, ask: "Fill the gap.",
      stem: "La sua proposta è stata ___ all'unanimità.", choices: ["approvata", "approfittata", "approdata", "appropriata"],
      why: "Approvare all'unanimità — to pass unanimously." },
    { id: "it-c1-4", level: "C1", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Pur ___ molto studiato, non ha superato l'esame.", choices: ["avendo", "avere", "avuto", "abbia"],
      why: "Pur + gerundio: although having studied." },
    { id: "it-c1-5", level: "C1", skill: "listening", task: ASCOLTO, ask: "Listen, then answer.",
      passage: "Sarebbe ingenuo pensare che la crisi si risolva da sola: occorrono interventi mirati e tempestivi.",
      stem: "Che cosa sostiene chi parla?", choices: ["Servono interventi rapidi e precisi", "La crisi passerà da sola", "Non bisogna intervenire", "La crisi è già finita"],
      why: "«occorrono interventi mirati e tempestivi»." },

    // C2
    { id: "it-c2-1", level: "C2", skill: "reading", task: LETTURA, ask: "Read, then answer.",
      passage: "Il romanzo procede per sottrazione: ciò che conta non è detto, ma traspare dai silenzi dei personaggi.",
      stem: "Come funziona il romanzo?", choices: ["Il significato emerge da ciò che non viene detto", "I personaggi spiegano tutto", "È un romanzo molto lungo", "Non ci sono personaggi"],
      why: "What matters shows through the silences." },
    { id: "it-c2-2", level: "C2", skill: "vocabulary", task: LINGUA, ask: "Choose the meaning.",
      stem: "«Prendere lucciole per lanterne» significa…", choices: ["prendere un grosso abbaglio", "andare a caccia di notte", "accendere una luce", "risparmiare energia"],
      why: "To mistake fireflies for lanterns: to be badly mistaken." },
    { id: "it-c2-3", level: "C2", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Checché ne ___ i critici, il film è un capolavoro.", choices: ["dicano", "dicono", "diranno", "dicevano"],
      why: "Checché takes the congiuntivo." },
    { id: "it-c2-4", level: "C2", skill: "vocabulary", task: LINGUA, ask: "Fill the gap.",
      stem: "Un discorso ___ è pieno di parole inutili.", choices: ["prolisso", "conciso", "incisivo", "asciutto"],
      why: "Prolisso — long-winded." },
    { id: "it-c2-5", level: "C2", skill: "grammar", task: LINGUA, ask: "Fill the gap.",
      stem: "Non fosse stato per lui, ___ tutto.", choices: ["avremmo perso", "abbiamo perso", "perdiamo", "avessimo perso"],
      why: "An unreal past condition takes the condizionale passato." },
  ],
}
