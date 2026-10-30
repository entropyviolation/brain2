/**
 * lib/bim-flow/default-flow.ts — The starter graph: one lane per room
 *
 * Every lane opens with a yes/no gate, because one narrow question per room
 * tested far better on real BIM text than one prompt asking for everything
 * (the big prompt padded every list and invented blocks for empty hours).
 * Lists, habits, and people are found by the message's words first, so a
 * `choose` node only ever sees a handful of options.
 */

import type { Flow, FlowEdge, FlowNode, FlowPort } from "./types"

const COL = 230
const ROW = 118

function n(id: string, kind: FlowNode["kind"], label: string, col: number, row: number, config: FlowNode["config"] = {}): FlowNode {
  return { id, kind, label, x: 30 + col * COL, y: 30 + row * ROW, config }
}

function e(from: string, to: string, port: FlowPort = "out"): FlowEdge {
  return { id: `${from}>${to}:${port}`, from, to, port }
}

export function defaultFlow(): Flow {
  const nodes: FlowNode[] = [
    n("msg", "message", "Message", 0, 3.5),

    n("g-act", "gate", "Doing something?", 1, 0, {
      question:
        "Does the message say what the person is doing, started, finished, or just did (not plans)? " +
        "Yes: 'starting dishes', 'walking since 4:46', 'garlic done', 'made pasta'. No: 'meal prep plan', 'need macbook bricks'.",
    }),
    n("s-pens", "search", "Activity pens", 2, 0, { source: "pens", scopeId: "activity", all: true }),
    n("c-pen", "choose", "Which pen", 3, 0, { fromNodeId: "s-pens", max: 1, question: "Which activity pen is this message about?" }),
    n("x-time", "extract", "When", 4, 0, {
      question: "How does this message sit in time against that activity?",
      fields: [
        { name: "relation", type: "enum", options: ["starting", "doing_now", "finished", "did_earlier"], hint: "'woke' is finished sleep" },
        { name: "since", type: "clock", hint: "a clock the message names for when it began, like 4:46" },
        { name: "minutes_left", type: "number", hint: "minutes the message says remain" },
      ],
    }),
    n("blocks", "blocks", "Time blocks", 5, 0),

    n("g-habit", "gate", "A habit done?", 1, 1, {
      question: "Does the message show the person did a habit-like thing (exercise, cleaning, water, stretching, going outside, journaling a dream, brushing teeth)? No for plans.",
    }),
    n("s-habit", "search", "Habits by words", 2, 1, { source: "habits", limit: 8 }),
    n("c-habit", "choose", "Which habit", 3, 1, { fromNodeId: "s-habit", max: 2, question: "Which of these habits did the message show being done?" }),
    n("p-habit", "propose", "Mark habit", 4, 1, { action: "habit-done" }),

    n("g-keep", "gate", "Keep on a list?", 1, 2, {
      question:
        "Is it an idea, task, or thing to buy worth keeping on a list? Yes: 'need more macbook bricks', 'prevent mold on wood counter tops', " +
        "'make the bim reply richer'. No: feelings, what they are doing now.",
    }),
    n("s-items", "search", "Related items", 2, 2, { source: "items", limit: 15 }),
    n("c-list", "choose", "Which list", 3, 2, { fromNodeId: "s-items", max: 2, question: "Which of these lists should this message go on?" }),
    n("p-list", "propose", "Add to list", 4, 2, { action: "add-to-list" }),

    n("g-person", "gate", "Names a person?", 1, 3, {
      question: "Does it name a specific person other than the writer? Yes: 'called elijah', 'Alexis'. No: 'someone', 'people'.",
    }),
    n("s-people", "search", "People by name", 2, 3, { source: "people", limit: 8 }),
    n("c-person", "choose", "Which person", 3, 3, { fromNodeId: "s-people", max: 3, question: "Which of these people does the message name?" }),
    n("p-person", "propose", "Mention", 4, 3, { action: "person-mention" }),

    n("g-intake", "gate", "Ate, drank, took?", 1, 4, {
      question: "Did the person eat, drink, or take a substance? Yes: 'took addy', 'made and ate the pasta', 'black coffee'. No: plans to.",
    }),
    n("x-intake", "extract", "What", 2, 4, {
      fields: [
        { name: "what", type: "string", hint: "the food, drink, or substance" },
        { name: "class", type: "enum", options: ["food", "drink", "drug"] },
        { name: "count", type: "number", hint: "how many, when said" },
      ],
    }),
    n("p-intake", "propose", "Intake", 3, 4, { action: "intake" }),

    n("g-mood", "gate", "A feeling?", 1, 5, {
      question: "Does it express how the person feels emotionally? Yes: 'im excitedddd', 'making me happy', 'big anxiety'. No: plain facts.",
    }),
    n("x-mood", "extract", "Mood words", 2, 5, {
      fields: [
        { name: "words", type: "string", hint: "two or three words for the feeling" },
        { name: "valence", type: "enum", options: ["great", "good", "meh", "low"] },
      ],
    }),
    n("p-mood", "propose", "Mood", 3, 5, { action: "mood" }),

    n("g-body", "gate", "Body or symptom?", 1, 6, {
      question: "Does it report a body state or symptom? Yes: 'urinary pain', 'tired', 'hungry'. No: moods about work.",
    }),
    n("p-body", "propose", "Body note", 2, 6, { action: "body" }),

    n("g-dream", "gate", "A dream?", 1, 7, {
      question: "Does it describe a dream from sleep? Yes: 'woke dream involving school'. No: goals ('dream job').",
    }),
    n("p-dream", "propose", "Dream log", 2, 7, { action: "dream" }),
  ]

  const edges: FlowEdge[] = [
    ...["g-act", "g-habit", "g-keep", "g-person", "g-intake", "g-mood", "g-body", "g-dream"].map((g) => e("msg", g)),
    e("g-act", "s-pens", "yes"), e("s-pens", "c-pen"), e("c-pen", "x-time"), e("x-time", "blocks"),
    e("g-habit", "s-habit", "yes"), e("s-habit", "c-habit"), e("c-habit", "p-habit"),
    e("g-keep", "s-items", "yes"), e("s-items", "c-list"), e("c-list", "p-list"),
    e("g-person", "s-people", "yes"), e("s-people", "c-person"), e("c-person", "p-person"),
    e("g-intake", "x-intake", "yes"), e("x-intake", "p-intake"),
    e("g-mood", "x-mood", "yes"), e("x-mood", "p-mood"),
    e("g-body", "p-body", "yes"),
    e("g-dream", "p-dream", "yes"),
  ]
  return { version: 1, nodes, edges }
}
