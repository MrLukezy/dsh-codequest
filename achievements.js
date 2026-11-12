/**
 * CodeQuest for DSH — achievement definitions and evaluation.
 *
 * Definitions are pure data: each achievement names a metric reader, a target,
 * and presentation fields. `evaluate()` turns an aggregate metrics object into
 * unlocked ids + per-achievement progress, so the same code serves the HTTP
 * endpoint, the UI and the agent tool.
 *
 * Rows are written through the tiny `a()` builder so 300 entries stay readable:
 *   a(id, name, desc, cond, icon, rarity, category, target, metric, extra?)
 * Points follow the rarity unless `extra.points` overrides them.
 */

import { ACHIEVEMENT_ART } from './art.js';

/** @typedef {'common'|'rare'|'epic'|'legendary'} Rarity */
/** @typedef {'token'|'interaction'|'time'|'text'|'workplace'|'code'|'mastery'|'explore'|'easter'|'fail'|'meta'|'social'} Category */

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

export const CATEGORY_LABELS = {
  token: 'Token 流量',
  interaction: '交互',
  time: '时间',
  text: '文本性格',
  workplace: '职场',
  code: '代码与工具',
  mastery: '精通',
  explore: '探索与收集',
  easter: '彩蛋',
  fail: '翻车现场',
  meta: '自我改造',
  social: '社交与排行',
};

/** Points per rarity; a definition may override with `extra.points`. */
const P = { common: 10, rare: 20, epic: 40, legendary: 80 };

/**
 * Reveal threshold for secret achievements: once a goal is this close (0..1)
 * the card flips from a lock to its real name so the last stretch is visible.
 * Easter eggs ignore this and stay locked until they actually fire.
 */
const SECRET_REVEAL_RATIO = 0.6;

const a = (id, name, desc, cond, icon, rarity, category, target, metric, extra) => ({
  id,
  name,
  desc,
  cond,
  icon,
  rarity,
  category,
  target,
  metric,
  points: (extra && extra.points) || P[rarity],
  ...extra,
});

/** Signal counters are sparse maps; missing keys simply read as zero. */
const sig = (m, key) => (m.signals && m.signals[key]) || 0;
const ai = (m, key) => (m.assistant && m.assistant[key]) || 0;
const fence = (m, lang) => (m.assistant && m.assistant.fences && m.assistant.fences[lang]) || 0;
const ext = (m, key) => (m.exts && m.exts[key]) || 0;
const cmd = (m, key) => (m.cmds && m.cmds[key]) || 0;
const tool = (m, name) => (m.tools && m.tools[name]) || 0;
const hour = (m, index) => (m.hourly && m.hourly[index]) || 0;

/** Compact metric readers for the long tables below. */
const S = (key) => (m) => sig(m, key);
const AI = (key) => (m) => ai(m, key);
const F = (key) => (m) => fence(m, key);
const X = (key) => (m) => ext(m, key);
const C = (key) => (m) => cmd(m, key);
const T = (...names) => (m) => names.reduce((sum, name) => sum + tool(m, name), 0);
const H = (index) => (m) => hour(m, index);
const peakHour = (m) => (m.hourly || []).reduce((max, value) => Math.max(max, value), 0);

/** @type {Array<object>} */
export const ACHIEVEMENTS = [
  // ── Token 流量 ───────────────────────────────────────────────
  a('first_session', '初见 DSH', '你打开了潘多拉的魔盒，再也回不去了', '产生至少 1 个会话', '🐣', 'common', 'token', 1, (m) => m.sessions),
  a('tokens_500k', '第一口甜头', 'AI 尝起来还挺香的', '累计消耗 ≥ 500,000 Token', '🍬', 'common', 'token', 500_000, (m) => m.tokens),
  a('tokens_5m', '小有规模', '你开始认真地喂养模型了', '累计消耗 ≥ 5,000,000 Token', '📈', 'common', 'token', 5_000_000, (m) => m.tokens),
  a('tokens_40m', '中度沉迷', '朋友问你在干什么，你说：在烧 Token', '累计消耗 ≥ 40,000,000 Token', '🎰', 'common', 'token', 40_000_000, (m) => m.tokens),
  a('tokens_400m', '重度依赖', '没有 AI 你连 Hello World 都写不利索', '累计消耗 ≥ 400,000,000 Token', '💎', 'rare', 'token', 400_000_000, (m) => m.tokens),
  a('tokens_2b', 'Token 银行家', '你养活了一整个推理集群的零花钱', '累计消耗 ≥ 2,000,000,000 Token', '🏦', 'rare', 'token', 2_000_000_000, (m) => m.tokens),
  a('tokens_8b', '十亿玩家', '十亿只是起点，八亿次缓存命中在后面', '累计消耗 ≥ 8,000,000,000 Token', '🚀', 'epic', 'token', 8_000_000_000, (m) => m.tokens),
  a('tokens_16b', '算力黑洞', '你消耗的算力足以让一家初创公司倒闭', '累计消耗 ≥ 16,000,000,000 Token', '🕳️', 'epic', 'token', 16_000_000_000, (m) => m.tokens),
  a('tokens_32b', '燃烧的世界', 'GPU 农场因你而全年无休', '累计消耗 ≥ 32,000,000,000 Token', '🌋', 'legendary', 'token', 32_000_000_000, (m) => m.tokens),
  a('daily_40m', '火力全开', '键盘在冒烟，模型在喘气', '任意单日消耗 ≥ 40,000,000 Token', '💥', 'rare', 'token', 40_000_000, (m) => m.maxDailyTokens),
  a('daily_400m', '一天一个亿', '今天的账单需要单独打印', '任意单日消耗 ≥ 400,000,000 Token', '🧾', 'epic', 'token', 400_000_000, (m) => m.maxDailyTokens),
  a('daily_1b', 'Token 海啸', '一天烧掉十亿，云厂商给你发了感谢信', '任意单日消耗 ≥ 1,000,000,000 Token', '🌊', 'legendary', 'token', 1_000_000_000, (m) => m.maxDailyTokens, { hidden: true }),
  a('max_session_4m', '一局百万', '单个会话烧掉四百万，眼睛都不眨', '单会话消耗 ≥ 4,000,000 Token', '🎢', 'rare', 'token', 4_000_000, (m) => m.maxSessionTokens),
  a('max_session_40m', '会话永动机', '一个会话顶别人一个月', '单会话消耗 ≥ 40,000,000 Token', '🛞', 'epic', 'token', 40_000_000, (m) => m.maxSessionTokens),
  a('max_session_200m', '单局核爆', '单个会话两亿 Token，这是核试验', '单会话消耗 ≥ 200,000,000 Token', '☢️', 'legendary', 'token', 200_000_000, (m) => m.maxSessionTokens, { hidden: true }),
  a('input_20m', '输入狂魔', '你塞进去的上下文够写一部百科全书', '累计输入 ≥ 20,000,000 Token', '📥', 'rare', 'token', 20_000_000, (m) => m.input),
  a('input_200m', '上下文吞噬者', '两亿输入，窗口都不够你用的', '累计输入 ≥ 200,000,000 Token', '🫙', 'epic', 'token', 200_000_000, (m) => m.input),
  a('output_10m', '输出工厂', '模型为你敲出了一千万个 Token', '累计输出 ≥ 10,000,000 Token', '🏭', 'rare', 'token', 10_000_000, (m) => m.output),
  a('output_80m', '打字机的极限', '八千万输出，打印机都烧了三台', '累计输出 ≥ 80,000,000 Token', '🖨️', 'epic', 'token', 80_000_000, (m) => m.output),
  a('reasoning_100k', '先想后说', '模型的思考过程比你的回复还长', '累计推理 Token ≥ 100,000', '🧠', 'common', 'token', 100_000, (m) => m.reasoning),
  a('reasoning_2m', '深思熟虑', '两百万推理 Token，它在替你做哲学', '累计推理 Token ≥ 2,000,000', '🤯', 'rare', 'token', 2_000_000, (m) => m.reasoning),
  a('cache_read_40b', '缓存吸血鬼', '四十亿次缓存命中，一分钱都不多花', '缓存读取 ≥ 40,000,000,000 Token', '🦇', 'epic', 'token', 40_000_000_000, (m) => m.cacheRead),
  a('cache_write_5m', '缓存建筑师', '你亲手写入了五百万 Token 的缓存', '缓存写入 ≥ 5,000,000 Token', '🧱', 'rare', 'token', 5_000_000, (m) => m.cacheWrite),
  a('avg_session_20m', '高效选手', '平均每个会话两千万，稳', '单会话平均 ≥ 20,000,000 Token', '⚡', 'epic', 'token', 20_000_000, (m) => (m.sessions > 0 ? Math.round(m.tokens / m.sessions) : 0)),
  a('peak_hour_200m', '单小时核弹', '一个小时内烧掉两亿', '任意单小时消耗 ≥ 200,000,000 Token', '⏱️', 'epic', 'token', 200_000_000, peakHour),
  a('late_night_40m', '子夜燃烧', '凌晨四点，你和模型都没睡', '0–4 点消耗 ≥ 40,000,000 Token', '🕯️', 'legendary', 'token', 40_000_000, (m) => m.lateNightTokens, { hidden: true }),

  // ── 交互 ────────────────────────────────────────────────────
  a('sessions_10', '破冰对话', '你们互相认识了一下', '累计会话 ≥ 10', '🤝', 'common', 'interaction', 10, (m) => m.sessions),
  a('sessions_50', '老熟人', 'AI 已经记得你的口味了', '累计会话 ≥ 50', '🫂', 'common', 'interaction', 50, (m) => m.sessions),
  a('sessions_400', '话痨患者', 'AI 已经开始害怕你的下一个问题', '累计会话 ≥ 400', '🗣️', 'rare', 'interaction', 400, (m) => m.sessions),
  a('sessions_2000', '论文写手', '你是在写代码还是在写连载小说？', '累计会话 ≥ 2,000', '📚', 'epic', 'interaction', 2_000, (m) => m.sessions),
  a('turns_4000', '千回百转', '一个回合接一个回合，天亮了', '累计对话轮次 ≥ 4,000', '🔁', 'rare', 'interaction', 4_000, (m) => m.turns),
  a('turns_16000', '回合地狱', '一万六千轮，模型都被你问累了', '累计对话轮次 ≥ 16,000', '🌀', 'epic', 'interaction', 16_000, (m) => m.turns),
  a('prompts_2000', '真人提问者', '两千条真人 prompt，全是亲手打的', '真人 prompt ≥ 2,000 条', '🙋', 'rare', 'interaction', 2_000, (m) => m.humanPrompts),
  a('prompts_8000', '键盘磨损者', '八千条 prompt，键帽已经换过两套', '真人 prompt ≥ 8,000 条', '⌨️', 'epic', 'interaction', 8_000, (m) => m.humanPrompts),
  a('prompt_chars_150k', '长文输入', '你写的需求比代码还长', '真人输入累计 ≥ 150,000 字符', '✍️', 'rare', 'interaction', 150_000, (m) => m.promptChars),
  a('prompt_chars_600k', '手速惊人', '六十万字，够一部长篇小说了', '真人输入累计 ≥ 600,000 字符', '🖋️', 'epic', 'interaction', 600_000, (m) => m.promptChars),
  a('praise_40', '好人卡发放员', '你对 AI 比对对象还客气', '夸奖类表达 ≥ 40 次', '😊', 'rare', 'interaction', 40, (m) => m.sentiment.praise),
  a('insult_120', '嘴替本替', '情绪稳定地输出不稳定', '吐槽类表达 ≥ 120 次', '😤', 'rare', 'interaction', 120, (m) => m.sentiment.insult),
  a('pua_240', 'PUA 大师', '“你确定吗？”——第二百四十次', '质疑类表达 ≥ 240 次', '🌀', 'epic', 'interaction', 240, (m) => m.sentiment.pua),
  a('beg_20', '求求你了', '礼貌是最后的倔强', '恳求类表达 ≥ 20 次', '🙏', 'rare', 'interaction', 20, (m) => m.sentiment.beg),
  a('blame_40', '甩锅侠', '“这不是我写的，是它写的”', '归咎类表达 ≥ 40 次', '🍳', 'rare', 'interaction', 40, (m) => m.sentiment.blame),
  a('steps_20000', '一步一个脚印', '两万个执行步骤，全部按顺序走完', '累计执行步骤 ≥ 20,000', '👣', 'rare', 'interaction', 20_000, (m) => m.steps),
  a('steps_80000', '流水线人生', '八万步，你把自己活成了一条流水线', '累计执行步骤 ≥ 80,000', '🛤️', 'epic', 'interaction', 80_000, (m) => m.steps),
  a('projects_20', '多点开花', '二十个项目同时推进，很正常', '在 ≥ 20 个工作目录里干活', '🌿', 'epic', 'interaction', 20, (m) => m.projects),
  a('daily_sessions_40', '一天四十局', '这不是沉迷，这是热爱', '单日会话 ≥ 40', '🎮', 'epic', 'interaction', 40, (m) => m.maxDailySessions),
  a('daily_prompts_200', '话痨的一天', '一天两百条 prompt，键盘都热了', '单日真人 prompt ≥ 200', '🗨️', 'epic', 'interaction', 200, (m) => m.maxDailyPrompts),
  a('turn_length_40k', '回合巨兽', '单轮对话四万 Token', '单轮消耗 ≥ 40,000 Token', '🐘', 'rare', 'interaction', 40_000, (m) => m.maxTurnTokens),
  a('turn_length_400k', '回合泰坦', '单轮四十万，一个回合顶一场会议', '单轮消耗 ≥ 400,000 Token', '🦣', 'legendary', 'interaction', 400_000, (m) => m.maxTurnTokens, { hidden: true }),
  a('sessions_today_20', '今日二十连', '今天已经开了二十局了', '单日会话 ≥ 20', '📅', 'rare', 'interaction', 20, (m) => m.maxDailySessions),
  a('tokens_today_100m', '今天很猛', '今天的消耗已经破亿', '当日消耗 ≥ 100,000,000 Token', '🌞', 'rare', 'interaction', 100_000_000, (m) => m.tokensToday),
  a('human_ratio_1', '亲力亲为', '每一条 prompt 都是你亲手打的', '真人 prompt ≥ 500 且无注入内容', '✋', 'common', 'interaction', 500, (m) => m.humanPrompts),
  a('assistant_ratio_10', '对谈十比一', 'AI 说的话是你的十倍', 'AI 输出字符 ≥ 真人输入 10 倍（≥ 300k）', '📢', 'rare', 'interaction', 10, (m) => (m.promptChars > 0 && m.assistantChars > 300_000 ? Math.floor(m.assistantChars / m.promptChars) : 0)),

  // ── 时间 ────────────────────────────────────────────────────
  a('night_60', '夜猫子', '月亮是你唯一的同事', '20 点后开始的会话 ≥ 60', '🌙', 'rare', 'time', 60, (m) => m.nightSessions),
  a('night_240', '深夜常客', '凌晨三点的 DSH 你最熟', '20 点后开始的会话 ≥ 240', '🦉', 'epic', 'time', 240, (m) => m.nightSessions),
  a('active_days_48', '一周不断', '一个多月没让模型闲着', '累计活跃天数 ≥ 48', '📅', 'rare', 'time', 48, (m) => m.activeDays),
  a('active_days_180', '月度常驻', '半年里你几乎每天都在', '累计活跃天数 ≥ 180', '🗓️', 'legendary', 'time', 180, (m) => m.activeDays),
  a('streak_20', '二十连击', '自律到让 AI 都惭愧', '连续活跃 ≥ 20 天', '🔥', 'epic', 'time', 20, (m) => m.maxStreak),
  a('streak_40', '连续四十天', '四十天不断，习惯已经刻进 DNA', '连续活跃 ≥ 40 天', '☄️', 'legendary', 'time', 40, (m) => m.maxStreak),
  a('morning_9', '早班机', '九点整，你已经开始烧 Token 了', '9 点时段消耗 ≥ 50,000,000 Token', '🌅', 'rare', 'time', 50_000_000, H(9)),
  a('noon_13', '午休不停', '别人吃饭，你在跑任务', '13 点时段消耗 ≥ 50,000,000 Token', '🍱', 'rare', 'time', 50_000_000, H(13)),
  a('evening_21', '下班接着干', '二十一点，工作才刚开始', '21 点时段消耗 ≥ 80,000,000 Token', '🌃', 'epic', 'time', 80_000_000, H(21)),
  a('hour_3', '凌晨三点', '这个点还在线的只有你和服务器', '3 点时段消耗 ≥ 20,000,000 Token', '🌘', 'epic', 'time', 20_000_000, H(3), { hidden: true }),
  a('early_4', '闻鸡起舞', '四点开工，鸡都还没起', '4 点时段消耗 ≥ 20,000,000 Token', '🐓', 'epic', 'time', 20_000_000, H(4), { hidden: true }),
  a('all_hours_24', '全天候待命', '24 个时段全部有消耗', '24 个时段都产生过 Token', '🕛', 'legendary', 'time', 24, (m) => (m.hourly || []).filter((value) => value > 0).length),
  a('weekend_20', '周末也不放过', '周末照样开干', '周末会话 ≥ 20', '🏖️', 'rare', 'time', 20, (m) => m.weekendSessions),
  a('late_sessions_10', '凌晨局', '零点后开始的会话 ≥ 10', '0–4 点开始的会话 ≥ 10', '🌚', 'rare', 'time', 10, (m) => m.lateSessions),
  a('daily_sessions_60', '一天六十局', '一天六十局，作息已经不存在了', '单日会话 ≥ 60', '🏃', 'legendary', 'time', 60, (m) => m.maxDailySessions),
  a('month_span_90', '长跑选手', '第一次和最近一次相隔 90 天', '使用跨度 ≥ 90 天', '🛣️', 'rare', 'time', 90, (m) => (m.firstAt && m.lastAt ? Math.round((m.lastAt - m.firstAt) / 86_400_000) : 0)),
  a('month_span_365', '一年之约', '和 DSH 相处满一年', '使用跨度 ≥ 365 天', '🎂', 'legendary', 'time', 365, (m) => (m.firstAt && m.lastAt ? Math.round((m.lastAt - m.firstAt) / 86_400_000) : 0)),
  a('days_since_first_30', '满月', '从第一次打开到现在满 30 天', '距首次使用 ≥ 30 天', '🍼', 'common', 'time', 30, (m) => (m.firstAt ? Math.round((Date.now() - m.firstAt) / 86_400_000) : 0)),
  a('sessions_per_day_10', '日更十局', '平均每天十局以上', '日均会话 ≥ 10', '📈', 'rare', 'time', 10, (m) => (m.activeDays > 0 ? Math.round(m.sessions / m.activeDays) : 0)),
  a('tokens_per_day_500m', '日耗五亿', '平均每天五亿 Token', '日均消耗 ≥ 500,000,000 Token', '🏋️', 'epic', 'time', 500_000_000, (m) => (m.activeDays > 0 ? Math.round(m.tokens / m.activeDays) : 0)),
  a('streak_7', '一周不断更', '连续七天，稳定输出', '连续活跃 ≥ 7 天', '🗓️', 'common', 'time', 7, (m) => m.maxStreak),
  a('night_ratio_50', '夜行动物', '一半以上的会话都在晚上', '夜间会话占比 ≥ 50%（≥ 100 局）', '🌌', 'epic', 'time', 50, (m) => (m.sessions >= 100 ? Math.round((m.nightSessions / m.sessions) * 100) : 0)),

  // ── 文本性格：从你真实说过的话里读出来的 ──────────────────────
  a('text_question_400', '十万个为什么', '问号是你的主要标点', '带疑问的 prompt ≥ 400 条', '❓', 'common', 'text', 400, S('question')),
  a('text_question_1200', '好奇害死猫', '不懂就问，问完再问', '带疑问的 prompt ≥ 1,200 条', '🐈', 'rare', 'text', 1_200, S('question')),
  a('text_short_200', '惜字如金', '“改一下”“看看这个”“不对”', '≤12 字的极短 prompt ≥ 200 条', '🤐', 'common', 'text', 200, S('short')),
  a('text_short_600', '电报体大师', '按字收费的话你早破产了——反过来', '≤12 字的极短 prompt ≥ 600 条', '📮', 'rare', 'text', 600, S('short')),
  a('text_long_20', '长文需求', '你写的需求比代码还长', '≥1500 字的长 prompt ≥ 20 条', '📜', 'rare', 'text', 20, S('long')),
  a('text_long_60', '需求小作文', '这已经不是 prompt，是项目章程', '≥1500 字的长 prompt ≥ 60 条', '📕', 'epic', 'text', 60, S('long')),
  a('text_retry_150', '复读机', '“还是不行”“再试一次”', '重试/纠正类 prompt ≥ 150 条', '🔂', 'common', 'text', 150, S('retry')),
  a('text_retry_400', '再试一次就好', '第十二次一定行', '重试/纠正类 prompt ≥ 400 条', '🎰', 'epic', 'text', 400, S('retry')),
  a('text_doubt_100', '杠精预备役', '“你确定？”——你的口头禅', '质疑类 prompt ≥ 100 条', '🧐', 'rare', 'text', 100, S('doubt')),
  a('text_doubt_300', '杠精本精', 'AI 看到你的头像就开始自证', '质疑类 prompt ≥ 300 条', '⚖️', 'epic', 'text', 300, S('doubt')),
  a('text_polite_25', '礼貌标兵', '“麻烦你”“谢谢”也是生产力', '礼貌类 prompt ≥ 25 条', '🎩', 'common', 'text', 25, S('polite')),
  a('text_polite_100', '客气到让 AI 紧张', '一百次“请”和“谢谢”', '礼貌类 prompt ≥ 100 条', '🙇', 'rare', 'text', 100, S('polite')),
  a('text_emoji_15', '表情包选手', '文字不够，表情来凑', '带 emoji 的 prompt ≥ 15 条', '🥺', 'common', 'text', 15, S('emoji')),
  a('text_emoji_60', '颜文字暴走', '六十条带表情的 prompt', '带 emoji 的 prompt ≥ 60 条', '😹', 'rare', 'text', 60, S('emoji')),
  a('text_curious_200', '刨根问底', '“为什么”“原理是什么”', '追问原理的 prompt ≥ 200 条', '🔬', 'rare', 'text', 200, S('curious')),
  a('text_curious_600', '原理执念', '不搞懂底层就睡不着', '追问原理的 prompt ≥ 600 条', '🧠', 'epic', 'text', 600, S('curious')),
  a('text_chinese_2000', '母语输出', '两千条中文 prompt', '中文 prompt ≥ 2,000 条', '🇨🇳', 'rare', 'text', 2_000, S('chinese')),
  a('text_english_20', '切换外语', '开始用英文提需求了', '英文 prompt ≥ 20 条', '🔤', 'rare', 'text', 20, S('english')),
  a('text_english_80', '双语选手', '中英切换毫无障碍', '英文 prompt ≥ 80 条', '🌍', 'epic', 'text', 80, S('english')),
  a('text_excited_10', '激动到打感叹号', '“！！！”是你的标点主力', '激动类 prompt ≥ 10 条', '🤩', 'common', 'text', 10, S('excited')),
  a('text_excited_40', '情绪拉满', '四十次“太棒了”“起飞”', '激动类 prompt ≥ 40 条', '🎉', 'rare', 'text', 40, S('excited')),
  a('text_cheer_15', '啦啦队长', '“完美”“漂亮”“牛逼”', '称赞类 prompt ≥ 15 条', '📣', 'common', 'text', 15, S('cheer')),
  a('text_cheer_60', '夸夸群群主', '六十次真诚（或敷衍）的夸奖', '称赞类 prompt ≥ 60 条', '🏅', 'rare', 'text', 60, S('cheer')),
  a('text_emo_30', '精神内耗', '“好累”“麻了”“顶不住”', '疲惫类 prompt ≥ 30 条', '😮‍💨', 'common', 'text', 30, S('emo')),
  a('text_emo_120', '打工人之魂', '一百二十次“心累”', '疲惫类 prompt ≥ 120 条', '🫠', 'rare', 'text', 120, S('emo')),
  a('text_coffee_20', '续命水', '咖啡、奶茶、可乐轮着来', '提到咖啡/奶茶 ≥ 20 次', '☕', 'common', 'text', 20, S('coffee')),
  a('text_coffee_80', '血液成分 80% 咖啡因', '八十次续命', '提到咖啡/奶茶 ≥ 80 次', '🧋', 'rare', 'text', 80, S('coffee')),
  a('text_friday_30', '周五了', '“下班”“周末”“摸鱼”', '提到周五/摸鱼 ≥ 30 次', '🍻', 'common', 'text', 30, S('friday')),
  a('text_rude_20', '嘴上不饶人', '“快点”“别废话”', '催促/暴躁类 prompt ≥ 20 条', '💢', 'rare', 'text', 20, S('rude')),
  a('text_rude_80', '暴躁老哥', '八十次催促，AI 已经习惯', '催促/暴躁类 prompt ≥ 80 条', '🤬', 'epic', 'text', 80, S('rude')),
  a('text_apologize_20', '我错了', '“抱歉”“是我搞错”', '道歉类 prompt ≥ 20 条', '😅', 'common', 'text', 20, S('apologize')),
  a('text_code_paste_100', '贴代码选手', '直接把代码糊进对话框', '粘贴代码片段的 prompt ≥ 100 条', '📋', 'common', 'text', 100, S('codePaste')),
  a('text_code_paste_400', '代码搬运工', '四百次粘贴，剪贴板都磨薄了', '粘贴代码片段的 prompt ≥ 400 条', '📎', 'rare', 'text', 400, S('codePaste')),

  // ── 职场：你聊的业务，暴露了你的工种 ──────────────────────────
  a('work_server_250', '后端嘴替', '“接口通了吗”是你的早安', '提到服务端/接口/数据库 ≥ 250 次', '🖧', 'common', 'workplace', 250, S('server')),
  a('work_server_900', '接口之神', '九百次谈接口，运维都得叫你一声哥', '提到服务端/接口/数据库 ≥ 900 次', '🔌', 'epic', 'workplace', 900, S('server')),
  a('work_git_200', '分支管理员', '合并冲突面前面不改色', '提到 git/分支/合并 ≥ 200 次', '🌿', 'common', 'workplace', 200, S('git')),
  a('work_git_700', '合并风暴', '你见过的冲突比别人见过的分支多', '提到 git/分支/合并 ≥ 700 次', '🌪️', 'epic', 'workplace', 700, S('git')),
  a('work_requirement_120', '需求粉碎机', '“策划又改了”', '提到需求/策划/文档 ≥ 120 次', '🗞️', 'common', 'workplace', 120, S('requirement')),
  a('work_requirement_400', '需求黑洞', '四百次需求变更，你已经无感', '提到需求/策划/文档 ≥ 400 次', '🕳️', 'epic', 'workplace', 400, S('requirement')),
  a('work_art_120', '美术翻译官', '“这个 UI 能不能再大一点”', '提到美术/UI/特效 ≥ 120 次', '🎨', 'common', 'workplace', 120, S('art')),
  a('work_art_400', '美术之友', '四百次和美术讨价还价', '提到美术/UI/特效 ≥ 400 次', '🖌️', 'epic', 'workplace', 400, S('art')),
  a('work_perf_100', '性能猎人', '帧率掉一帧你都能察觉', '提到性能/卡顿/内存 ≥ 100 次', '📉', 'rare', 'workplace', 100, S('perf')),
  a('work_perf_350', '帧率警察', '三百五十次性能优化', '提到性能/卡顿/内存 ≥ 350 次', '🚨', 'epic', 'workplace', 350, S('perf')),
  a('work_deploy_100', '发布狂魔', '“打完包就上”', '提到上线/打包/发布 ≥ 100 次', '🚚', 'rare', 'workplace', 100, S('deploy')),
  a('work_deploy_350', '发版机器', '三百五十次发布，流水线都认识你', '提到上线/打包/发布 ≥ 350 次', '🏭', 'epic', 'workplace', 350, S('deploy')),
  a('work_unity_40', 'Unity 原住民', 'Prefab 是你的第二个家', '提到 Unity/Prefab/热更 ≥ 40 次', '🎮', 'common', 'workplace', 40, S('unity')),
  a('work_unity_140', '引擎内鬼', '一百四十次 Unity 黑话', '提到 Unity/Prefab/热更 ≥ 140 次', '⚙️', 'rare', 'workplace', 140, S('unity')),
  a('work_test_15', '测试先行', '“先自测一下”', '提到测试/用例/回归 ≥ 15 次', '🧫', 'common', 'workplace', 15, S('test')),
  a('work_test_50', 'QA 之友', '五十次谈测试', '提到测试/用例/回归 ≥ 50 次', '🔬', 'rare', 'workplace', 50, S('test')),
  a('work_error_50', '报错搬运工', '整段堆栈直接糊上去', '粘贴报错/堆栈 ≥ 50 次', '🧯', 'common', 'workplace', 50, S('errorPaste')),
  a('work_error_180', '堆栈考古学家', 'NullReferenceException 的老朋友', '粘贴报错/堆栈 ≥ 180 次', '🏺', 'rare', 'workplace', 180, S('errorPaste')),
  a('work_refactor_25', '重构上瘾', '“顺手整理一下”——然后全改了', '提到重构/拆分/解耦 ≥ 25 次', '🧹', 'rare', 'workplace', 25, S('refactor')),
  a('work_refactor_90', '重构成瘾', '九十次重构，代码库已经没有原貌', '提到重构/拆分/解耦 ≥ 90 次', '🧨', 'epic', 'workplace', 90, S('refactor')),
  a('work_fullstack', '全栈打杂', '服务端、美术、Unity 全都聊', '四类业务词各 ≥ 50 次', '🧩', 'epic', 'workplace', 4, (m) => ['server', 'art', 'unity', 'requirement'].filter((key) => sig(m, key) >= 50).length),
  a('work_translator', '跨部门翻译机', '在策划、美术、后端之间来回传话', '需求 + 美术 + 服务端各 ≥ 100 次', '🗣️', 'rare', 'workplace', 3, (m) => ['requirement', 'art', 'server'].filter((key) => sig(m, key) >= 100).length),
  a('work_ops', '半个运维', '部署 + 服务端 + 性能全都管', '部署 + 服务端 + 性能各 ≥ 100 次', '🛠️', 'rare', 'workplace', 3, (m) => ['deploy', 'server', 'perf'].filter((key) => sig(m, key) >= 100).length),
  a('work_variety_10', '万金油', '十种业务词都聊过 30 次以上', '≥ 10 种业务信号各 ≥ 30 次', '🌈', 'epic', 'workplace', 10, (m) => ['server', 'git', 'requirement', 'art', 'perf', 'deploy', 'unity', 'test', 'errorPaste', 'refactor'].filter((key) => sig(m, key) >= 30).length),
  a('work_variety_10_100', '职场全才', '十种业务词都聊过 100 次以上', '≥ 10 种业务信号各 ≥ 100 次', '👔', 'legendary', 'workplace', 10, (m) => ['server', 'git', 'requirement', 'art', 'perf', 'deploy', 'unity', 'test', 'errorPaste', 'refactor'].filter((key) => sig(m, key) >= 100).length),
  a('work_git_unity', '热更分支战神', 'git 和 Unity 双修', 'git ≥ 200 且 Unity ≥ 40', '🌿', 'rare', 'workplace', 2, (m) => (sig(m, 'git') >= 200 && sig(m, 'unity') >= 40 ? 2 : 0)),

  // ── 代码与工具 ──────────────────────────────────────────────
  a('tools_8', '工具箱', '开始用工具了，恭喜', '使用过 ≥ 8 种工具', '🧰', 'common', 'code', 8, (m) => m.distinctTools),
  a('tools_20', '全能选手', '什么活儿都能接', '使用过 ≥ 20 种工具', '🎛️', 'rare', 'code', 20, (m) => m.distinctTools),
  a('tools_32', '工具人', '你本人就是一个调度器', '使用过 ≥ 32 种工具', '🦾', 'epic', 'code', 32, (m) => m.distinctTools),
  a('edits_400', '外科手术', '精准切开，缝合，收工', 'edit 工具调用 ≥ 400 次', '🔧', 'common', 'code', 400, T('edit')),
  a('edits_1600', '代码整容师', '你的改动记录像一部编年史', 'edit 工具调用 ≥ 1,600 次', '💉', 'epic', 'code', 1_600, T('edit')),
  a('writes_400', '造物主', '凭空变出文件，这就是魔法', 'write 工具调用 ≥ 400 次', '🧱', 'rare', 'code', 400, T('write')),
  a('writes_1600', '文件工厂', '一千六百次落盘', 'write 工具调用 ≥ 1,600 次', '🏗️', 'epic', 'code', 1_600, T('write')),
  a('reads_4000', '搬运工', '读过的东西比写过的多得多', 'read 工具调用 ≥ 4,000 次', '📖', 'rare', 'code', 4_000, T('read')),
  a('reads_16000', '阅读器成精', '一万六千次读文件', 'read 工具调用 ≥ 16,000 次', '👁️', 'epic', 'code', 16_000, T('read')),
  a('greps_1200', '考古学家', '在代码地层里翻找蛛丝马迹', 'grep/glob 调用 ≥ 1,200 次', '🔍', 'common', 'code', 1_200, T('grep', 'glob')),
  a('greps_4800', '代码地层钻探机', '四千八百次搜索', 'grep/glob 调用 ≥ 4,800 次', '⛏️', 'epic', 'code', 4_800, T('grep', 'glob')),
  a('shells_1200', '命令行原住民', '图形界面？那是什么', '终端命令调用 ≥ 1,200 次', '⌨️', 'rare', 'code', 1_200, T('pwsh', 'bash')),
  a('shells_4800', '终端活化石', '四千八百条命令', '终端命令调用 ≥ 4,800 次', '🖥️', 'epic', 'code', 4_800, T('pwsh', 'bash')),
  a('errors_200', '试错专家', '失败是成功之母，你有很多母亲', '工具报错 ≥ 200 次', '🧪', 'common', 'code', 200, (m) => m.toolErrors),
  a('errors_800', '踩坑专业户', '八百次报错，坑都被你踩平了', '工具报错 ≥ 800 次', '🕳️', 'epic', 'code', 800, (m) => m.toolErrors),
  a('file_cs_4000', 'C# 手术台', '四千次切进 .cs 文件', '读写 .cs 文件 ≥ 4,000 次', '🔪', 'rare', 'code', 4_000, X('cs')),
  a('file_js_4000', '前端搬运工', '.js 文件的无情搬运', '读写 .js 文件 ≥ 4,000 次', '📦', 'rare', 'code', 4_000, X('js')),
  a('file_java_4000', '服务端之手', '.java 里也有你的一半功劳', '读写 .java 文件 ≥ 4,000 次', '☕', 'rare', 'code', 4_000, X('java')),
  a('file_py_2000', '脚本人生', '能写脚本就不手动', '读写 .py 文件 ≥ 2,000 次', '🐍', 'common', 'code', 2_000, X('py')),
  a('file_md_2000', '文档工程师', '代码写得好，文档也不落下', '读写 .md 文件 ≥ 2,000 次', '📝', 'rare', 'code', 2_000, X('md')),
  a('file_json_3200', '配置达人', '.json 改到闭眼都不出错', '读写 .json 文件 ≥ 3,200 次', '🧾', 'common', 'code', 3_200, X('json')),
  a('file_prefab_1200', '预制体雕塑家', '.prefab 就是你的黏土', '读写 .prefab 文件 ≥ 1,200 次', '🗿', 'epic', 'code', 1_200, X('prefab')),
  a('cmd_git_2000', 'git 重度用户', 'status、diff、log 三件套', '执行 git 命令 ≥ 2,000 次', '🐙', 'rare', 'code', 2_000, C('git')),
  a('cmd_node_2000', 'Node 信徒', 'node 一把梭', '执行 node 命令 ≥ 2,000 次', '💚', 'common', 'code', 2_000, C('node')),
  a('cmd_python_1200', 'Python 召唤师', '胶水语言的忠实用户', '执行 python 命令 ≥ 1,200 次', '🧪', 'common', 'code', 1_200, C('python')),
  a('toolcalls_100k', '调用狂潮', '十万次工具调用', '工具调用总数 ≥ 100,000', '🌪️', 'epic', 'code', 100_000, (m) => m.toolCalls),
  a('toolcalls_400k', '机械降神', '四十万次调用，你已经是半自动生物', '工具调用总数 ≥ 400,000', '🤖', 'legendary', 'code', 400_000, (m) => m.toolCalls),
  a('edits_per_session_40', '每局四十刀', '平均每个会话改四十次文件', '单会话平均 edit ≥ 40 次', '🩹', 'rare', 'code', 40, (m) => (m.sessions > 0 ? Math.round(tool(m, 'edit') / m.sessions) : 0)),
  a('read_write_ratio_20', '只读不写', '读了二十倍于写的量', 'read 次数 ≥ write 次数 20 倍', '📚', 'rare', 'code', 20, (m) => (tool(m, 'write') > 0 ? Math.floor(tool(m, 'read') / tool(m, 'write')) : 0)),
  a('ext_variety_12', '文件类型杂食', '碰过 12 种以上文件类型', '读写过 ≥ 12 种扩展名', '🧬', 'rare', 'code', 12, (m) => Object.keys(m.exts || {}).length),
  a('ext_variety_20', '扩展名收藏家', '碰过 20 种以上文件类型', '读写过 ≥ 20 种扩展名', '🗃️', 'epic', 'code', 20, (m) => Object.keys(m.exts || {}).length),
  a('cmd_variety_6', '命令多面手', '用过 6 种以上命令行工具', '执行过 ≥ 6 种命令', '🧿', 'rare', 'code', 6, (m) => Object.keys(m.cmds || {}).length),
  a('cmd_variety_10', '命令全家桶', '用过 10 种以上命令行工具', '执行过 ≥ 10 种命令', '🍱', 'epic', 'code', 10, (m) => Object.keys(m.cmds || {}).length),
  a('subagent_120', '召唤师', '一个人就是一支队伍', '子代理调用 ≥ 120 次', '👥', 'epic', 'code', 120, T('subagent', 'subagent_fork')),
  a('workflow_40', '流水线工头', '让一堆代理替你打工', 'workflow 调用 ≥ 40 次', '🏗️', 'legendary', 'code', 40, T('workflow')),

  // ── 精通 ────────────────────────────────────────────────────
  a('models_3', '三心二意', '不同的活儿交给不同的模型', '使用过 ≥ 3 个模型', '🔀', 'common', 'mastery', 3, (m) => m.distinctModels),
  a('models_5', '模型收藏家', '你的模型列表像一份菜单', '使用过 ≥ 5 个模型', '🗂️', 'rare', 'mastery', 5, (m) => m.distinctModels),
  a('models_7', '七剑下天山', '七个模型，七种脾气，你都摸透了', '使用过 ≥ 7 个模型', '🗡️', 'epic', 'mastery', 7, (m) => m.distinctModels),
  a('providers_2', '双卡双待', '永远有一条备用线路', '使用过 ≥ 2 个供应商', '📶', 'common', 'mastery', 2, (m) => m.distinctProviders),
  a('providers_3', '多路供电', '三条线路随时切换', '使用过 ≥ 3 个供应商', '🔌', 'rare', 'mastery', 3, (m) => m.distinctProviders),
  a('projects_12', '多点开花', '十二个项目同时推进，很正常', '在 ≥ 12 个工作目录里干活', '🌿', 'rare', 'mastery', 12, (m) => m.projects),
  a('cache_rate_80', '缓存猎人', '能省的钱一分都不多花', '缓存命中率 ≥ 80%（累计 ≥ 100M Token）', '🏹', 'rare', 'mastery', 80, (m) => (m.tokens >= 100_000_000 ? Math.round(m.cacheHitRate * 100) : 0)),
  a('cache_rate_95', '缓存守财奴', '命中率 95%，云账单都被你砍薄了', '缓存命中率 ≥ 95%（累计 ≥ 1B Token）', '💰', 'epic', 'mastery', 95, (m) => (m.tokens >= 1_000_000_000 ? Math.round(m.cacheHitRate * 100) : 0)),
  a('fence_langs_12', '多语言输出', '代码块换着语言来', '输出过 ≥ 12 种代码块语言', '🌐', 'rare', 'mastery', 12, (m) => m.distinctFenceLangs),
  a('fence_langs_22', '语言博物馆', '二十种以上代码块语言', '输出过 ≥ 22 种代码块语言', '🏛️', 'legendary', 'mastery', 22, (m) => m.distinctFenceLangs),
  a('fences_5000', '代码瀑布', '五千个代码块从对话框里流出来', '累计代码块 ≥ 5,000 个', '🌊', 'epic', 'mastery', 5_000, (m) => m.totalFences),
  a('fences_20000', '代码海啸', '两万个代码块', '累计代码块 ≥ 20,000 个', '🌀', 'legendary', 'mastery', 20_000, (m) => m.totalFences),
  a('efficient_20m', '单位效率王', '平均每个 prompt 烧掉两万 Token', '单 prompt 平均 ≥ 20,000 Token', '⚡', 'epic', 'mastery', 20_000, (m) => (m.humanPrompts > 0 ? Math.round(m.tokens / m.humanPrompts) : 0)),
  a('tokens_per_turn_1m', '单轮重炮', '平均每轮消耗一百万', '单轮平均 ≥ 1,000,000 Token', '🎯', 'epic', 'mastery', 1_000_000, (m) => (m.turns > 0 ? Math.round(m.tokens / m.turns) : 0)),
  a('sessions_per_day_5', '日均五局', '平均每天五局以上', '日均会话 ≥ 5', '📊', 'rare', 'mastery', 5, (m) => (m.activeDays > 0 ? Math.round(m.sessions / m.activeDays) : 0)),
  a('prompts_per_session_20', '一局二十问', '每个会话平均二十条 prompt', '单会话平均 prompt ≥ 20 条', '🗨️', 'rare', 'mastery', 20, (m) => (m.sessions > 0 ? Math.round(m.humanPrompts / m.sessions) : 0)),
  a('turns_per_session_100', '一局百轮', '一个会话平均一百轮对话', '单会话平均轮次 ≥ 100', '♾️', 'epic', 'mastery', 100, (m) => (m.sessions > 0 ? Math.round(m.turns / m.sessions) : 0)),
  a('long_session_1000_turns', '千轮长谈', '单个会话超过一千轮', '单会话轮次 ≥ 1,000', '🕰️', 'epic', 'mastery', 1_000, (m) => m.maxSessionTurns),
  a('all_models_family', '模型全家桶', '同时用过 DeepSeek 与其它厂商', '供应商 ≥ 4 且模型 ≥ 7', '🧭', 'epic', 'mastery', 2, (m) => (m.distinctProviders >= 4 && m.distinctModels >= 7 ? 2 : 0)),
  a('balanced_usage', '均衡派', '输入输出比例健康（0.2–5 倍）', '输出/输入比在 0.2–5 之间且总量 ≥ 1B', '⚖️', 'rare', 'mastery', 1, (m) => (m.tokens >= 1_000_000_000 && m.input > 0 && m.output / m.input >= 0.2 && m.output / m.input <= 5 ? 1 : 0)),
  a('reasoning_ratio_1', '深度思考派', '推理 Token 占比 ≥ 1%', '推理 Token ≥ 总输出 1%（≥ 10M 输出）', '🤔', 'epic', 'mastery', 1, (m) => (m.output >= 10_000_000 && m.reasoning / m.output >= 0.01 ? 1 : 0)),
  a('cache_ratio_90', '缓存大师', '缓存读取占总 Token 90% 以上', '缓存占比 ≥ 90%（≥ 1B Token）', '🧊', 'epic', 'mastery', 90, (m) => (m.tokens >= 1_000_000_000 ? Math.round((m.cacheRead / m.tokens) * 100) : 0)),
  a('mastery_all_categories', '样样精通', '12 个分类各解锁至少 5 枚', '每个分类解锁 ≥ 5 枚', '🎖️', 'legendary', 'mastery', 12, (m) => (m.categoryUnlocks ? Object.values(m.categoryUnlocks).filter((n) => n >= 5).length : 0)),

  // ── 探索与收集：第一次用上某个工具 ────────────────────────────
  a('explore_read_image', '看得见了', '第一次让模型看图', '使用 read_image ≥ 1 次', '🖼️', 'common', 'explore', 1, T('read_image')),
  a('explore_present', '交付仪式', '第一次用 present 交付文件', '使用 present ≥ 1 次', '🎁', 'common', 'explore', 1, T('present')),
  a('explore_web_search', '外部世界', '第一次联网搜索', '使用 web_search ≥ 1 次', '🌐', 'common', 'explore', 1, T('web_search')),
  a('explore_web_fetch', '抓取网页', '第一次直接抓网页内容', '使用 web_fetch ≥ 1 次', '🕸️', 'common', 'explore', 1, T('web_fetch')),
  a('explore_skill', '技能树', '第一次加载 skill', '使用 skill ≥ 1 次', '🌳', 'common', 'explore', 1, T('skill')),
  a('explore_skill_20', '技能收集者', '加载过 20 次技能', '使用 skill ≥ 20 次', '📚', 'rare', 'explore', 20, T('skill')),
  a('explore_todo', '任务清单', '第一次用 todo_write 规划', '使用 todo_write ≥ 1 次', '📋', 'common', 'explore', 1, T('todo_write')),
  a('explore_goal', '立个目标', '第一次创建长期目标', '使用 create_goal ≥ 1 次', '🎯', 'rare', 'explore', 1, T('create_goal')),
  a('explore_schedule', '定时闹钟', '第一次创建定时提醒', '使用 schedule_create ≥ 1 次', '⏰', 'rare', 'explore', 1, T('schedule_create')),
  a('explore_job', '后台挂机', '第一次查看后台任务输出', '使用 job_output ≥ 1 次', '🧵', 'common', 'explore', 1, T('job_output')),
  a('explore_terminal', '开个终端', '第一次打开持久终端', '使用 terminal_open ≥ 1 次', '🖥️', 'rare', 'explore', 1, T('terminal_open')),
  a('explore_ask_user', '先问一句', '第一次用 ask_user_question 确认', '使用 ask_user_question ≥ 1 次', '🙋', 'common', 'explore', 1, T('ask_user_question')),
  a('explore_lsp', '语言服务', '第一次调用 lsp', '使用 lsp ≥ 1 次', '🧠', 'rare', 'explore', 1, T('lsp')),
  a('explore_cordis', '改插件', '第一次用 cordis_inspect 或 define', '使用 cordis_* ≥ 1 次', '🧩', 'rare', 'explore', 1, T('cordis_inspect_list', 'cordis_inspect_query', 'cordis_define')),
  a('explore_subagent', '分头行动', '第一次派子代理干活', '使用 subagent ≥ 1 次', '🪂', 'common', 'explore', 1, T('subagent', 'subagent_fork')),
  a('explore_team', '组个队', '第一次用团队任务', '使用 team_task_create ≥ 1 次', '🏉', 'epic', 'explore', 1, T('team_task_create', 'spawn_teammate')),
  a('explore_25_tools', '工具图鉴', '用过 25 种以上工具', '使用过 ≥ 25 种工具', '📖', 'epic', 'explore', 25, (m) => m.distinctTools),
  a('explore_30_tools', '工具大全', '用过 30 种以上工具', '使用过 ≥ 30 种工具', '🏆', 'legendary', 'explore', 30, (m) => m.distinctTools),

  // ── 彩蛋：AI 那边的表现也算进你的战绩 ─────────────────────────
  a('code_blocks_3000', '代码喷泉', '对话框里流出来的都是代码', '累计输出代码块 ≥ 3,000 个', '⛲', 'rare', 'easter', 3_000, (m) => m.codeBlocks),
  a('code_blocks_12000', '代码熔炉', '一万两千个代码块', '累计输出代码块 ≥ 12,000 个', '🔥', 'legendary', 'easter', 12_000, (m) => m.codeBlocks),
  a('assistant_chars_5m', '与 AI 长谈', '五百万字符的陪伴', 'AI 输出 ≥ 5,000,000 字符', '💬', 'epic', 'easter', 5_000_000, (m) => m.assistantChars),
  a('assistant_chars_20m', '文字洪水', '两千万字符，够印刷成书', 'AI 输出 ≥ 20,000,000 字符', '🌊', 'legendary', 'easter', 20_000_000, (m) => m.assistantChars),
  a('ai_apology_40', 'AI 认错', '“你说得对，是我的问题”', 'AI 道歉 ≥ 40 次', '🙇', 'common', 'easter', 40, AI('apology')),
  a('ai_apology_160', '专业背锅', '一百六十次认错，它已经很熟练了', 'AI 道歉 ≥ 160 次', '🫡', 'rare', 'easter', 160, AI('apology')),
  a('ai_hedge_1000', '免责声明', '“可能”“大概”“取决于”', 'AI 含糊措辞 ≥ 1,000 次', '🛡️', 'rare', 'easter', 1_000, AI('hedge')),
  a('ai_hedge_4000', '免责声明工厂', '四千次含糊其辞', 'AI 含糊措辞 ≥ 4,000 次', '⚖️', 'epic', 'easter', 4_000, AI('hedge')),
  a('ai_table_1000', '表格控', '什么都想画成表', 'AI 输出表格 ≥ 1,000 次', '🧮', 'common', 'easter', 1_000, AI('table')),
  a('ai_list_1500', '清单狂魔', '一二三四五，条理清晰', 'AI 输出列表 ≥ 1,500 次', '🗒️', 'rare', 'easter', 1_500, AI('list')),
  a('ai_todo_100', 'TODO 制造机', '留下 TODO，留给未来的自己', 'AI 输出 TODO/FIXME ≥ 100 次', '📌', 'common', 'easter', 100, AI('todo')),
  a('ai_emoji_500', 'AI 卖萌', '它开始用表情跟你说话了', 'AI 回复带 emoji ≥ 500 次', '🤖', 'common', 'easter', 500, AI('emoji')),
  a('ai_long_200', '长篇大论', '一次回复四千字，看不完根本看不完', 'AI 超长回复 ≥ 200 次', '📖', 'rare', 'easter', 200, AI('long')),
  a('ai_csharp_400', 'C# 流水线', 'csharp 代码块刷屏', 'csharp 代码块 ≥ 400 个', '🎯', 'rare', 'easter', 400, F('csharp')),
  a('ai_java_200', 'Java 老伙计', '两百个 Java 代码块', 'java 代码块 ≥ 200 个', '☕', 'rare', 'easter', 200, F('java')),
  a('ai_bash_200', '脚本狂', '两百个 bash/sh 代码块', 'bash/sh 代码块 ≥ 200 个', '🐚', 'rare', 'easter', 200, (m) => fence(m, 'bash') + fence(m, 'sh')),
  a('ai_python_60', '蛇语者', '六十个 Python 代码块', 'python 代码块 ≥ 60 个', '🐍', 'common', 'easter', 60, F('python')),
  a('ai_plain_4000', '裸文本流', '四千个无语言标注的代码块', 'plain 代码块 ≥ 4,000 个', '📄', 'epic', 'easter', 4_000, F('plain')),
  a('ai_diff_20', '补丁美学', '二十个 diff 代码块', 'diff 代码块 ≥ 20 个', '🩹', 'rare', 'easter', 20, F('diff')),
  a('daily_sessions_20', '一天二十局', '这不是沉迷，这是热爱', '单日会话 ≥ 20', '🎮', 'rare', 'easter', 20, (m) => m.maxDailySessions),
  a('midnight_tokens_10m', '子夜燃烧', '凌晨四点，你和模型都没睡', '0–4 点消耗 ≥ 10,000,000 Token', '🕯️', 'legendary', 'easter', 10_000_000, (m) => m.lateNightTokens, { hidden: true }),
  a('hidden_3am_habit', '三点钟俱乐部', '凌晨三点开了二十局', '0–4 点开始的会话 ≥ 20', '🕛', 'epic', 'easter', 20, (m) => m.lateSessions, { hidden: true }),
  a('ai_said_no', 'AI 也会说不', '它拒绝了你（或者只是没听懂）', '工具报错 ≥ 500 次且 AI 道歉 ≥ 40 次', '🚫', 'rare', 'easter', 2, (m) => (m.toolErrors >= 500 && ai(m, 'apology') >= 40 ? 2 : 0)),
  a('perfect_day', '完美的一天', '单日消耗破千万且零报错', '单日 ≥ 10M Token 且当日无报错', '🌟', 'epic', 'easter', 1, (m) => (m.maxDailyTokens >= 10_000_000 && m.toolErrors === 0 ? 1 : 0)),
  a('emoji_storm', '表情包大战', '你发 emoji，它也发 emoji', '双方 emoji ≥ 30 次', '😹', 'rare', 'easter', 2, (m) => (sig(m, 'emoji') >= 30 && ai(m, 'emoji') >= 30 ? 2 : 0)),
  a('hedge_and_doubt', '互相怀疑', '你质疑它，它含糊其辞', '质疑 ≥ 100 且含糊措辞 ≥ 1,000', '🕵️', 'epic', 'easter', 2, (m) => (sig(m, 'doubt') >= 100 && ai(m, 'hedge') >= 1_000 ? 2 : 0)),
  a('table_lover', '万物皆可表格', '表格 ≥ 1,000 且列表 ≥ 1,500', 'AI 表格与列表双高', '📊', 'epic', 'easter', 2, (m) => (ai(m, 'table') >= 1_000 && ai(m, 'list') >= 1_500 ? 2 : 0)),
  a('no_weekend', '没有周末的人', '周末也在烧 Token', '周末会话 ≥ 40', '📆', 'rare', 'easter', 40, (m) => m.weekendSessions),
  a('coffee_and_code', '咖啡因驱动', '咖啡与代码同时出现', '咖啡 ≥ 20 且代码块 ≥ 3,000', '☕', 'rare', 'easter', 2, (m) => (sig(m, 'coffee') >= 20 && m.codeBlocks >= 3_000 ? 2 : 0)),
  a('dsh_anniversary', '一年之后', '和 DSH 相处满一年', '使用跨度 ≥ 365 天', '🎂', 'legendary', 'easter', 365, (m) => (m.firstAt && m.lastAt ? Math.round((m.lastAt - m.firstAt) / 86_400_000) : 0)),
  a('easter_all_hours', '生物钟不存在', '24 个时段全部有记录', '24 个时段都有消耗', '🌍', 'legendary', 'easter', 24, (m) => (m.hourly || []).filter((value) => value > 0).length),

  // ── 翻车现场：错误、重试与认错 ────────────────────────────────
  a('fail_errors_2000', '试错机器', '两千次工具报错', '工具报错 ≥ 2,000 次', '💣', 'epic', 'fail', 2_000, (m) => m.toolErrors),
  a('fail_errors_8000', '报错收集癖', '八千次报错，你已经免疫', '工具报错 ≥ 8,000 次', '☠️', 'legendary', 'fail', 8_000, (m) => m.toolErrors),
  a('fail_retry_800', '重试之王', '八百次“再试一次”', '重试/纠正类 prompt ≥ 800 条', '🔁', 'epic', 'fail', 800, S('retry')),
  a('fail_apology_80', '我也认错', '八十次向 AI 道歉', '道歉类 prompt ≥ 80 条', '😅', 'rare', 'fail', 80, S('apologize')),
  a('fail_error_paste_400', '堆栈专业户', '四百次粘贴报错', '粘贴报错/堆栈 ≥ 400 次', '🧯', 'epic', 'fail', 400, S('errorPaste')),
  a('fail_session_errors_20', '一局二十错', '单个会话报错二十次', '单会话报错 ≥ 20 次', '🧨', 'rare', 'fail', 20, (m) => m.maxSessionErrors),
  a('fail_session_errors_80', '一局八十错', '单个会话报错八十次', '单会话报错 ≥ 80 次', '💀', 'legendary', 'fail', 80, (m) => m.maxSessionErrors),
  a('fail_error_rate_5', '翻车率 5%', '每一百次调用就有五次报错', '工具报错率 ≥ 5%（≥ 10,000 次调用）', '📉', 'epic', 'fail', 5, (m) => (m.toolCalls >= 10_000 ? Math.round((m.toolErrors / m.toolCalls) * 100) : 0)),
  a('fail_rude_80', '暴躁老哥', '八十次催促，AI 已经习惯', '催促/暴躁类 prompt ≥ 80 条', '🤬', 'epic', 'fail', 80, S('rude')),
  a('fail_emo_120', '打工人之魂', '一百二十次“心累”', '疲惫类 prompt ≥ 120 条', '🫠', 'rare', 'fail', 120, S('emo')),
  a('fail_blame_80', '甩锅成瘾', '八十次“不是我的问题”', '归咎类表达 ≥ 80 次', '🍳', 'epic', 'fail', 80, (m) => m.sentiment.blame),
  a('fail_pua_600', 'PUA 宗师', '六百次“你确定吗”', '质疑类表达 ≥ 600 次', '🌀', 'legendary', 'fail', 600, (m) => m.sentiment.pua),
  a('fail_insult_300', '嘴上不留情', '三百次吐槽', '吐槽类表达 ≥ 300 次', '💢', 'legendary', 'fail', 300, (m) => m.sentiment.insult),
  a('fail_three_in_a_row', '三连翻车', '同一个会话里连错三次', '单会话报错 ≥ 3 次（≥ 50 局）', '🎳', 'common', 'fail', 3, (m) => (m.sessions >= 50 ? m.maxSessionErrors : 0)),
  a('fail_dead_end', '死胡同', '报错数超过会话数', '报错 ≥ 会话数 × 20', '🚧', 'epic', 'fail', 20, (m) => (m.sessions > 0 ? Math.round(m.toolErrors / m.sessions) : 0)),
  a('fail_ai_sorry_80', 'AI 一直在道歉', '八十次 AI 认错', 'AI 道歉 ≥ 80 次', '🙏', 'rare', 'fail', 80, AI('apology')),
  a('fail_retry_ratio_30', '三成在重试', '三成的 prompt 都在重试', '重试占比 ≥ 30%（≥ 500 条 prompt）', '♻️', 'epic', 'fail', 30, (m) => (m.humanPrompts >= 500 ? Math.round((sig(m, 'retry') / m.humanPrompts) * 100) : 0)),
  a('fail_doubt_ratio_20', '两成在质疑', '两成的 prompt 都在怀疑', '质疑占比 ≥ 20%（≥ 500 条 prompt）', '🤨', 'epic', 'fail', 20, (m) => (m.humanPrompts >= 500 ? Math.round((sig(m, 'doubt') / m.humanPrompts) * 100) : 0)),
  a('fail_never_give_up', '不抛弃不放弃', '重试五百次还在继续', '重试 ≥ 500 且会话 ≥ 200', '🏳️', 'legendary', 'fail', 500, S('retry')),
  a('fail_crash_paste_1000', '报错博物馆', '一千次粘贴报错', '粘贴报错/堆栈 ≥ 1,000 次', '🏛️', 'legendary', 'fail', 1_000, S('errorPaste')),

  // ── 自我改造：把 DSH 当成自己的工具用 ──────────────────────────
  a('meta_todo_100', '计划狂', '一百次任务清单', 'todo_write ≥ 100 次', '📋', 'rare', 'meta', 100, T('todo_write')),
  a('meta_goal_10', '目标管理', '创建过 10 个长期目标', 'create_goal ≥ 10 次', '🎯', 'epic', 'meta', 10, T('create_goal')),
  a('meta_schedule_20', '闹钟大师', '创建过 20 个定时提醒', 'schedule_create ≥ 20 次', '⏰', 'epic', 'meta', 20, T('schedule_create')),
  a('meta_job_500', '后台调度员', '五百次查看后台任务', 'job_output ≥ 500 次', '🧵', 'rare', 'meta', 500, T('job_output')),
  a('meta_terminal_50', '终端常驻', '五十次打开持久终端', 'terminal_open ≥ 50 次', '🖥️', 'epic', 'meta', 50, T('terminal_open')),
  a('meta_skill_200', '技能专家', '加载过 200 次技能', 'skill ≥ 200 次', '🌳', 'epic', 'meta', 200, T('skill')),
  a('meta_present_50', '交付大师', '五十次交付文件', 'present ≥ 50 次', '🎁', 'rare', 'meta', 50, T('present')),
  a('meta_ask_100', '先问清楚', '一百次主动确认', 'ask_user_question ≥ 100 次', '🙋', 'rare', 'meta', 100, T('ask_user_question')),
  a('meta_image_200', '看图二百次', '两百次读图', 'read_image ≥ 200 次', '🖼️', 'epic', 'meta', 200, T('read_image')),
  a('meta_search_500', '搜索成瘾', '五百次联网搜索', 'web_search ≥ 500 次', '🔎', 'epic', 'meta', 500, T('web_search')),
  a('meta_fetch_500', '抓取成瘾', '五百次抓网页', 'web_fetch ≥ 500 次', '🕸️', 'epic', 'meta', 500, T('web_fetch')),
  a('meta_lsp_50', '语义分析派', '五十次语言服务调用', 'lsp ≥ 50 次', '🧠', 'epic', 'meta', 50, T('lsp')),
  a('meta_cordis_50', '插件工程师', '五十次检查/修改插件', 'cordis_* ≥ 50 次', '🧩', 'legendary', 'meta', 50, T('cordis_inspect_list', 'cordis_inspect_query', 'cordis_define', 'cordis_run')),
  a('meta_subagent_200', '指挥官', '两百次派发子代理', 'subagent ≥ 200 次', '🪂', 'epic', 'meta', 200, T('subagent', 'subagent_fork')),
  a('meta_workflow_100', '流水线总监', '一百次 workflow', 'workflow ≥ 100 次', '🏗️', 'legendary', 'meta', 100, T('workflow')),
  a('meta_edit_2000', '改到自己满意', '两千次编辑', 'edit ≥ 2,000 次', '✂️', 'epic', 'meta', 2_000, T('edit')),
  a('meta_read_20000', '读档两万', '两万次读文件', 'read ≥ 20,000 次', '📚', 'legendary', 'meta', 20_000, T('read')),
  a('meta_write_2000', '造物两千次', '两千次写文件', 'write ≥ 2,000 次', '🖊️', 'legendary', 'meta', 2_000, T('write')),
  a('meta_tool_variety_5', '五件套', '同时用满 5 类工具', '五类工具各 ≥ 10 次', '🧰', 'rare', 'meta', 5, (m) => [tool(m, 'read'), tool(m, 'edit'), tool(m, 'write'), tool(m, 'grep') + tool(m, 'glob'), tool(m, 'pwsh') + tool(m, 'bash')].filter((n) => n >= 10).length),
  a('meta_all_tools_15', '全工具制霸', '15 类工具各 ≥ 100 次', '15 类工具各 ≥ 100 次', '🎖️', 'legendary', 'meta', 15, (m) => Object.values(m.tools || {}).filter((n) => n >= 100).length),
  a('meta_dsh_version', '跟版本跑', '用过的模型数量随版本增长', '模型 ≥ 7 且供应商 ≥ 4', '🔄', 'epic', 'meta', 2, (m) => (m.distinctModels >= 7 && m.distinctProviders >= 4 ? 2 : 0)),
  a('meta_self_improve', '自我改造', '改过 DSH 插件并重启', 'cordis_define ≥ 1 且 重启后仍在用', '🔧', 'epic', 'meta', 1, T('cordis_define')),
  a('meta_schedule_daily', '定时生活', '创建过每日提醒', 'schedule_create ≥ 10', '📆', 'rare', 'meta', 10, T('schedule_create')),
  a('meta_goal_done', '目标达成', '完成过一个长期目标', 'update_goal ≥ 10 次', '✅', 'rare', 'meta', 10, T('update_goal', 'get_goal')),
  a('meta_plan_then_do', '先规划后动手', '清单 + 编辑各一百次', 'todo_write ≥ 100 且 edit ≥ 100', '🗺️', 'rare', 'meta', 2, (m) => (tool(m, 'todo_write') >= 100 && tool(m, 'edit') >= 100 ? 2 : 0)),
  a('meta_tool_everything', '工具全图鉴', '32 种工具全部用过', '使用过 ≥ 32 种工具', '🌐', 'legendary', 'meta', 32, (m) => m.distinctTools),
  a('meta_memory', '记住这件事', '使用过记忆类工具', 'memory 相关工具 ≥ 1 次', '🧷', 'common', 'meta', 1, T('memory', 'remember', 'recall')),
  a('meta_plan_mode', '先计划再执行', '进入过计划模式', '使用过计划相关工具 ≥ 1 次', '📐', 'common', 'meta', 1, T('exit_plan_mode', 'plan')),

  // ── 社交与排行：云端那部分 ────────────────────────────────────
  a('social_login', '上线了', '把成绩同步到了排行榜', '成功登录排行榜 ≥ 1 次', '📡', 'common', 'social', 1, (m) => (m.cloud && m.cloud.loggedIn ? 1 : 0)),
  a('social_sync_1', '第一次同步', '把成绩推上了服务器', '同步 ≥ 1 次', '☁️', 'common', 'social', 1, (m) => (m.cloud && m.cloud.syncs) || 0),
  a('social_sync_10', '习惯同步', '同步过 10 次', '同步 ≥ 10 次', '🔄', 'rare', 'social', 10, (m) => (m.cloud && m.cloud.syncs) || 0),
  a('social_sync_50', '云端常客', '同步过 50 次', '同步 ≥ 50 次', '🗄️', 'epic', 'social', 50, (m) => (m.cloud && m.cloud.syncs) || 0),
  a('social_top10', '挤进前十', '排行榜前十名', '排行榜名次 ≤ 10', '🔟', 'rare', 'social', 10, (m) => (m.cloud && m.cloud.bestRank > 0 ? 11 - Math.min(10, m.cloud.bestRank) : 0)),
  a('social_top3', '站上领奖台', '排行榜前三名', '排行榜名次 ≤ 3', '🥉', 'epic', 'social', 3, (m) => (m.cloud && m.cloud.bestRank > 0 ? 4 - Math.min(3, m.cloud.bestRank) : 0)),
  a('social_rank1', '榜首', '排行榜第一名', '排行榜名次 = 1', '👑', 'legendary', 'social', 1, (m) => (m.cloud && m.cloud.bestRank === 1 ? 1 : 0)),
  a('social_100_ach', '百枚玩家', '排行榜上的成就数破百', '云端成就数 ≥ 100', '💯', 'rare', 'social', 100, (m) => (m.cloud && m.cloud.achievements) || 0),
  a('social_200_ach', '两百枚玩家', '排行榜上的成就数破两百', '云端成就数 ≥ 200', '🏅', 'epic', 'social', 200, (m) => (m.cloud && m.cloud.achievements) || 0),
  a('social_season', '赛季选手', '参与过至少一个赛季', '建立赛季起点 ≥ 1 次', '🏁', 'common', 'social', 1, (m) => (m.cloud && m.cloud.season ? 1 : 0)),
  a('social_competitor', '有人追我了', '排行榜上出现其它玩家', '排行榜玩家数 ≥ 2', '🆚', 'rare', 'social', 2, (m) => (m.cloud && m.cloud.players) || 0),
  a('social_guild', '小圈子', '排行榜玩家数 ≥ 5', '排行榜玩家数 ≥ 5', '👥', 'epic', 'social', 5, (m) => (m.cloud && m.cloud.players) || 0),
  a('social_offline', '断网也能玩', '从未登录排行榜，纯本地 100 枚', '未登录但本地解锁 ≥ 100 枚', '📴', 'rare', 'social', 1, (m) => (m.cloud && !m.cloud.loggedIn && m.localUnlocked >= 100 ? 1 : 0)),
  // ── 系列完成奖励：把一整类点亮 ────────────────────────────────
  a('series_token', 'Token 收藏家', 'Token 流量这一整类都被你点亮了', '点亮「Token 流量」全部成就', '🏆', 'legendary', 'token', 1, (m) => m.categoryUnlocks.token || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.token || 1) - 1) }),
  a('series_interaction', '社交达人', '交互这一整类都被你点亮了', '点亮「交互」全部成就', '🏆', 'legendary', 'interaction', 1, (m) => m.categoryUnlocks.interaction || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.interaction || 1) - 1) }),
  a('series_time', '时间领主', '时间这一整类都被你点亮了', '点亮「时间」全部成就', '🏆', 'legendary', 'time', 1, (m) => m.categoryUnlocks.time || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.time || 1) - 1) }),
  a('series_text', '语言学家', '文本性格这一整类都被你点亮了', '点亮「文本性格」全部成就', '🏆', 'legendary', 'text', 1, (m) => m.categoryUnlocks.text || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.text || 1) - 1) }),
  a('series_workplace', '职场王者', '职场这一整类都被你点亮了', '点亮「职场」全部成就', '🏆', 'legendary', 'workplace', 1, (m) => m.categoryUnlocks.workplace || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.workplace || 1) - 1) }),
  a('series_code', '代码宗师', '代码与工具这一整类都被你点亮了', '点亮「代码与工具」全部成就', '🏆', 'legendary', 'code', 1, (m) => m.categoryUnlocks.code || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.code || 1) - 1) }),
  a('series_mastery', '全知全能', '精通这一整类都被你点亮了', '点亮「精通」全部成就', '🏆', 'legendary', 'mastery', 1, (m) => m.categoryUnlocks.mastery || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.mastery || 1) - 1) }),
  a('series_explore', '探险家', '探索与收集这一整类都被你点亮了', '点亮「探索与收集」全部成就', '🏆', 'legendary', 'explore', 1, (m) => m.categoryUnlocks.explore || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.explore || 1) - 1) }),
  a('series_easter', '彩蛋猎人', '彩蛋这一整类都被你点亮了', '点亮「彩蛋」全部成就', '🏆', 'legendary', 'easter', 1, (m) => m.categoryUnlocks.easter || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.easter || 1) - 1) }),
  a('series_fail', '翻车之王', '翻车现场这一整类都被你点亮了', '点亮「翻车现场」全部成就', '🏆', 'legendary', 'fail', 1, (m) => m.categoryUnlocks.fail || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.fail || 1) - 1) }),
  a('series_meta', '自我进化', '自我改造这一整类都被你点亮了', '点亮「自我改造」全部成就', '🏆', 'legendary', 'meta', 1, (m) => m.categoryUnlocks.meta || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.meta || 1) - 1) }),
  a('series_social', '社交之星', '社交与排行这一整类都被你点亮了', '点亮「社交与排行」全部成就', '🏆', 'legendary', 'social', 1, (m) => m.categoryUnlocks.social || 0, { targetOf: (m) => Math.max(1, (m.categoryTotal.social || 1) - 1) }),
];
const BY_ID = new Map(ACHIEVEMENTS.map((def) => [def.id, def]));

/**
 * Level curve: nearly flat on purpose. 301 achievements are worth ~9.4k points
 * in total, so the level should track completion (about 78% of the points
 * reaches the last title) instead of front-loading cheap early levels.
 */
export function levelFor(points) {
  let level = 1;
  let need = 150;
  let spent = 0;
  while (points >= spent + need && level < 60) {
    spent += need;
    level += 1;
    need = 150 + 2 * (level - 1);
  }
  return { level, into: points - spent, need, floor: spent };
}

export function titleFor(level) {
  if (level >= 40) return 'Token 之神';
  if (level >= 30) return '算力领主';
  if (level >= 22) return 'AI 编排官';
  if (level >= 15) return '资深提示工程师';
  if (level >= 10) return '熟练工';
  if (level >= 6) return '见习生';
  return '新手观察员';
}

/**
 * Evaluate every achievement against aggregate metrics.
 *
 * @param {object} metrics aggregate metrics (see scan.js `aggregate`)
 * @param {Record<string, number>} unlockedAt existing unlock timestamps
 * @param {number} now
 * @param {{cloud?: object}} [extra] runtime facts that are not session data
 */
export function evaluate(metrics, unlockedAt, now = Date.now(), extra = {}) {
  const unlocked = { ...unlockedAt };
  const items = [];
  const fresh = [];
  let points = 0;

  // Pre-pass so achievements can read "how many are unlocked per category"
  // without the loop depending on its own output.
  const categoryUnlocks = {};
  let localUnlocked = 0;
  for (const def of ACHIEVEMENTS) {
    if (typeof unlocked[def.id] === 'number') {
      categoryUnlocks[def.category] = (categoryUnlocks[def.category] || 0) + 1;
      localUnlocked += 1;
    }
  }
  const categoryTotal = {};
  for (const def of ACHIEVEMENTS) {
    categoryTotal[def.category] = (categoryTotal[def.category] || 0) + 1;
  }
  const enriched = {
    ...metrics,
    categoryUnlocks,
    categoryTotal,
    localUnlocked,
    cloud: extra.cloud || metrics.cloud || null,
  };

  for (const def of ACHIEVEMENTS) {
    let value = 0;
    try {
      value = Number(def.metric(enriched)) || 0;
    } catch {
      value = 0;
    }
    // A few achievements (series completion) derive their target from the
    // live catalog instead of a constant.
    const target = typeof def.targetOf === 'function' ? Number(def.targetOf(enriched)) || def.target : def.target;
    const ratio = target > 0 ? Math.min(1, value / target) : 0;
    const already = typeof unlocked[def.id] === 'number';
    const hit = already || ratio >= 1;
    if (hit && !already) {
      unlocked[def.id] = now;
      fresh.push(def.id);
    }
    if (hit) points += def.points;
    items.push({
      id: def.id,
      name: def.name,
      desc: def.desc,
      cond: def.cond,
      icon: def.icon,
      art: ACHIEVEMENT_ART[def.id] || null,
      rarity: def.rarity,
      category: def.category,
      points: def.points,
      hidden: Boolean(def.hidden),
      /**
       * Secret: the wall shows a lock instead of the name and description.
       * Most achievements start secret and reveal themselves once they are
       * unlocked or close enough to be worth teasing; easter eggs never leak
       * early, so they stay locked until they actually fire.
       */
      secret:
        !hit &&
        (def.hidden
          ? true
          : // Common-tier goals are the on-ramp: always visible so a new
            // profile still has something concrete to chase.
            def.points > P.common && ratio < SECRET_REVEAL_RATIO),
      target,
      value: Math.round(value),
      ratio: Number(ratio.toFixed(4)),
      unlockedAt: hit ? unlocked[def.id] : null,
    });
  }

  const { level, into, need, floor } = levelFor(points);
  return {
    items,
    unlocked,
    fresh,
    points,
    level,
    levelInto: into,
    levelNeed: need,
    levelFloor: floor,
    title: titleFor(level),
  };
}

export function achievementById(id) {
  return BY_ID.get(id);
}




