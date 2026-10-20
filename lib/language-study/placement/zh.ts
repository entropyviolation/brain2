/**
 * lib/language-study/placement/zh.ts — Mandarin placement bank (HSK format)
 *
 * Original items in the shape of HSK tasks: 听力 (listening), 阅读
 * (reading), and 选词填空 (choose the word for the gap). Levels follow
 * `LANGUAGE_EXAMS.zh`: HSK 1–2 → A1, 3 → A2, 4 → B1, 5 → B2, 6 → C1,
 * 7–9 → C2. Five per level; a run draws four. The right option is first.
 */

import type { PlacementBank } from "@/lib/language-study/placement/types"

const TINGLI = "听力"
const YUEDU = "阅读"
const TIANKONG = "选词填空"

export const ZH_PLACEMENT: PlacementBank = {
  lang: "zh",
  questions: [
    // A1 · HSK 1–2
    { id: "zh-a1-1", level: "A1", skill: "listening", task: TINGLI, ask: "Listen, then answer.",
      passage: "你好，我叫王明。我是老师，我在北京工作。",
      stem: "王明做什么工作？", choices: ["老师", "医生", "学生", "司机"],
      why: "“我是老师” — I'm a teacher." },
    { id: "zh-a1-2", level: "A1", skill: "reading", task: YUEDU, ask: "Read the sign, then answer.",
      passage: "超市营业时间：上午八点到晚上十点。",
      stem: "超市几点关门？", choices: ["晚上十点", "上午八点", "晚上八点", "上午十点"],
      why: "Open “到晚上十点” — until 10 p.m." },
    { id: "zh-a1-3", level: "A1", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "我 ___ 中国人。", choices: ["是", "有", "在", "叫"],
      why: "是 links a person to what they are." },
    { id: "zh-a1-4", level: "A1", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "这本书是 ___ 的？", choices: ["谁", "哪儿", "几", "多少"],
      why: "谁的 — whose." },
    { id: "zh-a1-5", level: "A1", skill: "vocabulary", task: TIANKONG, ask: "Fill the gap.",
      stem: "我饿了，我想 ___ 饭。", choices: ["吃", "喝", "看", "听"],
      why: "饿 is hungry; you 吃饭, eat." },

    // A2 · HSK 3
    { id: "zh-a2-1", level: "A2", skill: "listening", task: TINGLI, ask: "Listen to the announcement, then answer.",
      passage: "各位乘客，开往上海的火车晚点三十分钟，请大家耐心等待。",
      stem: "火车怎么了？", choices: ["晚点了", "取消了", "提前了", "换站台了"],
      why: "“晚点三十分钟” — thirty minutes late." },
    { id: "zh-a2-2", level: "A2", skill: "reading", task: YUEDU, ask: "Read, then answer.",
      passage: "小李：明天下午我们去看电影吧！不过我上午要上课，十二点以后才有空。",
      stem: "小李明天什么时候有空？", choices: ["中午十二点以后", "上午", "一整天", "晚上才有空"],
      why: "“十二点以后才有空”." },
    { id: "zh-a2-3", level: "A2", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "他跑 ___ 很快。", choices: ["得", "的", "地", "了"],
      why: "Verb + 得 + how it is done." },
    { id: "zh-a2-4", level: "A2", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "我比他 ___ 两岁。", choices: ["大", "多", "高", "胖"],
      why: "Age comparisons use 大: two years older." },
    { id: "zh-a2-5", level: "A2", skill: "vocabulary", task: TIANKONG, ask: "Fill the gap.",
      stem: "外面在下雨，别忘了带 ___。", choices: ["雨伞", "筷子", "护照", "钥匙链"],
      why: "Rain: take an umbrella." },

    // B1 · HSK 4
    { id: "zh-b1-1", level: "B1", skill: "listening", task: TINGLI, ask: "Listen to the call, then answer.",
      passage: "喂，您好！您订的书已经到了，不过我们这周末不营业，请您下周一再来取。",
      stem: "顾客什么时候可以取书？", choices: ["下周一", "这周末", "今天", "明天"],
      why: "“请您下周一再来取”." },
    { id: "zh-b1-2", level: "B1", skill: "reading", task: YUEDU, ask: "Read, then answer.",
      passage: "越来越多的年轻人选择骑共享单车上班。这不仅能节约时间，还能锻炼身体，而且对环境也有好处。",
      stem: "下面哪个不是文中提到的好处？", choices: ["省钱", "节约时间", "锻炼身体", "保护环境"],
      why: "Saving money is the one benefit the text never mentions." },
    { id: "zh-b1-3", level: "B1", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "即使明天下雨，比赛 ___ 会照常进行。", choices: ["也", "就", "才", "却"],
      why: "即使……也 — even if… still." },
    { id: "zh-b1-4", level: "B1", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "这件事 ___ 我来说很重要。", choices: ["对", "给", "向", "跟"],
      why: "对……来说 — as far as I'm concerned." },
    { id: "zh-b1-5", level: "B1", skill: "vocabulary", task: TIANKONG, ask: "Fill the gap.",
      stem: "他工作很努力，所以老板决定给他 ___ 工资。", choices: ["增加", "增长", "进步", "发展"],
      why: "增加工资 — to raise pay." },

    // B2 · HSK 5
    { id: "zh-b2-1", level: "B2", skill: "reading", task: YUEDU, ask: "Read, then answer.",
      passage: "虽然网购给人们带来了很大的方便，但也有不少人担心，过度包装会造成资源浪费和环境污染。",
      stem: "人们担心网购会带来什么问题？", choices: ["过度包装造成浪费和污染", "价格太高", "送货太慢", "商品质量差"],
      why: "“过度包装会造成资源浪费和环境污染”." },
    { id: "zh-b2-2", level: "B2", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "这个问题 ___ 简单，其实很复杂。", choices: ["看起来", "看上来", "看下去", "看过来"],
      why: "看起来 — it looks simple, but in fact…" },
    { id: "zh-b2-3", level: "B2", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "无论遇到什么困难，他 ___ 不放弃。", choices: ["都", "才", "就", "却"],
      why: "无论……都 — no matter what… always." },
    { id: "zh-b2-4", level: "B2", skill: "vocabulary", task: TIANKONG, ask: "Fill the gap.",
      stem: "经过多次讨论，双方终于 ___ 了一致。", choices: ["达成", "完成", "形成", "组成"],
      why: "达成一致 — to reach agreement." },
    { id: "zh-b2-5", level: "B2", skill: "listening", task: TINGLI, ask: "Listen, then answer.",
      passage: "很多人认为早起一定对身体好，其实关键不在于几点起床，而在于睡眠是否充足。",
      stem: "说话人认为什么最重要？", choices: ["睡眠是否充足", "几点起床", "早起", "晚睡"],
      why: "不在于……而在于 — not this, but that." },

    // C1 · HSK 6
    { id: "zh-c1-1", level: "C1", skill: "reading", task: YUEDU, ask: "Read, then answer.",
      passage: "作者并不反对使用科技产品，而是提醒人们，过分依赖手机可能会削弱人与人之间面对面交流的能力。",
      stem: "作者的观点是什么？", choices: ["过分依赖手机会影响面对面交流", "应该完全放弃手机", "科技产品没有用处", "面对面交流不重要"],
      why: "并不反对……而是提醒 — not against it, but warning." },
    { id: "zh-c1-2", level: "C1", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "他之所以成功，___ 他一直坚持不懈。", choices: ["是因为", "所以", "因此", "于是"],
      why: "之所以……是因为 — the reason… is that." },
    { id: "zh-c1-3", level: "C1", skill: "vocabulary", task: TIANKONG, ask: "Fill the gap.",
      stem: "面对突如其来的变化，他显得十分 ___。", choices: ["镇定", "镇压", "稳固", "固定"],
      why: "镇定 — calm, composed." },
    { id: "zh-c1-4", level: "C1", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "与其在家里等，___ 自己去找。", choices: ["不如", "还是", "而且", "何况"],
      why: "与其……不如 — rather than… better to." },
    { id: "zh-c1-5", level: "C1", skill: "listening", task: TINGLI, ask: "Listen, then answer.",
      passage: "这项政策的效果如何，现在下结论还为时过早，至少需要观察一两年。",
      stem: "说话人是什么意思？", choices: ["现在评价政策还太早", "政策已经失败了", "政策非常成功", "政策明年取消"],
      why: "为时过早 — too early to tell." },

    // C2 · HSK 7–9
    { id: "zh-c2-1", level: "C2", skill: "reading", task: YUEDU, ask: "Read, then answer.",
      passage: "这部小说表面上写的是一个家族的兴衰，实际上折射出整个时代的变迁。",
      stem: "这段话的意思是：", choices: ["小说借一个家族反映时代变化", "小说只写一个家族", "小说与时代无关", "小说写的是历史人物"],
      why: "折射出整个时代的变迁 — mirrors the whole era." },
    { id: "zh-c2-2", level: "C2", skill: "vocabulary", task: TIANKONG, ask: "Choose the meaning.",
      stem: "“画蛇添足”的意思是：", choices: ["做了多余的事反而坏事", "画画技术很高", "做事有始有终", "动作很快"],
      why: "Drawing legs on a snake: overdoing it spoils it." },
    { id: "zh-c2-3", level: "C2", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "此事 ___ 重大，务必谨慎处理。", choices: ["关系", "关于", "有关", "关心"],
      why: "关系重大 — of great consequence." },
    { id: "zh-c2-4", level: "C2", skill: "vocabulary", task: TIANKONG, ask: "Fill the gap.",
      stem: "他的发言 ___，让人抓不住重点。", choices: ["冗长", "简洁", "精辟", "扼要"],
      why: "冗长 — long-winded." },
    { id: "zh-c2-5", level: "C2", skill: "grammar", task: TIANKONG, ask: "Fill the gap.",
      stem: "___ 他再三劝说，她仍然不肯改变主意。", choices: ["尽管", "既然", "只要", "除非"],
      why: "尽管……仍然 — although… still." },
  ],
}
