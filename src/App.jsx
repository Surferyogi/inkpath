import { useState, useEffect, useMemo, useRef, useCallback } from "react";

/*
  墨径 INK PATH — v2026:08:03-11:41 (SGT) — PWA build
  Mandarin Chinese (Simplified, Hanyu Pinyin) + Japanese (kana/kanji, romaji).

  Data honesty:
  - Curated core lists below are verified standard dictionary values,
    tiered *inspired by* HSK / JLPT bands (not the official lists).
  - "AI Adaptive" rounds and example sentences are generated live by
    Claude and are labeled as AI-generated in the UI.
  - Analytics are computed only from your recorded answers. No figures
    are invented; empty states say "no data yet".

  Deployment notes (PWA build):
  - Progress persists via localStorage (falls back to claude.ai artifact
    storage automatically when run inside an artifact).
  - AI features need AI_ENDPOINT below to point at your own proxy
    (e.g. a Supabase Edge Function holding your Anthropic API key) —
    see README.md. Left empty, AI buttons stay visible but report
    "AI not configured" instead of failing silently.
*/

const VERSION = "v2026:08:03-11:41";

/* Set this to your deployed proxy, e.g.
   "https://<project-ref>.functions.supabase.co/claude-proxy"
   It must accept POST {prompt} and return {text}. See README.md. */
const AI_ENDPOINT = "https://towegspmywsmhlsjrpty.supabase.co/functions/v1/claude-proxy";
const ROUND_LEN = 10;
const AI_ROUND_LEN = 8; // fits the 1000-token API budget with sentences
const STORE_KEY = "inkpath-progress-v2";
const SENT_KEY = "inkpath-sentences-v1";
const MNEM_KEY = "inkpath-mnemonics-v2"; // v2: purge pre-component-table mnemonics

/* Verified etymology data — hand-checked standard decompositions only.
   PICTO: true pictographs (the character IS a drawing).
   PARTS: real component breakdowns. If a character is in neither,
   the AI is instructed to NEVER invent components. */
const PICTO = {
  "人": "a person standing, seen from the side",
  "口": "an open mouth",
  "山": "three mountain peaks",
  "木": "a tree — trunk, branches and roots",
  "日": "the sun — a circle with a dot, squared over time",
  "月": "a crescent moon",
  "水": "a flowing current with ripples at the sides",
  "火": "a rising flame with sparks",
  "田": "paths dividing four farm plots",
  "门": "a door frame with two swinging panels",
  "門": "a door frame with two swinging panels",
  "心": "a heart with its chambers",
  "手": "an open hand with fingers",
  "目": "an eye turned upright",
  "耳": "an ear",
  "马": "a horse — mane, legs and tail",
  "鱼": "a fish — head, scaled body and tail",
  "鸟": "a bird with a beak and feathers",
  "川": "flowing river channels",
  "雨": "raindrops falling from a cloud under the sky",
  "车": "a cart seen from above — axle and wheels",
  "車": "a cart seen from above — axle and wheels",
  "天": "the sky stretched above a person (大)",
  "立": "a person standing on the ground",
};
const PARTS = {
  "明": [["日","sun"],["月","moon"]],
  "好": [["女","woman"],["子","child"]],
  "休": [["亻","person"],["木","tree"]],
  "听": [["口","mouth"],["斤","axe"]],
  "看": [["手","hand"],["目","eye"]],
  "安": [["宀","roof"],["女","woman"]],
  "家": [["宀","roof"],["豕","pig"]],
  "间": [["门","door"],["日","sun"]],
  "間": [["門","gate"],["日","sun"]],
  "男": [["田","field"],["力","strength"]],
  "想": [["相","appearance"],["心","heart"]],
  "念": [["今","now"],["心","heart"]],
  "意": [["音","sound"],["心","heart"]],
  "情": [["忄","heart"],["青","blue-green"]],
  "星": [["日","sun"],["生","birth"]],
  "雪": [["雨","rain"],["彐","hand/broom"]],
  "花": [["艹","grass"],["化","change"]],
  "们": [["亻","person"],["门","door"]],
  "时": [["日","sun"],["寸","inch"]],
  "你": [["亻","person"],["尔","you (archaic)"]],
  "他": [["亻","person"],["也","also"]],
  "海": [["氵","water"],["每","every"]],
  "空": [["穴","hole"],["工","work"]],
  "話": [["言","speech"],["舌","tongue"]],
  "語": [["言","speech"],["吾","I (phonetic)"]],
  "読": [["言","speech"],["売","sell (phonetic)"]],
  "聞": [["門","gate"],["耳","ear"]],
  "働": [["亻","person"],["動","move"]],
  "秋": [["禾","grain"],["火","fire"]],
  "思": [["田","field (orig. skull)"],["心","heart"]],
  "林": [["木","tree"],["木","tree"]],
  "校": [["木","tree"],["交","cross"]],
  "机": [["木","tree"],["几","small table"]],
  "教": [["孝","filial piety"],["攵","action"]],
  "说": [["讠","speech"],["兑","exchange"]],
  "识": [["讠","speech"],["只","only (phonetic)"]],
  "议": [["讠","speech"],["义","justice"]],
  "惊": [["忄","heart"],["京","capital (phonetic)"]],
  "慢": [["忄","heart"],["曼","long (phonetic)"]],
};

/* ================= CORE DATA (verified) ================= */

const ZH_1 = [
  ["一","yī","one"],["二","èr","two"],["三","sān","three"],["人","rén","person"],
  ["大","dà","big"],["小","xiǎo","small"],["水","shuǐ","water"],["火","huǒ","fire"],
  ["山","shān","mountain"],["口","kǒu","mouth"],["日","rì","sun; day"],["月","yuè","moon; month"],
  ["木","mù","tree; wood"],["上","shàng","up; above"],["下","xià","down; below"],["中","zhōng","middle"],
  ["好","hǎo","good"],["我","wǒ","I; me"],["你","nǐ","you"],["他","tā","he; him"],
  ["马","mǎ","horse"],["天","tiān","sky; day"],["白","bái","white"],["手","shǒu","hand"],
  ["心","xīn","heart"],["门","mén","door"],["车","chē","vehicle"],["书","shū","book"],
  ["的","de","possessive particle"],["是","shì","to be"],["不","bù","no; not"],["了","le","completed-action particle"],
  ["在","zài","at; in"],["有","yǒu","to have"],["这","zhè","this"],["那","nà","that"],
  ["个","gè","general measure word"],["们","men","plural marker"],["来","lái","to come"],["去","qù","to go"],
  ["到","dào","to arrive"],["和","hé","and; with"],["会","huì","can; meeting"],["能","néng","to be able"],
  ["就","jiù","then; just"],["也","yě","also"],["要","yào","to want; need"],["年","nián","year"],
];
const ZH_2 = [
  ["吃","chī","to eat"],["喝","hē","to drink"],["看","kàn","to look; see"],["听","tīng","to listen"],
  ["说","shuō","to speak"],["走","zǒu","to walk"],["跑","pǎo","to run"],["买","mǎi","to buy"],
  ["卖","mài","to sell"],["钱","qián","money"],["家","jiā","home; family"],["友","yǒu","friend"],
  ["爱","ài","to love"],["想","xiǎng","to think; want"],["知","zhī","to know"],["道","dào","road; way"],
  ["电","diàn","electricity"],["飞","fēi","to fly"],["星","xīng","star"],["雨","yǔ","rain"],
  ["雪","xuě","snow"],["风","fēng","wind"],["花","huā","flower"],["鱼","yú","fish"],
  ["鸟","niǎo","bird"],["学","xué","to study"],["时","shí","time"],["间","jiān","between; room"],
  ["出","chū","to go out"],["生","shēng","life; to be born"],["对","duì","correct; toward"],["里","lǐ","inside"],
  ["后","hòu","after; behind"],["前","qián","front; before"],["开","kāi","to open; start"],["关","guān","to close; relate"],
  ["用","yòng","to use"],["事","shì","matter; affair"],["作","zuò","to do; work"],["工","gōng","work; labor"],
  ["分","fēn","to divide; minute"],["明","míng","bright; clear"],["都","dōu","all; both"],["很","hěn","very"],
  ["多","duō","many; much"],["少","shǎo","few; little"],["气","qì","air; gas"],["名","míng","name"],
];
const ZH_3 = [
  ["梦","mèng","dream"],["龙","lóng","dragon"],["静","jìng","quiet"],["强","qiáng","strong"],
  ["弱","ruò","weak"],["富","fù","rich"],["穷","qióng","poor"],["简","jiǎn","simple"],
  ["创","chuàng","to create"],["造","zào","to make; build"],["慢","màn","slow"],["快","kuài","fast"],
  ["深","shēn","deep"],["浅","qiǎn","shallow"],["神","shén","spirit; god"],["影","yǐng","shadow"],
  ["惊","jīng","startled"],["史","shǐ","history"],["智","zhì","wisdom"],["慧","huì","intelligent"],
  ["勇","yǒng","brave"],["敢","gǎn","to dare"],["温","wēn","warm"],["柔","róu","soft; gentle"],
  ["精","jīng","refined; essence"],["境","jìng","territory; situation"],["环","huán","ring; loop"],["历","lì","to experience"],
  ["经","jīng","to pass through; classic"],["济","jì","to aid; economy (经济)"],["情","qíng","feeling; emotion"],["意","yì","meaning; intention"],
  ["界","jiè","boundary; realm"],["论","lùn","to discuss; theory"],["变","biàn","to change"],["展","zhǎn","to unfold; exhibit"],
  ["观","guān","to observe; view"],["念","niàn","to think of; idea"],["识","shí","to know; knowledge"],["议","yì","to discuss; opinion"],
];
const JA_KANA = [
  ["あ","a"],["い","i"],["う","u"],["え","e"],["お","o"],["か","ka"],["き","ki"],["く","ku"],
  ["け","ke"],["こ","ko"],["さ","sa"],["し","shi"],["す","su"],["せ","se"],["そ","so"],
  ["た","ta"],["ち","chi"],["つ","tsu"],["て","te"],["と","to"],["な","na"],["に","ni"],
  ["ぬ","nu"],["ね","ne"],["の","no"],["は","ha"],["ひ","hi"],["ふ","fu"],["へ","he"],["ほ","ho"],
  ["ま","ma"],["み","mi"],["む","mu"],["め","me"],["も","mo"],["や","ya"],["ゆ","yu"],["よ","yo"],
  ["ら","ra"],["り","ri"],["る","ru"],["れ","re"],["ろ","ro"],["わ","wa"],["を","wo"],["ん","n"],
  ["ア","a"],["イ","i"],["ウ","u"],["エ","e"],["オ","o"],["カ","ka"],["キ","ki"],["ク","ku"],
  ["ケ","ke"],["コ","ko"],["サ","sa"],["シ","shi"],["ス","su"],["セ","se"],["ソ","so"],
  ["タ","ta"],["チ","chi"],["ツ","tsu"],["テ","te"],["ト","to"],["ナ","na"],["ニ","ni"],
  ["ヌ","nu"],["ネ","ne"],["ノ","no"],["ハ","ha"],["ヒ","hi"],["フ","fu"],["ヘ","he"],["ホ","ho"],
  ["マ","ma"],["ミ","mi"],["ム","mu"],["メ","me"],["モ","mo"],["ヤ","ya"],["ユ","yu"],["ヨ","yo"],
  ["ラ","ra"],["リ","ri"],["ル","ru"],["レ","re"],["ロ","ro"],["ワ","wa"],["ヲ","wo"],["ン","n"],
].map(([c, r]) => [c, r, null]);
const JA_N5 = [
  ["日","hi / nichi","sun; day"],["月","tsuki / getsu","moon; month"],["火","hi / ka","fire"],
  ["水","mizu / sui","water"],["木","ki / moku","tree; wood"],["金","kane / kin","gold; money"],
  ["土","tsuchi / do","earth; soil"],["山","yama","mountain"],["川","kawa","river"],
  ["人","hito","person"],["大","ookii / dai","big"],["小","chiisai / shou","small"],
  ["上","ue","up; above"],["下","shita","down; below"],["中","naka","middle; inside"],
  ["口","kuchi","mouth"],["目","me","eye"],["手","te","hand"],["足","ashi","foot; leg"],
  ["車","kuruma","car"],["学","gaku","study; learning"],["生","sei","life; student"],
  ["本","hon","book; origin"],["語","go","language"],["食","taberu / shoku","to eat"],
  ["見","miru","to see"],["行","iku","to go"],["来","kuru","to come"],
  ["一","ichi","one"],["二","ni","two"],["三","san","three"],["四","yon / shi","four"],
  ["五","go","five"],["六","roku","six"],["七","nana / shichi","seven"],["八","hachi","eight"],
  ["九","kyuu","nine"],["十","juu","ten"],["百","hyaku","hundred"],["千","sen","thousand"],
  ["万","man","ten thousand"],["円","en","yen; circle"],["年","toshi / nen","year"],["時","toki / ji","time; hour"],
  ["分","fun / bun","minute; part"],["半","han","half"],["今","ima","now"],["先","saki / sen","previous; ahead"],
  ["毎","mai","every"],["名","na / mei","name"],["国","kuni","country"],["男","otoko","man; male"],
  ["女","onna","woman; female"],["子","ko","child"],["父","chichi","father"],["母","haha","mother"],
  ["友","tomo","friend"],["天","ten","heaven; sky"],["気","ki","spirit; air"],["雨","ame","rain"],
  ["電","den","electricity"],["話","hanashi / wa","talk; story"],["読","yomu","to read"],["書","kaku","to write"],
  ["聞","kiku","to hear; ask"],["休","yasumu","to rest"],["出","deru","to go out"],["入","hairu","to enter"],
  ["右","migi","right"],["左","hidari","left"],["東","higashi","east"],["西","nishi","west"],
  ["南","minami","south"],["北","kita","north"],["外","soto","outside"],["前","mae","front; before"],
  ["後","ato / go","after; behind"],["間","aida / kan","interval; between"],["午","go","noon"],["立","tatsu","to stand"],
  ["買","kau","to buy"],["飲","nomu","to drink"],["高","takai","tall; expensive"],["安","yasui","cheap; peaceful"],
  ["新","atarashii","new"],["古","furui","old"],["長","nagai","long; chief"],["白","shiroi","white"],
];
const JA_N4 = [
  ["働","hataraku","to work"],["教","oshieru","to teach"],["室","shitsu","room"],
  ["病","byou","illness"],["院","in","institution"],["薬","kusuri","medicine"],
  ["旅","tabi","travel"],["駅","eki","station"],["銀","gin","silver"],
  ["映","ei","to reflect; project"],["画","ga","picture"],["音","oto","sound"],
  ["楽","tanoshii / gaku","fun; music"],["料","ryou","fee; material"],["理","ri","reason; logic"],
  ["転","ten","to roll; turn"],["運","un","to carry; luck"],["動","ugoku","to move"],
  ["物","mono","thing"],["問","mon","question"],["題","dai","topic; title"],
  ["説","setsu","to explain; theory"],["明","mei / akarui","bright; clear"],["集","atsumeru","to gather"],
  ["別","betsu","separate"],["強","tsuyoi / kyou","strong"],["曜","you","weekday"],["験","ken","test; verify"],
  ["会","au / kai","to meet; meeting"],["同","onaji / dou","same"],["事","koto / ji","thing; matter"],["自","ji","self"],
  ["社","sha","company; shrine"],["者","mono / sha","person"],["地","chi","ground; earth"],["場","ba / jou","place"],
  ["所","tokoro / sho","place"],["店","mise","shop"],["家","ie / ka","house; family"],["族","zoku","family; tribe"],
  ["兄","ani","older brother"],["弟","otouto","younger brother"],["姉","ane","older sister"],["妹","imouto","younger sister"],
  ["朝","asa","morning"],["昼","hiru","daytime; noon"],["夜","yoru","night"],["春","haru","spring"],
  ["夏","natsu","summer"],["秋","aki","autumn"],["冬","fuyu","winter"],["海","umi","sea"],
  ["空","sora","sky; empty"],["風","kaze","wind"],["花","hana","flower"],["犬","inu","dog"],
  ["鳥","tori","bird"],["魚","sakana","fish"],["肉","niku","meat"],["茶","cha","tea"],
  ["心","kokoro","heart; mind"],["思","omou","to think"],["知","shiru","to know"],["使","tsukau","to use"],
  ["作","tsukuru","to make"],["待","matsu","to wait"],["持","motsu","to hold"],["帰","kaeru","to return"],
  ["歩","aruku","to walk"],["走","hashiru","to run"],["起","okiru","to get up"],["寝","neru","to sleep"],
];

const LANGS = {
  zh: {
    label: "中文 · Mandarin Chinese",
    note: "Simplified characters · Hanyu Pinyin",
    font: "'Noto Serif SC', serif",
    translit: "pinyin",
    unsureWord: "不确定",
    tiers: [
      { id: "zh1", name: "Foundation", sub: "HSK 1–inspired", band: "HSK 1", data: ZH_1 },
      { id: "zh2", name: "Traveler", sub: "HSK 2–3–inspired", band: "HSK 2–3", data: ZH_2 },
      { id: "zh3", name: "Scholar", sub: "HSK 4+–inspired", band: "HSK 4–5", data: ZH_3 },
    ],
  },
  ja: {
    label: "日本語 · Japanese",
    note: "Kana & kanji · romaji readings",
    font: "'Noto Serif JP', serif",
    translit: "romaji",
    unsureWord: "わからない",
    tiers: [
      { id: "jaK", name: "Kana Gate", sub: "Hiragana", band: "kana", data: JA_KANA },
      { id: "ja5", name: "Wanderer", sub: "JLPT N5–inspired", band: "JLPT N5", data: JA_N5 },
      { id: "ja4", name: "Ronin", sub: "JLPT N4–inspired", band: "JLPT N4", data: JA_N4 },
    ],
  },
};

/* Milestone thresholds — verified benchmarks (see Analytics footnote):
   zh coverage: Jun Da Modern Chinese corpus + China's official 现代汉语常用字表 (2,500 chars ≈ 98%).
   ja: community-standard JLPT working numbers (official lists discontinued 2010); jōyō 2,136 (MEXT 2010). */
const MILESTONES = {
  zh: [
    { n: 25, t: "Opening strokes", s: "Your first 25 mastered characters." },
    { n: 50, t: "Foundation laid", s: "50 characters mastered." },
    { n: 100, t: "41% of written Chinese", s: "The 100 most frequent hanzi cover ≈41% of modern text (Jun Da corpus)." },
    { n: 500, t: "Everyday reader", s: "Top 500 characters ≈75% coverage of everyday text." },
    { n: 1000, t: "Solid intermediate", s: "Top 1,000 ≈89–90% coverage of modern Chinese." },
    { n: 2500, t: "Newspaper reader", s: "China's official 2,500 common-character list ≈98% coverage — newspaper level." },
    { n: 3000, t: "Near-complete coverage", s: "≈99% of modern text." },
  ],
  ja: [
    { n: 25, t: "First brushstrokes", s: "Your first 25 mastered characters." },
    { n: 46, t: "Kana-sized", s: "As many characters as the basic hiragana set (46)." },
    { n: 92, t: "Double kana", s: "As many as hiragana + katakana combined (92)." },
    { n: 100, t: "JLPT N5 benchmark", s: "≈100 kanji — the standard (unofficial) N5 working number." },
    { n: 300, t: "JLPT N4 benchmark", s: "≈300 cumulative kanji." },
    { n: 650, t: "JLPT N3 benchmark", s: "≈650 kanji — everyday reading territory." },
    { n: 1000, t: "JLPT N2 / newspaper gateway", s: "≈1,000 kanji — commonly tied to reading newspapers." },
    { n: 2136, t: "Jōyō complete", s: "All 2,136 official everyday-use kanji (MEXT 2010) — full newspaper coverage; N1 territory." },
  ],
};
const MASTER_MIN_A = 2, MASTER_MIN_ACC = 0.8;
function masteredCount(langKey, cs) {
  return Object.entries(cs || {}).filter(
    ([k, v]) => k.startsWith(langKey + "|") && v.a >= MASTER_MIN_A && v.c / v.a >= MASTER_MIN_ACC
  ).length;
}

const MODES = ["charToMeaning", "meaningToChar", "charToReading", "readingToChar"];
const MODE_LABEL = {
  charToMeaning: "Recognition (char → meaning)",
  meaningToChar: "Recall (meaning → char)",
  charToReading: "Reading (char → pinyin/romaji)",
  readingToChar: "Reverse reading (pinyin/romaji → char)",
};
const MODE_HINT = {
  charToMeaning: "What does this mean?",
  charToReading: "How is this read?",
  meaningToChar: "Which character means…",
  readingToChar: "Which character is read…",
};

/* ================= HELPERS ================= */

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const toItem = (row) => ({ char: row[0], reading: row[1], meaning: row[2], sentence: null, source: "core" });
const F = (item, field) => item[field];

/* ---- Progressive learning core ----
   Spaced repetition: Leitner boxes 1–5 per character. Correct → up a box;
   wrong or "not sure" → back to box 1. A character is DUE when its box
   interval has elapsed since it was last answered.
   Staged difficulty: recognition modes (char → meaning/reading) until a
   character has 2 correct answers; recall modes unlock after. */
const BOX_INTERVALS_MS = [0, 4 * 36e5, 24 * 36e5, 3 * 864e5, 7 * 864e5, 21 * 864e5]; // box 0–5
const LEARNED_C = 2;
const isDue = (s, now = Date.now()) =>
  !!s && s.a > 0 && now - (s.t || 0) >= BOX_INTERVALS_MS[Math.min(s.b || 0, 5)];
const isLearned = (s) => !!s && s.c >= LEARNED_C;
const RECOG_MODES = ["charToMeaning", "charToReading"];
function stageModes(s, hasMeaning) {
  const all = hasMeaning ? MODES : ["charToReading", "readingToChar"];
  if (isLearned(s)) return all;
  return hasMeaning ? RECOG_MODES : ["charToReading"]; // recognition first
}

function makeQuestion(item, pool, forcedMode, allowedModes) {
  const hasMeaning = item.meaning != null;
  let avail = hasMeaning ? MODES : ["charToReading", "readingToChar"];
  if (allowedModes) {
    const restricted = avail.filter((m) => allowedModes.includes(m));
    if (restricted.length) avail = restricted;
  }
  const mode = forcedMode && avail.includes(forcedMode) ? forcedMode : avail[Math.floor(Math.random() * avail.length)];
  const promptField = mode === "meaningToChar" ? "meaning" : mode === "readingToChar" ? "reading" : "char";
  const answerField = mode === "charToMeaning" ? "meaning" : mode === "charToReading" ? "reading" : "char";
  const answer = F(item, answerField);
  const distractors = shuffle([...new Set(pool.map((p) => F(p, answerField)).filter((v) => v && v !== answer))]).slice(0, 3);
  return { item, mode, prompt: F(item, promptField), promptField, answerField, answer, options: shuffle([answer, ...distractors]) };
}

/* Shape families — visually linked characters, from base form to variants.
   Verified readings/meanings. rare:true = shown in the tree for shape logic,
   excluded from quizzing (obscure vocabulary; possible glyph gaps on some devices). */
const FAMILIES = [
  {
    id: "kou", base: "口", name: "口 Mouth & squares",
    intro: "One square shape, many characters — trained by telling the lookalikes apart.",
    groups: [
      { label: "Closed squares (bigger or divided)", members: [
        { c: "口", py: "kǒu", m: "mouth", note: "the base form — an open mouth" },
        { c: "囗", py: "wéi", m: "enclosure", note: "same shape drawn large, to border what's inside", rare: true },
        { c: "日", py: "rì", m: "sun; day", note: "a line through the middle" },
        { c: "田", py: "tián", m: "field", note: "divided into four plots by a cross" },
        { c: "回", py: "huí", m: "to return", note: "a small mouth inside a larger one" },
        { c: "目", py: "mù", m: "eye", note: "stretched tall, two lines inside" },
        { c: "自", py: "zì", m: "self", note: "an eye with a stroke on top — originally a nose" },
      ]},
      { label: "Stacking the mouth", members: [
        { c: "吕", py: "lǚ", m: "spine; pitch", note: "two mouths stacked — originally vertebrae" },
        { c: "品", py: "pǐn", m: "product; quality", note: "three mouths — many items, many voices" },
        { c: "吅", py: "xuān", m: "clamor", note: "two mouths side by side — shouting", rare: true },
        { c: "㗊", py: "jí", m: "mass of voices", note: "four mouths — absolute chaos", rare: true },
      ]},
      { label: "Mouth with small modifications", members: [
        { c: "中", py: "zhōng", m: "middle", note: "pierced straight through the center" },
        { c: "申", py: "shēn", m: "to extend; state", note: "the line pokes out top AND bottom" },
        { c: "由", py: "yóu", m: "from; origin", note: "the line pokes out the top only" },
        { c: "甲", py: "jiǎ", m: "armor; first", note: "the line pokes out the bottom only" },
        { c: "舌", py: "shé", m: "tongue", note: "a tongue (千) sticking out of the mouth" },
      ]},
    ],
  },
  {
    id: "mu", base: "木", name: "木 Tree",
    intro: "One tree — mark its roots, its tip, or plant more of them.",
    groups: [
      { label: "Marking the tree", members: [
        { c: "木", py: "mù", m: "tree; wood", note: "the base form — trunk, branches, roots" },
        { c: "本", py: "běn", m: "root; origin", note: "a stroke marking the base of the trunk" },
        { c: "末", py: "mò", m: "tip; end", note: "a LONG stroke across the top — the treetop" },
        { c: "未", py: "wèi", m: "not yet", note: "a SHORT top stroke — the tip not yet grown" },
        { c: "果", py: "guǒ", m: "fruit; result", note: "something round grown on top of the tree" },
      ]},
      { label: "Planting more trees", members: [
        { c: "林", py: "lín", m: "woods", note: "two trees side by side" },
        { c: "森", py: "sēn", m: "forest", note: "three trees — dense growth" },
        { c: "休", py: "xiū", m: "to rest", note: "a person (亻) leaning against a tree" },
      ]},
    ],
  },
  {
    id: "ren", base: "人", name: "人 Person",
    intro: "A walking figure — add strokes and the person transforms.",
    groups: [
      { label: "One person, small changes", members: [
        { c: "人", py: "rén", m: "person", note: "the base form — a figure striding" },
        { c: "入", py: "rù", m: "to enter", note: "the lookalike trap: strokes cross the other way" },
        { c: "大", py: "dà", m: "big", note: "a person with arms stretched wide" },
        { c: "太", py: "tài", m: "too; greatest", note: "big, plus a dot — even bigger" },
        { c: "天", py: "tiān", m: "sky; day", note: "a line above the person — the sky overhead" },
        { c: "夫", py: "fū", m: "man; husband", note: "a line THROUGH the person — a hairpin of adulthood" },
      ]},
      { label: "More people", members: [
        { c: "从", py: "cóng", m: "to follow; from", note: "one person following another" },
        { c: "众", py: "zhòng", m: "crowd; many", note: "three people — a crowd" },
      ]},
    ],
  },
  {
    id: "tu", base: "土", name: "土 Earth & 王 King",
    intro: "Horizontal strokes on a vertical — tiny differences, different worlds.",
    groups: [
      { label: "Earth and scholar", members: [
        { c: "土", py: "tǔ", m: "earth; soil", note: "the base form — a mound on the ground; bottom stroke longer" },
        { c: "士", py: "shì", m: "scholar; warrior", note: "the trap: TOP stroke longer" },
        { c: "生", py: "shēng", m: "life; to be born", note: "a sprout growing out of the earth" },
      ]},
      { label: "King and jade", members: [
        { c: "王", py: "wáng", m: "king", note: "three levels — heaven, man, earth — joined by one line" },
        { c: "玉", py: "yù", m: "jade", note: "a king with a dot — the jade at his belt" },
        { c: "主", py: "zhǔ", m: "master; main", note: "a dot ABOVE the king — the flame of a lamp; the one in charge" },
      ]},
    ],
  },
];

function familyItems(fam, includeRare) {
  return fam.groups.flatMap((g) => g.members)
    .filter((m) => includeRare || !m.rare)
    .map((m) => ({ char: m.c, reading: m.py, meaning: m.m, sentence: null, source: "family" }));
}

/* Progressive gating: group i unlocks when every non-rare member of group i-1
   is learned (≥2 correct answers). Group 0 is always open. */
function familyUnlockedGroups(fam, cs) {
  let unlocked = 1;
  for (let i = 0; i < fam.groups.length - 1; i++) {
    const done = fam.groups[i].members
      .filter((m) => !m.rare)
      .every((m) => isLearned(cs[`zh|${m.c}`]));
    if (done) unlocked = i + 2; else break;
  }
  return unlocked;
}
function familyTrainableItems(fam, cs) {
  const n = familyUnlockedGroups(fam, cs);
  return fam.groups.slice(0, n).flatMap((g) => g.members)
    .filter((m) => !m.rare)
    .map((m) => ({ char: m.c, reading: m.py, meaning: m.m, sentence: null, source: "family" }));
}

/* Family round: targets sampled from the family, distractors are the visually
   similar SIBLINGS — that is what trains identification. Repeats across
   different modes are allowed (deliberate drilling). */
function buildFamilyRound(fam, cs) {
  const targets = familyTrainableItems(fam, cs);
  const siblings = familyItems(fam, false); // distractors from the whole family
  const round = [];
  let last = null;
  while (round.length < ROUND_LEN) {
    let it = targets[Math.floor(Math.random() * targets.length)];
    if (targets.length > 1 && last === it.char) continue;
    last = it.char;
    round.push(makeQuestion(it, siblings, null, stageModes(cs[`zh|${it.char}`], true)));
  }
  return round;
}

function buildRound(items, len = ROUND_LEN) {
  const picks = shuffle(items).slice(0, Math.min(len, items.length));
  return picks.map((it) => makeQuestion(it, items));
}

function buildTierRound(items, cs, langKey) {
  const picks = shuffle(items).slice(0, Math.min(ROUND_LEN, items.length));
  return picks.map((it) =>
    makeQuestion(it, items, null, stageModes(cs[`${langKey}|${it.char}`], it.meaning != null))
  );
}

/* Smart Review — spaced repetition first, then interleaving:
   1. Characters DUE for review (most overdue + weakest first) — up to ~70%.
   2. ~30% NEW (unseen) characters, interleaved.
   3. Any remaining slots: weakness-weighted from the whole pool. */
function buildAdaptiveRound(langKey, cs, weakestMode) {
  const now = Date.now();
  const pool = LANGS[langKey].tiers.flatMap((t) => t.data.map(toItem));
  const stat = (it) => cs[`${langKey}|${it.char}`];

  const due = pool
    .filter((it) => isDue(stat(it), now))
    .sort((a, b) => {
      const sa = stat(a), sb = stat(b);
      const accA = sa.c / sa.a, accB = sb.c / sb.a;
      if (accA !== accB) return accA - accB;      // weakest first
      return (sa.t || 0) - (sb.t || 0);            // then most overdue
    });
  const fresh = shuffle(pool.filter((it) => !stat(it) || !stat(it).a));

  const picks = [];
  const used = new Set();
  const take = (it) => { if (it && !used.has(it.char)) { picks.push(it); used.add(it.char); } };

  const dueTarget = Math.min(due.length, Math.round(ROUND_LEN * 0.7));
  const freshTarget = Math.min(fresh.length, ROUND_LEN - dueTarget);
  for (let i = 0; i < dueTarget; i++) take(due[i]);
  for (let i = 0; i < freshTarget && picks.length < ROUND_LEN; i++) take(fresh[i]);

  // remaining: weakness-weighted over the rest
  const rest = pool.filter((it) => !used.has(it.char));
  const weighted = rest.map((it) => {
    const s = stat(it);
    const w = !s || !s.a ? 1.2 : 0.4 + 4 * (1 - s.c / s.a) + 0.6 * (s.u || 0);
    return { it, w };
  });
  while (picks.length < ROUND_LEN && weighted.length) {
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total, i = 0;
    while (r > weighted[i].w) { r -= weighted[i].w; i++; }
    take(weighted[i].it); weighted.splice(i, 1);
  }

  return shuffle(picks).map((it, i) => {
    const allowed = stageModes(stat(it), it.meaning != null);
    const forced = weakestMode && i % 3 === 0 && allowed.includes(weakestMode) ? weakestMode : null;
    return makeQuestion(it, pool, forced, allowed);
  });
}

/* ================= ANALYTICS ================= */

function computeAnalytics(langKey, progress) {
  const chars = Object.entries(progress.cs || {})
    .filter(([k]) => k.startsWith(langKey + "|"))
    .map(([k, v]) => ({ char: k.split("|")[1], ...v, acc: v.a ? v.c / v.a : 0 }));
  const attempts = chars.reduce((s, c) => s + c.a, 0);
  const correct = chars.reduce((s, c) => s + c.c, 0);
  const unsure = chars.reduce((s, c) => s + (c.u || 0), 0);
  const seen2 = chars.filter((c) => c.a >= 2);
  /* One miss IS evidence of weakness — no attempt gate here. (Strong keeps the
     ≥2 gate: one lucky hit is not evidence of mastery.) */
  const weakest = chars
    .filter((c) => c.c < c.a || (c.u || 0) > 0)
    .sort((a, b) => a.acc - b.acc || (b.u || 0) - (a.u || 0) || b.a - a.a)
    .slice(0, 8);
  const weakSet = new Set(weakest.map((c) => c.char));
  const strongest = seen2
    .filter((c) => c.acc >= 0.9 && !weakSet.has(c.char))
    .sort((a, b) => b.acc - a.acc || b.a - a.a)
    .slice(0, 6);
  const ms = (progress.ms || {})[langKey] || {};
  const modeRows = MODES.map((m) => ({ mode: m, a: ms[m]?.a || 0, c: ms[m]?.c || 0, acc: ms[m]?.a ? ms[m].c / ms[m].a : null }))
    .filter((r) => r.a > 0);
  const weakestMode = modeRows.length ? [...modeRows].sort((a, b) => a.acc - b.acc)[0].mode : null;
  const overallAcc = attempts ? correct / attempts : null;
  /* Level suggestion — heuristic, shown transparently */
  const bandIdx = overallAcc == null ? 0 : overallAcc > 0.85 && attempts >= 40 ? 2 : overallAcc > 0.65 ? 1 : 0;
  const band = LANGS[langKey].tiers[Math.min(bandIdx, LANGS[langKey].tiers.length - 1)].band;
  const now = Date.now();
  const dueCount = chars.filter((c) => isDue(c, now)).length;
  const mastered = masteredCount(langKey, progress.cs);
  const nextMilestone = MILESTONES[langKey].find((m) => m.n > mastered) || null;
  return { attempts, correct, unsure, overallAcc, weakest, strongest, modeRows, weakestMode, band, charCount: chars.length, mastered, nextMilestone, dueCount };
}

/* ================= STORAGE (adapter: artifact storage → localStorage) ================= */

const EMPTY = { xp: 0, bestStreak: 0, rounds: 0, best: {}, cs: {}, ms: {} };
const hasArtifactStorage = () =>
  typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";

async function loadJSON(key) {
  if (hasArtifactStorage()) {
    try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
  }
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function saveJSON(key, v) {
  if (hasArtifactStorage()) {
    try { await window.storage.set(key, JSON.stringify(v)); return; } catch { /* fall through */ }
  }
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* non-fatal */ }
}

/* ================= AI (Claude via proxy, or direct inside claude.ai artifacts) ================= */

const inArtifact = () =>
  typeof window !== "undefined" && /claudeusercontent|claude\.ai/.test(window.location.hostname);

async function callClaude(prompt) {
  if (AI_ENDPOINT) {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const data = await res.json();
    if (!data.text) throw new Error("proxy returned no text");
    return data.text.replace(/```json|```/g, "").trim();
  }
  if (inArtifact()) {
    // Inside a claude.ai artifact the API is available without a key.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (!text) throw new Error("empty response");
    return text.replace(/```json|```/g, "").trim();
  }
  throw new Error("AI not configured: set AI_ENDPOINT in src/App.jsx (see README.md)");
}

async function aiSentence(langKey, item) {
  const zh = langKey === "zh";
  const prompt = zh
    ? `Write ONE very short simple Mandarin Chinese (Simplified) example sentence using the character "${item.char}" (${item.reading}, ${item.meaning ?? "kana"}). Respond ONLY with JSON: {"t":"sentence in characters","r":"full Hanyu Pinyin with tone marks","e":"English translation"}. No markdown.`
    : `Write ONE very short simple Japanese example sentence using "${item.char}" (${item.reading}${item.meaning ? ", " + item.meaning : ""}). Respond ONLY with JSON: {"t":"sentence in Japanese","r":"full romaji","e":"English translation"}. No markdown.`;
  const raw = await callClaude(prompt);
  const o = JSON.parse(raw);
  if (!o.t || !o.r || !o.e) throw new Error("bad shape");
  return o;
}

async function aiMnemonic(langKey, item) {
  const zh = langKey === "zh";
  const parts = PARTS[item.char];
  const picto = PICTO[item.char];
  const facts = parts
    ? `Its ACTUAL components are exactly: ${parts.map((p) => `${p[0]} (${p[1]})`).join(" + ")}. Build the scene ONLY from these real components — do not add any others.`
    : picto
    ? `It is a true pictograph: originally a drawing of ${picto}. Build the scene from that image.`
    : `If you are not fully certain of its real components, describe its overall visual shape instead — NEVER invent components that are not actually in the character.`;
  const prompt = `Create a visual mnemonic for remembering the ${zh ? "Mandarin Chinese (Simplified) character" : "Japanese character"} "${item.char}" (${item.reading}${item.meaning ? ", meaning: " + item.meaning : ""}). ${facts} Paint ONE vivid, memorable scene that links the shape to ${item.meaning ? "its meaning" : "its sound"}, ending with a short hint for the ${zh ? "pinyin" : "reading"}. Max 55 words. Respond ONLY with JSON {"m":"mnemonic text"}. No markdown.`;
  const raw = await callClaude(prompt);
  const o = JSON.parse(raw);
  if (!o.m) throw new Error("bad shape");
  return o.m;
}

async function aiRound(langKey, analytics) {
  const zh = langKey === "zh";
  const weak = analytics.weakest.slice(0, 3).map((w) => w.char);
  const strong = analytics.strongest.slice(0, 8).map((s) => s.char);
  const prompt = `Generate ${AI_ROUND_LEN} character-quiz items for a ${zh ? "Mandarin Chinese (Simplified characters)" : "Japanese"} learner at approximately ${analytics.band} level${analytics.overallAcc != null ? ` (recent accuracy ${(analytics.overallAcc * 100).toFixed(0)}%)` : ""}.
${weak.length ? `Include these review characters the learner struggles with: ${weak.join(" ")}.` : ""}
${strong.length ? `Avoid these already-strong characters: ${strong.join(" ")}.` : ""}
Respond ONLY with a JSON array (no markdown) of objects:
{"c":"single ${zh ? "simplified hanzi" : "kanji or kana"}","p":"${zh ? "Hanyu Pinyin with tone marks" : "reading in romaji (kana reading first if kanji)"}","m":"short English meaning","t":"very short example sentence in ${zh ? "Chinese characters" : "Japanese"}","r":"${zh ? "sentence pinyin" : "sentence romaji"}","e":"sentence English"}. Keep sentences under 8 characters. All data must be linguistically correct.`;
  const raw = await callClaude(prompt);
  const arr = JSON.parse(raw);
  const items = (Array.isArray(arr) ? arr : [])
    .filter((o) => o && o.c && o.p && o.m)
    .map((o) => ({ char: o.c, reading: o.p, meaning: o.m, source: "ai",
      sentence: o.t && o.r && o.e ? { t: o.t, r: o.r, e: o.e } : null }));
  if (items.length < 4) throw new Error("AI batch too small");
  return items.map((it) => makeQuestion(it, items));
}

/* ================= APP ================= */

export default function InkPath() {
  const [screen, setScreen] = useState("home"); // home | play | results | stats | origins
  const [lang, setLang] = useState(null);
  const [roundInfo, setRoundInfo] = useState(null); // {round, tierId?, name, kind}
  const [progress, setProgress] = useState(EMPTY);
  const [sentCache, setSentCache] = useState({});
  const [mnemCache, setMnemCache] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    Promise.all([loadJSON(STORE_KEY), loadJSON(SENT_KEY), loadJSON(MNEM_KEY)]).then(([p, s, m]) => {
      if (p) setProgress({ ...EMPTY, ...p });
      if (s) setSentCache(s);
      if (m) setMnemCache(m);
      setLoaded(true);
    });
  }, []);

  const startCore = (langKey, tier) => {
    setLang(langKey); setAiError(null);
    setRoundInfo({ round: buildTierRound(tier.data.map(toItem), progress.cs, langKey), tierId: tier.id, name: tier.name, kind: "core" });
    setScreen("play");
  };
  const startFamily = (fam) => {
    setLang("zh"); setAiError(null);
    setRoundInfo({ round: buildFamilyRound(fam, progress.cs), tierId: null, name: `Family · ${fam.name}`, kind: "family", famId: fam.id });
    setScreen("play");
  };
  const startSmart = (langKey, analytics) => {
    setLang(langKey); setAiError(null);
    setRoundInfo({ round: buildAdaptiveRound(langKey, progress.cs, analytics.weakestMode), tierId: null, name: "Smart Review", kind: "smart" });
    setScreen("play");
  };
  const startAI = async (langKey, analytics) => {
    setLang(langKey); setAiBusy(true); setAiError(null);
    try {
      const round = await aiRound(langKey, analytics);
      setRoundInfo({ round, tierId: null, name: `AI Adaptive · ~${analytics.band}`, kind: "ai" });
      setScreen("play");
    } catch (e) {
      setAiError(`AI round unavailable — ${e.message}. Smart Review works fully offline.`);
    } finally { setAiBusy(false); }
  };

  const cacheSentence = (langKey, char, s) => {
    setSentCache((prev) => {
      const next = { ...prev, [`${langKey}|${char}`]: s };
      const keys = Object.keys(next);
      if (keys.length > 300) delete next[keys[0]];
      saveJSON(SENT_KEY, next);
      return next;
    });
  };

  const cacheMnemonic = (langKey, char, m) => {
    setMnemCache((prev) => {
      const next = { ...prev, [`${langKey}|${char}`]: m };
      const keys = Object.keys(next);
      if (keys.length > 300) delete next[keys[0]];
      saveJSON(MNEM_KEY, next);
      return next;
    });
  };

  const finish = useCallback((summary) => {
    const beforeMastered = masteredCount(summary.lang, progress.cs);
    setProgress((prev) => {
      const cs = { ...prev.cs };
      const msLang = { ...(prev.ms?.[summary.lang] || {}) };
      for (const log of summary.log) {
        const k = `${summary.lang}|${log.char}`;
        const cur = cs[k] || { a: 0, c: 0, u: 0 };
        cs[k] = {
          a: cur.a + 1,
          c: cur.c + (log.ok ? 1 : 0),
          u: (cur.u || 0) + (log.unsure ? 1 : 0),
          b: log.ok ? Math.min((cur.b || 0) + 1, 5) : 1, // Leitner: up a box, or back to 1
          t: Date.now(),
        };
        const mm = msLang[log.mode] || { a: 0, c: 0 };
        msLang[log.mode] = { a: mm.a + 1, c: mm.c + (log.ok ? 1 : 0) };
      }
      const next = {
        xp: prev.xp + summary.xp,
        bestStreak: Math.max(prev.bestStreak, summary.bestStreak),
        rounds: prev.rounds + 1,
        best: summary.tierId
          ? { ...prev.best, [summary.tierId]: Math.max(prev.best[summary.tierId] || 0, summary.score) }
          : prev.best,
        cs, ms: { ...prev.ms, [summary.lang]: msLang },
      };
      saveJSON(STORE_KEY, next);
      const afterMastered = masteredCount(summary.lang, next.cs);
      setResult({
        ...summary,
        mastered: afterMastered,
        crossed: MILESTONES[summary.lang].filter((m) => beforeMastered < m.n && m.n <= afterMastered),
      });
      return next;
    });
    setScreen("results");
  }, [progress]);

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      {screen === "home" && (
        <Home progress={progress} loaded={loaded} aiBusy={aiBusy} aiError={aiError}
          onStart={startCore} onStats={(k) => { setLang(k); setScreen("stats"); }}
          onOrigins={(k) => { setLang(k); setScreen("origins"); }}
          onFamilies={() => setScreen("families")}
          onAI={(k) => startAI(k, computeAnalytics(k, progress))} />
      )}
      {screen === "origins" && <Origins langKey={lang} onBack={() => setScreen("home")} />}
      {screen === "families" && <Families cs={progress.cs} onBack={() => setScreen("home")} onTrain={startFamily} />}
      {screen === "stats" && (
        <Stats langKey={lang} progress={progress} aiBusy={aiBusy} aiError={aiError}
          onBack={() => setScreen("home")}
          onSmart={(a) => startSmart(lang, a)}
          onAI={(a) => startAI(lang, a)} />
      )}
      {screen === "play" && (
        <Play lang={lang} info={roundInfo} sentCache={sentCache} cacheSentence={cacheSentence} mnemCache={mnemCache} cacheMnemonic={cacheMnemonic}
          onQuit={() => setScreen("home")} onFinish={finish} />
      )}
      {screen === "results" && (
        <Results result={result} lang={lang}
          onReplay={() => {
            if (roundInfo.kind === "core") {
              const t = LANGS[lang].tiers.find((t) => t.id === roundInfo.tierId);
              startCore(lang, t);
            } else if (roundInfo.kind === "smart") startSmart(lang, computeAnalytics(lang, progress));
            else if (roundInfo.kind === "family") startFamily(FAMILIES.find((f) => f.id === roundInfo.famId));
            else startAI(lang, computeAnalytics(lang, progress));
          }}
          onStats={() => setScreen("stats")}
          onHome={() => setScreen("home")} />
      )}
    </div>
  );
}

/* ================= HOME ================= */

function Home({ progress, loaded, onStart, onStats, onOrigins, onFamilies, onAI, aiBusy, aiError }) {
  return (
    <div style={S.frame}>
      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>字 · 学 · 遊 — learn characters by playing</div>
          <h1 style={S.title}><span style={{ fontFamily: "'Noto Serif SC', serif" }}>墨径</span> INK PATH</h1>
        </div>
        <div style={S.xpBadge}>
          <div style={S.xpNum}>{loaded ? progress.xp : "…"}</div>
          <div style={S.xpLabel}>total XP</div>
        </div>
      </header>

      {aiError && <div style={S.errorBar}>{aiError}</div>}

      <div style={S.langGrid}>
        {Object.entries(LANGS).map(([key, lv]) => (
          <section key={key} style={S.langCard}>
            <div style={{ ...S.langGlyph, fontFamily: lv.font }}>{key === "zh" ? "文" : "字"}</div>
            <h2 style={S.langTitle}>{lv.label}</h2>
            <div style={S.langNote}>{lv.note}</div>
            <div style={S.tierList}>
              {lv.tiers.map((t, i) => (
                <button key={t.id} className="tierBtn" style={S.tierBtn} onClick={() => onStart(key, t)}>
                  <span style={S.tierIdx}>{"·".repeat(i + 1)}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <span style={S.tierName}>{t.name}</span>
                    <span style={S.tierSub}>{t.sub} · {t.data.length} characters</span>
                  </span>
                  <span style={S.tierBest}>{progress.best[t.id] ? `best ${progress.best[t.id]}` : "new"}</span>
                </button>
              ))}
            </div>
            <div style={S.langActions}>
              <button className="tierBtn" style={S.smallBtn} onClick={() => onStats(key)}>Analytics</button>
              <button className="tierBtn" style={S.smallBtn} onClick={() => onOrigins(key)}>字源 Origins</button>
              {key === "zh" && (
                <button className="tierBtn" style={S.smallBtn} onClick={onFamilies}>形 Families</button>
              )}
              <button className="tierBtn" style={{ ...S.smallBtn, borderColor: T.gold, color: T.gold }}
                disabled={aiBusy} onClick={() => onAI(key)}>
                {aiBusy ? "Generating…" : "✦ AI Adaptive round"}
              </button>
            </div>
          </section>
        ))}
      </div>

      <footer style={S.footer}>
        {VERSION} · Core tiers use verified curated lists inspired by HSK / JLPT bands (not official lists).
        “AI Adaptive” rounds and example sentences are generated live by Claude and labeled as such.
        Analytics come only from your recorded answers.
      </footer>
    </div>
  );
}

/* ================= STATS ================= */

function pct(x) { return x == null ? "—" : `${Math.round(x * 100)}%`; }

function Stats({ langKey, progress, onBack, onSmart, onAI, aiBusy, aiError }) {
  const lv = LANGS[langKey];
  const a = useMemo(() => computeAnalytics(langKey, progress), [langKey, progress]);
  const noData = a.attempts === 0;
  return (
    <div style={S.frame}>
      <div style={S.hud}>
        <button className="quiet" style={S.quitBtn} onClick={onBack}>← back</button>
        <h2 style={{ margin: 0, fontSize: 20 }}>{lv.label} — Analytics</h2>
        <span />
      </div>

      {aiError && <div style={S.errorBar}>{aiError}</div>}

      {noData ? (
        <div style={{ ...S.paperCard, minHeight: 140 }}>
          <div style={{ color: T.inkGrey, textAlign: "center" }}>
            No data yet for this language.<br />Play a round and your strengths & weaknesses will appear here.
          </div>
        </div>
      ) : (
        <>
          <div style={S.statCards}>
            <StatCard n={a.attempts} l="answers recorded" />
            <StatCard n={pct(a.overallAcc)} l="overall accuracy" />
            <StatCard n={a.unsure} l="marked “not sure”" />
            <StatCard n={a.charCount} l="characters seen" />
            <StatCard n={a.dueCount} l="due for spaced review" />
          </div>

          <div style={S.paperCardLeft}>
            <div style={S.sectionHead}>Accuracy by skill</div>
            {a.modeRows.map((r) => (
              <div key={r.mode} style={S.barRow}>
                <span style={S.barLabel}>{MODE_LABEL[r.mode]}</span>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: `${(r.acc || 0) * 100}%`, background: r.mode === a.weakestMode ? T.vermilion : T.gold }} />
                </div>
                <span style={S.barVal}>{pct(r.acc)} <em style={S.barN}>({r.c}/{r.a})</em></span>
              </div>
            ))}
            {a.weakestMode && (
              <div style={S.insight}>Weakest skill: <b>{MODE_LABEL[a.weakestMode]}</b>. Smart Review will drill it more often.</div>
            )}
          </div>

          <div style={S.twoCol}>
            <CharList title="Needs work" chars={a.weakest} color={T.vermilion} font={lv.font} empty="Nothing needs work yet — every answer so far has been correct." />
            <CharList title="Strong" chars={a.strongest} color="#4C8C4A" font={lv.font} empty="Need ≥2 attempts per character to rank." />
          </div>

          <div style={S.paperCardLeft}>
            <div style={S.sectionHead}>Milestones</div>
            <div style={{ fontSize: 14, color: T.inkGrey, marginBottom: 10 }}>
              <b style={{ color: T.ink }}>{a.mastered}</b> characters mastered (≥{MASTER_MIN_A} attempts at ≥{MASTER_MIN_ACC * 100}% accuracy)
              {a.nextMilestone && <> — next: <b style={{ color: T.ink }}>{a.nextMilestone.t}</b> at {a.nextMilestone.n}</>}
            </div>
            {a.nextMilestone && (
              <div style={{ ...S.barTrack, marginBottom: 14 }}>
                <div style={{ ...S.barFill, width: `${Math.min(100, (a.mastered / a.nextMilestone.n) * 100)}%`, background: T.gold }} />
              </div>
            )}
            {MILESTONES[langKey].map((m) => (
              <div key={m.n} style={{ ...S.charRow, opacity: a.mastered >= m.n ? 1 : 0.65 }}>
                <span style={{ fontSize: 18, minWidth: 26, color: a.mastered >= m.n ? "#4C8C4A" : T.inkGrey }}>{a.mastered >= m.n ? "✓" : "·"}</span>
                <span>
                  <b>{m.t}</b> <span style={{ color: T.inkGrey }}>({m.n})</span>
                  <span style={{ display: "block", fontSize: 12, color: T.inkGrey }}>{m.s}</span>
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: T.inkGrey, marginTop: 10 }}>
              Benchmarks: Jun Da corpus & China's official 2,500-char list (zh); community JLPT working numbers (official lists ended 2010) & MEXT jōyō 2,136 (ja).
            </div>
          </div>

          <div style={S.paperCardLeft}>
            <div style={S.sectionHead}>Next round, designed from this data</div>
            <div style={{ fontSize: 14, color: T.inkGrey, lineHeight: 1.6 }}>
              Estimated working band: <b style={{ color: T.ink }}>{a.band}</b> (heuristic: accuracy {pct(a.overallAcc)} over {a.attempts} answers).
              Smart Review runs spaced repetition (Leitner): <b style={{ color: T.ink }}>{a.dueCount} due now</b>, drilled first,
              interleaved with ~30% new characters. New characters start in recognition mode; recall unlocks after 2 correct answers.
              AI Adaptive asks Claude for fresh {a.band}-level characters, reinserting up to 3 of your weak ones.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button className="tierBtn" style={{ ...S.bigBtn, background: T.vermilion, color: "#fff", flex: 1 }} onClick={() => onSmart(a)}>
                Smart Review (offline)
              </button>
              <button className="tierBtn" style={{ ...S.bigBtn, background: T.night, color: T.gold, flex: 1, border: `1px solid ${T.gold}` }}
                disabled={aiBusy} onClick={() => onAI(a)}>
                {aiBusy ? "Generating…" : "✦ AI Adaptive round"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const StatCard = ({ n, l }) => (
  <div style={S.statCard}>
    <div style={{ fontSize: 26, fontWeight: 700, color: T.gold }}>{n}</div>
    <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: T.paperDim }}>{l}</div>
  </div>
);

const CharList = ({ title, chars, color, font, empty }) => (
  <div style={S.paperCardLeft}>
    <div style={{ ...S.sectionHead, color }}>{title}</div>
    {chars.length === 0 ? (
      <div style={{ fontSize: 13, color: T.inkGrey }}>{empty}</div>
    ) : chars.map((c) => (
      <div key={c.char} style={S.charRow}>
        <span style={{ fontFamily: font, fontSize: 26, minWidth: 38 }}>{c.char}</span>
        <span style={{ color: T.inkGrey, fontSize: 13 }}>{c.c}/{c.a} correct{c.u ? ` · ${c.u}× unsure` : ""}</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color }}>{pct(c.acc)}</span>
      </div>
    ))}
  </div>
);

/* ================= PLAY ================= */

function Play({ lang, info, sentCache, cacheSentence, mnemCache, cacheMnemonic, onQuit, onFinish }) {
  const lv = LANGS[lang];
  const round = info.round;
  const [idx, setIdx] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [picked, setPicked] = useState(null); // value | "__unsure__"
  const [log, setLog] = useState([]);
  const [sent, setSent] = useState(null); // {state:'loading'|'ok'|'err', data}
  const q = round[idx];
  const answered = picked !== null;
  const wasCorrect = picked === q.answer;
  const wasUnsure = picked === "__unsure__";

  const [mnem, setMnem] = useState(null); // null | {state:'loading'|'ok'|'err', data}
  useEffect(() => { setSent(null); setMnem(null); }, [idx]);

  const record = (ok, unsure) => {
    setLog((l) => [...l, { char: q.item.char, mode: q.mode, ok, unsure }]);
  };

  const choose = (opt) => {
    if (answered) return;
    setPicked(opt);
    const ok = opt === q.answer;
    record(ok, false);
    if (ok) {
      const st = streak + 1;
      setStreak(st); setBestStreak(Math.max(bestStreak, st));
      setScore(score + 10 + Math.min(st - 1, 5) * 2);
    } else {
      setHearts(hearts - 1); setStreak(0);
    }
  };

  const notSure = () => {
    if (answered) return;
    setPicked("__unsure__");
    record(false, true);
    setStreak(0); // honesty costs the streak, not a heart
  };

  /* mistakes computed at finish from log + round */
  const finishNow = () => {
    const correct = log.filter((l) => l.ok).length;
    const mistakes = round
      .map((qq, i) => ({ qq, l: log[i] }))
      .filter((x) => x.l && !x.l.ok)
      .map((x) => ({ ...x.qq.item, unsure: x.l.unsure }));
    onFinish({
      lang, tierId: info.tierId, name: info.name, kind: info.kind,
      score, xp: score, correct, answered: log.length, total: round.length,
      bestStreak, heartsLeft: hearts, log, mistakes,
    });
  };
  const advance = () => {
    const last = idx === round.length - 1 || hearts === 0;
    if (last) finishNow();
    else { setIdx(idx + 1); setPicked(null); }
  };

  const showExample = async () => {
    const key = `${lang}|${q.item.char}`;
    if (q.item.sentence) { setSent({ state: "ok", data: q.item.sentence }); return; }
    if (sentCache[key]) { setSent({ state: "ok", data: sentCache[key] }); return; }
    setSent({ state: "loading" });
    try {
      const s = await aiSentence(lang, q.item);
      cacheSentence(lang, q.item.char, s);
      setSent({ state: "ok", data: s });
    } catch { setSent({ state: "err" }); }
  };

  const showMnemonic = async () => {
    const key = `${lang}|${q.item.char}`;
    if (mnemCache[key]) { setMnem({ state: "ok", data: mnemCache[key] }); return; }
    setMnem({ state: "loading" });
    try {
      const m = await aiMnemonic(lang, q.item);
      cacheMnemonic(lang, q.item.char, m);
      setMnem({ state: "ok", data: m });
    } catch { setMnem({ state: "err" }); }
  };

  const isChar = q.promptField === "char";
  return (
    <div style={S.frame}>
      <div style={S.hud}>
        <button className="quiet" style={S.quitBtn} onClick={onQuit}>← quit</button>
        <div style={S.hudMid}>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${(idx / round.length) * 100}%` }} />
          </div>
          <div style={S.hudMeta}>
            <span>{info.name}</span>
            <span>{idx + 1}/{round.length}</span>
            <span style={{ color: T.gold }}>{streak > 1 ? `${streak}×` : "\u00A0"}</span>
            <span>{score} pts</span>
          </div>
        </div>
        <div style={S.hearts} aria-label={`${hearts} lives left`}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ opacity: i < hearts ? 1 : 0.18, color: T.vermilion }}>●</span>
          ))}
        </div>
      </div>

      {info.kind === "ai" && <div style={S.aiTag}>✦ AI-generated round — verify anything surprising before memorising</div>}

      <div style={S.paperCard} className={answered ? (wasCorrect ? "cardOk" : wasUnsure ? "" : "cardNo") : ""}>
        <div style={S.modeHint}>{MODE_HINT[q.mode]}{q.mode === "readingToChar" ? ` “${q.prompt}”` : ""}</div>
        {q.mode !== "readingToChar" ? (
          <div style={{ ...S.promptGlyph, fontFamily: isChar ? lv.font : "'Karla', sans-serif",
            fontSize: isChar ? "min(26vw, 118px)" : "clamp(22px, 6vw, 38px)" }}>
            {q.prompt}
          </div>
        ) : <div style={{ ...S.promptGlyph, fontSize: 60, color: T.inkGrey }}>?</div>}

        {answered && (
          <div className="stamp" style={{ ...S.stamp, background: wasCorrect ? T.vermilion : wasUnsure ? T.gold : T.inkGrey }}>
            <span style={{ fontFamily: "'Noto Serif JP','Noto Serif SC',serif" }}>
              {wasCorrect ? "正" : wasUnsure ? "学" : "誤"}
            </span>
          </div>
        )}
      </div>

      <div style={S.optGrid}>
        {q.options.map((opt) => {
          const isAns = opt === q.answer;
          const state = !answered ? "" : isAns ? "optOk" : opt === picked ? "optNo" : "optDim";
          const optIsChar = q.answerField === "char";
          return (
            <button key={opt} className={`opt ${state}`} disabled={answered} onClick={() => choose(opt)}
              style={{ ...S.opt, fontFamily: optIsChar ? lv.font : "'Karla', sans-serif", fontSize: optIsChar ? 38 : 16 }}>
              {opt}
            </button>
          );
        })}
      </div>

      {!answered && (
        <button className="opt" onClick={notSure} style={S.unsureBtn}>
          {lv.unsureWord} · Not sure — show me
        </button>
      )}

      {answered && (
        <div style={S.afterBox}>
          <div style={{ fontSize: 15, textAlign: "center" }}>
            <span style={{ fontFamily: lv.font, fontSize: 24 }}>{q.item.char}</span>
            {"  "}— {q.item.reading}{q.item.meaning ? ` — ${q.item.meaning}` : ""}
            {/* "not sure" is still logged for review and costs no heart — note intentionally not shown */}
          </div>

          {q.item.meaning !== null && (
            sent === null ? (
              <button className="quiet" style={S.exampleBtn} onClick={showExample}>✦ Show example sentence (AI)</button>
            ) : sent.state === "loading" ? (
              <div style={S.exampleBox}>Generating example…</div>
            ) : sent.state === "err" ? (
              <div style={S.exampleBox}>Example unavailable (AI call failed).</div>
            ) : (
              <div style={S.exampleBox}>
                <div style={{ fontFamily: lv.font, fontSize: 20 }}>{sent.data.t}</div>
                <div style={{ color: T.gold, fontSize: 14 }}>{sent.data.r}</div>
                <div style={{ color: T.paperDim, fontSize: 13 }}>{sent.data.e}</div>
                <div style={S.aiSmall}>AI-generated example</div>
              </div>
            )
          )}

          {mnem === null ? (
            <button className="quiet" style={S.exampleBtn} onClick={showMnemonic}>🧠 Memory aid (stroke order + mnemonic)</button>
          ) : mnem.state === "loading" ? (
            <div style={S.exampleBox}>Building memory aid…</div>
          ) : mnem.state === "err" ? (
            <div style={S.exampleBox}>Memory aid unavailable (AI call failed).</div>
          ) : (
            <div style={S.exampleBox}>
              {PARTS[q.item.char] && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                  {PARTS[q.item.char].map((p, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {i > 0 && <span style={{ color: T.gold, fontSize: 20 }}>+</span>}
                      <span style={{ textAlign: "center" }}>
                        <span style={{ display: "block", fontFamily: lv.font, fontSize: 34 }}>{p[0]}</span>
                        <span style={{ fontSize: 11, color: T.paperDim }}>{p[1]}</span>
                      </span>
                    </span>
                  ))}
                  <span style={{ color: T.gold, fontSize: 20 }}>→</span>
                  <span style={{ fontFamily: lv.font, fontSize: 40 }}>{q.item.char}</span>
                </div>
              )}
              {!PARTS[q.item.char] && PICTO[q.item.char] && (
                <div style={{ fontSize: 13, color: T.gold, textAlign: "center" }}>
                  True pictograph: {PICTO[q.item.char]}
                </div>
              )}
              <StrokeAnim char={q.item.char} />
              <div style={{ fontSize: 14, lineHeight: 1.55 }}>{mnem.data}</div>
              <div style={S.aiSmall}>AI-generated mnemonic · stroke data: Hanzi Writer</div>
            </div>
          )}

          <button className="tierBtn" style={{ ...S.bigBtn, background: T.vermilion, color: "#fff" }} onClick={advance}>
            {idx === round.length - 1 || hearts === 0 ? "Finish round" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= RESULTS + CELEBRATION ================= */

const ORIGIN10 = [
  ["人","rén","hito","a person standing, seen from the side","person"],
  ["口","kǒu","kuchi","an open mouth","mouth; opening"],
  ["山","shān","yama","three mountain peaks","mountain"],
  ["木","mù","ki","trunk, branches and roots","tree; wood"],
  ["日","rì","hi","the sun — a circle with a dot, squared over time","sun; day"],
  ["月","yuè","tsuki","a crescent moon","moon; month"],
  ["水","shuǐ","mizu","a flowing current with ripples","water"],
  ["火","huǒ","hi","a rising flame with sparks","fire"],
  ["田","tián","ta","paths between four farm plots","field"],
  ["门","mén","mon (kanji: 門)","a door frame with two swinging panels","door; gate"],
];
const ORIGIN_COMPOUNDS = [
  ["木 + 木","林","lín — woods: two trees side by side"],
  ["木 + 木 + 木","森","sēn — forest: three trees, dense growth"],
  ["日 + 月","明","míng — bright: sun and moon, the two brightest things"],
  ["亻 + 木","休","xiū / yasumu — rest: a person leaning on a tree"],
  ["門 + 耳","聞","kiku (JP) — to hear: an ear at the gate"],
  ["门 + 日","间","jiān — between: sunlight through a doorway"],
  ["火 + 山","火山","huǒshān — volcano: a fire mountain"],
  ["人 + 口","人口","rénkǒu — population: mouths to feed"],
  ["门 + 口","门口","ménkǒu — doorway: the mouth of a door"],
];
const ORIGIN_RADICALS = [
  ["水","氵","three drops of water — left side of liquid words","江 river · 洗 wash"],
  ["火","灬","four dots of fire — coals under heat words","热 hot · 煮 boil"],
  ["人","亻","standing person — left side of human actions","你 you · 他 he"],
  ["心","忄","squeezed heart — left side of feeling words","情 feeling · 快 fast/glad"],
  ["木","木","narrowed tree — left side of wooden things","机 machine · 校 school"],
];

function Families({ cs, onBack, onTrain }) {
  const [sel, setSel] = useState(null);
  const font = LANGS.zh.font;
  if (!sel) return (
    <div style={S.frame}>
      <div style={S.hud}>
        <button className="quiet" style={S.quitBtn} onClick={onBack}>← back</button>
        <h2 style={{ margin: 0, fontSize: 20 }}>形 Shape families</h2>
        <span />
      </div>
      <div style={S.aiTag}>Build from a base form to its lookalikes — then train by telling the siblings apart.</div>
      {FAMILIES.map((f) => (
        <button key={f.id} className="tierBtn" style={{ ...S.tierBtn, alignItems: "center" }} onClick={() => setSel(f)}>
          <span style={{ fontFamily: font, fontSize: 44, minWidth: 56 }}>{f.base}</span>
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={S.tierName}>{f.name}</span>
            <span style={S.tierSub}>{f.intro}</span>
          </span>
          <span style={S.tierBest}>{familyItems(f, false).length} to train</span>
        </button>
      ))}
    </div>
  );
  return (
    <div style={S.frame}>
      <div style={S.hud}>
        <button className="quiet" style={S.quitBtn} onClick={() => setSel(null)}>← families</button>
        <h2 style={{ margin: 0, fontSize: 20 }}>{sel.name}</h2>
        <span />
      </div>
      {sel.groups.map((g, gi) => {
        const unlocked = gi < familyUnlockedGroups(sel, cs);
        return (
          <div key={g.label} style={{ ...S.paperCardLeft, opacity: unlocked ? 1 : 0.55 }}>
            <div style={S.sectionHead}>{unlocked ? g.label : `🔒 ${g.label}`}</div>
            {!unlocked && (
              <div style={{ fontSize: 12, color: T.inkGrey, marginBottom: 10 }}>
                Unlocks when every character in the previous group is learned (2 correct answers each).
              </div>
            )}
            {g.members.map((m) => {
              const learned = isLearned(cs[`zh|${m.c}`]);
              return (
                <div key={m.c} style={S.charRow}>
                  <span style={{ fontFamily: font, fontSize: 34, minWidth: 48 }}>{unlocked ? m.c : "？"}</span>
                  <span style={{ flex: 1 }}>
                    <b>{unlocked ? m.m : "—"}</b> {unlocked && <span style={{ color: T.inkGrey }}>· {m.py}</span>}
                    {learned && <span style={{ color: "#4C8C4A" }}> ✓ learned</span>}
                    {m.rare && unlocked && <span style={{ color: T.vermilion, fontSize: 11 }}> · rare — shape logic only</span>}
                    {unlocked && <span style={{ display: "block", fontSize: 12, color: T.inkGrey }}>{m.note}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      <button className="tierBtn" style={{ ...S.bigBtn, background: T.vermilion, color: "#fff" }} onClick={() => onTrain(sel)}>
        Train unlocked characters ({familyTrainableItems(sel, cs).length}) — lookalikes as the wrong answers
      </button>
    </div>
  );
}

function Origins({ langKey, onBack }) {
  const lv = LANGS[langKey || "zh"];
  return (
    <div style={S.frame}>
      <div style={S.hud}>
        <button className="quiet" style={S.quitBtn} onClick={onBack}>← back</button>
        <h2 style={{ margin: 0, fontSize: 20 }}>字源 Origins — how characters were built</h2>
        <span />
      </div>
      {langKey === "ja" && (
        <div style={S.aiTag}>Kanji descend from these same Chinese pictographs — the origins below apply to both languages.</div>
      )}

      <div style={S.paperCardLeft}>
        <div style={S.sectionHead}>1 · Start with true pictures</div>
        <div style={{ fontSize: 13, color: T.inkGrey, marginBottom: 12 }}>
          These characters ARE drawings. See the object, not the strokes.
        </div>
        {ORIGIN10.map(([c, py, ja, origin, meaning]) => (
          <div key={c} style={S.charRow}>
            <span style={{ fontFamily: lv.font, fontSize: 34, minWidth: 48 }}>{c}</span>
            <span style={{ flex: 1 }}>
              <b>{meaning}</b> <span style={{ color: T.inkGrey }}>· {py} / {ja}</span>
              <span style={{ display: "block", fontSize: 12, color: T.inkGrey }}>{origin}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={S.paperCardLeft}>
        <div style={S.sectionHead}>2 · Combine pictures into ideas</div>
        {ORIGIN_COMPOUNDS.map(([eq, res, note]) => (
          <div key={res + eq} style={S.charRow}>
            <span style={{ fontFamily: lv.font, fontSize: 20, minWidth: 118, color: T.inkGrey }}>{eq}</span>
            <span style={{ color: T.gold, fontSize: 18 }}>→</span>
            <span style={{ fontFamily: lv.font, fontSize: 28, minWidth: 62 }}>{res}</span>
            <span style={{ fontSize: 12, color: T.inkGrey, flex: 1 }}>{note}</span>
          </div>
        ))}
      </div>

      <div style={S.paperCardLeft}>
        <div style={S.sectionHead}>3 · Radicals: pictures change shape</div>
        <div style={{ fontSize: 13, color: T.inkGrey, marginBottom: 12 }}>
          When a picture attaches to another character, it compresses into a side radical.
        </div>
        {ORIGIN_RADICALS.map(([full, rad, note, ex]) => (
          <div key={full + rad} style={S.charRow}>
            <span style={{ fontFamily: lv.font, fontSize: 26, minWidth: 34 }}>{full}</span>
            <span style={{ color: T.gold, fontSize: 18 }}>→</span>
            <span style={{ fontFamily: lv.font, fontSize: 26, minWidth: 34 }}>{rad}</span>
            <span style={{ fontSize: 12, color: T.inkGrey, flex: 1 }}>
              {note}
              <span style={{ display: "block", fontFamily: lv.font, fontSize: 14, color: T.ink }}>{ex}</span>
            </span>
          </div>
        ))}
        <div style={{ fontSize: 13, color: T.inkGrey, marginTop: 12, borderTop: "1px dashed rgba(34,30,25,0.2)", paddingTop: 10 }}>
          4 · Active visualization: when you meet a character, picture its ancient drawing first, then its strokes.
          In any round, tap 🧠 Memory aid for the real components plus a scene built from them.
        </div>
      </div>
    </div>
  );
}

function StrokeAnim({ char }) {
  const ref = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ok | err
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    import("hanzi-writer")
      .then((mod) => {
        if (!alive || !ref.current) return;
        ref.current.innerHTML = "";
        const writer = mod.default.create(ref.current, char, {
          width: 140, height: 140, padding: 8,
          strokeColor: "#221E19", radicalColor: "#C5372C",
          delayBetweenStrokes: 120, strokeAnimationSpeed: 1.4,
          onLoadCharDataSuccess: () => { if (alive) { setStatus("ok"); writer.loopCharacterAnimation(); } },
          onLoadCharDataError: () => { if (alive) setStatus("err"); },
        });
      })
      .catch(() => { if (alive) setStatus("err"); });
    return () => { alive = false; };
  }, [char]);
  if (status === "err")
    return <div style={{ fontSize: 12, color: T.paperDim }}>Stroke animation unavailable for this character.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div ref={ref} style={{ width: 140, height: 140, background: "#FDFBF4", borderRadius: 12 }} />
      <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.paperDim }}>
        {status === "loading" ? "loading strokes…" : "stroke order (tap card to replay round)"}
      </div>
    </div>
  );
}

function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = (cv.width = cv.offsetWidth), H = (cv.height = cv.offsetHeight);
    const colors = [T.vermilion, T.gold, "#F6F1E4", "#4C8C4A"];
    const ps = Array.from({ length: 90 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.4, y: H * 0.35,
      vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 3,
      s: 4 + Math.random() * 5, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let t = 0, raf;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      ps.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      });
      if (++t < 160) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} style={S.confetti} aria-hidden="true" />;
}

function CountUp({ to }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    let cur = 0; const step = Math.max(1, Math.ceil(to / 40));
    const iv = setInterval(() => {
      cur = Math.min(to, cur + step); setN(cur);
      if (cur >= to) clearInterval(iv);
    }, 26);
    return () => clearInterval(iv);
  }, [to]);
  return <>{n}</>;
}

function Results({ result, lang, onReplay, onStats, onHome }) {
  const lv = LANGS[lang];
  const acc = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
  const cleared = result.heartsLeft > 0;
  return (
    <div style={{ ...S.frame, position: "relative" }}>
      {(cleared || (result.crossed && result.crossed.length > 0)) && <Confetti />}
      <div style={{ ...S.paperCard, paddingBottom: 30 }}>
        <div className="stamp" style={{ ...S.sealBig, background: cleared ? T.vermilion : T.inkGrey }}>
          <span style={{ fontFamily: "'Noto Serif JP','Noto Serif SC',serif" }}>{cleared ? "合格" : "再挑"}</span>
        </div>
        {result.crossed && result.crossed.length > 0 && result.crossed.map((m) => (
          <div key={m.n} style={{ background: T.gold, color: T.ink, borderRadius: 10, padding: "8px 16px", fontWeight: 700, marginBottom: 10, textAlign: "center" }}>
            🏮 Milestone reached: {m.t} ({m.n} characters)
          </div>
        ))}
        <h2 style={S.resTitle}>{cleared ? "Level cleared! 🎉" : "The path continues"}</h2>
        <p style={S.resSub}>{result.name}{cleared ? ` · ${result.heartsLeft}/3 lives kept` : ""}</p>
        <div style={S.statRow}>
          <Stat n={<CountUp to={result.score} />} l="score (+XP)" />
          <Stat n={`${acc}%`} l={`accuracy (${result.correct}/${result.answered})`} />
          <Stat n={`${result.bestStreak}×`} l="best streak" />
        </div>

        {result.mistakes.length > 0 && (
          <div style={S.reviewBox}>
            <div style={S.reviewHead}>Review before your next round</div>
            {result.mistakes.map((m, i) => (
              <div key={i} style={S.reviewRow}>
                <span style={{ fontFamily: lv.font, fontSize: 28, minWidth: 42 }}>{m.char}</span>
                <span style={{ color: T.inkGrey }}>{m.reading}</span>
                <span style={{ marginLeft: "auto", textAlign: "right" }}>
                  {m.meaning || "—"}{m.unsure ? " · skipped" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.resBtns}>
        <button className="tierBtn" style={{ ...S.bigBtn, background: T.vermilion, color: "#fff" }} onClick={onReplay}>Play again</button>
        <button className="tierBtn" style={{ ...S.bigBtn, background: "transparent", border: `1px solid ${T.gold}`, color: T.gold }} onClick={onStats}>Analytics</button>
        <button className="tierBtn" style={{ ...S.bigBtn, background: "transparent", border: `1px solid ${T.paperDim}`, color: T.paper }} onClick={onHome}>Home</button>
      </div>
    </div>
  );
}

const Stat = ({ n, l }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 30, fontWeight: 700, color: T.ink }}>{n}</div>
    <div style={{ fontSize: 12, color: T.inkGrey, letterSpacing: ".04em" }}>{l}</div>
  </div>
);

/* ================= TOKENS & STYLES ================= */

const T = {
  night: "#141A2E", nightDeep: "#0E1322",
  paper: "#F6F1E4", paperDim: "#8B8FA3",
  ink: "#221E19", inkGrey: "#6B6459",
  vermilion: "#C5372C", gold: "#C9A227",
};

const S = {
  root: {
    minHeight: "100vh",
    background: `radial-gradient(1200px 600px at 80% -10%, #1D2645 0%, ${T.night} 45%, ${T.nightDeep} 100%)`,
    color: T.paper, fontFamily: "'Karla', sans-serif",
    display: "flex", justifyContent: "center", padding: "24px 16px 48px",
  },
  frame: { width: "100%", maxWidth: 780, display: "flex", flexDirection: "column", gap: 18 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" },
  eyebrow: { fontSize: 12, letterSpacing: ".22em", textTransform: "uppercase", color: T.gold, marginBottom: 6 },
  title: { fontSize: "clamp(30px, 7vw, 46px)", margin: 0, fontWeight: 700, letterSpacing: ".02em" },
  xpBadge: { textAlign: "right" },
  xpNum: { fontSize: 28, fontWeight: 700, color: T.gold },
  xpLabel: { fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: T.paperDim },
  errorBar: { background: "rgba(197,55,44,0.18)", border: `1px solid ${T.vermilion}`, borderRadius: 10, padding: "10px 14px", fontSize: 14 },
  aiTag: { fontSize: 12, color: T.gold, textAlign: "center", letterSpacing: ".04em" },

  langGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  langCard: { background: "rgba(246,241,228,0.04)", border: "1px solid rgba(246,241,228,0.12)", borderRadius: 14, padding: 20, position: "relative", overflow: "hidden" },
  langGlyph: { position: "absolute", right: -10, top: -26, fontSize: 140, opacity: 0.06, pointerEvents: "none" },
  langTitle: { margin: "0 0 2px", fontSize: 20, fontWeight: 700 },
  langNote: { fontSize: 12, color: T.paperDim, marginBottom: 14 },
  tierList: { display: "flex", flexDirection: "column", gap: 10 },
  tierBtn: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "rgba(246,241,228,0.06)", border: "1px solid rgba(246,241,228,0.14)", color: T.paper, borderRadius: 10, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" },
  tierIdx: { color: T.vermilion, fontSize: 22, lineHeight: 1, letterSpacing: "2px" },
  tierName: { display: "block", fontWeight: 700, fontSize: 15 },
  tierSub: { display: "block", fontSize: 12, color: T.paperDim, marginTop: 2 },
  tierBest: { fontSize: 12, color: T.gold, whiteSpace: "nowrap" },
  langActions: { display: "flex", gap: 10, marginTop: 12 },
  smallBtn: { flex: 1, justifyContent: "center", background: "transparent", border: "1px solid rgba(246,241,228,0.25)", color: T.paper, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, display: "flex", alignItems: "center" },
  footer: { fontSize: 12, color: T.paperDim, lineHeight: 1.6, textAlign: "center", marginTop: 8 },

  hud: { display: "flex", alignItems: "center", gap: 14 },
  quitBtn: { display: "flex", alignItems: "center", gap: 6, minHeight: 44, background: "rgba(246,241,228,0.07)", border: "1px solid rgba(246,241,228,0.28)", color: T.paper, borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontSize: 15, fontWeight: 600, fontFamily: "inherit" },
  hudMid: { flex: 1 },
  progressTrack: { height: 6, borderRadius: 3, background: "rgba(246,241,228,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", background: T.gold, transition: "width .4s ease" },
  hudMeta: { display: "flex", justifyContent: "space-between", fontSize: 12, color: T.paperDim, marginTop: 5, gap: 8 },
  hearts: { fontSize: 16, letterSpacing: 3 },

  paperCard: { position: "relative", background: T.paper, color: T.ink, borderRadius: 16, padding: "24px 22px 28px", minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 50px rgba(0,0,0,0.45)" },
  paperCardLeft: { background: T.paper, color: T.ink, borderRadius: 16, padding: "18px 20px", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" },
  sectionHead: { fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: T.vermilion, marginBottom: 12, fontWeight: 700 },
  modeHint: { fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: T.inkGrey, marginBottom: 8, textAlign: "center" },
  promptGlyph: { lineHeight: 1.15, fontWeight: 600, textAlign: "center", wordBreak: "keep-all" },
  stamp: { position: "absolute", right: 16, bottom: 14, width: 70, height: 70, borderRadius: 10, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, transform: "rotate(-8deg)", boxShadow: "0 6px 16px rgba(0,0,0,0.3)" },

  optGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 },
  opt: { minHeight: 72, borderRadius: 12, border: "1px solid rgba(246,241,228,0.2)", background: "rgba(246,241,228,0.07)", color: T.paper, cursor: "pointer", padding: "10px 12px", lineHeight: 1.3 },
  unsureBtn: { minHeight: 48, borderRadius: 12, border: `1px dashed ${T.gold}`, background: "transparent", color: T.gold, cursor: "pointer", fontSize: 14, fontFamily: "inherit" },

  afterBox: { display: "flex", flexDirection: "column", gap: 12 },
  exampleBtn: { background: "none", border: "none", color: T.gold, cursor: "pointer", fontSize: 14, fontFamily: "inherit", textDecoration: "underline", alignSelf: "center" },
  exampleBox: { background: "rgba(246,241,228,0.06)", border: "1px solid rgba(246,241,228,0.14)", borderRadius: 12, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, alignItems: "center", textAlign: "center" },
  aiSmall: { fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: T.paperDim, marginTop: 4 },

  statCards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 },
  statCard: { background: "rgba(246,241,228,0.05)", border: "1px solid rgba(246,241,228,0.14)", borderRadius: 12, padding: "14px 16px" },
  barRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  barLabel: { fontSize: 12, width: 170, color: T.inkGrey },
  barTrack: { flex: 1, height: 8, borderRadius: 4, background: "rgba(34,30,25,0.12)", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barVal: { fontSize: 13, fontWeight: 700, minWidth: 84, textAlign: "right" },
  barN: { fontStyle: "normal", fontWeight: 400, color: T.inkGrey, fontSize: 11 },
  insight: { marginTop: 8, fontSize: 13, color: T.inkGrey, borderTop: "1px dashed rgba(34,30,25,0.2)", paddingTop: 10 },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  charRow: { display: "flex", alignItems: "center", gap: 12, padding: "5px 0", borderBottom: "1px solid rgba(34,30,25,0.08)" },

  sealBig: { width: 110, height: 110, borderRadius: 14, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, transform: "rotate(-7deg)", marginBottom: 14, boxShadow: "0 8px 22px rgba(0,0,0,0.3)" },
  resTitle: { margin: "4px 0 2px", fontSize: 26, color: T.ink },
  resSub: { margin: 0, color: T.inkGrey, fontSize: 14 },
  statRow: { display: "flex", gap: 28, marginTop: 20, flexWrap: "wrap", justifyContent: "center" },
  reviewBox: { width: "100%", marginTop: 24, borderTop: `1px dashed ${T.inkGrey}`, paddingTop: 14 },
  reviewHead: { fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: T.vermilion, marginBottom: 10 },
  reviewRow: { display: "flex", alignItems: "center", gap: 12, padding: "6px 0", fontSize: 14, borderBottom: "1px solid rgba(34,30,25,0.08)" },
  resBtns: { display: "flex", gap: 12, flexWrap: "wrap" },
  bigBtn: { flex: 1, minWidth: 150, padding: "14px 18px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  confetti: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;900&family=Noto+Serif+JP:wght@600;900&family=Karla:wght@400;500;700&display=swap');
button:focus-visible { outline: 2px solid ${T.gold}; outline-offset: 2px; }
.tierBtn:hover:not(:disabled), .opt:hover:not(:disabled), .quiet:hover { border-color: ${T.gold}; transform: translateY(-1px); }
.quiet { transition: transform .15s ease, border-color .15s ease; }
.tierBtn, .opt { transition: transform .15s ease, border-color .15s ease, background .15s ease; }
.tierBtn:disabled { opacity: .55; cursor: wait; }
.opt.optOk { background: rgba(76,140,74,0.25); border-color: #6FA96C; }
.opt.optNo { background: rgba(197,55,44,0.25); border-color: ${T.vermilion}; }
.opt.optDim { opacity: .4; }
.stamp { animation: stampIn .35s cubic-bezier(.2,1.6,.4,1) both; }
.cardOk { animation: nudge .3s ease; }
.cardNo { animation: shake .35s ease; }
@keyframes stampIn { from { transform: rotate(-8deg) scale(2.2); opacity: 0; } to { transform: rotate(-8deg) scale(1); opacity: 1; } }
@keyframes nudge { 50% { transform: scale(1.012); } }
@keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@media (prefers-reduced-motion: reduce) {
  .stamp, .cardOk, .cardNo { animation: none; }
  .tierBtn, .opt { transition: none; }
}
`;
