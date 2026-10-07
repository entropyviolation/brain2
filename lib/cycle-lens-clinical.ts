/**
 * lib/cycle-lens-clinical.ts — Clinical lens for the cycle popup
 *
 * `clinicalLensSections` is the short reading for a phase `phaseForDate`
 * already derived from bleed and ovulation marks. Spotting is not a phase.
 * `clinicalReference` is the longer library behind that reading. Education,
 * not a diagnosis, not a fertility method, and not a prescription.
 */
import type { CyclePhase } from "@/lib/cycle-phase"

export const CLINICAL_EDUCATION_LINE: string =
  "This is education from your own bleed and ovulation marks, not a diagnosis or a fertility guarantee. Where ovulation was not marked, this calendar does not know it, and a day labeled estimated elsewhere is a guess, not a mark."

export type LensSectionId = "physiology" | "typical" | "worth-doing" | "worth-not-doing"

export type LensSection = {
  id: LensSectionId
  title: string
  paragraphs: readonly string[]
}

const SECTION_TITLES: Record<LensSectionId, string> = {
  physiology: "Physiology",
  typical: "What's typical",
  "worth-doing": "Worth doing",
  "worth-not-doing": "Worth not doing",
}

function lensSection(id: LensSectionId, paragraphs: readonly string[]): LensSection {
  return { id, title: SECTION_TITLES[id], paragraphs }
}

export const clinicalLensSections: Record<CyclePhase, readonly LensSection[]> = {
  menstrual: [
    lensSection("physiology", [
      "In an ovulatory cycle, menstruation is the functional layer of the endometrium leaving after estradiol and progesterone fall. Without a pregnancy, the corpus luteum is not maintained, and the lining loses that support. Spiral arterioles constrict, the tissue becomes ischemic, and local prostaglandins help it break down. The functional layer sloughs with blood and fluid. The basal layer stays. By the ordinary count, the first day of menstrual flow is cycle day 1. A spotting mark is not that day.",
      "In that ovulatory cycle, follicle-stimulating hormone rose before the bleed, so a new cohort of follicles is already being recruited while the lining leaves. The calendar still calls every bleeding day menstrual, and bleeding wins over an ovulation mark on the same day. Bleeding days that touch are one menses. Spotting does not join them. With no ovulation mark before it, the bleed may follow a corpus luteum, or it may come from a cycle with none, often when estradiol falls and progesterone never stabilized the lining. The mark does not say which.",
    ]),
    lensSection("typical", [
      "Cramping is common because prostaglandins make the uterine muscle contract, and the pelvis may ache. Flow is often heavier in the first half and lighter toward the end. When flow is brisk, blood can clot in the uterus or vagina before it leaves. That can be ordinary on a heavy day. Energy often narrows, and sleep may be lighter. Some people feel a clearing as the late-luteal drop finishes. Others feel flat or tender for a day or two. Those are ordinary shapes of a bleed. They are not a diagnosis.",
    ]),
    lensSection("worth-doing", [
      "Treat the bleed as a physiological event with a cost. Warmth, rest scaled to the day, and meals that replace iron when flow is substantial are plain care. A short walk often eases cramping. Mark the days you are actually bleeding. Those marks are how a luteal stretch ends, and how the days after the bleed get a phase.",
    ]),
    lensSection("worth-not-doing", [
      "One heavy day, or one light day, is not a verdict on the whole cycle. This label is not proof that you ovulated last time. The calendar knows the marks you set. It does not know a serum level, the thickness of a lining, or whether the next cycle will look like this one.",
      "Pain that is new, fainting, or bleeding that soaks through protection hour after hour belongs with a clinician. The word menstrual is not that conversation.",
    ]),
  ],
  follicular: [
    lensSection("physiology", [
      "These days are the gap after a bleed when no ovulation mark is in effect. It may be long or short, and it includes days still ahead. If you never mark ovulation, it runs up to the next bleed. An ovulation earlier than that bleed no longer counts. An ovulation marked during the bleed opens luteal days once that bleeding stops. If the bleed is still going, mark it. A day is menstrual only when you mark it bleeding.",
      "Follicle-stimulating hormone starts a cohort of follicles. Estradiol and inhibin B then hold follicle-stimulating hormone down, and usually one follicle becomes dominant. That follicle's estradiol, made by granulosa cells from theca-derived androgen, rises across the phase, rebuilds a proliferative endometrium, and often makes cervical fluid clearer and more slippery. Toward the end, high estradiol switches the hypothalamus and pituitary from holding luteinizing hormone back to releasing its surge. How long this takes is the variable part of a cycle. The interval after ovulation is the steadier one.",
    ]),
    lensSection("typical", [
      "Energy often widens as bleeding stops and estradiol climbs. For many people sleep and mood are steadiest here. That is a tendency, and a tired week is still follicular. Waking temperature, if you track it, usually sits lower than it will after ovulation. The label does not require these signs. It requires the marks.",
    ]),
    lensSection("worth-doing", [
      "Use the clearer days for work that needs range, and keep sleep and meals ordinary. If you already trust a way of noticing ovulation, mark the day you judge it has arrived. Until you do, the calendar stays follicular. An absent mark means you have not recorded ovulation. It is not a finding that ovulation failed.",
    ]),
    lensSection("worth-not-doing", [
      "Ovulation does not belong to a fixed cycle day. A missing mark is not proof that ovulation did not occur. Some cycles pass without ovulation, and some ovulations are simply unmarked. The calendar cannot tell those apart. A day labeled estimated elsewhere is a guess, not a mark.",
      "This is not a hormone assay, not an ultrasound, and not a statement that a day is fertile or infertile. What you do with that knowledge in a life that may or may not be trying to conceive is outside this label.",
    ]),
  ],
  ovulatory: [
    lensSection("physiology", [
      "A late-follicular peak of estradiol triggers a surge of luteinizing hormone. The surge resumes maturation of the oocyte. About a day to a day and a half after the surge begins, the dominant follicle ruptures and the oocyte is released. Estradiol is high, then falls briefly. A little progesterone is already rising with the surge, before rupture. After the follicle ruptures it becomes the corpus luteum, and progesterone rises in earnest. The event is short.",
      "The calendar keeps this phase to a day you marked ovulation, and only when that day is not also marked bleeding. If both are set, the day is menstrual. Spotting does not create the mark and does not erase it. Another day you mark is another ovulatory day. An unmarked day is not ovulatory, and a guess labeled estimated is not a mark.",
    ]),
    lensSection("typical", [
      "Some people notice a brief one-sided twinge, a peak and then a fall in slippery cervical fluid, or attention that feels brighter and more outward. If waking temperature rises, it does so over the following mornings, after ovulation, once progesterone has lifted the set-point. It is not a signal of the rupture itself. None of these signs is required. The mark is the whole of what this calendar calls ovulatory.",
    ]),
    lensSection("worth-doing", [
      "Set the mark on the day you take to be ovulation, by whatever method you already use, and let the days after it become luteal. If you are unsure, leave the mark off. With no ovulation mark in effect, the days after a bleed stay follicular. A guess does not turn them luteal.",
    ]),
    lensSection("worth-not-doing", [
      "This label is not a fertility guarantee, not guidance about conception, and not a prediction of the next cycle. A marked day is not a measured luteinizing hormone value and not a rupture seen on ultrasound. Whether that sequence happened in your body on this date is exactly as sure as the mark you chose, and no surer.",
    ]),
  ],
  luteal: [
    lensSection("physiology", [
      "The ruptured follicle is the corpus luteum. Progesterone is its main hormone, with a second, often smaller, rise of estradiol. Progesterone converts the proliferative lining into secretory endometrium, raises the waking-temperature set-point, quiets uterine muscle, and, with estradiol, holds the next ovulation off for this cycle. If a pregnancy does not maintain the corpus luteum, the corpus luteum fades. Bleeding then often arrives about 10 to 16 days after ovulation, most often near 12 to 14, as progesterone and estradiol fall.",
      "On this calendar, luteal days are the days after an ovulation mark that are not marked bleeding, until the next bleed. If you marked ovulation during a bleed, luteal starts once that bleeding stops. If no later bleed is marked, the days stay luteal, including days still ahead. Only a mark you set opens the phase. A guess labeled estimated does not. The length shown is the gap between your marks, not a progesterone level.",
    ]),
    lensSection("typical", [
      "The body is often warmer and a little slower. Progesterone can feel mildly sedating, and waking temperature sits higher by a few tenths of a degree Celsius. Breasts may feel fuller, and appetite often increases. Sleep may be heavier or more broken. Late, as the corpus luteum fades, the fall in progesterone and estradiol can bring irritability, sadness, bloating, or a sense of pressure. That late stretch is still luteal. Attention often narrows toward what is already underway.",
    ]),
    lensSection("worth-doing", [
      "Protect sleep, and keep meals steady so appetite does not swing from empty to overrun. These days suit finishing, editing, and looking after what earlier days opened. When bleeding begins, mark it. That mark is what ends the phase. A real bleed left unmarked leaves the calendar in luteal time.",
    ]),
    lensSection("worth-not-doing", [
      "A long luteal tail with no next bleed is not proof of pregnancy. A short one is not proof of a luteal defect. The calendar cannot see progesterone. It sees an ovulation mark that no later bleed has closed. Spotting on these days is kept, and it does not move the phase. A missed bleed, a short luteal interval, or pain is a question for a clinician. The word luteal does not answer it.",
    ]),
  ],
  unknown: [
    lensSection("physiology", [
      "This day is before your first bleeding mark, and no ovulation mark is in effect. The label means the record has no anchor yet. Spotting does not give it one.",
      "An ovulation mark still counts before any bleed. That day is ovulatory, and the days after it are luteal. The first day you mark bleeding is menstrual, and bleeding wins if that day is also marked ovulation.",
    ]),
    lensSection("typical", [
      "This label has no typical physical picture. It records a gap in the marks. It names no disorder, and it gives no reason for the gap.",
    ]),
    lensSection("worth-doing", [
      "Mark bleeding on the days it happens. If you already trust a way of noticing ovulation, mark that day when you judge it has arrived. A bleeding mark or an ovulation mark is what places a day. Until one of those places this day, it stays unknown.",
    ]),
    lensSection("worth-not-doing", [
      "Leave the gap empty until the marks support a phase. A day labeled estimated elsewhere is a guess, and it does not place this day. Unknown is not proof that ovulation failed. Pain that is new, fainting, or bleeding that soaks through protection hour after hour belongs with a clinician. This label is not that conversation.",
    ]),
  ],
}

export type ClinicalSource = {
  id: string
  citation: string
  href?: string
}

export type ClinicalTopic = {
  id: string
  title: string
  paragraphs: readonly string[]
  sourceIds: readonly string[]
}

export type ClinicalChapter = {
  id: string
  title: string
  topics: readonly ClinicalTopic[]
}

export const clinicalSources: readonly ClinicalSource[] = [
  {
    id: "who-1980",
    citation:
      "World Health Organization Task Force on Methods for the Determination of the Fertile Period. Temporal relationships between ovulation and defined changes in the concentration of plasma estradiol-17β, luteinizing hormone, follicle-stimulating hormone, and progesterone. I. Probit analysis. American Journal of Obstetrics and Gynecology. 1980;138(4):383-390.",
    href: "https://pubmed.ncbi.nlm.nih.gov/6775535/",
  },
  {
    id: "hoff-1983",
    citation:
      "Hoff JD, Quigley ME, Yen SSC. Hormonal dynamics at midcycle: a reevaluation. Journal of Clinical Endocrinology and Metabolism. 1983;57(4):792-796.",
    href: "https://pubmed.ncbi.nlm.nih.gov/6411753/",
  },
  {
    id: "fehring-2006",
    citation:
      "Fehring RJ, Schneider M, Raviele K. Variability in the phases of the menstrual cycle. Journal of Obstetric, Gynecologic, and Neonatal Nursing. 2006;35(3):376-384.",
    href: "https://pubmed.ncbi.nlm.nih.gov/16700687/",
  },
  {
    id: "lenton-1984",
    citation:
      "Lenton EA, Landgren BM, Sexton L. Normal variation in the length of the luteal phase of the menstrual cycle: identification of the short luteal phase. British Journal of Obstetrics and Gynaecology. 1984;91(7):685-689.",
    href: "https://doi.org/10.1111/j.1471-0528.1984.tb04831.x",
  },
  {
    id: "reed-2018",
    citation:
      "Reed BG, Carr BR. The normal menstrual cycle and the control of ovulation. Updated 2018 Aug 5. In: Feingold KR, Ahmed SF, Anawalt B, et al., editors. Endotext. South Dartmouth (MA): MDText.com.",
    href: "https://www.ncbi.nlm.nih.gov/books/NBK279054/",
  },
  {
    id: "baker-2020-temperature",
    citation:
      "Baker FC, Siboza F, Fuller A. Temperature regulation in women: effects of the menstrual cycle. Temperature. 2020;7(3):226-262.",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7575238/",
  },
  {
    id: "ecochard-2001",
    citation:
      "Ecochard R, Boehringer H, Rabilloud M, Marret H. Chronological aspects of ultrasonic, hormonal, and other indirect indices of ovulation. BJOG. 2001;108(8):822-829.",
    href: "https://pubmed.ncbi.nlm.nih.gov/11510707/",
  },
  {
    id: "critchley-2020",
    citation:
      "Critchley HOD, Maybin JA, Armstrong GM, Williams ARW. Physiology of the endometrium and regulation of menstruation. Physiological Reviews. 2020;100(3):1149-1179.",
    href: "https://pubmed.ncbi.nlm.nih.gov/32031903/",
  },
  {
    id: "jones-2025",
    citation:
      "Jones K, Sung S. Anovulatory bleeding. Updated 2025 Mar 23. In: StatPearls. Treasure Island (FL): StatPearls Publishing.",
    href: "https://www.ncbi.nlm.nih.gov/books/NBK549773/",
  },
  {
    id: "iacovides-2015",
    citation:
      "Iacovides S, Avidon I, Baker FC. What we know about primary dysmenorrhea today: a critical review. Human Reproduction Update. 2015;21(6):762-778.",
    href: "https://doi.org/10.1093/humupd/dmv039",
  },
  {
    id: "hallberg-1966",
    citation:
      "Hallberg L, Högdahl AM, Nilsson L, Rybo G. Menstrual blood loss—a population study. Variation at different ages and attempts to define normality. Acta Obstetricia et Gynecologica Scandinavica. 1966;45(3):320-351.",
    href: "https://pubmed.ncbi.nlm.nih.gov/5922481/",
  },
  {
    id: "romans-2012",
    citation:
      "Romans S, Clarkson R, Einstein G, Petrovic M, Stewart D. Mood and the menstrual cycle: a review of prospective data studies. Gender Medicine. 2012;9(5):361-384.",
    href: "https://doi.org/10.1016/j.genm.2012.07.003",
  },
  {
    id: "alzueta-2023",
    citation:
      "Alzueta E, Baker FC. The menstrual cycle and sleep. Sleep Medicine Clinics. 2023;18(4):399-413.",
    href: "https://doi.org/10.1016/j.jsmc.2023.06.003",
  },
  {
    id: "mcnulty-2020",
    citation:
      "McNulty KL, Elliott-Sale KJ, Dolan E, Swinton PA, Ansdell P, Goodall S, Thomas K, Hicks KM. The effects of menstrual cycle phase on exercise performance in eumenorrheic women: a systematic review and meta-analysis. Sports Medicine. 2020;50(10):1813-1827.",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7497427/",
  },
  {
    id: "meng-2007",
    citation:
      "Meng X, Ichim TE, Zhong J, Rogers A, Yin Z, Jackson J, Wang H, Ge W, Bogin V, Chan KW, Thébaud B, Riordan NH. Endometrial regenerative cells: a novel stem cell population. Journal of Translational Medicine. 2007;5:57.",
    href: "https://doi.org/10.1186/1479-5876-5-57",
  },
  {
    id: "patel-2008",
    citation:
      "Patel AN, Park E, Kuzman M, Benetti F, Silva FJ, Allickson JG. Multipotent menstrual blood stromal stem cells: isolation, characterization, and differentiation. Cell Transplantation. 2008;17(3):303-311.",
    href: "https://pubmed.ncbi.nlm.nih.gov/18522233/",
  },
  {
    id: "sanchez-mata-2021",
    citation:
      "Sanchez-Mata A, Gonzalez-Muñoz E. Understanding menstrual blood-derived stromal/stem cells: definition and properties. Are we rushing into their therapeutic applications? iScience. 2021;24(12):103501.",
    href: "https://doi.org/10.1016/j.isci.2021.103501",
  },
  {
    id: "cuenca-2018",
    citation:
      "Cuenca J, Le-Gatt A, Castillo V, Belletti J, Díaz M, Kurte GM, Gonzalez PL, Alcayaga-Miranda F, Schuh C, Ezquer F, Ezquer M, Khoury M. The reparative abilities of menstrual stem cells modulate the wound matrix signals and improve cutaneous regeneration. Frontiers in Physiology. 2018;9:464.",
    href: "https://doi.org/10.3389/fphys.2018.00464",
  },
]

export const clinicalReference: readonly ClinicalChapter[] = [
  {
    id: "ovarian-cycle",
    title: "The ovarian cycle",
    topics: [
      {
        id: "follicular-variability",
        title: "The days before ovulation vary",
        sourceIds: ["fehring-2006", "reed-2018"],
        paragraphs: [
          "In 1,060 cycles from 141 regularly cycling women, mean age 29, the stretch from the first day of bleeding through the peak reading on a urinary hormone monitor averaged 16.5 days. Ninety-five percent of those cycles fell between 10 and 22 days. Within the same woman, that stretch differed by more than seven days in about a third of the group. The days after the monitor's peak differed by that much in 9 percent. The peak reading was the study's stand-in for ovulation. The women were selected for regular cycles, so the series does not describe the first years after menarche or the approach to menopause.",
          "In an ovulatory cycle those days are recruitment, then dominance. As the previous corpus luteum fades, follicle-stimulating hormone rises and a cohort of follicles is recruited. Estradiol from the growing follicles, together with inhibin B, then holds follicle-stimulating hormone down, and usually one follicle continues. Estradiol from that follicle rises, and the endometrium proliferates. The number of days this takes is the part of a cycle that moves.",
        ],
      },
      {
        id: "lh-surge",
        title: "The luteinizing hormone surge and rupture",
        sourceIds: ["who-1980", "reed-2018"],
        paragraphs: [
          "A surgical series timed ovulation against hormones in blood. The ovaries were inspected at operation, and the follicle or corpus luteum was examined. The median interval from the first significant rise in luteinizing hormone to ovulation was 32 hours, with a 95 percent confidence interval of 23.6 to 38.2 hours for that median. The median from the hormone's peak was 16.5 hours, confidence interval 9.5 to 23.0. Across the individual cycles they could time, the interval from the first significant rise ran from 24 to 56 hours. About a day to a day and a half is the center of that estimate from the start of the rise. The scatter around it is wider.",
          "A standard review puts the same events in that range: the surge begins on the order of 34 to 36 hours before ovulation, and the peak about 10 to 12 hours before. The late rise in estradiol from the dominant follicle is what switches the pituitary into the surge. The surge resumes maturation of the oocyte. The follicle then ruptures. Neither interval is a value this calendar measures.",
        ],
      },
      {
        id: "progesterone-rise",
        title: "Progesterone before rupture, and after",
        sourceIds: ["hoff-1983", "who-1980", "reed-2018", "critchley-2020"],
        paragraphs: [
          "A little progesterone is already rising before the follicle ruptures. In five women sampled every two hours across five periovulatory days, a rapid progesterone rise began about 12 hours before the luteinizing hormone surge, and progesterone kept rising through the first part of the surge. A second, steeper rise began about 36 hours after the surge started, while the surge was still descending. The sample is five people. A separate surgical series, using its own definition of a progesterone rise, placed that rise a median of 7.8 hours before ovulation, with a 95 percent confidence interval from 12.5 hours before ovulation to 15.9 hours after. Under that definition the rise was a poor clock for the moment of rupture.",
          "After rupture, the remaining follicular cells form the corpus luteum, and progesterone is its main hormone. Estradiol falls around ovulation and rises again in the middle of the luteal phase, alongside progesterone. If a pregnancy does not maintain the corpus luteum, progesterone and estradiol fall. In a lining that progesterone had prepared, that withdrawal is what starts menstruation.",
        ],
      },
      {
        id: "luteal-length",
        title: "How long the luteal interval usually is",
        sourceIds: ["fehring-2006", "lenton-1984", "who-1980"],
        paragraphs: [
          "Two counts that start from a luteinizing hormone peak land near the same center, and neither is a single required length. In the monitor study, the luteal count ran from the day after the urinary peak through the day before the next bleed: mean 12.4 days, median 13, mode 13, and 95 percent of cycles between 9 and 16 days. In 327 apparently ovulatory cycles timed from a serum peak, the count from the day after the peak through the day before bleeding was described as mostly a normal distribution with a mean of 14.13 days and a standard deviation of 1.41. Phases of 9 days or fewer sat outside that distribution, and the authors estimated that many 10-day and some 11-day phases did too. Short phases, by their definition, were 5.2 percent of the cycles.",
          "The clocks differ. A urinary peak can fall later than the serum peak, which shortens a luteal count that starts from the urine test. The serum peak itself precedes rupture: in the surgical series the median from the peak to ovulation was 16.5 hours. About 10 to 16 days, most often near 12 to 14, is a fair rounding of these counts from the hormone peak toward the next bleed. It is a population pattern. It is the gap between marks on this calendar only when those marks were set.",
        ],
      },
      {
        id: "temperature-shift",
        title: "The temperature shift follows ovulation",
        sourceIds: ["baker-2020-temperature", "ecochard-2001"],
        paragraphs: [
          "In ovulatory cycles, core temperature sits about 0.3°C to 0.7°C higher in the luteal phase than in the follicular phase. The difference is clearest in sleep or on waking, before activity. The rise is attributed to progesterone. A review of the temperature literature, drawing on earlier measurements, places the rise about a day after progesterone becomes detectable in blood, with a plateau over the next day or so. Cycles without that progesterone rise do not show the temperature rise. Some cycles that are ovulatory by hormones still show no clear rise. The shift is a retrospective sign that a luteal progesterone rise has already happened. It is not the rupture itself.",
          "In a separate study of 107 women aged 18 to 45, recruited as normally fertile and cycling, a waking-temperature rise was recorded in 98 percent of the cycles in which ultrasound showed ovulation. That sample was selected for ordinary fertility. A rise on a chart still does not name the hour the follicle opened.",
        ],
      },
      {
        id: "cervical-fluid",
        title: "Cervical fluid changes with the hormones",
        sourceIds: ["reed-2018", "ecochard-2001"],
        paragraphs: [
          "The glands of the cervix respond to the same two hormones. Just after menstruation the fluid is scant and viscous. In the late follicular phase, as estradiol rises, it becomes clearer, more abundant, and more elastic. After ovulation, as progesterone rises, it becomes thick, viscous, and opaque again, and the amount falls.",
          "In the ultrasound study of women recruited as normally fertile, the peak day of cervical fluid fell close to the ultrasound evidence of ovulation in more than 72 percent of cycles. That is a description of a bodily change alongside the hormones. It is not a method for conceiving, and it is not a method for avoiding conception.",
        ],
      },
    ],
  },
  {
    id: "menstruation",
    title: "Menstruation",
    topics: [
      {
        id: "withdrawal-bleed",
        title: "Withdrawal after an ovulatory cycle",
        sourceIds: ["critchley-2020", "reed-2018", "fehring-2006"],
        paragraphs: [
          "When a corpus luteum has formed and then fades, menstruation is the functional layer of the endometrium leaving after progesterone is withdrawn. Estradiol falls with it. The local sequence is an orderly inflammation: prostaglandins and cytokines rise, matrix is broken down, spiral arterioles constrict, the superficial tissue becomes ischemic, and that layer is shed with blood and fluid. Prostaglandin F2α is part of the vasoconstriction. The basal layer stays. Repair of the surface begins while bleeding is still going. Within the first two days, estrogen from the new cohort of follicles is already supporting that repair.",
          "Menstrual fluid is shed lining, blood, and inflammatory fluid. By the ordinary count, the first day of flow is day 1 of the next cycle. In the monitor study of regularly cycling women, bleeding lasted a mean of 5.8 days, and 95 percent of cycles fell between 3 and 8 days.",
        ],
      },
      {
        id: "bleed-not-proof",
        title: "Bleeding does not prove a corpus luteum",
        sourceIds: ["jones-2025", "critchley-2020"],
        paragraphs: [
          "The withdrawal sequence above belongs to a lining that progesterone had prepared. Progesterone withdrawal is the trigger when that preparation has happened. When ovulation does not occur, no corpus luteum forms, and that progesterone is absent. Estrogen can still stimulate the endometrium. The lining then breaks down without having become secretory, and the bleeding is described clinically as irregular in timing and often heavy or prolonged. That description comes from people evaluated for abnormal bleeding. It is a known route to bleeding. It is not a finding that any particular cycle took that route.",
          "A day of bleeding shows that the endometrium shed. It does not show that a corpus luteum preceded the shed.",
        ],
      },
      {
        id: "cramping",
        title: "Prostaglandins, cramping, and pain",
        sourceIds: ["critchley-2020", "iacovides-2015"],
        paragraphs: [
          "Prostaglandins belong to ordinary menstruation. They also sit at the center of the account of primary dysmenorrhea, which means cramping menstrual pain when no pelvic disease has been found. Across studies, that pain is reported by somewhere between 45 and 95 percent of menstruating women. The width of the range is the width of the questions and the samples.",
          "The review's synthesis of the measurements is that people with this pain have higher prostaglandin F2α and prostaglandin E2 during menstruation than people without it, highest in the first 48 hours, when the pain usually peaks. The working account is stronger uterine contraction and less blood flow in the muscle, and from that, pain. During the bleeding days, groups with primary dysmenorrhea also report worse mood, worse sleep, and a lower quality of life than in their own follicular phase, and worse than menstruating people who are not in that pain. The comparison is with a pain syndrome. It does not describe every bleed.",
        ],
      },
      {
        id: "iron-loss",
        title: "Iron leaves with heavy flow",
        sourceIds: ["hallberg-1966", "reed-2018", "critchley-2020"],
        paragraphs: [
          "In a random sample of 476 women in Göteborg, aged 15 to 50, measured menstrual blood loss averaged 43.4 milliliters. Loss varied widely between women and much less from one period to the next in the same woman. The investigators related heavier losses to signs of iron deficiency and treated about 80 milliliters as the level where that association mattered. A woman's own judgment of whether the period was heavy agreed poorly with the measured volume.",
          "Reed and Carr, citing those measurements, treat a loss above about 80 milliliters as abnormal. Critchley and colleagues, reviewing menstrual physiology, state that heavy menstrual bleeding affects about one in four women of reproductive age. The average, the threshold, and the one-in-four figure are population descriptions. They do not convert one day's protection into a laboratory iron value.",
        ],
      },
    ],
  },
  {
    id: "mood-sleep-energy-pain",
    title: "Mood, sleep, energy, and pain",
    topics: [
      {
        id: "mood",
        title: "Mood across the cycle",
        sourceIds: ["romans-2012", "alzueta-2023"],
        paragraphs: [
          "A review of 47 studies collected daily mood for at least one full cycle in people who were not seeking care for a premenstrual problem. Eighteen found no association between mood and any phase. Eighteen found negative mood in the premenstrual days together with another phase, a pattern that often continued into the bleeding days. Seven found negative mood limited to the premenstrual phase. Four found it in some other phase only. The methods differed enough that the studies were not pooled. The authors' conclusion was that clear evidence for a mood change confined to the premenstrual days, in the general population, is lacking.",
          "A named premenstrual syndrome is a narrower cut: emotional, behavioral, and physical symptoms that appear in the late luteal phase and ease after bleeding starts. A sleep review, summarizing earlier clinical literature, says many people have some premenstrual symptoms, that symptoms severe enough to affect daily life have been estimated in up to about 18 percent, and that premenstrual dysphoric disorder is described in about 3 to 8 percent. Those are estimates attached to a diagnosis, confirmed when the pattern repeats on a prospective record. They are not a finding that the late luteal days darken mood in most cycles, and a hard month is not by itself that diagnosis.",
        ],
      },
      {
        id: "sleep",
        title: "Sleep across the cycle",
        sourceIds: ["alzueta-2023"],
        paragraphs: [
          "In studies of adult women, sleep complaints cluster more often in the late luteal days and the first days of bleeding than at midcycle. The finding is a tendency across samples, and some samples do not show it. In young women recorded overnight in a laboratory, time to fall asleep, time awake after sleep onset, and sleep efficiency are generally stable from the follicular phase to the luteal phase. The electroencephalogram change that repeats most clearly is an increase, in the luteal phase, of the faster sleep spindles. A few small studies have found more awakenings in the late luteal phase. The groups are small, and they do not all agree.",
          "Age and symptoms change what is measured. In an actigraphy group of 163 women aged 48 to 59, sleep efficiency and total sleep time fell in the premenstrual week compared with the week before, with larger drops alongside obesity, financial strain, smoking, and more disordered breathing. People with premenstrual syndrome more often say their sleep is poor. A laboratory recording does not always show a matching change. Complaint and measurement come apart, and both are reports about groups.",
        ],
      },
      {
        id: "energy",
        title: "Energy, as far as performance studies go",
        sourceIds: ["mcnulty-2020"],
        paragraphs: [
          "A feeling of energy has not been pooled the way a stopwatch has. What has been pooled is exercise performance in regularly cycling women. A 2020 review found 78 such studies. In the 51 that could be combined, performance in the early follicular phase sat trivially below the other phases taken together: the central effect size was −0.06, and the 95 percent interval ran from −0.16 to 0.04, which includes no difference. The largest contrast was early follicular against late follicular, effect size −0.14, interval −0.26 to −0.03. The authors classed the evidence as low, because the studies varied and many were poor, and they wrote that the difference is too small to justify a general rule for training by phase.",
          "That is a statement about averaged strength and endurance tests. It does not rank one person's week, and it does not turn a phase name into a forecast of capacity.",
        ],
      },
      {
        id: "pain-context",
        title: "Where pain sits in the cycle",
        sourceIds: ["iacovides-2015", "alzueta-2023"],
        paragraphs: [
          "The pain that the dysmenorrhea review can document is concentrated in the bleeding days, especially the first two, in people who have primary dysmenorrhea. In that group it travels with worse mood, worse sleep, and a lower quality of life for those days. Outside that syndrome, the prospective mood review does not show a reliable premenstrual worsening in community samples, and the sleep review finds complaints more often in a window that includes both the late luteal days and early bleeding.",
          "Taken together, the sourced pattern is local and conditional. Cramping pain, when it is the primary-dysmenorrhea pattern, belongs to menstruation. Sleep complaints, when they appear, favor the days around the start of bleeding. Mood, in people not selected for a premenstrual disorder, does not belong to one phase. None of these is a reading of a single calendar.",
        ],
      },
    ],
  },
  {
    id: "menstrual-blood-cells",
    title: "Cells studied from menstrual blood",
    topics: [
      {
        id: "mensc-origin",
        title: "What the cells are, as far as published work agrees",
        sourceIds: ["meng-2007", "patel-2008", "sanchez-mata-2021"],
        paragraphs: [
          "Menstrual fluid contains fragments of endometrium that is being shed. In 2007 a laboratory reported cells from that fluid which, grown in culture, carried surface markers also used for mesenchymal stromal cells, and which the authors described as taking on features of several tissue types, including muscle, fat, bone, and others. They named them endometrial regenerative cells. A 2008 report described a similar population from menstrual blood and, again in culture, a shift toward cartilage, fat, bone, neural, and cardiac features. Both papers are laboratory descriptions of cells after they had been grown. They are the start of this literature.",
          "A 2021 review sets those reports beside mesenchymal stromal cells identified around blood vessels in the endometrium, in the layer that is shed and in the layer that remains. Each cycle, the functional layer leaves and the basal layer stays. The review's conclusion is that cells grown from menstrual blood have been loosely defined. Papers do not agree on which markers identify them, or on what they can become. A relationship to the stroma of the lining is what the tissue of origin supports. Which cells in that lining, and whether one laboratory's culture matches the next, is still open.",
        ],
      },
      {
        id: "mensc-wounds",
        title: "Wound-healing experiments",
        sourceIds: ["cuenca-2018", "sanchez-mata-2021"],
        paragraphs: [
          "One experiment compared these human cells with saline in a splinted skin wound on mice, followed for 14 days. From day 6 onward the cell-treated wounds closed faster. At the end they showed a denser network of vessels, and thicker collagen bundles nearer in arrangement to the neighboring skin, than the saline-treated wounds. The paper discloses that some of its authors were affiliated with a company developing cell therapies.",
          "The result is a laboratory animal finding about cutaneous repair under those conditions. A 2021 review of the wider literature treats reparative and immunomodulatory claims as reported, and also treats the identity of the cells as unsettled. Reported in mice, by investigators with a commercial stake, is the strength of this particular experiment.",
        ],
      },
      {
        id: "mensc-not-a-treatment",
        title: "Laboratory research, not a treatment",
        sourceIds: ["sanchez-mata-2021", "cuenca-2018", "meng-2007"],
        paragraphs: [
          "This calendar is not offering these cells. The work cited here is laboratory research: cells grown from menstrual blood, and one mouse wound study. It is not a therapy, it is not a prescription, and it is not something to try at home. Collecting or processing menstrual blood in order to obtain cells is outside anything this reading describes.",
          "The 2021 review asks whether therapeutic plans have moved ahead of an agreed definition of the cells. Until that definition is settled, and until human trials that this library does not claim to summarize say otherwise, the honest statement is the limited one: published experiments have grown cells from shed endometrium and have reported repair effects in animals. That is the whole of the claim.",
        ],
      },
    ],
  },
]
