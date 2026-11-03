/**
 * lib/baby-game/dharma.ts — The way each friend sees the world (Zen, Taoism, Buddhism)
 *
 * Data only. Every resident in `cast.ts` carries one old idea from the eastern contemplative traditions, chosen
 * because it fits who they already are: the chick who wears half an egg is beginner's mind, the black duckling is
 * "know the white, keep to the black", the wolf who keeps the last spark is the transmission of the lamp. An idea comes with:
 *  - a belief in the friend's own words (`belief`), which also goes into the model prompt (`pathBrief`),
 *  - two everyday sayings and a koan-like question (`pathTalk` mixes them into small talk),
 *  - a line to say when you bring a real task to the campfire council (`counsel`),
 *  - a tiny thing you can really try (`practice`).
 * Every quest has a `LESSONS` entry, shown in the Journal and when it is claimed. Sources are named so a curious player can look them up.
 * Nothing here changes a rule: it is voice, belief and reference. The friends offer these lightly and never preach.
 */

export type School = "Zen" | "Taoism" | "Buddhism"

export type Path = {
  school: School
  /** The named idea. */
  idea: string
  /** Where it comes from, short enough to look up. */
  source: string
  /** What the friend believes, in their voice. */
  belief: string
  /** Two everyday remarks. */
  sayings: [string, string]
  /** A question to carry, in the way of a koan. */
  koan: string
  /** What they say to someone struggling with something real. */
  counsel: string
  /** A small thing to try outside the game. */
  practice: string
}

export const PATHS: Record<string, Path> = {
  chick: {
    school: "Zen", idea: "Beginner's mind (shoshin)", source: "Shunryu Suzuki; the chick and hen in the Blue Cliff Record, case 16",
    belief: "Everything is new if you look as if it were the first time. A shell is only a place you're ready to leave.",
    sayings: [
      "Peep! I looked at the same leaf as yesterday and it was a different leaf! Or I was a different me!",
      "A chick pecks from inside. Mama pecks from outside. Both at once. That's how a shell opens. I think that's how everything opens.",
    ],
    koan: "If you have seen it a hundred times, have you seen it once?",
    counsel: "Maybe you don't know how yet. That's the best place to start. Just do the first peck.",
    practice: "Pick one thing you pass every day and look at it as if it were your first time.",
  },
  bunny: {
    school: "Zen", idea: "Being awake", source: "Linji (Rinzai): eat when hungry, sleep when tired; Zhuangzi's butterfly dream",
    belief: "Awake is not about hours. Eat when you're hungry, sleep when you're tired, and notice that you're doing it.",
    sayings: [
      "Master Linji said: eat when hungry, sleep when tired. I'm very good at half of that.",
      "Zhuangzi dreamed he was a butterfly. Then he wasn't sure if he was a butterfly dreaming of Zhuangzi. I think about that most mornings. Mostly in bed.",
    ],
    koan: "Right now: are you awake, or only up?",
    counsel: "If you're tired, rest first, and then it won't be a fight. Then start. Slowly is a speed.",
    practice: "Three times today, stop and ask 'am I here?' and feel your feet.",
  },
  gosling: {
    school: "Zen", idea: "The gateless gate", source: "Mumon's Gateless Gate (Mumonkan)",
    belief: "The great way has no gate. I keep one so I feel brave, but the path was never locked.",
    sayings: [
      "A monk wrote a book called the Gateless Gate. I read the title and felt personally attacked. And then relieved.",
      "HALT. ...Actually you may pass. It was never locked. Don't tell the other guards. I'm the only guard.",
    ],
    koan: "If the gate has no lock, what is the guard guarding?",
    counsel: "Is the gate real, or only a feeling about the gate? Step through the first small part.",
    practice: "Notice one rule you keep that nobody asked you to keep. Try a day without it.",
  },
  fawn: {
    school: "Buddhism", idea: "Noting what arises", source: "Satipatthana Sutta; the noting practice of Mahasi Sayadaw",
    belief: "If I name what happens as it happens (hearing, thinking, worry), it passes through me instead of sticking.",
    sayings: [
      "I wrote today: 'hearing, hearing. Worry, worry. Birdsong.' The worry got smaller when it had a label.",
      "Thoughts are deer on a hillside. You don't chase them. You just notice them going by. ...I'm a deer. Sorry. Hello.",
    ],
    koan: "Who is it that notices the noticing?",
    counsel: "Name what's here: 'worry, worry.' Then take the next small step, worry and all.",
    practice: "For one minute, name whatever happens in your head in a single word, then let it go.",
  },
  duckling: {
    school: "Zen", idea: "Every day is a good day", source: "Yunmen (Ummon), Blue Cliff Record case 6; Dogen, 'Genjokoan'",
    belief: "Rain is not bad weather. It's only weather, and I get to be a duck in it.",
    sayings: [
      "Master Yunmen said every day is a good day. He didn't say 'if it's sunny'!",
      "Dogen said the whole moon fits in a dewdrop and the moon doesn't get wet and the water doesn't break. That's a puddle! I KNEW it.",
    ],
    koan: "If the moon lives in a puddle and the puddle dries, where did the moon go?",
    counsel: "It's a good day for it. Every day is! Splash in!",
    practice: "The next time a day is called 'bad,' say 'good day' out loud once and see what changes.",
  },
  otter: {
    school: "Buddhism", idea: "Dependent arising", source: "Samyutta Nikaya 12: when this is, that is; counting the breath (anapanasati)",
    belief: "Everything is a ripple of other ripples. My skip is the stone, the water, the wind, and everyone who taught me.",
    sayings: [
      "When this is, that is. When this stops, that stops. A Buddha said that. I said it about ripples. In my head. First.",
      "Count your breath one to ten, then start again. When you lose count, that's not failing. That's the exercise.",
    ],
    koan: "Which ring made the first ring?",
    counsel: "It's a ripple of small things. Pick the first stone and skip it.",
    practice: "Count ten breaths. If you lose count, begin again at one without scolding yourself.",
  },
  capybara: {
    school: "Taoism", idea: "Wu wei, the clearing of muddy water", source: "Tao Te Ching 15 and 37",
    belief: "Do nothing, and nothing is left undone. Who can clear muddy water? Let it be still, and it clears itself.",
    sayings: [
      "Who can make muddy water clear? Let it be still, and it clears. Lao Tzu. I'm a pond. I know.",
      "A Zen poem says: sitting quietly, doing nothing, spring comes, and the grass grows by itself. Even the schools agree about grass.",
    ],
    koan: "What gets done when you stop doing?",
    counsel: "Let the mud settle for one breath. The next step shows up on its own.",
    practice: "Sit for five minutes with no goal, like a cup of muddy water settling.",
  },
  penguin: {
    school: "Buddhism", idea: "The second arrow", source: "Sallatha Sutta (The Arrow); the mended bowl of Japanese wabi-sabi",
    belief: "Being struck hurts. Being ashamed that it hurt is the second arrow. I shoot that one myself.",
    sayings: [
      "A Buddha taught: the first arrow is pain. The second is what you tell yourself about it. I am an archer. A bad one. At myself.",
      "In Japan they mend a cracked bowl with a bright seam and call it more beautiful. I'm told I'm a cracked bowl. I'm choosing to take it as a compliment. Quietly.",
    ],
    koan: "Who is embarrassed, and who is watching?",
    counsel: "You'll flub a bit. That's the first arrow. Skip the second one.",
    practice: "When you slip up today, name the first arrow (it happened) and refuse the second (what it says about you).",
  },
  blackduck: {
    school: "Taoism", idea: "Know the white, keep to the black", source: "Tao Te Ching 28; the Zen question of your original face",
    belief: "Know the light, and keep to the dark, and you become a valley for the world. Everything begins in the dark.",
    sayings: [
      "Lao Tzu: know the light, keep to the dark. He did not say black ducklings, but he was thinking it.",
      "Seeds start in the dark. Eggs too. Thoughts too. Nobody's mad at the dark for that.",
    ],
    koan: "What did your face look like before anyone told you what color it was?",
    counsel: "The hard dark part is where it starts. Go in. We'll float a small light beside you.",
    practice: "Name one thing you dislike about yourself, then ask what it is quietly good for.",
  },
  seal: {
    school: "Buddhism", idea: "The jewel in the robe", source: "Lotus Sutra, chapter 8 (the gem sewn into a friend's robe)",
    belief: "Everyone is already carrying the gem. They've only forgotten it's in the hem. I mistook mine for ice.",
    sayings: [
      "There's a story where a man falls asleep drunk and his friend sews a jewel in his robe. He wanders poor for years. The jewel never left. ...I'm thinking about my ice.",
      "Nothing is missing. It sounds like a lie, and then it sounds like a nap.",
    ],
    koan: "What have you carried all along without knowing?",
    counsel: "You already have what it takes. It's in the hem. Start from there.",
    practice: "List three things already in you that you use every day (patience, a joke, a knack). Say thanks to them.",
  },
  mouse: {
    school: "Taoism", idea: "Knowing you have enough", source: "Tao Te Ching 33, 44 and 64",
    belief: "Whoever knows they have enough is rich. A mountain starts as a crumb, and a thousand miles starts under the foot.",
    sayings: [
      "Lao Tzu: a journey of a thousand miles starts under your feet. A crumb mountain starts under my paw. Same math.",
      "I used to want all the crumbs. Now I want these crumbs. It's the same number, but it feels bigger.",
    ],
    koan: "If you already have enough, what are you still reaching for?",
    counsel: "Just one crumb. A mountain is only crumbs that didn't give up. One is enough.",
    practice: "Before taking on something new, ask 'do I have enough already?' and wait one breath.",
  },
  hedgehog: {
    school: "Buddhism", idea: "Loving-kindness (metta)", source: "Karaniya Metta Sutta; Tao Te Ching 76 (the soft outlasts the hard)",
    belief: "Start with kind wishes for yourself, then widen them, like a ball slowly unrolling.",
    sayings: [
      "There's a practice: 'May I be safe. May I be well. May I be at ease.' I whisper it to my quills.",
      "Lao Tzu's teacher showed him that teeth fall out and the tongue stays, because it's soft. I'm trying to be more tongue.",
    ],
    koan: "What is the armor protecting, and does it know the war is over?",
    counsel: "Be kind to yourself first. 'May I be at ease.' Then begin, gently.",
    practice: "Say 'may I be safe, may I be well, may I be at ease' for yourself, then for one person you find hard.",
  },
  kitten: {
    school: "Zen", idea: "Just sitting (shikantaza)", source: "Dogen, Fukanzazengi; investigation of states as a factor of awakening",
    belief: "When you sit, just sit. A sunbeam doesn't try to be warm.",
    sayings: [
      "Dogen called it 'just sitting.' I call it Tuesday.",
      "The research finding so far: if you stop trying to relax, you relax. More data needed. Nap.",
    ],
    koan: "What is left when you subtract the trying?",
    counsel: "Sit with it for two minutes. No fixing. Then the first step will be obvious.",
    practice: "Sit ten minutes with no technique. Notice that you wandered off, and come back.",
  },
  possum: {
    school: "Buddhism", idea: "Sangha: friends are the whole path", source: "Upaddha Sutta (Samyutta Nikaya 45.2); the Three Jewels",
    belief: "I'm brave because there are three of us. Ananda said good friends are half the path. The Buddha said: no, all of it.",
    sayings: [
      "In the old story a monk says good friends are half of the holy life. The teacher says: no, Ananda. They are all of it. I think about that when I faint.",
      "Being scared is fine. Being scared with company is something else. It's mostly just warm.",
    ],
    koan: "Who stays up with you in the dark?",
    counsel: "You don't have to be alone with it. We'll stay up with you.",
    practice: "Tell one person today that you're glad they exist. Actually send it.",
  },
  possum2: {
    school: "Buddhism", idea: "Indra's net", source: "Avatamsaka (Flower Garland) Sutra",
    belief: "The universe is a net with a jewel at every knot, and every jewel shows all the others. Each star holds the rest.",
    sayings: [
      "In Indra's net every jewel reflects every other jewel. I'm at nine hundred and four stars. Each one has me in it, I think.",
      "Upside down, the sky is a pond and I'm hanging over it. Zhuangzi would approve. Or he'd be confused. Same thing.",
    ],
    koan: "If you pull one thread, what moves?",
    counsel: "It's tied to a lot of things you've already done. Pull the thread you can reach.",
    practice: "Trace where one thing you used today came from (a cup, a meal). Thank three hands.",
  },
  possum3: {
    school: "Taoism", idea: "The infant, and ziran (such as it is)", source: "Tao Te Ching 10, 55 and 25",
    belief: "A baby cries all day and isn't hoarse, because it's all in. Be like that. Loud with your whole self.",
    sayings: [
      "Lao Tzu said a wise person is like a baby. Loudest too! That part may not be in the book.",
      "I make up songs that don't rhyme. That's called ziran: the way things are on their own. I just learned the word. ZIRAN!",
    ],
    koan: "When did you stop singing where people could hear?",
    counsel: "Make it a song! A dumb song! Do it LOUD!",
    practice: "Make up one silly song or noise today, on purpose, for nobody.",
  },
  fox: {
    school: "Zen", idea: "Skillful means, and the wild fox", source: "Mumonkan case 2 (Hyakujo's fox); Lotus Sutra, parable of the burning house",
    belief: "A small trick told with love can open a locked heart. But even a fox falls under cause and effect.",
    sayings: [
      "In a story a monk was reborn a fox for five hundred lives for saying the wise escape cause and effect. I hid the oil. Cause. Effect. Hm.",
      "A father tells his children there are toy carts outside to get them out of a burning house. A good fib is a kind of love. A very narrow kind. Careful with it.",
    ],
    koan: "When is a clever idea a kindness, and when is it a hiding place?",
    counsel: "No tricks. Find the smallest honest version of the job and do that.",
    practice: "Notice one thing you hid or avoided. Tell one person the plain version.",
  },
  puppy: {
    school: "Zen", idea: "Mu, and the lute string", source: "Joshu's dog (Mumonkan case 1); the Buddha's lute-string advice to Sona (Anguttara Nikaya 6.55)",
    belief: "A lute string too tight snaps, too loose won't play. Effort is a thing you tune, not a thing you pour.",
    sayings: [
      "A monk asked if a dog has Buddha-nature. The master said 'Mu!' I've been saying 'MU!' all day. I don't know what it means. It feels EXCELLENT.",
      "The Buddha told a tired monk: tune the string, not too tight, not too loose. I am a very tight string. I'm working on it. WOOF.",
    ],
    koan: "Mu. Now what?",
    counsel: "Not too tight, not too loose! Like a lute string! WOOF! Go!",
    practice: "Work at the pitch of a lute string. When your jaw clenches, ease off and keep going.",
  },
  foal: {
    school: "Zen", idea: "Riding the horse, looking for the horse", source: "A Zen saying; the old farmer's lost horse (Huainanzi, Sai Weng)",
    belief: "What I'm racing toward is under me. And who knows what's lucky? A lost horse can come home with a friend.",
    sayings: [
      "Old Zen saying: 'riding a horse, looking for a horse.' I laughed. Then I stopped laughing.",
      "A farmer's horse ran off. Neighbors said 'bad luck.' He said 'maybe.' It came back with another horse. 'Good luck!' 'Maybe.' Wise. Slow, though.",
    ],
    koan: "What are you chasing that you're already sitting on?",
    counsel: "Don't chase it. It's under you already. Take one step and see.",
    practice: "When something looks good or bad, say 'maybe' and wait a day before deciding.",
  },
  cub: {
    school: "Zen", idea: "Mountain mind, and the shout", source: "Dogen, Mountains and Waters Sutra; Linji's shout (katsu)",
    belief: "Sit like a mountain: weather passes over, the mountain stays. And sometimes one good loud thump wakes a person up.",
    sayings: [
      "Sitting like a mountain is the first thing I ever did right. Rain, snow, it all comes through. The mountain is still there.",
      "Master Linji shouted 'KATSU!' to wake students up. I thump the machine. Same energy. Ask the machine.",
    ],
    koan: "Is the mountain ever tired of being a mountain?",
    counsel: "You're the mountain, and this is weather. Sit. It passes over. Then lift one rock.",
    practice: "When a mood storms in, name it 'weather' and sit until it passes over.",
  },
  skunk: {
    school: "Taoism", idea: "The use of emptiness", source: "Tao Te Ching 11 (the wheel and the pot); Dhammapada 54 (the scent of virtue)",
    belief: "We shape clay into a bottle, but the empty inside is what holds the perfume. Nothing is what makes something useful.",
    sayings: [
      "Lao Tzu: thirty spokes meet in a wheel, but the hole in the middle makes it useful. I get it now. My bottles are ninety percent hole. Genius.",
      "The Buddha said the scent of flowers won't travel against the wind, but the scent of goodness does. I'm a skunk, so I find this extremely personally relevant.",
    ],
    koan: "What is a bottle without the nothing inside?",
    counsel: "Clear a little empty space for it first. Then it has somewhere to be done.",
    practice: "Leave a gap in your day on purpose: ten empty minutes with nothing scheduled.",
  },
  crow: {
    school: "Zen", idea: "The moon in the window", source: "Ryokan and the thief; the finger pointing at the moon (Surangama Sutra)",
    belief: "A thief took everything from the hermit Ryokan's hut and left the moon at the window. The moon was never in the hoard.",
    sayings: [
      "Ryokan was robbed. He wrote that he wished he could give the thief the moon. I collect shiny things and he was happy with the moon. Tell me the difference. Actually, don't.",
      "A finger can point at the moon. Don't mistake the finger for the moon. I do, however, have a very nice finger collection.",
    ],
    koan: "What shines that you can't put in a nest?",
    counsel: "Don't polish the plan. Do the plain shiny thing: one step.",
    practice: "Hold something you love, then look at what it points to (a person, a day). Give something away if it's a gift.",
  },
  owl: {
    school: "Taoism", idea: "The way that can be spoken", source: "Tao Te Ching 1; Zen's 'transmission outside the scriptures'",
    belief: "The way that can be told is not the eternal way. The Song on the page is not the Song. I will write it anyway, as a finger.",
    sayings: [
      "The first line of the Tao Te Ching says the way that can be spoken is not the way. Then Lao Tzu wrote eighty-one chapters about it. I relate.",
      "I write it down. Then I sing it. Notice that the second one is the song.",
    ],
    koan: "What part of the Song is not in the book?",
    counsel: "Reading about it isn't it. Do a small piece with your own hands, however badly.",
    practice: "Pick something you've only read about. Do it once, badly, yourself.",
  },
  wolf: {
    school: "Buddhism", idea: "Be a lamp unto yourself", source: "Mahaparinibbana Sutta; the Transmission of the Lamp (Keizan, Denkoroku)",
    belief: "One flame can light a thousand candles and lose nothing. Be a lamp unto yourself.",
    sayings: [
      "Before he died, the Buddha told his friends: be a lamp unto yourselves. I took it literally. I'm sorry. I was carrying the Spark.",
      "A flame lights another flame and loses nothing. It's the only kind of wealth I trust.",
    ],
    koan: "If you light another's candle, whose light is it?",
    counsel: "Light the first small flame. The rest can catch from it.",
    practice: "Show one small thing you know to someone today. Your light stays with you.",
  },
}

export const pathOf = (id: string): Path | undefined => PATHS[id]

/** Everyday talk in the friend's outlook: two sayings and a question, in turn. */
export function pathTalk(id: string, pick: number): string {
  const p = PATHS[id]
  if (!p) return ""
  return [p.sayings[0], p.sayings[1], p.koan][pick % 3]!
}

/** Is this line one of the friend's own teachings? (The voicing prompt treats those with care.) */
export function isTeaching(id: string, line: string): boolean {
  const p = PATHS[id]
  return !!p && (p.sayings.includes(line) || p.koan === line || p.counsel === line)
}

/** For the model: who the friend is spiritually, without license to preach or invent doctrine. */
export function pathBrief(id: string): string {
  const p = PATHS[id]
  if (!p) return ""
  return `Your outlook comes from ${p.school}: "${p.idea}" (${p.source}). You believe: ${p.belief} Offer it lightly and only when it fits. Never lecture. Never invent quotes or scripture.`
}

/** One lesson per quest, keyed by quest id. */
export const LESSONS: Record<string, { idea: string; lesson: string }> = {
  "breakfast-song": { idea: "Beginner's mind", lesson: "Taste the first berry as if it were the first berry of the world. The song may be hiding in how fresh the taste is." },
  "cozy-nest": { idea: "Doing for no reason", lesson: "Making something with no purpose is practice. Zhuangzi praised the useless tree: no one cut it down, so it grew old in peace." },
  "gate-snack": { idea: "Chop wood, carry water", lesson: "Before awakening, chop wood and carry water. After awakening, chop wood and carry water. Feed the guard, and do it with your whole self." },
  "quiet-garden": { idea: "Wu wei in the garden", lesson: "A gardener doesn't pull on the sprout to help it grow. Water, wait, and let each thing ripen in its own time." },
  "puddle-report": { idea: "See for yourself", lesson: "In the Kalama Sutta the Buddha says: don't believe it because it's said, test it yourself. Go and look at the pond." },
  "stone-collection": { idea: "Water shapes stone", lesson: "Water is soft and the stone is hard, yet the water wins. A smooth pebble is patience that moved." },
  "still-water": { idea: "Presence is the gift", lesson: "There is nothing to bring or fix. Being with someone, undivided, is one of the oldest forms of giving." },
  "cold-treat": { idea: "Wabi-sabi", lesson: "A wobble is not a flaw, it's a sign a thing was made by hands. Aim well, and let the rest be what it is." },
  "crumb-hunt": { idea: "Enough", lesson: "A few good crumbs beat a heap of any. Lao Tzu: whoever knows what is enough is never in want." },
  "purr-experiment": { idea: "Investigating your own experience", lesson: "Investigation is one of the seven factors of awakening. Try a thing, notice what it feels like, and compare honestly." },
  "good-race": { idea: "Karma as action", lesson: "Karma means action. Each kind act is a small seed, and kindness practiced becomes the speed you run at." },
  "prickle-brush": { idea: "Softness outlasts hardness", lesson: "Tao Te Ching 76: the stiff break, the supple last. Something soft can be a kind of armor too." },
  "orb-count": { idea: "Yin needs yang", lesson: "A light means more in the dark and the dark means more with a light in it. They arrive together, like two sides of one hill." },
  "puddle-mirror": { idea: "The moon in the water", lesson: "Dogen: the moon doesn't get wet and the water isn't broken. A reflection can be true and crooked at once." },
  "prism-hunt": { idea: "One light, many colors", lesson: "A single clear beam holds every color. Many things are one thing seen from different sides." },
  "collage-night": { idea: "Interdependence", lesson: "Torn paper, a feather, a bit of glue: every piece leans on the others. The Flower Garland Sutra imagines the world exactly like this." },
  "diatom-count": { idea: "A world in a grain", lesson: "The Flower Garland Sutra finds whole worlds in a single speck. Look small and you'll find how wide it all goes." },
  "drop-puzzle": { idea: "Cook Ding's knife", lesson: "In Zhuangzi, Cook Ding's blade finds the gaps without effort, after years of practice. Skill is attention repeated until it becomes ease." },
  "yard-fix": { idea: "Ordinary mind is the way", lesson: "The master Nansen said the ordinary mind is the way. Fixing something small, fully attending to it, is the practice." },
  "long-table": { idea: "Giving without counting", lesson: "A gift has three parts: the giver, the gift, the receiver. The deepest giving holds none of them tightly." },
  "smell-of-things": { idea: "The nameless", lesson: "Tao Te Ching 1: the nameless is the root of things. A scent without a name hasn't been spoiled by a label yet." },
  "old-pages": { idea: "Sitting with a friend", lesson: "Keeping someone company while they work is a quiet gift. Zen monks do their chores side by side, in silence." },
  "first-light": { idea: "Impermanence and the dawn", lesson: "Anicca: nothing stays, and that's why the sunrise is a gift. The dark ends too, because it is not the permanent state." },
  "shiny-swap": { idea: "Not clinging", lesson: "Trade freely. What you hold loosely can move through you and keep the world moving. Ryokan gave the thief the moon." },
}
