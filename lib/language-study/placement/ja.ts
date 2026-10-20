/**
 * lib/language-study/placement/ja.ts — Japanese placement bank (JLPT format)
 *
 * Original items in the shape of JLPT tasks: 読解 (reading), 聴解
 * (listening), 文法 (grammar), and 文字・語彙 (vocabulary). The JLPT has five
 * levels; here N5 → A1, N4 → A2, N3 → B1, N2 → B2, and N1 covers C1 and C2,
 * with the C2 stage drawn from the hardest N1-style items. A1 and A2 are in
 * kana, as the N5 and N4 papers mostly are. Five per level; a run draws four.
 * The right option is first.
 */

import type { PlacementBank } from "@/lib/language-study/placement/types"

const DOKKAI = "読解"
const CHOUKAI = "聴解"
const BUNPOU = "文法"
const GOI = "文字・語彙"

export const JA_PLACEMENT: PlacementBank = {
  lang: "ja",
  questions: [
    // A1 · N5
    { id: "ja-a1-1", level: "A1", skill: "listening", task: CHOUKAI, ask: "Listen, then answer.",
      passage: "はじめまして。たなかです。がくせいです。どうぞ よろしく おねがいします。",
      stem: "たなかさんは なにを していますか。", choices: ["がくせいです", "せんせいです", "いしゃです", "かいしゃいんです"],
      why: "「がくせいです」 — I'm a student." },
    { id: "ja-a1-2", level: "A1", skill: "reading", task: DOKKAI, ask: "Read the notice, then answer.",
      passage: "としょかん：ごぜん ９じから ごご ５じまで。げつようびは やすみです。",
      stem: "としょかんは いつ やすみですか。", choices: ["げつようび", "にちようび", "すいようび", "まいにち"],
      why: "「げつようびは やすみです」 — closed Mondays." },
    { id: "ja-a1-3", level: "A1", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "わたしは まいあさ コーヒー＿＿ のみます。", choices: ["を", "に", "で", "が"],
      why: "The thing you drink takes を." },
    { id: "ja-a1-4", level: "A1", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "きのう えいがを ＿＿。", choices: ["みました", "みます", "みましょう", "みて ください"],
      why: "きのう (yesterday) needs the past: みました." },
    { id: "ja-a1-5", level: "A1", skill: "vocabulary", task: GOI, ask: "Fill the gap.",
      stem: "この りんごは ＿＿ です。おいしいです。", choices: ["あまい", "ひくい", "おそい", "せまい"],
      why: "あまい — sweet, which fits a tasty apple." },

    // A2 · N4
    { id: "ja-a2-1", level: "A2", skill: "listening", task: CHOUKAI, ask: "Listen to the announcement, then answer.",
      passage: "おしらせします。３ばんせんの でんしゃは じこの ため、２０ぷん おくれて います。",
      stem: "でんしゃは どう なりましたか。", choices: ["２０ぷん おくれて いる", "とまって しまった", "はやく くる", "べつの せんに くる"],
      why: "「２０ぷん おくれて います」 — running twenty minutes late." },
    { id: "ja-a2-2", level: "A2", skill: "reading", task: DOKKAI, ask: "Read the note, then answer.",
      passage: "ゆみさんへ　あしたの パーティーは ６じからです。のみものを かって きて ください。たべものは わたしが つくります。けん",
      stem: "ゆみさんは なにを しますか。", choices: ["のみものを かう", "たべものを つくる", "パーティーを ひらく", "６じに でんわする"],
      why: "「のみものを かって きて ください」." },
    { id: "ja-a2-3", level: "A2", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "あめが ふって いる ＿＿、かさを もって いきます。", choices: ["から", "けど", "のに", "まで"],
      why: "から gives the reason: because it is raining." },
    { id: "ja-a2-4", level: "A2", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "にほんごが すこし はなせる ＿＿ なりました。", choices: ["ように", "ことに", "ために", "そうに"],
      why: "〜ようになる — to come to be able to." },
    { id: "ja-a2-5", level: "A2", skill: "vocabulary", task: GOI, ask: "Fill the gap.",
      stem: "あしたは しけんが あるので、こんばん ＿＿ します。", choices: ["ふくしゅう", "しゅっぱつ", "りょこう", "さんぽ"],
      why: "ふくしゅう — review, before a test." },

    // B1 · N3
    { id: "ja-b1-1", level: "B1", skill: "listening", task: CHOUKAI, ask: "Listen, then answer.",
      passage: "お知らせです。明日の会議は、会議室が使えないため、二階の研修室で行います。時間は変わりません。",
      stem: "何が変わりましたか。", choices: ["会議の場所", "会議の時間", "会議の日", "会議の参加者"],
      why: "The room moves; 「時間は変わりません」." },
    { id: "ja-b1-2", level: "B1", skill: "reading", task: DOKKAI, ask: "Read, then answer.",
      passage: "最近、駅前に新しい図書館ができた。本を借りるだけでなく、カフェで飲み物を飲みながら勉強することもできるので、学生に人気がある。",
      stem: "図書館が学生に人気がある理由は何ですか。", choices: ["カフェで飲みながら勉強できるから", "本が安く買えるから", "駅から遠いから", "夜遅くまで開いているから"],
      why: "「飲み物を飲みながら勉強することもできるので」." },
    { id: "ja-b1-3", level: "B1", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "雨が降った＿＿、試合は中止になった。", choices: ["ため", "のに", "ても", "ながら"],
      why: "〜ため gives a cause: because it rained." },
    { id: "ja-b1-4", level: "B1", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "この料理は 母に 教えて ＿＿ ものです。", choices: ["もらった", "あげた", "くれた", "やった"],
      why: "母に〜てもらう — I had my mother teach me." },
    { id: "ja-b1-5", level: "B1", skill: "vocabulary", task: GOI, ask: "Fill the gap.",
      stem: "彼は 約束の 時間に いつも ＿＿ する。", choices: ["遅刻", "遅延", "延期", "中止"],
      why: "遅刻 is a person arriving late; 遅延 is for trains." },

    // B2 · N2
    { id: "ja-b2-1", level: "B2", skill: "reading", task: DOKKAI, ask: "Read, then answer.",
      passage: "在宅勤務が広がったことで、通勤時間が減ったと喜ぶ人がいる一方、同僚と気軽に相談できなくなったと感じる人も少なくない。",
      stem: "文章の内容と合うものはどれか。", choices: ["在宅勤務には良い面と悪い面がある", "在宅勤務は全員に喜ばれている", "通勤時間が増えた", "同僚と相談しやすくなった"],
      why: "〜一方 sets one view against another." },
    { id: "ja-b2-2", level: "B2", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "忙しい ＿＿、毎日 運動を 続けている。", choices: ["にもかかわらず", "によって", "にとって", "について"],
      why: "〜にもかかわらず — despite being busy." },
    { id: "ja-b2-3", level: "B2", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "この 問題は 専門家 ＿＿ 解けない だろう。", choices: ["でなければ", "からこそ", "ばかりか", "どころか"],
      why: "〜でなければ〜ない — only an expert could solve it." },
    { id: "ja-b2-4", level: "B2", skill: "vocabulary", task: GOI, ask: "Fill the gap.",
      stem: "新しい 制度が 来月から ＿＿ される。", choices: ["導入", "輸入", "投入", "記入"],
      why: "導入 — to introduce a system." },
    { id: "ja-b2-5", level: "B2", skill: "listening", task: CHOUKAI, ask: "Listen, then answer.",
      passage: "若者の読書離れが進んでいると言われてきましたが、今回の調査で、実際には電子書籍で読む人が増えているだけだということがわかりました。",
      stem: "調査で何がわかりましたか。", choices: ["若者は電子書籍で読むようになった", "若者は本を読まなくなった", "電子書籍の利用が減った", "若者は図書館をよく使う"],
      why: "「電子書籍で読む人が増えているだけ」." },

    // C1 · N1
    { id: "ja-c1-1", level: "C1", skill: "reading", task: DOKKAI, ask: "Read, then answer.",
      passage: "筆者は、効率化そのものを否定しているわけではない。ただ、効率だけを基準にすれば、すぐには成果の出ない基礎研究が切り捨てられかねないと懸念しているのである。",
      stem: "筆者が心配していることは何か。", choices: ["効率重視で基礎研究が軽視されること", "効率化が進まないこと", "基礎研究に成果が多すぎること", "研究者が足りないこと"],
      why: "「基礎研究が切り捨てられかねない」." },
    { id: "ja-c1-2", level: "C1", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "彼の 発言は、誤解を 招き ＿＿ ものだった。", choices: ["かねない", "がたい", "かねる", "っこない"],
      why: "〜かねない — could well lead to." },
    { id: "ja-c1-3", level: "C1", skill: "vocabulary", task: GOI, ask: "Fill the gap.",
      stem: "その 提案は 会議で ＿＿ 却下された。", choices: ["あっさり", "うっかり", "しっかり", "ゆっくり"],
      why: "あっさり — flatly, without fuss." },
    { id: "ja-c1-4", level: "C1", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "言う ＿＿、健康が 一番 大切だ。", choices: ["までもなく", "ばかりに", "ものの", "ところで"],
      why: "言うまでもなく — needless to say." },
    { id: "ja-c1-5", level: "C1", skill: "listening", task: CHOUKAI, ask: "Listen, then answer.",
      passage: "結論から申し上げますと、今回の計画は費用の面で見直しが必要だと考えております。",
      stem: "話している人は計画についてどう考えていますか。", choices: ["費用の点で再検討が必要だ", "すぐに実行すべきだ", "中止すべきだ", "費用は問題ない"],
      why: "「費用の面で見直しが必要」." },

    // C2 · N1, hardest items
    { id: "ja-c2-1", level: "C2", skill: "reading", task: DOKKAI, ask: "Read, then answer.",
      passage: "この小説の魅力は、語り手が登場人物を突き放して描きながらも、どこかで彼らを見捨てきれずにいる、その揺らぎにある。",
      stem: "筆者はこの小説の魅力を何だと言っているか。", choices: ["語り手の距離感と愛着の間の揺れ", "登場人物が多いこと", "語り手が人物を完全に見捨てていること", "筋が単純なこと"],
      why: "Held at arm's length, yet never quite abandoned." },
    { id: "ja-c2-2", level: "C2", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "彼の 努力 ＿＿、この 成功は なかった だろう。", choices: ["なくしては", "ともなると", "をもって", "ならでは"],
      why: "〜なくしては — without his effort." },
    { id: "ja-c2-3", level: "C2", skill: "vocabulary", task: GOI, ask: "Choose the meaning.",
      stem: "「漁夫の利」の 意味は どれか。", choices: ["争う二者の間で第三者が利益を得ること", "漁師が魚をたくさん取ること", "努力して大きな利益を得ること", "海で働く人の給料"],
      why: "A third party profits while two others quarrel." },
    { id: "ja-c2-4", level: "C2", skill: "grammar", task: BUNPOU, ask: "Fill the gap.",
      stem: "社長の 許可 ＿＿、この 書類は 外部に 出せない。", choices: ["なしには", "ながらに", "ずくめで", "まみれで"],
      why: "〜なしには〜ない — not without permission." },
    { id: "ja-c2-5", level: "C2", skill: "vocabulary", task: GOI, ask: "Fill the gap.",
      stem: "彼の 説明は ＿＿ で、要点が つかめなかった。", choices: ["冗長", "簡潔", "明快", "的確"],
      why: "冗長 — long-winded, so the point was lost." },
  ],
}
