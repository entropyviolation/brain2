/**
 * lib/cycle-lens-chinese.ts — Chinese-medicine lens for the cycle popup
 *
 * A traditional reading of the phase `phaseForDate` already derived from
 * bleed and ovulation marks. Four phases of modern Chinese gynecology,
 * plus unknown. Not a prescription, not a diagnosis, not a formula, and not a point.
 *
 * `chineseLensSections` is the short popup. `chineseEncyclopedia` is the
 * longer reference. Classical and modern ideas are paraphrased from works
 * that were actually read. Gram amounts, decoctions, and "take this" are omitted
 * even where a source printed them.
 */
import type { CyclePhase } from "@/lib/cycle-phase"

export type LensSectionId = "physiology" | "typical" | "worth-doing" | "worth-not-doing"

export type LensSection = {
  id: LensSectionId
  title: string
  paragraphs: readonly string[]
}

/** Shown with this lens. A reading of the marks, not a formula to take. */
export const CHINESE_LENS_LINE =
  "A traditional reading of these marks. Not a prescription, and not a diagnosis."

export const chineseLensSections: Record<CyclePhase, readonly LensSection[]> = {
  menstrual: [
    {
      id: "physiology",
      title: "The phase",
      paragraphs: [
        "行经期 (xíng jīng qī), the menstrual phase, is the reading for a day marked bleeding. The Chong vessel, 冲脉 (chōng mài), the sea of Blood, 血海 (xuè hǎi), and the Ren vessel, 任脉 (rèn mài), are open, and Blood moves downward. The turn that belongs here is 重阳转阴 (zhòng yáng zhuǎn yīn): yang has stood at its height, and it gives way to yin through the discharge. The work is free passage. In this map the next phase replenishes after the old Blood has been allowed to leave.",
        "Astringing the flow, or replenishing so heavily that the flow stalls, goes against an open passage. Replenishing Kidney yin, 肾阴 (shèn yīn), and Blood waits until the discharge is through. If bleeding and ovulation are both marked on this day, bleeding wins, and the reading stays 行经期. A day marked only as spotting is not this phase.",
      ],
    },
    {
      id: "typical",
      title: "What's typical",
      paragraphs: [
        "The lower abdomen bears down, the uterus cramps as it empties, and attention narrows. A wish for warmth is common while the discharge of 行经期 (xíng jīng qī) is under way.",
        "Once the flow is under way, qi and Blood are being spent, so the body can feel emptier than it did in the days before. If the qi that carries Blood is stuck, the same days feel irritable or obstructed. If the passage is free, they feel quiet. Both are pictures of Blood moving. Neither is a diagnosis.",
      ],
    },
    {
      id: "worth-doing",
      title: "Worth doing",
      paragraphs: [
        "Let the discharge of 行经期 (xíng jīng qī) finish. Warmth on the lower abdomen, rest scaled to how heavy the day is, and simple warm food are ordinary care while the passage is open. Keep the day from being so driven that the movement knots.",
        "Mark the days you are actually bleeding. Those marks are how the calendar knows the passage was open, and how the replenishing phase knows where to start.",
      ],
    },
    {
      id: "worth-not-doing",
      title: "Worth not doing",
      paragraphs: [
        "The emptier feeling that comes with the flow is the cost of the discharge in 行经期 (xíng jīng qī). It is a poor reason to close the passage early, and these marks cannot show that Kidney yin, 肾阴 (shèn yīn), is deficient. That judgment needs more than a bleed on a calendar.",
        "A formula belongs to a practitioner who can see the person. A needle, a point, or a dose is the same kind of decision. This reading stops at the shape of the phase.",
      ],
    },
  ],
  follicular: [
    {
      id: "physiology",
      title: "The phase",
      paragraphs: [
        "经后期 (jīng hòu qī), the post-menstrual phase, is the reading for follicular days on this calendar: a bleed has ended, and no ovulation mark has yet taken effect. Kidney yin, 肾阴 (shèn yīn), and Blood are replenished. The sea of Blood, 血海 (xuè hǎi), fills again, the Liver stores Blood as it returns, and yin lengthens. Tian gui, 天癸 (tiān guǐ), the kidney essence that matures reproductive life, depends on that yin. The bleed itself is a different stretch.",
        "重阴转阳 (zhòng yīn zhuǎn yáng), full yin transforming into yang, is the next turn. This calendar gives it only to a day you mark as ovulation. It does not spread that turn back across the days of replenishing. If ovulation is never marked, the days stay 经后期 until the next bleed. A missing mark does not measure whether yin has filled, and it does not prove that the body failed to change.",
      ],
    },
    {
      id: "typical",
      title: "What's typical",
      paragraphs: [
        "Sleep, moisture, and an appetite for ordinary effort tend to return as yin and Blood come back in 经后期 (jīng hòu qī), and attention often widens. When the filling is thin, the same stretch can feel dry, scant, or tired. The marks still assign 经后期 either way.",
      ],
    },
    {
      id: "worth-doing",
      title: "Worth doing",
      paragraphs: [
        "Give the replenishing of 经后期 (jīng hòu qī) something ordinary to work with: regular meals, enough sleep, and work that builds. In daily life, Blood is rebuilt from food and rest. The qi that courses Blood should stay free enough that what is gathering does not sit in a knot. The emphasis is still storage and increase.",
        "Leave the ovulation mark unset until you judge the change has happened. Until that mark, this lens keeps the days in the growth of Kidney yin, 肾阴 (shèn yīn).",
      ],
    },
    {
      id: "worth-not-doing",
      title: "Worth not doing",
      paragraphs: [
        "An ovulation mark belongs on the day you judge the change to have happened. An earlier mark shortens 经后期 (jīng hòu qī) and names that earlier day 重阴转阳 (zhòng yīn zhuǎn yáng). Treating the stretch as if the bleed were still open, or as if yang were already at its height, skips the work of this phase.",
        "Harsh heat, and spending the days as if the replenishing were already finished, scatter yin while it is supposed to gather. Ordinary warmth and a normal day's effort are a different matter. A formula belongs to a practitioner who can see the person.",
      ],
    },
  ],
  ovulatory: [
    {
      id: "physiology",
      title: "The phase",
      paragraphs: [
        "经间期 (jīng jiān qī), the intermenstrual phase, is a brief turn, and this calendar allows it on one kind of day only: a day you marked ovulation and did not also mark bleeding. Yin has been lengthening. At its height it transforms into yang. That turn is 重阴转阳 (zhòng yīn zhuǎn yáng). The stir that goes with it is called 氤氲 (yīn yūn), the dense mixing in which yang begins to move. Kidney yang, 肾阳 (shèn yáng), supplies the warmth the turn requires. Liver qi, 肝气 (gān qì), has to course, or fullness cannot pivot.",
        "The teaching gives this stir a short window, sometimes a few days, often with clear stretchy fluid. The Chong vessel, 冲脉 (chōng mài), and the Ren vessel, 任脉 (rèn mài), do not open in this phase. They open with the bleed. This calendar is stricter than that window. Only the marked day is 经间期. The mark does not prove the body made the turn.",
      ],
    },
    {
      id: "typical",
      title: "What's typical",
      paragraphs: [
        "When the turn of 经间期 (jīng jiān qī) shows itself, it shows briefly: a stir low in the abdomen, a sudden clear slippery fluid, or attention that faces outward for a day. In this language that is yin at its edge and yang just taking the lead, the stir called 氤氲 (yīn yūn). The same turn can pass almost quietly. A missing sensation does not erase a mark you set, and a strong sensation does not add a day you left blank.",
      ],
    },
    {
      id: "worth-doing",
      title: "Worth doing",
      paragraphs: [
        "Mark the day you take the transformation, 重阴转阳 (zhòng yīn zhuǎn yáng), to have happened, then keep the day ordinary. Ease, a little warmth, and enough room for qi to move suit 经间期 (jīng jiān qī), a phase of one marked day.",
        "If you are unsure the turn occurred, leave the mark off. After a bleed, an unmarked day stays 经后期 (jīng hòu qī), and the reading remains the replenishing of Kidney yin, 肾阴 (shèn yīn), and Blood. A guess would assign a yang phase the marks do not support.",
      ],
    },
    {
      id: "worth-not-doing",
      title: "Worth not doing",
      paragraphs: [
        "This day stays one marked day. It is a timing, not a week and not guidance about conception. 重阴转阳 (zhòng yīn zhuǎn yáng) and 氤氲 (yīn yūn) name that timing. They are not evidence that Kidney yang, 肾阳 (shèn yáng), completed the change. A formula belongs to a practitioner who can see the person.",
        "Bleeding on the same day is 行经期 (xíng jīng qī). Blood moving overrides the turn, and the calendar follows that. Spotting does not create 经间期 (jīng jiān qī), and spotting does not cancel a mark you did set.",
      ],
    },
  ],
  luteal: [
    {
      id: "physiology",
      title: "The phase",
      paragraphs: [
        "经前期 (jīng qián qī), the premenstrual phase, is the reading from the day after an ovulation mark until the next bleed. Yang grows, and qi with it. Kidney yang, 肾阳 (shèn yáng), warms what Kidney yin and Blood have built. The Chong vessel, 冲脉 (chōng mài), the sea of Blood, and the Ren vessel, 任脉 (rèn mài), become relatively full. They stay closed. Discharge is the menstrual phase, still ahead.",
        "Early in the stretch, yang is rising. Later, yang and qi stand relatively full, and the discharge approaches. While Blood has not started to move, qi needs a free course, so the passage ahead is not jammed. 重阳转阴 (zhòng yáng zhuǎn yīn), yang at its height giving way to yin, arrives with the bleed. If no later bleed is marked, the days stay 经前期. The calendar has not been shown an opening. The marks do not establish a pregnancy, and they do not measure yang.",
      ],
    },
    {
      id: "typical",
      title: "What's typical",
      paragraphs: [
        "The body tends toward warmth, heavier sleep, and a fuller chest or lower abdomen in 经前期 (jīng qián qī). Attention would rather finish what is already open than start something new.",
        "Late in the phase, Liver qi, 肝气 (gān qì), is easily constrained. Qi is abundant, and the discharge has not begun. Tightness, irritability, swelling, or sadness can follow. That picture belongs to 经前期. It is a feature of this phase, and it is not a fault of character.",
      ],
    },
    {
      id: "worth-doing",
      title: "Worth doing",
      paragraphs: [
        "Warmth, steady meals, and regular rest suit 经前期 (jīng qián qī), a phase in which yang and qi come toward fullness. Let the work be finishing and looking after what is already under way. Give qi a path, such as a walk or a conversation that reaches its end, so fullness can course instead of knotting.",
        "When bleeding starts, mark it. That mark is the opening of the Chong vessel, 冲脉 (chōng mài), and the Ren vessel, 任脉 (rèn mài), and it ends this phase. An unmarked bleed leaves the calendar in 经前期 after the discharge has already begun.",
      ],
    },
    {
      id: "worth-not-doing",
      title: "Worth not doing",
      paragraphs: [
        "Late tightness is still 经前期 (jīng qián qī). Moving or purging Blood as if the passage were already open treats this phase as 行经期 (xíng jīng qī). Astringing the flow as the discharge approaches shuts the path that fullness needs. Qi should stay free while the sea is full and the bleed has not started.",
        "A short stretch or a long one shows duration only. The marks cannot show that Kidney yang, 肾阳 (shèn yáng), is deficient, or that it is excessive. A formula belongs to a practitioner who can see the person. Spotting does not turn these days into the bleed.",
      ],
    },
  ],
  unknown: [
    {
      id: "physiology",
      title: "The phase",
      paragraphs: [
        "The calendar lacks bleed history for this day, and no ovulation mark is in effect. There is no season here to name. The lens will not call the day 行经期 (xíng jīng qī), 经后期 (jīng hòu qī), 经间期 (jīng jiān qī), or 经前期 (jīng qián qī).",
      ],
    },
    {
      id: "typical",
      title: "What's typical",
      paragraphs: [
        "There is no typical picture, for this day, of Blood moving, of Kidney yin, 肾阴 (shèn yīn), returning, of the brief turn, or of yang and qi standing full. Those are readings of marks. Sensations on an unnamed day may be real. They do not supply the history the calendar is missing.",
      ],
    },
    {
      id: "worth-doing",
      title: "Worth doing",
      paragraphs: [
        "Mark bleeding on the days it happens. That history is what later readings of 行经期 (xíng jīng qī) and the phases after it use. An ovulation mark, on a day you judge the turn to have happened, can also give the calendar a phase to read. Until one of those marks exists, this lens has no season to describe.",
      ],
    },
    {
      id: "worth-not-doing",
      title: "Worth not doing",
      paragraphs: [
        "Leave 行经期 (xíng jīng qī), 经后期 (jīng hòu qī), 经间期 (jīng jiān qī), and 经前期 (jīng qián qī) for days the marks support. The silence is not a reading of deficient Kidney yin, 肾阴 (shèn yīn), deficient Kidney yang, 肾阳 (shèn yáng), or stuck Liver qi, 肝气 (gān qì). A formula belongs to a practitioner who can see the person. The four-phase map reads marks that exist.",
      ],
    },
  ],
}

export type TcmSource = { id: string; citation: string; note?: string }

export type TcmHerb = {
  name: string
  pinyin: string
  chinese: string
  traditionalRole: string
  sourceId: string
}

export type TcmEntry = {
  id: string
  title: string
  paragraphs: readonly string[]
  herbs?: readonly TcmHerb[]
  sourceIds: readonly string[]
}

export type TcmChapter = {
  id: string
  title: string
  entries: readonly TcmEntry[]
}

export const tcmSources: readonly TcmSource[] = [
  {
    id: "neijing-suwen-tianzhen",
    citation:
      "《黄帝内经·素问·上古天真论》. Kidney qi through the sevens, tian gui arriving, the Ren vessel opening, the great Chong vessel abundant, and the monthly matter descending on time; at seven times seven, that tide recedes.",
  },
  {
    id: "neijing-lingshu-hailun",
    citation:
      "《黄帝内经·灵枢·海论》. Names marrow, blood, qi, and food-and-water as the four seas, and calls the Chong vessel the sea of the twelve channels.",
  },
  {
    id: "zhang-leijing-hailun",
    citation:
      "张介宾《类经》, note on 《灵枢·海论》. Reads the Chong vessel, sea of the twelve channels, as the blood sea: what receives the channels' infusion and stores essence and blood.",
  },
  {
    id: "chen-liangfang",
    citation:
      "陈自明《妇人大全良方》卷之一·调经门, especially 月经绪论 and 月水不调方论. Song dynasty. His gloss on the Neijing line: the Chong vessel is the blood sea, and the Ren vessel governs the uterus.",
  },
  {
    id: "danxi-gezhi",
    citation:
      "朱震亨《格致余论》, the essays 阳有余阴不足论 and 经水或紫或黑论. Yuan dynasty.",
  },
  {
    id: "jingyue-furen-gui",
    citation:
      "张介宾《景岳全书》卷三十八·妇人规（上）·经脉类·经不调. Ming dynasty. Includes his quotations of 朱丹溪 and 王子亨, and his own qualifications of them.",
  },
  {
    id: "fu-nvke",
    citation:
      "傅山《傅青主女科》上卷·调经, from 经水先期 through 经水将来脐下先疼痛, including 经水先后无定期, 经水忽来忽断时疼时止, 经水未来腹先疼, 行经后少腹疼痛, and 经前腹疼吐血. Qing dynasty.",
  },
  {
    id: "xia-1998",
    citation:
      "夏桂成. 月经周期与调周法, and the continuation on treatment in the menstrual phase. 南京中医药大学学报 1998, volume 14, numbers 3 and 4.",
  },
  {
    id: "xia-handbook",
    citation:
      "夏桂成, editor. 《夏桂成中医妇科诊疗手册》. Beijing: 中国中医药出版社. Seven-phase outline and the printed formulas 五味调经散, 归芍地黄汤, 补肾促排卵汤, and 温土毓麟汤.",
    note: "Those lists were read from the published clinical summary of the handbook (南方plus, 20 February 2022, which credits the book), not from a page-by-page reading of the handbook itself.",
  },
  {
    id: "xia-qian-lu-2016",
    citation:
      "钱菁, 卢苏. 国医大师夏桂成教授调周法经后期证治探析. 南京中医药大学学报 2016, volume 32, number 3, pages 204–206. Used for the postmenstrual method: nourish yin and blood, assist yang, and value quiet.",
  },
  {
    id: "tcm-gynecology-four",
    citation:
      "The four-phase rhythm as taught in 中医妇科学 and repeated in Chinese-medicine physician exam outlines: 行经期, 经后期, 经间期, 经前期, with 重阳转阴, 重阴转阳, and 氤氲之时 (also called 的候 and 真机). The twenty-eight-day sketch in that teaching is an illustration.",
  },
  {
    id: "jiangsu-xia-1986",
    citation:
      "江苏省卫生健康委员会, notice “国医大师夏桂成,” 13 June 2015. Older gynecology divided the cycle into menstrual, postmenstrual, and premenstrual stretches and did not name an intermenstrual phase. Xia’s teaching of that phase entered the fifth edition of the national textbook in 1986 under 经间期出血.",
  },
]

function herb(
  name: string,
  pinyin: string,
  chinese: string,
  traditionalRole: string,
  sourceId: string,
): TcmHerb {
  return { name, pinyin, chinese, traditionalRole, sourceId }
}

const XIA_MENSTRUAL_FIVE: readonly TcmHerb[] = [
  herb(
    "Salvia root",
    "dān shēn",
    "丹参",
    "One of the five ingredients Xia Guicheng names for the ordinary menstrual-phase formula, whose job is to quicken Blood and clear what should leave with the discharge.",
    "xia-1998",
  ),
  herb(
    "Red peony root",
    "chì sháo",
    "赤芍",
    "Paired with salvia in that same five-ingredient formula. Xia places the group on the side of moving stasis so the old discharge can finish.",
    "xia-1998",
  ),
  herb(
    "Trogopterus dung",
    "wǔ líng zhī",
    "五灵脂",
    "The third of Xia’s five. In this formula it belongs with the herbs that move the blood of the discharge rather than with a remedy for stopping it.",
    "xia-1998",
  ),
  herb(
    "Mugwort leaf",
    "ài yè",
    "艾叶",
    "The warming member of Xia’s five. He keeps it inside a formula whose stated weight is on dispelling stasis while the flow is open.",
    "xia-1998",
  ),
  herb(
    "Leonurus",
    "yì mǔ cǎo",
    "益母草",
    "The fifth of Xia’s five. He also notes that leonurus, salvia, and the peonies retain some blood-nourishing character as the bleeding days move toward their end.",
    "xia-1998",
  ),
  herb(
    "Dipsacus root",
    "xù duàn",
    "续断",
    "Xia writes this as 川断 (chuān duàn). In the 1998 articles it is an example of a yang-supporting item he may join to the menstrual formula so the turn has yang behind it, without shutting the discharge. The handbook summary prints it in the same phase list.",
    "xia-1998",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Named by Xia among the milder items for disinhibiting damp and draining turbidity during the menstrual phase, when damp is mixed into what must leave.",
    "xia-1998",
  ),
  herb(
    "Lycopus leaf",
    "zé lán yè",
    "泽兰叶",
    "Named with poria as a mild damp-and-stasis item for the menstrual phase. Xia’s point is that leftover turbidity, like leftover stasis, gets in the way of what is newly generated.",
    "xia-1998",
  ),
  herb(
    "Coix seed",
    "yì yǐ rén",
    "薏苡仁",
    "Listed by Xia with poria and lycopus as one of the lighter damp-disinhibiting items he may add in the menstrual phase. He distinguishes these from stronger drainers, which this library does not itemize.",
    "xia-1998",
  ),
]

const XIA_POSTMENSTRUAL: readonly TcmHerb[] = [
  herb(
    "Chinese angelica root",
    "dāng guī",
    "当归",
    "In the handbook’s postmenstrual formula, whose method is to nourish yin and Blood once the sea of Blood is empty.",
    "xia-handbook",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Stands with angelica in that postmenstrual list. The printed method for the phase is nourishing yin and Blood, not opening the discharge.",
    "xia-handbook",
  ),
  herb(
    "Red peony root",
    "chì sháo",
    "赤芍",
    "Printed beside white peony in the same postmenstrual formula. The handbook does not split their jobs; both sit under nourishing yin and Blood after the flow.",
    "xia-handbook",
  ),
  herb(
    "Chinese yam",
    "shān yào",
    "山药",
    "The handbook writes 怀山药 (huái shān yào). It belongs to the yin-nourishing group of the postmenstrual formula.",
    "xia-handbook",
  ),
  herb(
    "Cornus fruit",
    "shān zhū yú",
    "山茱萸",
    "Included in the handbook’s postmenstrual formula on the yin-nourishing side, for the stretch when the sea of Blood is filling again.",
    "xia-handbook",
  ),
  herb(
    "Raw rehmannia root",
    "shēng dì huáng",
    "生地黄",
    "The rehmannia the handbook prints for this postmenstrual formula. The method line is to nourish yin and Blood. It is a different rehmannia preparation from the prepared root Fu uses in other chapters.",
    "xia-handbook",
  ),
  herb(
    "Tree peony root bark",
    "mǔ dān pí",
    "牡丹皮",
    "Printed as 丹皮 (dān pí) in the handbook’s postmenstrual list, inside a formula aimed at yin and Blood rather than at forcing a turn.",
    "xia-handbook",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Included in the handbook’s postmenstrual formula. The stated aim of the whole list is nourishing yin and Blood while the sea is still recovering.",
    "xia-handbook",
  ),
  herb(
    "Achyranthes root",
    "huái niú xī",
    "怀牛膝",
    "The handbook specifies the Huai form in this postmenstrual formula. It is listed under the same method, nourishing yin and Blood, not as a separate instruction.",
    "xia-handbook",
  ),
  herb(
    "Taxillus",
    "sāng jì shēng",
    "桑寄生",
    "The last item in the handbook’s printed postmenstrual list. Like the rest of that list, it is tied to nourishing yin and Blood after the discharge.",
    "xia-handbook",
  ),
]

const XIA_INTERMENSTRUAL: readonly TcmHerb[] = [
  herb(
    "Chinese angelica root",
    "dāng guī",
    "当归",
    "In the handbook’s intermenstrual formula. The method printed with it is to quicken Blood, free the network vessels, and regulate kidney yin and kidney yang together through the turn.",
    "xia-handbook",
  ),
  herb(
    "Red peony root",
    "chì sháo",
    "赤芍",
    "Printed in that intermenstrual formula on the Blood-moving side of 重阴转阳 (zhòng yīn zhuǎn yáng).",
    "xia-handbook",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Printed beside red peony in the same intermenstrual formula, so the moving side of the turn is not separated from Blood.",
    "xia-handbook",
  ),
  herb(
    "Chinese yam",
    "shān yào",
    "山药",
    "The handbook writes 怀山药 (huái shān yào) in the intermenstrual formula, among the items that keep the turn from being only a moving formula.",
    "xia-handbook",
  ),
  herb(
    "Prepared rehmannia root",
    "shú dì huáng",
    "熟地黄",
    "The rehmannia printed for the intermenstrual formula. The phase method is to support the kidney through 重阴转阳 (zhòng yīn zhuǎn yáng), when yin is at its height.",
    "xia-handbook",
  ),
  herb(
    "Tree peony root bark",
    "mǔ dān pí",
    "牡丹皮",
    "Printed as 丹皮 (dān pí) in the intermenstrual list, inside the same Blood-moving and kidney-regulating method.",
    "xia-handbook",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Included in the handbook’s intermenstrual formula under the method of regulating yin and yang while the network vessels are freed.",
    "xia-handbook",
  ),
  herb(
    "Dipsacus root",
    "xù duàn",
    "续断",
    "Written 川断 (chuān duàn) in the handbook’s intermenstrual list. It sits with the kidney-supporting items of the turn.",
    "xia-handbook",
  ),
  herb(
    "Cuscuta seed",
    "tù sī zǐ",
    "菟丝子",
    "A kidney-supporting item in the handbook’s intermenstrual formula, whose turn is 重阴转阳 (zhòng yīn zhuǎn yáng).",
    "xia-handbook",
  ),
  herb(
    "Deer antler slice",
    "lù jiǎo piàn",
    "鹿角片",
    "The yang-side item the handbook prints in the intermenstrual formula, for a turn that needs warmth as well as movement.",
    "xia-handbook",
  ),
  herb(
    "Cornus fruit",
    "shān zhū yú",
    "山茱萸",
    "Included in the intermenstrual formula with the other kidney-essence items, so the moving herbs are not the whole of the turn.",
    "xia-handbook",
  ),
  herb(
    "Trogopterus dung",
    "wǔ líng zhī",
    "五灵脂",
    "Printed in the intermenstrual formula on the stasis-moving side. In Xia’s teaching the turn itself is a movement of qi and Blood, not only a tonifying moment.",
    "xia-handbook",
  ),
  herb(
    "Safflower",
    "hóng huā",
    "红花",
    "The handbook’s intermenstrual list ends with safflower, among the items that quicken Blood at 重阴转阳 (zhòng yīn zhuǎn yáng).",
    "xia-handbook",
  ),
]

const XIA_PREMENSTRUAL: readonly TcmHerb[] = [
  herb(
    "Codonopsis root",
    "dǎng shēn",
    "党参",
    "In the handbook’s premenstrual formula 温土毓麟汤 (wēn tǔ yù lín tāng). The printed method is to supplement the kidney and assist yang, with the middle burner included.",
    "xia-handbook",
  ),
  herb(
    "White atractylodes",
    "bái zhú",
    "白术",
    "The handbook writes it stir-fried. It is the spleen-earth item in a premenstrual formula whose name says it warms earth.",
    "xia-handbook",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Stands with atractylodes and codonopsis in that premenstrual formula, on the spleen side of assisting yang.",
    "xia-handbook",
  ),
  herb(
    "Dipsacus root",
    "xù duàn",
    "续断",
    "Written 川断 (chuān duàn) in the premenstrual list. It is one of the kidney items under the method of assisting yang after the turn.",
    "xia-handbook",
  ),
  herb(
    "Eucommia bark",
    "dù zhòng",
    "杜仲",
    "Paired with dipsacus in the handbook’s premenstrual formula, whose aim is kidney yang for the stretch in which yang should be growing.",
    "xia-handbook",
  ),
  herb(
    "Degelatinized deer antler",
    "lù jiǎo shuāng",
    "鹿角霜",
    "The yang medicinal the handbook prints in the premenstrual formula. It is a different antler preparation from the slice used in the intermenstrual list.",
    "xia-handbook",
  ),
  herb(
    "Amomum fruit",
    "shā rén",
    "砂仁",
    "Included so the premenstrual warming formula also moves the middle. The handbook groups it with medicated leaven and tangerine peel.",
    "xia-handbook",
  ),
  herb(
    "Medicated leaven",
    "shén qū",
    "神曲",
    "Sits with amomum and tangerine peel in the premenstrual formula, on the side of keeping the middle from stagnating while yang is assisted.",
    "xia-handbook",
  ),
  herb(
    "Aged tangerine peel",
    "chén pí",
    "陈皮",
    "The qi-moving peel in the handbook’s premenstrual formula. The seven-phase account also wants qi coursed late in this stretch; this is the qi item the printed formula actually names.",
    "xia-handbook",
  ),
]

const FU_QINGJING: readonly TcmHerb[] = [
  herb(
    "Tree peony root bark",
    "mǔ dān pí",
    "牡丹皮",
    "Fu writes 丹皮 (dān pí) in 清经散 (qīng jīng sǎn). He describes the formula as clearing fire while the group as a whole still replenishes water, so the water is not drained away with the fire.",
    "fu-nvke",
  ),
  herb(
    "Lycium root bark",
    "dì gǔ pí",
    "地骨皮",
    "In Qingjing San, on the fire-clearing side of a formula Fu insists must not exhaust kidney water. He gives lycium root bark a more explicit bone-heat role in the next formula, Liangdi Tang.",
    "fu-nvke",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Fu lists it wine-prepared in Qingjing San. It belongs to the Blood side of a formula whose aim is to cool a surplus of fire without turning the treatment into a drain of water.",
    "fu-nvke",
  ),
  herb(
    "Prepared rehmannia root",
    "shú dì huáng",
    "熟地黄",
    "The replenishing-water root in Qingjing San. Fu’s whole argument is that fire may be cleared a little and water must not be left insufficient.",
    "fu-nvke",
  ),
  herb(
    "Sweet wormwood",
    "qīng hāo",
    "青蒿",
    "One of the cooling items Fu puts in Qingjing San beside moutan, lycium root bark, and phellodendron, for early copious menses he reads as fire and water both in surplus.",
    "fu-nvke",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Fu writes 白茯苓 (bái fú líng) in Qingjing San. He does not single it out; it stands in the formula whose stated work is to clear heat and keep water.",
    "fu-nvke",
  ),
  herb(
    "Phellodendron bark",
    "huáng bǎi",
    "黄柏",
    "The bitter cooling item in Qingjing San. Fu’s comment on the formula is that it clears fire and still tastes of replenishing water, a decrease that is also an increase.",
    "fu-nvke",
  ),
]

const FU_LIANGDI: readonly TcmHerb[] = [
  herb(
    "Raw rehmannia root",
    "shēng dì huáng",
    "生地黄",
    "Fu writes 大生地 (dà shēng dì) in 两地汤 (liǎng dì tāng). With lycium root bark, he says it clears heat in the bone. He traces that heat to the kidney, and he says this clearing does not damage stomach qi.",
    "fu-nvke",
  ),
  herb(
    "Scrophularia root",
    "xuán shēn",
    "玄参",
    "Fu writes 元参 (yuán shēn). In Liangdi Tang it belongs to the group he calls entirely water-replenishing, for early menses that are only a drop or two.",
    "fu-nvke",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Fu writes 白芍药 (bái sháo yào), wine-prepared, in Liangdi Tang. The formula’s aim is to replenish water so fire settles, rather than to drain fire outright.",
    "fu-nvke",
  ),
  herb(
    "Ophiopogon tuber",
    "mài dōng",
    "麦冬",
    "In Liangdi Tang, among the items Fu sums up as pure replenishers of water for fire with insufficient yin-water.",
    "fu-nvke",
  ),
  herb(
    "Lycium root bark",
    "dì gǔ pí",
    "地骨皮",
    "Fu names it with raw rehmannia as what clears bone heat in Liangdi Tang. Bone heat, in this chapter, comes from heat in the kidney channel.",
    "fu-nvke",
  ),
  herb(
    "Donkey-hide gelatin",
    "ē jiāo",
    "阿胶",
    "The Blood-and-yin item in Liangdi Tang. Fu’s method for this picture is to replenish water and leave the fire undrained, on the claim that enough water quiets fire.",
    "fu-nvke",
  ),
]

const FU_WENJING: readonly TcmHerb[] = [
  herb(
    "Prepared rehmannia root",
    "shú dì huáng",
    "熟地黄",
    "The chief replenishing root in 温经摄血汤 (wēn jīng shè xuè tāng). Fu says the formula greatly replenishes essence and Blood of the Liver, kidney, and spleen.",
    "fu-nvke",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Wine-prepared in Fu’s list for Wenjing Shexue Tang, on the Blood side of a formula that replenishes and warms together.",
    "fu-nvke",
  ),
  herb(
    "Sichuan lovage rhizome",
    "chuān xiōng",
    "川芎",
    "In Wenjing Shexue Tang. Fu says the formula scatters without consuming qi and drains without damaging yin. Lovage is part of that moving side inside a replenishing formula.",
    "fu-nvke",
  ),
  herb(
    "White atractylodes",
    "bái zhú",
    "白术",
    "The spleen item in Wenjing Shexue Tang. Fu includes the spleen with Liver and kidney as what the formula replenishes.",
    "fu-nvke",
  ),
  herb(
    "Bupleurum root",
    "chái hú",
    "柴胡",
    "Fu names bupleurum as the item that releases constraint inside Wenjing Shexue Tang, so the warming replenishment is not a closed tonification.",
    "fu-nvke",
  ),
  herb(
    "Schisandra fruit",
    "wǔ wèi zǐ",
    "五味子",
    "In Wenjing Shexue Tang. Fu’s summary of the formula is replenishment of Liver, kidney, and spleen together with a scatter that does not consume qi. He does not give this fruit a separate sentence.",
    "fu-nvke",
  ),
  herb(
    "Dipsacus root",
    "xù duàn",
    "续断",
    "In Wenjing Shexue Tang, among the kidney-supporting items of a formula for late menses he reads as cold, whether the amount is scant or copious.",
    "fu-nvke",
  ),
  herb(
    "Cinnamon bark",
    "ròu guì",
    "肉桂",
    "The item Fu explicitly adds in Wenjing Shexue Tang to dispel cold. Late arrival, in this chapter, is a cold picture, not a blank label of Blood deficiency.",
    "fu-nvke",
  ),
]

const FU_DINGJING: readonly TcmHerb[] = [
  herb(
    "Cuscuta seed",
    "tù sī zǐ",
    "菟丝子",
    "Fu leads 定经汤 (dìng jīng tāng) with cuscuta. He says the formula replenishes Liver and kidney essence and courses their qi, and that it is not a menses-forcing formula.",
    "fu-nvke",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Wine-prepared in Dingjing Tang, on the Blood side of a formula whose target is bound Liver qi pulling the kidney with it.",
    "fu-nvke",
  ),
  herb(
    "Chinese angelica root",
    "dāng guī",
    "当归",
    "In Dingjing Tang. Fu’s method is to course the Liver’s bind, which in his account opens the kidney’s bind, so the timing can settle.",
    "fu-nvke",
  ),
  herb(
    "Prepared rehmannia root",
    "shú dì huáng",
    "熟地黄",
    "The yin-Blood root in Dingjing Tang. Fu is explicit that the formula replenishes essence rather than attacking the menses.",
    "fu-nvke",
  ),
  herb(
    "Chinese yam",
    "shān yào",
    "山药",
    "In Dingjing Tang, with poria, among the items that keep the Liver-and-kidney formula from being only a qi-moving one.",
    "fu-nvke",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Fu writes 白茯苓 (bái fú líng) in Dingjing Tang. The formula’s stated work is coursing Liver and kidney qi and replenishing their essence.",
    "fu-nvke",
  ),
  herb(
    "Schizonepeta",
    "jīng jiè",
    "荆芥",
    "Fu writes 芥穗 (jiè suì), the spike, in Dingjing Tang. It is in the list he sums up as coursing and replenishing, not as a formula that forces the flow through.",
    "fu-nvke",
  ),
  herb(
    "Bupleurum root",
    "chái hú",
    "柴胡",
    "The Liver-coursing item in Dingjing Tang. Fu’s chapter treats irregular timing as Liver qi bound, with the kidney bound because the Liver is its child.",
    "fu-nvke",
  ),
]

const FU_XUANYU: readonly TcmHerb[] = [
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Fu says 宣郁通经汤 (xuān yù tōng jīng tāng) replenishes Liver Blood while it releases the Liver’s constraint. White peony is on that Blood side.",
    "fu-nvke",
  ),
  herb(
    "Chinese angelica root",
    "dāng guī",
    "当归",
    "With white peony, the Blood-replenishing pair in Xuanyu Tongjing Tang, for pain before the flow that Fu reads as Liver fire failing to transform.",
    "fu-nvke",
  ),
  herb(
    "Tree peony root bark",
    "mǔ dān pí",
    "牡丹皮",
    "Fu writes 丹皮 (dān pí). In this formula it is part of bringing Liver fire down. He warns that draining fire without releasing constraint leaves the root.",
    "fu-nvke",
  ),
  herb(
    "Gardenia fruit",
    "zhī zǐ",
    "栀子",
    "Fu writes 山栀子 (shān zhī zǐ). It stands with moutan, scutellaria, and curcuma on the fire-descending side of Xuanyu Tongjing Tang.",
    "fu-nvke",
  ),
  herb(
    "White mustard seed",
    "bái jiè zǐ",
    "白芥子",
    "In Xuanyu Tongjing Tang. Fu’s summary of the formula is that it replenishes Liver Blood, releases Liver constraint, courses Liver qi, and descends Liver fire. He does not give mustard seed a separate line.",
    "fu-nvke",
  ),
  herb(
    "Bupleurum root",
    "chái hú",
    "柴胡",
    "The coursing item in Xuanyu Tongjing Tang. The chapter’s pain starts, in Fu’s reading, because the menses want to move and the Liver does not answer.",
    "fu-nvke",
  ),
  herb(
    "Cyperus rhizome",
    "xiāng fù",
    "香附",
    "Fu lists it wine-prepared in Xuanyu Tongjing Tang, among the items that course Liver qi when the flow is still ahead and already painful.",
    "fu-nvke",
  ),
  herb(
    "Curcuma root",
    "yù jīn",
    "郁金",
    "Fu writes 川郁金 (chuān yù jīn). In this formula it belongs with the qi-coursing, fire-descending group for premenstrual pain with purple-black clots.",
    "fu-nvke",
  ),
  herb(
    "Scutellaria root",
    "huáng qín",
    "黄芩",
    "A fire-clearing item in Xuanyu Tongjing Tang. Fu’s picture is heat at an extreme, fire that does not transform, not the cold picture people expect from dark clots.",
    "fu-nvke",
  ),
  herb(
    "Licorice root",
    "gān cǎo",
    "甘草",
    "Fu writes 生甘草 (shēng gān cǎo) at the end of Xuanyu Tongjing Tang. It closes a formula aimed at Liver Blood, Liver constraint, Liver qi, and Liver fire together.",
    "fu-nvke",
  ),
]

const FU_TIAOGAN: readonly TcmHerb[] = [
  herb(
    "Chinese yam",
    "shān yào",
    "山药",
    "Fu leads 调肝汤 (tiáo gān tāng) with yam. He says the formula evens Liver qi, turns rebellious qi, and is the right shape for patterns after the flow, not only for lower-abdominal pain.",
    "fu-nvke",
  ),
  herb(
    "Donkey-hide gelatin",
    "ē jiāo",
    "阿胶",
    "In Tiaogan Tang, on the yin-Blood side. The chapter’s pain after the flow is, for Fu, dried-up kidney water failing to generate wood.",
    "fu-nvke",
  ),
  herb(
    "Chinese angelica root",
    "dāng guī",
    "当归",
    "With white peony, the Blood pair in Tiaogan Tang. The method is to course the Liver and to replenish the kidney at the same time.",
    "fu-nvke",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Wine-prepared in Tiaogan Tang. Fu’s aim is a Liver that is no longer overacting once kidney water is sufficient.",
    "fu-nvke",
  ),
  herb(
    "Cornus fruit",
    "shān zhū yú",
    "山茱萸",
    "Fu writes 山萸肉 (shān yú ròu) in Tiaogan Tang, a kidney-essence item for the water that should generate Liver wood.",
    "fu-nvke",
  ),
  herb(
    "Morinda root",
    "bā jǐ tiān",
    "巴戟天",
    "Fu writes 巴戟 (bā jǐ). In Tiaogan Tang it is the warming kidney item inside a formula whose main sentence is still coursing the Liver.",
    "fu-nvke",
  ),
  herb(
    "Licorice root",
    "gān cǎo",
    "甘草",
    "Closes Tiaogan Tang. Fu says the formula both turns rebellious qi and eases pain from constraint, and that its range is the postmenstrual stretch more broadly.",
    "fu-nvke",
  ),
]

const FU_WENQI: readonly TcmHerb[] = [
  herb(
    "White atractylodes",
    "bái zhú",
    "白术",
    "Fu calls white atractylodes the chief of 温脐化湿汤 (wēn qí huà shī tāng), for the qi of the waist and the navel, in a formula that disinhibits damp and warms cold in the Chong and Ren.",
    "fu-nvke",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Fu writes 白茯苓 (bái fú líng) in Wenqi Huashi Tang. The method of the chapter is to disinhibit damp and warm cold so the two vessels are no longer troubled by pathogenic qi.",
    "fu-nvke",
  ),
  herb(
    "Chinese yam",
    "shān yào",
    "山药",
    "Fu groups yam with hyacinth bean and lotus seed as what guards the Chong vessel, 冲脉 (chōng mài), in this cold-damp picture.",
    "fu-nvke",
  ),
  herb(
    "Morinda root",
    "bā jǐ tiān",
    "巴戟天",
    "Fu writes 巴戟肉 (bā jǐ ròu). With ginkgo he says it frees the Ren vessel, 任脉 (rèn mài), when cold-damp is what he thinks is quarreling in the lower abdomen before the flow.",
    "fu-nvke",
  ),
  herb(
    "White hyacinth bean",
    "bái biǎn dòu",
    "白扁豆",
    "Fu writes 扁豆 (biǎn dòu). Grouped with yam and lotus seed as guarding the Chong vessel while damp is disinhibited and cold is warmed.",
    "fu-nvke",
  ),
  herb(
    "Ginkgo seed",
    "bái guǒ",
    "白果",
    "Fu names ginkgo with morinda as freeing the Ren vessel in Wenqi Huashi Tang. That is his assignment for this pattern. It is not an instruction to use the seed.",
    "fu-nvke",
  ),
  herb(
    "Lotus seed",
    "lián zǐ",
    "莲子",
    "Fu writes 建莲子 (jiàn lián zǐ). With yam and hyacinth bean, he says it guards the Chong vessel in this formula.",
    "fu-nvke",
  ),
]

const FU_JIAWEI_SIWU: readonly TcmHerb[] = [
  herb(
    "Prepared rehmannia root",
    "shú dì huáng",
    "熟地黄",
    "One of the four substances Fu names inside 加味四物汤 (jiā wèi sì wù tāng). He says that four-substance core nourishes the yin-Blood of the spleen and stomach.",
    "fu-nvke",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "In the four-substance core, and again in Fu’s comment that bupleurum, white peony, and moutan vent wind-constraint in the Liver channel.",
    "fu-nvke",
  ),
  herb(
    "Chinese angelica root",
    "dāng guī",
    "当归",
    "The third of the four substances Fu lists for this formula, whose first aim is to replenish Blood in the Liver when wind-cold has shut the open pore of the menstrual days.",
    "fu-nvke",
  ),
  herb(
    "Sichuan lovage rhizome",
    "chuān xiōng",
    "川芎",
    "The fourth substance in Fu’s core for Jiawei Siwu Tang. The chapter’s method is to replenish Liver Blood, open constraint, and scatter wind.",
    "fu-nvke",
  ),
  herb(
    "White atractylodes",
    "bái zhú",
    "白术",
    "Fu groups atractylodes with licorice and corydalis as what eases the waist, the navel, and the abdominal pain, inside the same wind-and-Blood formula.",
    "fu-nvke",
  ),
  herb(
    "Tree peony root bark",
    "mǔ dān pí",
    "牡丹皮",
    "Fu writes 粉丹皮 (fěn dān pí). With bupleurum and white peony, he says it vents wind-constraint of the Liver channel.",
    "fu-nvke",
  ),
  herb(
    "Corydalis rhizome",
    "yán hú suǒ",
    "延胡索",
    "Fu writes 元胡 (yuán hú). He groups it with licorice and atractylodes for the abdominal pain of a flow that stops and starts.",
    "fu-nvke",
  ),
  herb(
    "Licorice root",
    "gān cǎo",
    "甘草",
    "With atractylodes and corydalis, in Fu’s comment, it eases the waist and navel and harmonizes the abdominal pain of this pattern.",
    "fu-nvke",
  ),
  herb(
    "Bupleurum root",
    "chái hú",
    "柴胡",
    "Fu names bupleurum with white peony and moutan as what vents the Liver channel’s wind-constraint when cold has struck during the open days of the flow.",
    "fu-nvke",
  ),
]

const FU_SHUNJING: readonly TcmHerb[] = [
  herb(
    "Chinese angelica root",
    "dāng guī",
    "当归",
    "In 顺经汤 (shùn jīng tāng). Fu says the formula replenishes the kidney and regulates the menses, and inside that uses items that lead Blood back to its channel.",
    "fu-nvke",
  ),
  herb(
    "Prepared rehmannia root",
    "shú dì huáng",
    "熟地黄",
    "The kidney-replenishing root in Shunjing Tang, for Blood that leaves upward a day or two before the flow, which he reads as Liver qi rebelling.",
    "fu-nvke",
  ),
  herb(
    "White peony root",
    "bái sháo",
    "白芍",
    "Wine-prepared in Shunjing Tang, on the Blood side of a formula that is also meant to settle rebellious qi.",
    "fu-nvke",
  ),
  herb(
    "Tree peony root bark",
    "mǔ dān pí",
    "牡丹皮",
    "Fu writes 丹皮 (dān pí) in Shunjing Tang. The chapter’s method is harmony of Blood that is also a settling of qi.",
    "fu-nvke",
  ),
  herb(
    "Poria",
    "fú líng",
    "茯苓",
    "Fu writes 白茯苓 (bái fú líng) in Shunjing Tang, inside the kidney-replenishing group he uses when Blood has run upward before the menses.",
    "fu-nvke",
  ),
  herb(
    "Sha shen root",
    "shā shēn",
    "沙参",
    "Fu writes 沙参 (shā shēn) without saying whether he means the northern or the southern root. In Shunjing Tang it belongs to the group he describes as leading Blood back while the kidney is replenished.",
    "fu-nvke",
  ),
  herb(
    "Schizonepeta",
    "jīng jiè",
    "荆芥",
    "Fu writes 黑芥穗 (hēi jiè suì), the charred spike, in Shunjing Tang. He treats the formula as one that leads Blood back to the channel so the Liver is no longer rebelling and kidney qi can follow.",
    "fu-nvke",
  ),
]

export const chineseEncyclopedia: readonly TcmChapter[] = [
  {
    id: "map",
    title: "How this calendar maps onto the four phases",
    entries: [
      {
        id: "marks-not-day-count",
        title: "The marks already named the phase",
        paragraphs: [
          "This lens reads a label the calendar has already chosen from bleeding and ovulation marks. It does not choose a season by counting days, and spotting never becomes a phase. Spotting is stored and left out of the phase. Unknown means there is not enough bleed history for that day, and no ovulation mark is in effect, so none of the four names applies.",
          "The four names are the modern teaching of 中医妇科学 (Zhōngyī fùkē xué): 行经期 (xíng jīng qī), 经后期 (jīng hòu qī), 经间期 (jīng jiān qī), and 经前期 (jīng qián qī). Outlines of that teaching illustrate them on a sample cycle of about twenty-eight days: the uterus draining and not storing while heavy yang turns toward yin; then the sea of Blood empty and gradually restored, the uterus storing and not draining, yin growing; then a brief intermenstrual window; then yang growing toward heavy yang. That sketch is a classroom picture. This calendar follows marks. What follows is a traditional reading, not a prescription and not a diagnosis. A formula belongs to a practitioner who can see the person.",
        ],
        sourceIds: ["tcm-gynecology-four"],
      },
      {
        id: "bleeding-wins",
        title: "Bleeding outranks the turn on the same day",
        paragraphs: [
          "A day with bleeding marked is 行经期 (xíng jīng qī) even when ovulation is also marked that day. The discharge outranks the turn. 经间期 (jīng jiān qī) is only a day marked ovulation on which bleeding is not marked.",
          "An ovulation mark that falls during the bleed still counts once the bleed stops. From the next day that is not a bleeding day, the reading is 经前期 (jīng qián qī), because that mark is already in effect. 经后期 (jīng hòu qī) is the stretch after a bleed only when no ovulation mark from that bleed onward has taken effect. If ovulation is never marked, the days after the bleed stay 经后期 until the next bleed.",
        ],
        sourceIds: ["tcm-gynecology-four"],
      },
      {
        id: "not-xia-seven",
        title: "夏桂成 (Xià Guìchéng) later counted seven stretches",
        paragraphs: [
          "Xia Guicheng later split the same round into seven clinical stretches: the menstrual phase; an early, a middle, and a late postmenstrual stretch; the intermenstrual ovulation phase; and an earlier and a later premenstrual half. His 调周法 (tiáo zhōu fǎ) treats them in sequence. Jiangsu’s health commission notes that older gynecology already spoke of a menstrual stretch, a postmenstrual stretch, and a premenstrual stretch, and that the intermenstrual phase was the piece he supplied. It entered the fifth edition of the national textbook in 1986 under the disease name 经间期出血 (jīng jiān qī chū xuè).",
          "This calendar cannot see those seven. It has no mark for an early postmenstrual stretch or a later premenstrual half. Until an ovulation mark, the long replenishing label stays 经后期 (jīng hòu qī). From the day after that mark until the next bleed, the label stays 经前期 (jīng qián qī).",
        ],
        sourceIds: ["jiangsu-xia-1986", "xia-handbook", "tcm-gynecology-four"],
      },
    ],
  },
  {
    id: "ground",
    title: "Writings underneath the four names",
    entries: [
      {
        id: "tian-gui",
        title: "天癸 (tiān guǐ) and the monthly tide",
        paragraphs: [
          "《素问·上古天真论》 (Sùwèn, Shànggǔ tiānzhēn lùn) times reproductive life in sevens. At two times seven, 天癸 (tiān guǐ) arrives, the Ren vessel, 任脉 (rèn mài), is open, the great Chong vessel is abundant, and the monthly matter descends on time, which is why there can be children. At seven times seven the Ren vessel is empty, the great Chong declines, tian gui is exhausted, and the earthly path is shut. The four phases of one cycle sit inside that longer tide. They do not replace it.",
          "Chen Ziming, 陈自明 (Chén Zìmíng), opens his menstrual section by quoting that passage and glossing it. Heaven, in his gloss, is heaven’s true qi descending. Gui is the water name. The Chong vessel is the sea of Blood, the Ren vessel governs the uterus, kidney qi is fully abundant, the two vessels flow, Blood gradually fills, and it descends when it should. A peaceful rhythm, he says, is about once in three ten-day spans, imaged on the moon as it fills and then wanes. Xia Guicheng’s 1998 articles point back to the same gloss, through 《女科经纶》 (Nǚkē jīng lún) citing Chen under the name 陈良甫 (Chén Liángfǔ).",
        ],
        sourceIds: ["neijing-suwen-tianzhen", "chen-liangfang", "xia-1998"],
      },
      {
        id: "blood-sea",
        title: "血海 (xuè hǎi), and the Liver that stores Blood",
        paragraphs: [
          "《灵枢·海论》 (Língshū, Hǎi lùn) says a person has a marrow sea, a blood sea, a qi sea, and a sea of food and water. In the same chapter the Chong vessel, 冲脉 (chōng mài), is the sea of the twelve channels. The chapter does not, in so many words, write “the Chong vessel is the blood sea.” Zhang Jiebin, 张介宾 (Zhāng Jièbīn), in the Leijing note on that line, says this is the blood sea: the vessel receives what the channels pour in, and essence and Blood are stored there. Chen Ziming’s gynecology uses the working sentence directly: the Chong is the blood sea, and the Ren governs the uterus, 任主胞胎 (rèn zhǔ bāo tāi).",
          "The Liver’s storing of Blood is the other half of the same picture, as later gynecology uses it. Fu Shan says the Liver belongs to wood and stores Blood. Zhang, describing where menstrual Blood comes from, says it is stored by the Liver. The Lingshu chapter names meeting places of the seas. This reading does not turn those places into points to use.",
        ],
        sourceIds: ["neijing-lingshu-hailun", "zhang-leijing-hailun", "chen-liangfang", "fu-nvke", "jingyue-furen-gui"],
      },
      {
        id: "chen-first",
        title: "陈自明 (Chén Zìmíng): gynecology begins with the menses",
        paragraphs: [
          "Chen’s menstrual section is the first gate of the book, under the claim that treating women begins by regulating the menses, 调经 (tiáo jīng). The mechanism he wants in place before any formula is the one in the Neijing line: kidney qi full, tian gui present, Chong and Ren flowing, Blood filling and then descending.",
          "He also keeps a monthly image. When the rhythm is peaceful it resembles the moon, full and then waning, about every thirty days. That image is older than the modern four-phase names. It is why a calendar of marks can be read in this tradition at all. It is not a license to invent a phase the marks do not have.",
        ],
        sourceIds: ["chen-liangfang", "neijing-suwen-tianzhen"],
      },
      {
        id: "jingyue-source-of-blood",
        title: "张介宾 (Zhāng Jièbīn): where the monthly Blood comes from",
        paragraphs: [
          "In 妇人规 (Fùrén guī), Zhang treats menstrual Blood as the refined part of food and water. It is harmonized in the five zang, spread through the six fu, and only then enters the vessels. He traces its coming: generated by the spleen, presided over by the heart, stored by the Liver, distributed by the lung, discharged by the kidney. In men, he says, that stream becomes essence. In women it rises as milk and descends to the blood sea to become the menses. If essence is unharmed, the emotions are even, and food and drink are suitable, yang generates and yin grows, and the vessels fill.",
          "What injures this, in his order, is the emotions first and overwork next. The Chong and Ren can also fail to keep their charge. His working emphasis, once illness is already there, is that deficiency is far more common than excess. The essentials he names are to support the spleen and stomach so Blood has a source, and to nourish kidney qi so Blood has a settled chamber. While the menses are actually moving, he warns strongly against cold medicines, and he says the same of food.",
        ],
        sourceIds: ["jingyue-furen-gui"],
      },
      {
        id: "danxi-yin-slow",
        title: "朱震亨 (Zhū Zhènhēng): yin is slow to finish",
        paragraphs: [
          "Zhu Danxi’s essay on yang often in surplus and yin often insufficient argues from heaven and earth, then from the body. Yang qi corresponds to qi, yin qi to Blood, and in his account qi is often more than enough while Blood is often not. Human yin, he says, waxes and wanes as the moon does. A boy’s essence arrives at sixteen and a girl’s menses at fourteen, and even then yin is only just ready, after milk and grain have finished it. He takes that as evidence that yin is hard to complete and easy to lose, and the essay’s practical lean is toward protecting yin rather than spending it.",
          "That is not yet the modern postmenstrual phase. It is one reason later teachers speak of 经后期 (jīng hòu qī) as a time when yin and Blood have to be allowed to return. In the menstrual chapter, Zhang treats Danxi’s line about early heat and late deficiency as only a rough map, and then qualifies it. The essay and the chapter are left side by side.",
        ],
        sourceIds: ["danxi-gezhi", "jingyue-furen-gui"],
      },
    ],
  },
  {
    id: "xing-jing-qi",
    title: "行经期 (xíng jīng qī)",
    entries: [
      {
        id: "heavy-yang-turns",
        title: "重阳转阴 (zhòng yáng zhuǎn yīn): the uterus drains",
        paragraphs: [
          "In the four-phase teaching, 行经期 (xíng jīng qī) is the stretch in which the uterus drains and does not store, 泻而不藏 (xiè ér bù cáng), and lets the menses out. The outline calls the character of the stretch 重阳转阴 (zhòng yáng zhuǎn yīn). It is both the end of one cycle and the sign that another can start. On this calendar that teaching applies to bleeding days, including a bleeding day that also carries an ovulation mark.",
          "Xia Guicheng describes the same turn as 重阳必阴 (zhòng yáng bì yīn): yang has grown to a physiological limit, and if it does not turn, by leaving with the menses, the balance tips into disease. The uterus opens and drains. The Chong and Ren move and pass. Heart and Liver have to stir for that movement to happen. Old Blood leaves, and the yang that had stood too high leaves with it, so yin has room to grow. He divides bleeding days, in clinic, into a beginning, a middle, and an end, and near the end he shifts the weight toward generating the new. He is fond of the warning that stasis left behind interferes with what should be newly made. This calendar does not split one bleeding day into those three. A bleeding mark is 行经期 for that whole day.",
        ],
        sourceIds: ["tcm-gynecology-four", "xia-1998"],
      },
      {
        id: "five-ingredient-decoction",
        title: "Herbs Xia ties to the old Blood leaving",
        paragraphs: [
          "For the ordinary work of 行经期 (xíng jīng qī), the 1998 articles say Xia composed a five-ingredient decoction, 五味调经汤 (wǔ wèi tiáo jīng tāng): salvia, red peony, trogopterus dung, mugwort leaf, and leonurus. The aim he states is to quicken Blood and regulate the menses, with the weight on dispelling stasis, so what is old can leave and what is new can form. He says he often joined it to 越鞠丸 (Yuèjū wán). This library does not list that pill’s ingredients. They were not re-read from Zhu Danxi for this entry.",
          "The same articles say a little yang support may be added so the turn has something behind it, and that damp-turbidity has to leave as well. As milder examples he names dipsacus, poria, coix seed, and lycopus. A published summary of his handbook prints a powder under the five-ingredient name whose list is the original five plus dipsacus, poria, and lycopus, and whose method line is to quicken Blood, transform stasis, disinhibit damp, and discharge turbidity. He also describes stronger drainers and stasis-breakers for heavier cases. Those longer lists are omitted here. The scan was not clean enough to itemize, and several of them are named only as a class. None of this is an instruction. A formula belongs to a practitioner who can see the person.",
        ],
        herbs: XIA_MENSTRUAL_FIVE,
        sourceIds: ["xia-1998", "xia-handbook"],
      },
      {
        id: "zhang-cold-during-flow",
        title: "张介宾 (Zhāng Jièbīn) on cold while the flow is moving",
        paragraphs: [
          "Zhang’s menstrual chapter ends the general discussion with a hard caution: while the menses are in progress, cold medicines are greatly to be avoided, and cold food with them. The caution matches the phase’s open passage. Cold, in this sentence, is what he does not want shutting a discharge that is supposed to move.",
          "The sentence is about the days the flow is actually moving, which this calendar calls 行经期 (xíng jīng qī). It is not a finding that any particular bleeding day is a cold pattern. Fu Shan and Zhu Danxi disagree with each other about when a dark flow is cold and when it is heat. Zhang’s caution does not settle that argument.",
        ],
        sourceIds: ["jingyue-furen-gui"],
      },
    ],
  },
  {
    id: "jing-hou-qi",
    title: "经后期 (jīng hòu qī)",
    entries: [
      {
        id: "yin-fills",
        title: "阴长 (yīn zhǎng): the sea fills again",
        paragraphs: [
          "经后期 (jīng hòu qī) in the four-phase teaching runs from the end of bleeding up to the intermenstrual turn. The blood sea is empty and gradually restored. The uterus stores and does not drain, 藏而不泻 (cáng ér bù xiè). What grows is yin: kidney water, 天癸 (tiān guǐ), yin-essence, and Blood, toward the height called 重阴 (zhòng yīn). On this calendar those are the days after a finished bleed when no ovulation mark has yet taken effect. If that mark never comes, the stretch simply continues until the next bleed.",
          "Xia’s account of why the replenishing matters is twofold. Yin growing inside tian gui is what nourishes the essence that has to mature, and it is what fills the blood sea again after the lining has been shed, so there is something there for a later discharge or for a pregnancy. The 2016 account of his method says the phase is when kidney yin and tian gui grow, and that this growth lays the material base of the menses. The treatment line they report is to nourish yin and Blood, and to assist with yang.",
        ],
        sourceIds: ["tcm-gynecology-four", "xia-1998", "xia-qian-lu-2016"],
      },
      {
        id: "quiet-generates-water",
        title: "静能生水 (jìng néng shēng shuǐ)",
        paragraphs: [
          "The 2016 account adds a condition Xia insists on during 经后期 (jīng hòu qī): quiet can generate water, and the heart should be calm. The quiet they describe is especially the quiet of the heart. Yin-essence and the water of tian gui, in that telling, grow when the heart is settled, and they are spent when the heart is restless. Early in the postmenstrual stretch the movement of yin is still almost still, so rest is the main gesture. In the middle, a little yang is added and there is movement inside the quiet. Near the turn, yin and yang are regulated together.",
          "Those three inner stretches are Xia’s clinic, not three labels on this calendar. A day after the bleed with no ovulation mark in effect is simply 经后期, whether it feels still, dry, or already full. The paper’s herb examples for the middle stretch are not itemized here. The list below is the one printed in the handbook summary, which was read as a complete list.",
        ],
        sourceIds: ["xia-qian-lu-2016"],
      },
      {
        id: "gui-shao-dihuang",
        title: "Herbs in the handbook’s postmenstrual formula",
        paragraphs: [
          "The handbook summary’s postmenstrual method is 滋阴养血 (zī yīn yǎng xuè), nourish yin and nourish Blood. The picture it attaches is the sea of Blood empty, with the yin aspect not yet enough. The formula it prints is 归芍地黄汤 (guī sháo dì huáng tāng), in a list that includes both peonies, raw rehmannia, cornus, yam, moutan, poria, achyranthes, and taxillus.",
          "This is a clinical formula for a practitioner’s visit, not a measure of the calendar. A long or short 经后期 (jīng hòu qī) shows only that the bleed has ended and that ovulation has not been marked. It does not show that yin is deficient. A formula belongs to a practitioner who can see the person.",
        ],
        herbs: XIA_POSTMENSTRUAL,
        sourceIds: ["xia-handbook"],
      },
    ],
  },
  {
    id: "jing-jian-qi",
    title: "经间期 (jīng jiān qī)",
    entries: [
      {
        id: "one-marked-day",
        title: "重阴转阳 (zhòng yīn zhuǎn yáng), on one marked day",
        paragraphs: [
          "经间期 (jīng jiān qī) is the name the modern textbook gives the brief middle of the cycle. Outlines also call it 氤氲之时 (yīn yūn zhī shí), 的候 (dí hòu), and 真机 (zhēn jī). Yin has reached its height and turns toward yang. Yang stirs while yin is still abundant. The teaching often speaks of a day or two, and of clear threadlike fluid, and it treats the moment as the traditional timing for conceiving. Xia’s phrase for the same turn is 重阴必阳 (zhòng yīn bì yáng): through a dense, mixing movement of qi and Blood, the essence is released.",
          "This calendar is narrower than that window. 经间期 is only the day ovulation is marked and bleeding is not. The days before that mark, after a bleed, stay 经后期 (jīng hòu qī). The days after it are 经前期 (jīng qián qī). A feeling without a mark does not add the phase. A mark without the feeling does not erase it. The mark is a judgment the person recorded. It does not prove that kidney yang completed the change.",
        ],
        sourceIds: ["tcm-gynecology-four", "xia-handbook", "jiangsu-xia-1986"],
      },
      {
        id: "bu-shen-cu-pai",
        title: "Herbs in the handbook’s intermenstrual formula",
        paragraphs: [
          "The handbook summary’s intermenstrual picture is the middle of the cycle, more discharge, clear and threadlike, and the turn 重阴转阳 (zhòng yīn zhuǎn yáng), with or without an added pattern. The method line is to quicken Blood, free the network vessels, and regulate kidney yin and yang. The formula it prints is 补肾促排卵汤 (bǔ shèn cù pái luǎn tāng).",
          "Xia’s seven-count sometimes gives this stir several days. This lens will not stretch one marked day into that course. The herbs are what the summary associates with the turn. They are not a method for producing a mark that was never set. A formula belongs to a practitioner who can see the person.",
        ],
        herbs: XIA_INTERMENSTRUAL,
        sourceIds: ["xia-handbook"],
      },
    ],
  },
  {
    id: "jing-qian-qi",
    title: "经前期 (jīng qián qī)",
    entries: [
      {
        id: "yang-grows",
        title: "阳长 (yáng zhǎng) while the vessels are full and still closed",
        paragraphs: [
          "经前期 (jīng qián qī) in the four-phase teaching follows the intermenstrual turn. Yin is abundant and yang is generated, moving toward 重阳 (zhòng yáng), the high point of yang in the cycle’s waxing and waning. The outline says yin and yang are both abundant then, in preparation either for a pregnancy or for the next discharge. If a pregnancy holds, essence and Blood gather to it and the menses stop. If not, the old gives way to the new: the blood sea goes from full to overflowing, and that overflow is the next 行经期 (xíng jīng qī).",
          "On this calendar the phase starts the day after an ovulation mark and lasts until the next bleeding mark. Xia’s seven-count splits it. In the earlier half, yang grows and yin recedes, warming the uterus, and the method is to supplement the kidney and assist yang, seeking yang within yin, within Blood, and within qi. In the later half, heavy yang is simply maintained. The Chong and Ren are relatively full, and heart and Liver qi-fire tend to run strong. He wants yang still assisted, and qi coursed, for two reasons: so Blood will be free to move when the discharge opens, and so the premenstrual bind of heart and Liver has somewhere to go. 重阳转阴 (zhòng yáng zhuǎn yīn) itself waits for the bleed. This calendar has no separate label for that later half.",
        ],
        sourceIds: ["tcm-gynecology-four", "xia-handbook"],
      },
      {
        id: "wen-tu-yu-lin",
        title: "Herbs in the handbook’s premenstrual formula",
        paragraphs: [
          "Under the single heading 经前期 (jīng qián qī), the handbook summary prints 温土毓麟汤 (wēn tǔ yù lín tāng). The method line is to supplement the kidney and assist yang. The symptom line is: after the turn, discharge lessens and the body’s warmth sits higher; if spleen and kidney yang are insufficient the limbs are not warm; if heart and Liver qi-fire are mixed in, there is fullness in the chest and distending pain in the breasts.",
          "The seven-phase prose asks for qi to be coursed in the later premenstrual half. The formula this summary actually prints is the warming one, and its only clearly qi-moving item is aged tangerine peel, together with amomum and medicated leaven at the middle burner. A separate qi formula for that later half is not itemized here, because this summary does not print one. Breast distention and a short temper, on a luteal day, remain 经前期. They do not prove a pattern, and they do not open the Chong and Ren early. A formula belongs to a practitioner who can see the person.",
        ],
        herbs: XIA_PREMENSTRUAL,
        sourceIds: ["xia-handbook"],
      },
    ],
  },
  {
    id: "patterns",
    title: "Patterns the sources discuss inside a phase",
    entries: [
      {
        id: "label-is-not-a-pattern",
        title: "A phase label is not yet a pattern",
        paragraphs: [
          "行经期 (xíng jīng qī), 经后期 (jīng hòu qī), 经间期 (jīng jiān qī), and 经前期 (jīng qián qī) are timings. 血瘀 (xuè yū), 血寒 (xuè hán), 肝郁 (gān yù), and 肾阴 (shèn yīn) vacancy are patterns. Fu Shan’s chapters exist because the same timing can hide opposite patterns: early and heavy is not the same illness as early and scant; dark clots before the flow are heat in one chapter and cold-damp in another. Zhu Danxi and Zhang Jiebin spend their menstrual essays on the same warning. A calendar mark cannot see the tongue, the pulse, or the person.",
          "The herbs below stay under the pattern the source attached them to. They are materia medica in a book, which is what that book used them for. A formula belongs to a practitioner who can see the person.",
        ],
        sourceIds: ["fu-nvke", "danxi-gezhi", "jingyue-furen-gui"],
      },
      {
        id: "early-copious",
        title: "Early and copious: water and fire both abundant",
        paragraphs: [
          "In 经水先期 (jīng shuǐ xiān qī), Fu Shan refuses the common label of extreme Blood heat for menses that come early and heavily. He reads kidney water and kidney fire both too abundant. Fire makes the Blood hot. Water makes the amount large. He calls it a surplus, not a deficiency. He still does not want the fire left in surplus, because the uterus is then too hot, and he refuses to drain the water while clearing the fire.",
          "清经散 (qīng jīng sǎn) is his formula for that narrow aim. His comment is that although the formula clears fire, its taste is still the taste of replenishing water: fire leaves and water does not leave with it. Timing that runs early is not, by itself, this pattern. The calendar’s 经前期 (jīng qián qī) or 行经期 (xíng jīng qī) does not know whether water and fire are both abundant.",
        ],
        herbs: FU_QINGJING,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "early-scant",
        title: "Early and scant: fire with thin yin-water",
        paragraphs: [
          "The same chapter gives the opposite early arrival. If the menses come early and the amount is only a drop or two, Fu says people again call it extreme Blood heat, and again he disagrees. This one is fire abundant and yin-water insufficient. Earliness, for him, is the sign of fire. The amount is the sign of water. Treating every early period as surplus heat, and draining fire without replenishing water, or draining both, makes the illness worse.",
          "两地汤 (liǎng dì tāng) is built to replenish water so the fire settles. He says lycium root bark and raw rehmannia clear heat in the bone, that this bone heat comes from the kidney channel, and that the clearing does not damage stomach qi. The rest of the formula, in his words, is entirely a water-replenishing group. He tells the reader to set the two early-period pictures side by side. A short cycle on a calendar is neither picture until someone can tell copious from scant and see the person.",
        ],
        herbs: FU_LIANGDI,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "late-and-cold",
        title: "A late period, read as cold",
        paragraphs: [
          "In 经水后期 (jīng shuǐ hòu qī), Fu rejects a single label of Blood deficiency for a late period. A late period that is scant is cold with insufficiency. A late period that is copious is cold with surplus. The menses are rooted in the kidney, and once the flow starts, the Blood of the organs comes to join it because the gate is open and does not shut again at once. After that Blood has left, a deficiency has been created even if the picture began in surplus. He will not let “late” mean “always deficient.”",
          "温经摄血汤 (wēn jīng shè xuè tāng) is meant to replenish and to warm-disperse together. He says cinnamon bark is there to dispel cold and bupleurum to release constraint, and that the formula replenishes essence and Blood of the Liver, the kidney, and the spleen. A long 经后期 (jīng hòu qī) on this calendar means ovulation was not marked. It is not Fu’s diagnosis of cold.",
        ],
        herbs: FU_WENJING,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "liver-timing",
        title: "Timing that will not settle: bound 肝气 (gān qì)",
        paragraphs: [
          "经水先后无定期 (jīng shuǐ xiān hòu wú dìng qī) is Fu’s chapter on menses that stop and start, or come sometimes early and sometimes late. People call that qi and Blood deficiency. He reads bound Liver qi. The menses come out of the kidney, and the Liver is the kidney’s child, so a bound Liver binds the kidney. Kidney qi then fails to spread. The timing’s opening and closing is the kidney’s opening and closing. Course the Liver’s bind and the kidney’s bind opens with it.",
          "定经汤 (dìng jīng tāng) is the formula. He is explicit that it courses Liver and kidney qi and is not a menses-forcing medicine, and that it replenishes Liver and kidney essence and is not a damp-draining medicine. When Liver and kidney qi are coursing, essence gets through; when their essence is abundant, water moves. A cycle that varies is not this pattern on the strength of the dates alone.",
        ],
        herbs: FU_DINGJING,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "pain-before-fire",
        title: "Pain before the flow, with dark clots: Fu’s fire reading",
        paragraphs: [
          "经水未来腹先疼 (jīng shuǐ wèi lái fù xiān téng) describes several days of abdominal pain before the menses, which then arrive as purple-black clots. The common reading is extreme cold. Fu reads extreme heat, fire that does not transform. The Liver belongs to wood and has fire in it. When it courses, there is free passage. When it is bound, it does not lift. The menses want to move and the Liver does not answer, so qi is thwarted and pain starts. The sea is already full and cannot keep storing. Liver fire flares inward and drives the menses out, and the fire discharges in that anger. Purple-black, in this chapter, is water and fire fighting. Clots are fire boiling Blood into a shape.",
          "宣郁通经汤 (xuān yù tōng jīng tāng) is meant to replenish Liver Blood, release the Liver’s constraint, course Liver qi, and bring Liver fire down. He says that draining the fire without releasing the constraint removes the branch and leaves the root. This is a 经前期 (jīng qián qī) kind of timing, pain while the discharge has not yet opened. It is one master’s reading of one picture. The next entries are the readings that disagree.",
        ],
        herbs: FU_XUANYU,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "danxi-color",
        title: "朱丹溪 (Zhū Dānxī) on purple, black, clots, and pain",
        paragraphs: [
          "Danxi’s essay on menses that are purple or black says the menses are yin Blood, and that Blood follows qi. Qi hot, and the Blood is hot. Qi cold, and it is cold. Qi congeals, and the Blood congeals. Qi stagnates, and it stagnates. Clots, in this essay, are qi congealing. Pain as the flow is about to start is qi stagnating. Pain after the flow has come is qi and Blood both weak. A pale color is also weakness. Blood leaving along the wrong path is qi in disorder. Purple is heat in the qi. Black is that heat gone further.",
          "He says physicians who see purple, black, pain, or clots and call the picture wind-cold, then warm it, do harm quickly. He blames the habit on 《病源》 (Bìng yuán), which explains menstrual disorders as wind-cold taking advantage. Someone objects that black is the color of water in the north, so it must be cold. He answers with the Neijing rule that when a qi overreaches it does harm, and the qi that follows it restrains it: extreme heat takes on the signs of water. Heat, then purple; heat at an extreme, then black. This essay names no formula. It is included because it is the classical argument against reading every dark clot as cold.",
        ],
        sourceIds: ["danxi-gezhi"],
      },
      {
        id: "cold-damp-chong-ren",
        title: "Knife-like pain and a black discharge: Fu’s cold-damp reading",
        paragraphs: [
          "A different chapter, 经水将来脐下先疼痛 (jīng shuǐ jiāng lái qí xià xiān téng tòng), is easy to confuse with the fire chapter and with Danxi. Here the pain is three to five days before the flow, below the navel, like a knife. There may be alternating chills and fever. What comes away resembles the juice of black beans. Everyone, Fu says, calls this extreme Blood heat. He reads cold and damp, pathogenic qi, fighting in the lower burner. The Chong vessel is the blood sea and the Ren vessel governs the uterus. Both want upright qi through them and are vulnerable to pathogenic qi. Cold generates turbidity. The black color, in this chapter, is the image of cold water in the north.",
          "温脐化湿汤 (wēn qí huà shī tāng) is meant to disinhibit the damp and warm the cold so the Chong and Ren are no longer in that quarrel. He warns that if this picture is mistaken for heat and attacked with cold medicines, the blood sea becomes a sea of ice and the blood chamber an ice room. Set beside Danxi, the two masters use the color black for opposite conclusions, and they are not describing identical illnesses. Fu’s knife-like pain, chill, and black-bean discharge is not Danxi’s general claim about purple and black menses. A calendar cannot choose between them. A formula belongs to a practitioner who can see the person.",
        ],
        herbs: FU_WENQI,
        sourceIds: ["fu-nvke", "danxi-gezhi"],
      },
      {
        id: "pain-after",
        title: "Pain after the flow: kidney water and the Liver",
        paragraphs: [
          "行经后少腹疼痛 (xíng jīng hòu shào fù téng tòng) is pain in the lower abdomen after the menses have come. People call it qi and Blood deficiency. Fu reads dried-up kidney qi. Menstrual water, he says, is the true water of heaven: when it is full it overflows, and when it is empty it closes. Emptiness should not be painful. It becomes painful, in this chapter, because kidney water fails to generate wood, Liver wood then overacts on spleen earth, wood and earth quarrel, and qi rebels.",
          "调肝汤 (tiáo gān tāng) is meant to course the Liver first and to add kidney-replenishing items, so water is sufficient, Liver qi settles, and rebellious qi follows. He says the formula is suited to postmenstrual patterns more broadly, not only to this pain. On this calendar, pain on days after a bleed, with no ovulation mark in effect, falls in 经后期 (jīng hòu qī). The phase label does not establish dried-up kidney water.",
        ],
        herbs: FU_TIAOGAN,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "wind-at-open-pore",
        title: "The flow stops and starts: wind-cold at an open pore",
        paragraphs: [
          "经水忽来忽断，时疼时止 (jīng shuǐ hū lái hū duàn, shí téng shí zhǐ) is a discharge that suddenly comes and stops, with pain that comes and goes, and alternating chills and fever. People call it congealed Blood. Fu reads Liver qi failing to course. The Liver belongs to wood and stores Blood, and it particularly dislikes wind and cold. During the menses the interstices are wide open. If wind blows and cold strikes, Liver qi shuts, and the road of the menses shuts with it. Qi in the yang aspect produces heat. Qi in the yin aspect produces cold. He says a deeper strike can become heat entering the blood chamber. The milder picture is only the coming and going of chills and fever.",
          "加味四物汤 (jiā wèi sì wù tāng) is meant to replenish Blood in the Liver, open the constraint, and scatter the wind. He invokes the older rule of treating wind by first treating Blood: when Blood is harmonious, wind dies down. The four-substance core he names is prepared rehmannia, white peony, angelica, and Sichuan lovage, there to nourish the yin-Blood of the spleen and stomach. This pattern sits inside 行经期 (xíng jīng qī), because it is about the days the flow is trying to move. A stop-and-start bleed on the calendar is still the menstrual phase. It is not yet this wind-cold reading.",
        ],
        herbs: FU_JIAWEI_SIWU,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "blood-upward",
        title: "Blood leaving upward just before the flow",
        paragraphs: [
          "经前腹疼吐血 (jīng qián fù téng tù xuè) is abdominal pain and vomiting of Blood a day or two before the menses. People call it fire at an extreme. Fu reads Liver qi rebelling. The Liver’s nature is urgent. It should go onward. Against its grain, qi moves, and Blood follows qi. He considers whether the reversal is a failure of the Liver to store Blood or of the kidney to receive qi, and he lands on ministerial fire rushing up with Liver fire. The Blood of the coming menses is driven the wrong way.",
          "顺经汤 (shùn jīng tāng) works inside a kidney-replenishing group and leads Blood back to the channel. He says the method of harmonizing Blood is, here, also a method of settling qi. When the Liver is no longer rebelling, kidney qi follows, and the menses are no longer reversed. He adds that this kind of vomiting of Blood in a robust woman should not be treated as a consumption illness, or the Liver qi will rebel further. The timing is 经前期 (jīng qián qī). The symptom is not something a phase label contains.",
        ],
        herbs: FU_SHUNJING,
        sourceIds: ["fu-nvke"],
      },
      {
        id: "chen-cold-binds",
        title: "陈自明 (Chén Zìmíng): cold binds Blood, warmth scatters it",
        paragraphs: [
          "Chen’s essay on the monthly water failing to keep its rhythm traces the trouble to overwork damaging qi and Blood, an empty body, and wind-cold taking the chance. Wind-cold lodges in the uterus and injures the Chong and Ren. He says both vessels start in the uterus and are the sea of the channels. The monthly water is the surplus of the channels. When cold and heat are in harmony, Chong and Ren qi are abundant and Blood descends on time. When they are not, the vessels are empty, wind-cold occupies them, and pathogenic qi grapples with Blood. Cold binds Blood. Warmth scatters it. The amount is then sometimes more and sometimes less.",
          "A formula discussed in that chapter compares yin overcoming yang with a cold uterus in which Blood does not move, like water freezing, so the menses are scant and late, and yang overcoming yin with Blood spilling, like water boiling over, so the menses are copious and early. The ingredient list of that formula was not re-read, so it is not itemized. Chen’s cold-binds account is the Song-dynasty picture Fu and Danxi are both still arguing with centuries later. It is a pattern inside the cycle, not a phase the calendar can assign by itself.",
        ],
        sourceIds: ["chen-liangfang"],
      },
      {
        id: "jingyue-qualifies",
        title: "张介宾 (Zhāng Jièbīn) qualifies the early-heat, late-deficiency sketch",
        paragraphs: [
          "Zhang records Danxi’s sketch: what comes early is Blood heat, and what comes late is Blood deficiency. He also records Wang Ziheng, 王子亨 (Wáng Zǐhēng): when yang is in great surplus the period comes early, and when yin does not reach the period comes late. Amounts that jump, a flow that stops, and flooding that will not stop are, on that sketch, prosperity and decline of yin and yang. Zhang says this is only the rough map.",
          "His qualifications are the part that matters for this lens. An early period may involve fire, but if deficiency is holding that fire, the weight is on the deficiency, and the work is to nourish the nutritive and settle Blood. Some early periods have no fire at all, and then he would support the qi of the middle or secure the life gate, and he does not want cold overused. A late period generally belongs to Blood deficiency, yet some late periods are heat with dry stasis and need a cool replenishment, and some are Blood moving backward and lodging and need to be coursed. Clearing and disinhibiting wait, in his account, on a person whose form and pulse are both in surplus. Deficiency, he says, is extremely common and excess extremely rare. Dates on a calendar are the rough map he says is not enough.",
        ],
        sourceIds: ["jingyue-furen-gui"],
      },
      {
        id: "several-months",
        title: "A rhythm of several months is not automatically an illness",
        paragraphs: [
          "Fu’s chapter 经水数月一行 (jīng shuǐ shù yuè yī xíng) describes someone whose menses come every few months, regularly, without swinging early and late or much and little. Observers call it strange. He says it may not be an illness at all. Qi and Blood are not both damaged. Some people, in his account, are built to a seasonal rhythm rather than a monthly filling and emptying, and treating them as deficient creates a disease that was not there. He also says plenty of people have damaged that rhythm by desire, and those people are a different discussion.",
          "On this calendar a long gap after a bleed, with no ovulation mark, remains 经后期 (jīng hòu qī) until the next bleed or until an ovulation mark is set. That label is the postmenstrual phase. It is not Fu’s judgment that the person is constitutionally seasonal, and it is not his judgment that the person is depleted. The formula he offers for the depleted case is omitted here so that a warning against needless treatment does not turn into a second treatment.",
        ],
        sourceIds: ["fu-nvke"],
      },
    ],
  },
  {
    id: "unnamed",
    title: "When the marks name no phase",
    entries: [
      {
        id: "no-fifth-season",
        title: "Unknown is not a fifth season",
        paragraphs: [
          "If this day has no finished bleed behind it, and no ovulation mark in effect, the lens stops. It does not borrow 行经期 (xíng jīng qī), 经后期 (jīng hòu qī), 经间期 (jīng jiān qī), or 经前期 (jīng qián qī) to fill the gap. Sensations can be real on an unnamed day. They are not a history of bleeding, and they are not a recorded turn.",
          "The pattern names in the previous chapter, stasis, cold, bound Liver qi, vacant yin, are judgments about a person. They are not what silence on a calendar means. A formula belongs to a practitioner who can see the person.",
        ],
        sourceIds: ["tcm-gynecology-four", "fu-nvke"],
      },
      {
        id: "after-seven-sevens",
        title: "Bleeding after 天癸 (tiān guǐ) is exhausted",
        paragraphs: [
          "The Neijing line at seven times seven is that the Ren vessel is empty, the great Chong has declined, tian gui is exhausted, and the earthly path no longer passes. Fu’s chapter on the menses returning in old age says that a flow at fifty, or at sixty and seventy, is not youth coming back. Tian gui is already exhausted. What looks like a period is, in his reading, the approach of a flood: either the fire of the life gate has been stirred, or constraint has flared, and the Liver is failing to store while the spleen is failing to contain.",
          "This lens has no phase for that chapter. If the calendar has no current bleed history and no ovulation mark in effect, the day stays unnamed. It is not assigned to 行经期 (xíng jīng qī) in order to make an old bleeding look like a cycle. The formula Fu prints for that chapter is omitted here. It is a practitioner’s formula for a person, and it is outside the four phases these marks can support.",
        ],
        sourceIds: ["neijing-suwen-tianzhen", "fu-nvke"],
      },
    ],
  },
]
