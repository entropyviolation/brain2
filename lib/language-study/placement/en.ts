/**
 * lib/language-study/placement/en.ts — English placement bank (Cambridge English format)
 *
 * Original items in the shape of Cambridge English tasks: Reading,
 * Listening, and Use of English cloze gaps. Cambridge has no A1 paper, so the
 * A1 stage is a plain starter check. Five per level; a run draws four. The
 * right option is first. A native speaker does not take this quiz.
 */

import type { PlacementBank } from "@/lib/language-study/placement/types"

const READING = "Reading"
const LISTENING = "Listening"
const USE = "Use of English"

export const EN_PLACEMENT: PlacementBank = {
  lang: "en",
  questions: [
    // A1
    { id: "en-a1-1", level: "A1", skill: "listening", task: LISTENING, ask: "Listen, then answer.",
      passage: "Hi, I'm Sam. I live in a small flat with my cat. I work in a bookshop.",
      stem: "Where does Sam work?", choices: ["In a bookshop", "In a flat", "In a café", "In a school"],
      why: "“I work in a bookshop.”" },
    { id: "en-a1-2", level: "A1", skill: "reading", task: READING, ask: "Read the sign, then answer.",
      passage: "SWIMMING POOL — Open every day, 7 am to 9 pm. Children under 8 must swim with an adult.",
      stem: "Who must swim with an adult?", choices: ["Children under eight", "All children", "Adults over eighty", "Nobody"],
      why: "“Children under 8 must swim with an adult.”" },
    { id: "en-a1-3", level: "A1", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "She ___ two brothers.", choices: ["has", "have", "is", "are"],
      why: "Third person singular of have: has." },
    { id: "en-a1-4", level: "A1", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "There ___ three apples on the table.", choices: ["are", "is", "be", "am"],
      why: "A plural subject after there: there are." },
    { id: "en-a1-5", level: "A1", skill: "vocabulary", task: USE, ask: "Fill the gap.",
      stem: "I'm cold. Can you close the ___?", choices: ["window", "floor", "chair", "plate"],
      why: "You close a window against the cold." },

    // A2 · A2 Key
    { id: "en-a2-1", level: "A2", skill: "listening", task: LISTENING, ask: "Listen to the announcement, then answer.",
      passage: "The museum café is closed today, but you can buy drinks from the machine on the first floor.",
      stem: "Where can you get a drink today?", choices: ["From a machine on the first floor", "At the museum café", "Outside the museum", "Nowhere"],
      why: "“buy drinks from the machine on the first floor.”" },
    { id: "en-a2-2", level: "A2", skill: "reading", task: READING, ask: "Read the message, then answer.",
      passage: "Hi Mia, I can't meet you at the station at six. My bus is late. Let's meet at the cinema at half past six instead. Ben",
      stem: "Where will they meet?", choices: ["At the cinema", "At the station", "On the bus", "At Ben's house"],
      why: "“Let's meet at the cinema … instead.”" },
    { id: "en-a2-3", level: "A2", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "I ___ to London last summer.", choices: ["went", "go", "have gone", "going"],
      why: "Last summer is finished time: past simple." },
    { id: "en-a2-4", level: "A2", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "This is ___ book I've ever read.", choices: ["the best", "the better", "best", "better"],
      why: "Ever read sets up a superlative: the best." },
    { id: "en-a2-5", level: "A2", skill: "vocabulary", task: USE, ask: "Fill the gap.",
      stem: "I need to ___ some money from the bank.", choices: ["take out", "take off", "take up", "take after"],
      why: "Take out money — withdraw it." },

    // B1 · B1 Preliminary
    { id: "en-b1-1", level: "B1", skill: "listening", task: LISTENING, ask: "Listen, then answer.",
      passage: "Thanks for calling the leisure centre. Please note that from next week, the yoga class on Tuesday will move to Thursday evening at the same time.",
      stem: "What is changing?", choices: ["The day of the yoga class", "The time of the yoga class", "The yoga teacher", "The price"],
      why: "Tuesday moves to Thursday, “at the same time.”" },
    { id: "en-b1-2", level: "B1", skill: "reading", task: READING, ask: "Read, then answer.",
      passage: "Many people think that keeping a diary is old-fashioned. However, psychologists say that writing down your thoughts for ten minutes a day can reduce stress and help you sleep better.",
      stem: "According to psychologists, writing a diary can…", choices: ["help you sleep better", "make you old-fashioned", "take too much time", "cause stress"],
      why: "“can reduce stress and help you sleep better.”" },
    { id: "en-b1-3", level: "B1", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "If it rains tomorrow, we ___ at home.", choices: ["will stay", "would stay", "stayed", "stay will"],
      why: "First conditional: if + present, will + verb." },
    { id: "en-b1-4", level: "B1", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "I've lived here ___ 2015.", choices: ["since", "for", "from", "during"],
      why: "A point in time with the present perfect: since." },
    { id: "en-b1-5", level: "B1", skill: "vocabulary", task: USE, ask: "Fill the gap.",
      stem: "Could you ___ me a favour and post this letter?", choices: ["do", "make", "give", "take"],
      why: "The collocation is do someone a favour." },

    // B2 · B2 First
    { id: "en-b2-1", level: "B2", skill: "reading", task: READING, ask: "Read, then answer.",
      passage: "While electric cars produce no exhaust fumes, critics point out that the electricity they use is not always generated cleanly, so their overall environmental benefit depends on where you live.",
      stem: "What do the critics say?", choices: ["The benefit depends on how the electricity is made", "Electric cars produce exhaust fumes", "Electric cars are always clean", "Electric cars are too expensive"],
      why: "Not always generated cleanly, so it depends where you live." },
    { id: "en-b2-2", level: "B2", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "I wish I ___ more attention in class last year.", choices: ["had paid", "paid", "have paid", "would pay"],
      why: "A wish about the past takes the past perfect." },
    { id: "en-b2-3", level: "B2", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "By the time we arrived, the film ___.", choices: ["had already started", "already started", "has already started", "was already start"],
      why: "Earlier than another past event: past perfect." },
    { id: "en-b2-4", level: "B2", skill: "vocabulary", task: USE, ask: "Fill the gap.",
      stem: "She has a real ___ for languages; she picked up Italian in six months.", choices: ["flair", "flare", "flavour", "fluency"],
      why: "A flair for something is a natural talent." },
    { id: "en-b2-5", level: "B2", skill: "listening", task: LISTENING, ask: "Listen, then answer.",
      passage: "What surprised me about the new office wasn't the size, but how quiet it was, even with forty people working there.",
      stem: "What surprised the speaker?", choices: ["How quiet the office was", "How big the office was", "How many people worked there", "How new the office was"],
      why: "“wasn't the size, but how quiet it was.”" },

    // C1 · C1 Advanced
    { id: "en-c1-1", level: "C1", skill: "reading", task: READING, ask: "Read, then answer.",
      passage: "The author does not dispute that standardised tests are efficient; rather, she argues that their efficiency comes at the cost of rewarding memorisation over genuine understanding.",
      stem: "What is the author's main criticism?", choices: ["Tests reward memorising more than understanding", "Tests are inefficient", "Tests are too expensive", "Tests are too hard"],
      why: "“rewarding memorisation over genuine understanding.”" },
    { id: "en-c1-2", level: "C1", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "Not only ___ late, but he also forgot the tickets.", choices: ["was he", "he was", "he is", "did he"],
      why: "Not only at the front inverts subject and verb." },
    { id: "en-c1-3", level: "C1", skill: "vocabulary", task: USE, ask: "Fill the gap.",
      stem: "The evidence was so ___ that the jury reached a verdict in an hour.", choices: ["compelling", "compulsive", "complacent", "compliant"],
      why: "Compelling evidence is convincing." },
    { id: "en-c1-4", level: "C1", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "___ the bad weather, the event went ahead as planned.", choices: ["Notwithstanding", "Despite of", "Although", "However"],
      why: "Notwithstanding takes a noun phrase; despite never takes of." },
    { id: "en-c1-5", level: "C1", skill: "listening", task: LISTENING, ask: "Listen, then answer.",
      passage: "I'd be wary of reading too much into one quarter's figures; a single good result hardly amounts to a recovery.",
      stem: "What does the speaker mean?", choices: ["One good result does not prove a recovery", "The economy has recovered", "The figures are wrong", "The results were bad"],
      why: "“hardly amounts to a recovery.”" },

    // C2 · C2 Proficiency
    { id: "en-c2-1", level: "C2", skill: "reading", task: READING, ask: "Read, then answer.",
      passage: "Far from being a mere period piece, the novel uses its Victorian setting to hold up an unflattering mirror to our own preoccupations.",
      stem: "What does the writer suggest about the novel?", choices: ["It comments on the present through the past", "It is only about the Victorian era", "It flatters modern readers", "It has no relevance today"],
      why: "A mirror to our own preoccupations." },
    { id: "en-c2-2", level: "C2", skill: "vocabulary", task: USE, ask: "Choose the meaning.",
      stem: "To “damn with faint praise” means to…", choices: ["criticise by praising only weakly", "praise someone loudly", "curse someone quietly", "refuse to praise at all"],
      why: "Lukewarm praise that implies criticism." },
    { id: "en-c2-3", level: "C2", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "Little ___ that the decision would cost him his career.", choices: ["did he know", "he knew", "knew he", "he did know"],
      why: "Little at the front inverts with do-support." },
    { id: "en-c2-4", level: "C2", skill: "vocabulary", task: USE, ask: "Fill the gap.",
      stem: "His ___ manner put everyone at ease, despite the gravity of the situation.", choices: ["affable", "abrasive", "aloof", "acerbic"],
      why: "Affable — friendly, easy to talk to." },
    { id: "en-c2-5", level: "C2", skill: "grammar", task: USE, ask: "Fill the gap.",
      stem: "Were the plan ___ fail, we would have no fallback.", choices: ["to", "for", "that", "it"],
      why: "Inverted conditional: were + subject + to-infinitive." },
  ],
}
