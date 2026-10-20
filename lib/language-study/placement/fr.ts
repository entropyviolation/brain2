/**
 * lib/language-study/placement/fr.ts — French placement bank (DELF / DALF format)
 *
 * Original items in the shape of DELF A1–B2 and DALF C1–C2 tasks:
 * Compréhension de l'oral, Compréhension des écrits, and short grammar and
 * vocabulary gaps. Five per level; a run draws four. The right option is first.
 */

import type { PlacementBank } from "@/lib/language-study/placement/types"

const ORAL = "Compréhension de l'oral"
const ECRIT = "Compréhension des écrits"
const LANGUE = "Lexique et grammaire"

export const FR_PLACEMENT: PlacementBank = {
  lang: "fr",
  questions: [
    // A1
    { id: "fr-a1-1", level: "A1", skill: "listening", task: ORAL, ask: "Listen, then answer.",
      passage: "Bonjour, je m'appelle Léa. J'habite à Lyon et j'ai vingt-deux ans.",
      stem: "Où habite Léa ?", choices: ["À Lyon", "À Paris", "À Lille", "À Nice"],
      why: "« J'habite à Lyon » — I live in Lyon." },
    { id: "fr-a1-2", level: "A1", skill: "reading", task: ECRIT, ask: "Read the sign, then answer.",
      passage: "Boulangerie Martin — Ouvert du mardi au dimanche, de 7 h à 19 h. Fermé le lundi.",
      stem: "Quel jour la boulangerie est-elle fermée ?", choices: ["Le lundi", "Le mardi", "Le dimanche", "Le samedi"],
      why: "« Fermé le lundi » — closed on Monday." },
    { id: "fr-a1-3", level: "A1", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Nous ___ français.", choices: ["parlons", "parlez", "parlent", "parle"],
      why: "Nous takes the -ons ending: nous parlons." },
    { id: "fr-a1-4", level: "A1", skill: "vocabulary", task: LANGUE, ask: "Fill the gap.",
      stem: "Pour boire mon café le matin, j'utilise une ___.", choices: ["tasse", "fourchette", "chaise", "fenêtre"],
      why: "Une tasse is a cup." },
    { id: "fr-a1-5", level: "A1", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Elle ___ un frère et une sœur.", choices: ["a", "est", "as", "ont"],
      why: "Avoir for siblings, third person singular: elle a." },

    // A2
    { id: "fr-a2-1", level: "A2", skill: "listening", task: ORAL, ask: "Listen to the announcement, then answer.",
      passage: "Le train pour Marseille partira avec vingt minutes de retard, à dix heures quarante.",
      stem: "À quelle heure part le train ?", choices: ["10 h 40", "10 h 20", "10 h", "20 h 40"],
      why: "« à dix heures quarante » — at 10:40." },
    { id: "fr-a2-2", level: "A2", skill: "reading", task: ECRIT, ask: "Read the message, then answer.",
      passage: "Salut Tom ! Samedi, on fait un pique-nique au parc. Apporte des boissons, moi j'apporte les sandwichs. S'il pleut, on mange chez moi. Inès",
      stem: "Que doit apporter Tom ?", choices: ["Des boissons", "Des sandwichs", "Un parapluie", "Un gâteau"],
      why: "« Apporte des boissons » — bring drinks." },
    { id: "fr-a2-3", level: "A2", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Hier, nous ___ au cinéma.", choices: ["sommes allés", "avons allé", "allons", "irons"],
      why: "Aller takes être in the passé composé, and hier asks for the past." },
    { id: "fr-a2-4", level: "A2", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Tu connais Paul ? Oui, je ___ connais bien.", choices: ["le", "lui", "la", "leur"],
      why: "Connaître takes a direct object; Paul is masculine: le." },
    { id: "fr-a2-5", level: "A2", skill: "vocabulary", task: LANGUE, ask: "Fill the gap.",
      stem: "Je suis malade : je dois prendre rendez-vous chez le ___.", choices: ["médecin", "boulanger", "coiffeur", "facteur"],
      why: "When you are ill you see le médecin, the doctor." },

    // B1
    { id: "fr-b1-1", level: "B1", skill: "listening", task: ORAL, ask: "Listen to the voicemail, then answer.",
      passage: "Bonjour, c'est Marc du service client. Votre commande est arrivée, mais il manque un article. Nous vous l'enverrons séparément la semaine prochaine, sans frais.",
      stem: "Quel est le problème ?", choices: ["Un article manque dans la commande", "La commande est perdue", "Il faut payer des frais", "La commande arrive demain"],
      why: "« il manque un article » — one item is missing." },
    { id: "fr-b1-2", level: "B1", skill: "reading", task: ECRIT, ask: "Read the article, then answer.",
      passage: "La mairie lance un programme de vélos partagés. Pour vingt euros par an, les habitants pourront emprunter un vélo dans l'une des quinze stations de la ville. Les trente premières minutes de chaque trajet sont gratuites.",
      stem: "Qu'est-ce qui est gratuit ?", choices: ["La première demi-heure de chaque trajet", "L'abonnement annuel", "Les quinze premiers trajets", "Le vélo pour les touristes"],
      why: "« Les trente premières minutes de chaque trajet sont gratuites. »" },
    { id: "fr-b1-3", level: "B1", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Si j'avais plus de temps, j'___ le piano.", choices: ["apprendrais", "apprendrai", "apprenais", "ai appris"],
      why: "Si + imparfait pairs with the conditionnel." },
    { id: "fr-b1-4", level: "B1", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Il faut que tu ___ avant midi.", choices: ["viennes", "viens", "viendras", "venais"],
      why: "Il faut que takes the subjunctive: que tu viennes." },
    { id: "fr-b1-5", level: "B1", skill: "vocabulary", task: LANGUE, ask: "Fill the gap.",
      stem: "Pour ce poste, il faut ___ un CV et une lettre de motivation.", choices: ["envoyer", "recevoir", "dépenser", "emprunter"],
      why: "You send (envoyer) a CV to apply." },

    // B2
    { id: "fr-b2-1", level: "B2", skill: "reading", task: ECRIT, ask: "Read, then answer.",
      passage: "Si le télétravail a séduit de nombreux salariés, certains chercheurs s'inquiètent de ses effets à long terme : l'isolement et la difficulté à séparer vie privée et vie professionnelle pourraient, selon eux, annuler les gains de productivité observés.",
      stem: "Selon les chercheurs, le télétravail…", choices: ["pourrait perdre ses avantages à long terme", "augmente toujours la productivité", "est rejeté par la majorité des salariés", "améliore la vie privée"],
      why: "The downsides « pourraient annuler les gains » — could cancel the gains." },
    { id: "fr-b2-2", level: "B2", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Bien qu'il ___ beaucoup travaillé, il n'a pas réussi l'examen.", choices: ["ait", "a", "avait", "aura"],
      why: "Bien que takes the subjunctive: qu'il ait travaillé." },
    { id: "fr-b2-3", level: "B2", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "C'est un projet ___ je tiens beaucoup.", choices: ["auquel", "duquel", "lequel", "dont"],
      why: "Tenir à quelque chose: à + lequel becomes auquel." },
    { id: "fr-b2-4", level: "B2", skill: "vocabulary", task: LANGUE, ask: "Fill the gap.",
      stem: "Les négociations ont échoué : les deux parties n'ont pas réussi à trouver un ___.", choices: ["compromis", "comportement", "complément", "composant"],
      why: "Trouver un compromis — to reach a compromise." },
    { id: "fr-b2-5", level: "B2", skill: "listening", task: ORAL, ask: "Listen, then answer.",
      passage: "Contrairement à ce qu'on pourrait croire, la hausse des ventes de livres numériques n'a pas fait baisser celles des livres papier ; les deux marchés semblent plutôt se compléter.",
      stem: "Que dit-on des livres papier ?", choices: ["Leurs ventes n'ont pas baissé", "Ils disparaissent", "Ils coûtent plus cher", "Ils remplacent le numérique"],
      why: "« n'a pas fait baisser celles des livres papier »." },

    // C1
    { id: "fr-c1-1", level: "C1", skill: "reading", task: ECRIT, ask: "Read, then answer.",
      passage: "L'auteur ne nie pas l'utilité des indicateurs économiques ; il leur reproche plutôt de s'être imposés comme l'unique boussole des politiques publiques, au détriment de considérations qu'aucun chiffre ne saurait traduire.",
      stem: "Que reproche l'auteur aux indicateurs économiques ?", choices: ["D'être devenus le seul critère des décisions", "D'être inexacts", "D'être inutiles", "D'être trop difficiles à calculer"],
      why: "« l'unique boussole » — the only compass for policy." },
    { id: "fr-c1-2", level: "C1", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "___ la crise, l'entreprise a maintenu ses investissements.", choices: ["En dépit de", "Grâce à", "Faute de", "Au lieu de"],
      why: "Concession: in spite of the crisis, it kept investing." },
    { id: "fr-c1-3", level: "C1", skill: "vocabulary", task: LANGUE, ask: "Fill the gap.",
      stem: "Son discours, truffé de lieux communs, était d'une grande ___.", choices: ["banalité", "subtilité", "audace", "pertinence"],
      why: "Lieux communs are clichés, so the speech was banal." },
    { id: "fr-c1-4", level: "C1", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Quelles que ___ vos raisons, vous auriez dû prévenir.", choices: ["soient", "sont", "seraient", "étaient"],
      why: "Quel que takes the subjunctive: quelles que soient." },
    { id: "fr-c1-5", level: "C1", skill: "listening", task: ORAL, ask: "Listen, then answer.",
      passage: "Il serait réducteur d'imputer l'échec du projet au seul manque de financement ; c'est avant tout l'absence de concertation avec les habitants qui l'a condamné.",
      stem: "Selon l'orateur, la cause principale de l'échec est…", choices: ["le manque de concertation avec les habitants", "le manque d'argent", "un mauvais calendrier", "l'opposition des élus"],
      why: "« c'est avant tout l'absence de concertation »." },

    // C2
    { id: "fr-c2-1", level: "C2", skill: "reading", task: ECRIT, ask: "Read, then answer.",
      passage: "On aurait tort de voir dans cette œuvre une simple satire : sous l'ironie mordante affleure une tendresse inavouée pour les travers mêmes qu'elle épingle.",
      stem: "Quel est le sens du texte ?", choices: ["L'œuvre se moque de défauts qu'elle aime secrètement", "L'œuvre est une satire sans pitié", "L'œuvre refuse toute ironie", "L'œuvre n'a aucun lien avec la satire"],
      why: "A hidden tenderness for the very flaws it mocks." },
    { id: "fr-c2-2", level: "C2", skill: "vocabulary", task: LANGUE, ask: "Fill the gap.",
      stem: "Ce n'est pas la peine de tergiverser : il faut ___ sans plus attendre.", choices: ["trancher", "atermoyer", "louvoyer", "temporiser"],
      why: "Trancher is to decide firmly; the others all mean to stall." },
    { id: "fr-c2-3", level: "C2", skill: "grammar", task: LANGUE, ask: "Fill the gap.",
      stem: "Il eût fallu qu'il ___ plus tôt.", choices: ["partît", "partait", "part", "partirait"],
      why: "Literary sequence of tenses: eût fallu takes the imperfect subjunctive." },
    { id: "fr-c2-4", level: "C2", skill: "vocabulary", task: LANGUE, ask: "Choose the meaning.",
      stem: "« Il ne faut pas vendre la peau de l'ours avant de l'avoir tué » signifie :", choices: ["Il ne faut pas se réjouir d'un succès avant qu'il soit certain", "Il faut respecter les animaux", "Il faut vendre vite ses biens", "Il ne faut pas chasser seul"],
      why: "Don't count your chickens before they hatch." },
    { id: "fr-c2-5", level: "C2", skill: "vocabulary", task: LANGUE, ask: "Fill the gap.",
      stem: "Loin de ___ la polémique, sa déclaration l'a ravivée.", choices: ["désamorcer", "attiser", "raviver", "alimenter"],
      why: "Loin de sets up a contrast: far from defusing it, it revived it." },
  ],
}
