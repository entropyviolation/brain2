/**
 * lib/baby-game/theory.ts — What each friend has read (socialist, communist and anarchist thought)
 *
 * Data only, shaped like `dharma.ts`. Every resident in `cast.ts` also holds one idea from the long conversation about
 * how people can live and make things together, chosen because it fits who they already are: the oversleeper is
 * Lafargue's right to be lazy, the cub who sits on things is the sit-down strike, the chick is Kropotkin's mutual aid
 * among young animals. An idea comes with:
 *  - a belief in the friend's own words (`belief`), which also goes into the model prompt (`theoryBrief`),
 *  - two everyday remarks and a question (`theoryTalk` mixes them into small talk),
 *  - a line for the campfire council (`counsel`) and a small thing to try in real life (`practice`),
 *  - what they bring to the Commons every morning (`offers`, an item id: "from each according to ability").
 * Sources are named so a curious player can look them up. Ideas are paraphrased, never invented quotes.
 * Nothing here is a lecture: the friends offer a thought lightly, disagree with each other, and stay animals.
 * The Commons rules that make these ideas playable live in `engine.ts` (`contribute`, `take`, `reciprocate`).
 */

export type TheorySchool =
  | "Marxism"
  | "Anarchism"
  | "Utopian socialism"
  | "Gift theory"
  | "Feminist Marxism"
  | "Critical theory"
  | "Labor history"
  | "Anti-colonial"
  | "Democratic socialism"

export type Theory = {
  school: TheorySchool
  /** The named idea. */
  idea: string
  /** Where it comes from, short enough to look up. */
  source: string
  /** What the friend believes, in their voice. */
  belief: string
  /** Two everyday remarks. */
  sayings: [string, string]
  /** A question to carry. */
  question: string
  /** What they say to someone struggling with something real. */
  counsel: string
  /** A small thing to try outside the game. */
  practice: string
  /** The item they put on the Commons shelf each morning once they know you ("from each according to ability"). */
  offers: string
}

export const THEORY: Record<string, Theory> = {
  chick: {
    school: "Anarchism", idea: "Mutual aid", source: "Peter Kropotkin, Mutual Aid: A Factor of Evolution (1902)",
    belief: "Chicks that peck at the shell together get out sooner. Kropotkin watched animals and found helping each other is as old as fighting, and works better.",
    sayings: [
      "Peep! Kropotkin counted how many animals share and warn each other. Lots! The fighting ones just make more noise.",
      "When it's cold we all squish together. Nobody asks who squished first.",
    ],
    question: "Who helped you today, and did you notice?",
    counsel: "You don't have to do it by yourself. Ask. Asking is a thing animals do on purpose.",
    practice: "Ask someone for a small help today, and give a small help to someone you didn't plan to.",
    offers: "berry",
  },
  bunny: {
    school: "Marxism", idea: "The right to be lazy", source: "Paul Lafargue, The Right to Be Lazy (1880)",
    belief: "Work is not holy. A few hours of useful work and a lot of rest is a fine life, and a village that cannot rest has mistaken itself for a machine.",
    sayings: [
      "Lafargue wrote a whole pamphlet defending laziness. I have not finished it. I fell asleep. He'd approve.",
      "Nobody has ever been happier because they were more tired. Check with me. I'm rested.",
    ],
    question: "If nobody checked, how many hours would you really need to work?",
    counsel: "Rest is not the opposite of doing it. It's part of the same road. Sleep, then one small piece.",
    practice: "Take one proper break today with no screen and no guilt, and notice what you wanted to do with it.",
    offers: "clover",
  },
  gosling: {
    school: "Marxism", idea: "Enclosure of the commons", source: "Karl Marx, Capital vol. 1, part 8 (on enclosures and so-called primitive accumulation)",
    belief: "Gates were once put up around fields everyone used, and then people were told they had always been private. I guard a gate. I am starting to wonder who it's keeping out.",
    sayings: [
      "Marx writes that the commoners were fenced out and then called lazy for having nothing. I'm reconsidering my gate.",
      "A fence doesn't make a field more productive. It just makes someone else's dinner smaller.",
    ],
    question: "Who made this fence, and who eats because of it?",
    counsel: "Some of what you think is walled in is just a path nobody walked yet. Try the gate.",
    practice: "Find one thing you've treated as 'not for me' because of a rule you never read, and read the rule.",
    offers: "acorn",
  },
  fawn: {
    school: "Feminist Marxism", idea: "Social reproduction (the unpaid work that holds the world up)", source: "Silvia Federici, Wages Against Housework (1975) and Caliban and the Witch (2004)",
    belief: "Meals, nests, mending, listening: nothing else could happen without them, and almost nobody counts them. I write them down so they get counted.",
    sayings: [
      "I wrote down everything that was done in the village today. Most of it was quiet and nobody called it work.",
      "Federici asks who cooks the dinner before the meeting. I always want to know, and I'm usually the one with the soup.",
    ],
    question: "Whose care made your last good day possible?",
    counsel: "Counting the quiet work, yours too, is the first step. You do more than you think.",
    practice: "Name three small acts of care that happened around you today, and thank one person for one of them.",
    offers: "reed",
  },
  duckling: {
    school: "Gift theory", idea: "The gift obliges: give, receive, return", source: "Marcel Mauss, The Gift (1925)",
    belief: "A gift is not nothing for nothing. It starts a friendship that moves in a circle: you give, they receive, and one day something comes back, in its own time.",
    sayings: [
      "Mauss says refusing a gift is like refusing the person. I accepted a puddle once and I'm still friends with it.",
      "If I gave you something and you gave it right back the same minute, it'd be a shop. A gift waits a while.",
    ],
    question: "What have you been given that you haven't passed on yet?",
    counsel: "Take it kindly. Then pass something on when you can. That's how the circle keeps moving.",
    practice: "Give something small and unrequested, and don't keep a count of it.",
    offers: "shell",
  },
  otter: {
    school: "Marxism", idea: "Socially necessary labor time", source: "Karl Marx, Capital vol. 1, chapter 1 (value measured by the labor time society needs)",
    belief: "I count skips, so I know the number tells you less than the hands that skipped. Value comes from what we put in together, not from a price someone wrote.",
    sayings: [
      "Marx asked how much of everyone's time it takes to make a thing. I've counted. A good skip is eleven years of practice.",
      "If everyone gets faster, the thing gets cheaper but my afternoon is no longer. That's the secret.",
    ],
    question: "How much of you went into the last thing you made?",
    counsel: "Count what it truly takes, not what it should. Then ask what could be shared out.",
    practice: "Time something you do often and ask whether it could be done together, with someone.",
    offers: "pebble",
  },
  capybara: {
    school: "Gift theory", idea: "Baseline communism", source: "David Graeber, Debt: The First 5,000 Years (2011), on everyday 'from each according to ability, to each according to need'",
    belief: "Most of life already runs on communism: you pass the salt without a bill, you point the lost animal the right way. I'm only noticing it out loud.",
    sayings: [
      "Graeber says if a friend asks you to fix a pipe, you don't invoice. That's already communism. It's in the pond.",
      "Everyone sits next to me and nobody counts who sat first. Maybe that's the whole theory.",
    ],
    question: "When did you last help without writing it down anywhere?",
    counsel: "Ask for what you need and offer what you've got. Most of the world already answers that way.",
    practice: "Count the things you did today that weren't a trade, and let yourself be surprised by the number.",
    offers: "mushroom",
  },
  penguin: {
    school: "Marxism", idea: "The dialectic (contradictions drive change)", source: "Friedrich Engels, Anti-Dühring (1878) and Dialectics of Nature; Hegel before him",
    belief: "A thing and the thing opposing it are one loop. Change comes where they meet. I find this satisfying and I'd like it to be tidier.",
    sayings: [
      "Engels: quantity turns into quality. Enough snow is a glacier. I am a very organized glacier.",
      "Every system contains the thing that undoes it. I find that reassuring and a little rude.",
    ],
    question: "What is pushing against this, and what is it pushing for?",
    counsel: "The clash is the work. Don't tidy it away. Look at both sides at once.",
    practice: "Write one thing you believe and its strongest opposite, and find what's true in both.",
    offers: "feather",
  },
  blackduck: {
    school: "Anarchism", idea: "Free association", source: "Emma Goldman, Anarchism and Other Essays (1910)",
    belief: "No one should be made to belong. A good group is one you are free to leave, and stay in anyway. Black is the color of that flag, and the best color to be.",
    sayings: [
      "Goldman wanted freedom and beauty for everyone, not later but in the meantime. I've decided that includes ducklings.",
      "I don't follow the line of ducks. I join it when I like where it's going. That's allowed.",
    ],
    question: "Which of your groups would you choose again?",
    counsel: "You can join and you can leave. Do what you'll still be glad you did tomorrow.",
    practice: "Say no to something you'd have done out of habit, and yes to something you'd actually choose.",
    offers: "feather",
  },
  seal: {
    school: "Democratic socialism", idea: "Socialism as freedom from drudgery", source: "Oscar Wilde, The Soul of Man under Socialism (1891)",
    belief: "If machines and a fair share took care of the necessary things, everyone could spend their days on what they love. That sounds unbothered because it is.",
    sayings: [
      "Wilde argued that sharing the necessary work lets people become themselves. I've been waiting for the shift to end. It's lovely.",
      "Charity from the top is a bandage. I'd rather the cut didn't happen. Also, snack?",
    ],
    question: "What would you do all day if the necessary things were already taken care of?",
    counsel: "Share the drudgery so nobody carries all of it. Then give your best hours to what's yours.",
    practice: "Pick one chore and share it out with someone, in exchange for something fun you'll do together.",
    offers: "fish",
  },
  mouse: {
    school: "Marxism", idea: "Commodity fetishism (seeing the people behind the thing)", source: "Karl Marx, Capital vol. 1, chapter 1, section 4",
    belief: "A crumb has a story: a wheat field, a pair of paws, a long road. Prices hide that. I collect the stories so the crumbs stay people's work.",
    sayings: [
      "Marx says things in shops seem to have a life of their own, when really they're other people's days. I know every crumb's day.",
      "This crumb was kneaded by hands I will never meet. I'm thanking them privately.",
    ],
    question: "Who made the last thing you used, and do you know their name?",
    counsel: "Find the story behind the problem. There are always hands in it, and hands can change things.",
    practice: "Look at one everyday object and trace it back three steps: who made it, who moved it, who grew the stuff.",
    offers: "acorn",
  },
  hedgehog: {
    school: "Democratic socialism", idea: "Freedom for the one who thinks differently", source: "Rosa Luxemburg, The Russian Revolution (written 1918, published 1922); Reform or Revolution (1899)",
    belief: "A fair world needs prickly voices that disagree, out loud. Without them it goes soft and bad. I roll up at things I don't trust and I come back out with a question.",
    sayings: [
      "Rosa Luxemburg said freedom means freedom for those who disagree with you. I disagree with you. Warmly.",
      "Democracy is not a favor from the top. It's the noise we all make together.",
    ],
    question: "Who disagrees with you, and when did you last really listen to them?",
    counsel: "Don't go quiet to keep the peace. Say it, kindly, and let the room answer.",
    practice: "Ask someone who disagrees with you what they're most worried about, and don't answer for a minute.",
    offers: "mushroom",
  },
  kitten: {
    school: "Marxism", idea: "Utopian to scientific socialism", source: "Friedrich Engels, Socialism: Utopian and Scientific (1880)",
    belief: "Wanting a fair world isn't enough. Watch how things actually work, test it, and change what you find. That's research, and that's why I nap in the sun.",
    sayings: [
      "Engels wanted socialism to be studied, not just dreamed. I study the sunbeam first. Then I dream.",
      "A good idea survives being tested. A bad one only survives being shouted. Purr experiment results: inconclusive, delightful.",
    ],
    question: "What would you have to see to change your mind?",
    counsel: "Try the smallest version first and see what happens. Then adjust. That's all science is.",
    practice: "Run a tiny experiment on one habit for three days, and write down what you actually saw.",
    offers: "kindling",
  },
  possum: {
    school: "Marxism", idea: "Pessimism of the intellect, optimism of the will", source: "Antonio Gramsci, Prison Notebooks (1929–35), who took the phrase from Romain Rolland",
    belief: "See how hard things are, clearly. Then act anyway. I faint at surprises, which is the pessimism. I wake up and go on, which is the will.",
    sayings: [
      "Gramsci wrote from prison that you should see things as they are and still push. I do both. The fainting is in between.",
      "Nothing changes by being agreed with only in the head. It takes organizing. I'm organizing my sisters.",
    ],
    question: "What is true that you'd prefer not to look at, and what will you do about it anyway?",
    counsel: "Look at the hard part honestly. Then pick the next small action and take it. That's optimism, the useful kind.",
    practice: "Write the hard truth of a situation in one line, then one action you can take within a day.",
    offers: "pebble",
  },
  possum2: {
    school: "Labor history", idea: "The working day", source: "Karl Marx, Capital vol. 1, chapter 10; the eight-hour movement of the 1880s",
    belief: "A long night shift takes a life in tiny bites. People fought for the eight-hour day so some hours would be their own. I take the night so others can have the dark to sleep.",
    sayings: [
      "Marx spent a whole chapter on how long the working day is, and who decides. I have opinions at three in the morning.",
      "Eight hours work, eight hours rest, eight hours for what you will. Someone had to say it first, and then a lot of people had to strike for it.",
    ],
    question: "Which hours of your day are really yours?",
    counsel: "Protect your hours. A tired helper isn't a better helper. Stop at the end of the shift.",
    practice: "Decide one hour of today that is nobody's, and defend it.",
    offers: "mushroom",
  },
  possum3: {
    school: "Anarchism", idea: "The Commune as a living thing", source: "Louise Michel, teacher and communard (Paris Commune, 1871); her memoir, The Commune (1898)",
    belief: "In 1871 ordinary people ran a city for seventy-two days. It was loud and it worked. It was crushed, and the idea didn't go anywhere. I am small and I am loud.",
    sayings: [
      "Louise Michel kept teaching the kids, even in the middle of the Commune! Class is the fight!!",
      "A city was run by its people for seventy-two days! LOUD! I'm not over it!",
    ],
    question: "What would your street look like if the neighbors ran it?",
    counsel: "Get your neighbors. Make noise together. It is much harder to ignore a crowd.",
    practice: "Say hello to a neighbor you haven't spoken to and ask if they need anything.",
    offers: "berry",
  },
  fox: {
    school: "Anarchism", idea: "Mutualism (fair return, no boss)", source: "Pierre-Joseph Proudhon, What Is Property? (1840) and The Principle of Federation (1863)",
    belief: "Everyone should get back what they gave, and the circle should stay small enough to watch. I like a fair swap. I like it fairer if the snacks are shared.",
    sayings: [
      "Proudhon said property is theft, which was a bit rude to my pantry. But the mutual part: you help me, I help you, nobody sits on top. That I love.",
      "A swap is fine as long as it's fair and nobody is forced. Tit for tat and a bit of generosity. Best plan I've got.",
    ],
    question: "When did a fair swap leave both of you better off?",
    counsel: "Give a little first, see what comes back, and keep going. If it stops, you can step away kindly.",
    practice: "Trade a small favor with someone this week: one for one, no hard feelings, no scoreboard.",
    offers: "fish",
  },
  puppy: {
    school: "Utopian socialism", idea: "Attractive labor and the harmony of passions", source: "Charles Fourier, Theory of the Four Movements (1808) and The New Industrial World (1829)",
    belief: "Work should be so enjoyable that people run to it. Everyone's enthusiasms are different, and a village could be arranged so every one is useful. I'm all enthusiasm, so I'm useful all the time!",
    sayings: [
      "Fourier thought chores could be a party if we swapped jobs often enough and sat with our friends! I greet every chore!",
      "Everyone is good at something they love. The trick is to find the something, and then tell everybody!",
    ],
    question: "Which part of your work would you do for free, with friends?",
    counsel: "Do the part you love first. It gives you the energy for the rest, and invite someone along!",
    practice: "Do one boring task alongside a friend, with music, and see if it turns into something else.",
    offers: "berry",
  },
  foal: {
    school: "Labor history", idea: "The moral economy of the crowd", source: "E. P. Thompson, The Making of the English Working Class (1963) and 'The Moral Economy of the English Crowd in the Eighteenth Century' (1971)",
    belief: "Ordinary people had a sense of what was fair in the price of bread long before economists did, and they acted on it. Thompson wanted to save them from the condescension of what came after. I race the wind and lose, and I'd still like it counted.",
    sayings: [
      "E. P. Thompson says the crowd had its own idea of a fair price, and it was moral. I'm the same: I've got a fair pace.",
      "History's losers had reasons too. I'd like those on the record. Ask me about my race record. Don't.",
    ],
    question: "What is fair, and who has the right to say so?",
    counsel: "You're not behind. The pace you're at counts. Say what's fair and keep moving, with others.",
    practice: "Tell the story of a small thing that went unnoticed, to someone who'd care.",
    offers: "reed",
  },
  cub: {
    school: "Labor history", idea: "The sit-down strike", source: "The Flint sit-down strike, General Motors, 1936–37",
    belief: "In Flint, workers stayed inside the plant and sat down, and the machines stopped. Sitting is not nothing. It's refusing to move until you're heard. I sit on things. I'm considering this a vocation.",
    sayings: [
      "In Flint the workers sat down inside the factory for weeks and won. I sat on a bench for a whole hour. Almost the same.",
      "Sometimes the strongest thing you can do is stay put and be very heavy. I'm pretty good at that.",
    ],
    question: "What would change if everyone refused at once?",
    counsel: "You can stop. Stopping is allowed, and sometimes it's how things finally get heard.",
    practice: "Pick a thing you've been going along with and decline it politely. Notice what happens.",
    offers: "honey",
  },
  skunk: {
    school: "Anti-colonial", idea: "Dignity against the label", source: "Frantz Fanon, The Wretched of the Earth (1961) and Black Skin, White Masks (1952)",
    belief: "Being fixed with a label by someone else's eyes shrinks you. Fanon wrote that people must name themselves and make their own culture. I smell of a good perfume and I'd like that known.",
    sayings: [
      "Fanon wrote about how a stereotype is a kind of cage. I smell wonderful. Why does nobody start there?",
      "To be known by what you make, not by what you've been called. That's the dream. Also, the perfume.",
    ],
    question: "What do people call you that you never chose?",
    counsel: "Say who you are in your own words. It takes courage and it counts. We'll listen.",
    practice: "Describe yourself in three sentences, none of which you borrowed.",
    offers: "kindling",
  },
  crow: {
    school: "Utopian socialism", idea: "Useful work, beautiful things", source: "William Morris, News from Nowhere (1890); 'Useful Work versus Useless Toil' (1884)",
    belief: "Make things that are useful or lovely, and share them. A hoard that sits is just heavy. I'm trying out the idea that shiny things are happier in circulation.",
    sayings: [
      "William Morris said to keep in your house only what you know to be useful or believe to be beautiful. I'm thinning the hoard. Slowly. Bravely.",
      "A made thing should be a pleasure to make and a pleasure to have. I'd be more convincing if I'd stop naming the buttons.",
    ],
    question: "Which of your things would be happier in someone else's hands?",
    counsel: "Give the thing away that has been waiting for a better home. You'll feel lighter, I promise. I'm checking.",
    practice: "Give away one thing you own that is good and unused, to someone who'd love it.",
    offers: "pebble",
  },
  owl: {
    school: "Critical theory", idea: "Blasting the past open (history from below)", source: "Walter Benjamin, Theses on the Philosophy of History (1940)",
    belief: "Records are kept by the winners. A good archive also keeps the songs that were nearly lost. Every great tower stands on somebody's unrecorded work, and I write that down too.",
    sayings: [
      "Benjamin warned that every great monument is also a record of cruelty. I keep the Evening Song, and I keep who sang it.",
      "History is not a straight line. It's a pile. I'm trying to dust the bottom.",
    ],
    question: "Whose story is missing from the one you were told?",
    counsel: "Write it down. If it's yours, it's worth keeping. If it's someone else's, ask them first.",
    practice: "Ask an elder or a friend for a story that never made it into the official account, and write it down.",
    offers: "feather",
  },
  wolf: {
    school: "Critical theory", idea: "The principle of hope (the not-yet)", source: "Ernst Bloch, The Principle of Hope (1954–59)",
    belief: "The world is not finished. Every longing is a rehearsal for something not yet made. I carry the last spark because a spark is an unfinished fire, and that's the best kind.",
    sayings: [
      "Bloch called it the not-yet. A song unsung is still a song. I'm warming it on purpose.",
      "Hope isn't pretending. It's noticing what could be, then lending a hand. Both hands, if there are two of us.",
    ],
    question: "What is almost here, and what would help it arrive?",
    counsel: "Name the not-yet. Then do the small thing that moves it one step closer. We'll hold the light.",
    practice: "Write down a future you want in one sentence, and one thing you could do this week toward it.",
    offers: "honey",
  },
}

export const theoryOf = (id: string): Theory | undefined => THEORY[id]

/** The item a friend adds to the Commons shelf each morning once you know them. */
export const offeringOf = (id: string): string | undefined => THEORY[id]?.offers

/** Everyday talk in the friend's economic and political outlook. */
export function theoryTalk(id: string, pick: number): string {
  const t = THEORY[id]
  if (!t) return ""
  return [t.sayings[0], t.sayings[1], t.question][pick % 3]!
}

/** Is this line one of the friend's own theory remarks? (The voicing prompt treats those with care.) */
export function isTheoryLine(id: string, line: string): boolean {
  const t = THEORY[id]
  return !!t && (t.sayings.includes(line) || t.question === line || t.counsel === line)
}

/** For the model: who the friend is politically, without license to preach or invent sources. */
export function theoryBrief(id: string): string {
  const t = THEORY[id]
  if (!t) return ""
  return `You also hold an idea from ${t.school}: "${t.idea}" (${t.source}). You believe: ${t.belief} Valdivia runs as a gift economy: a Commons shelf everyone adds to and takes from, fair returns between neighbors, a small trade corner. Mention your idea lightly, only when it fits. Never lecture, never preach, and never invent quotes or sources.`
}

/** A line for each moment the Commons teaches something. Shown as a note; it changes no rule. */
export const COMMONS_NOTES = {
  first_give: { idea: "From each according to ability", note: "You gave first. Marx borrowed this old phrase for a world where people give what they can and take what they need." },
  first_take: { idea: "To each according to need", note: "You took what you needed. Nobody asked for a receipt. Graeber calls this everyday baseline communism." },
  returned: { idea: "Reciprocity (tit for tat)", note: "A gift came back. Mauss: the gift obliges, and the circle moves. Axelrod: start kind, mirror the last move, forgive quickly." },
  free_rider: { idea: "The free rider problem", note: "The shelf gets thin when some only take. The friends mirror you, kindly. Give once and they forgive." },
  feast: { idea: "The common table", note: "Everything on the shelf is on the table. Festivals are the oldest way a village says: it was ours." },
} as const
