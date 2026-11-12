/**
 * CodeQuest for DSH — achievement definitions and evaluation.
 *
 * Definitions are pure data: each achievement names a metric reader, a target,
 * and presentation fields. `evaluate()` turns an aggregate metrics object into
 * unlocked ids + per-achievement progress, so the same code serves the HTTP
 * endpoint, the UI and the agent tool.
 */

import { ACHIEVEMENT_ART } from './art.js';

/** @typedef {'common'|'rare'|'epic'|'legendary'} Rarity */
/** @typedef {'token'|'interaction'|'time'|'code'|'mastery'|'easter'} Category */

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

export const CATEGORY_LABELS = {
  token: 'Token 流量',
  interaction: '交互',
  time: '时间',
  text: '文本性格',
  workplace: '职场',
  code: '代码与工具',
  mastery: '精通',
  easter: '彩蛋',
};

/** Signal counters are sparse maps; missing keys simply read as zero. */
const sig = (m, key) => (m.signals && m.signals[key]) || 0;
const ai = (m, key) => (m.assistant && m.assistant[key]) || 0;
const fence = (m, lang) => (m.assistant && m.assistant.fences && m.assistant.fences[lang]) || 0;
const ext = (m, key) => (m.exts && m.exts[key]) || 0;
const cmd = (m, key) => (m.cmds && m.cmds[key]) || 0;

/**
 * @param {object} m aggregate metrics (see metrics.js)
 * @returns {number}
 */
const tool = (m, name) => (m.tools && m.tools[name]) || 0;

/** @type {Array<object>} */
export const ACHIEVEMENTS = [
  // ── Token 流量 ───────────────────────────────────────────────
  { id: 'first_session', name: '初见 DSH', desc: '你打开了潘多拉的魔盒，再也回不去了', cond: '产生至少 1 个会话', icon: '🐣', rarity: 'common', points: 5, category: 'token', target: 1, metric: (m) => m.sessions },
  { id: 'tokens_100k', name: '第一口甜头', desc: 'AI 尝起来还挺香的', cond: '累计消耗 ≥ 100,000 Token', icon: '🍬', rarity: 'common', points: 5, category: 'token', target: 100_000, metric: (m) => m.tokens },
  { id: 'tokens_1m', name: '百万起跳', desc: '百万俱乐部的门票到手了', cond: '累计消耗 ≥ 1,000,000 Token', icon: '🎟️', rarity: 'common', points: 5, category: 'token', target: 1_000_000, metric: (m) => m.tokens },
  { id: 'tokens_10m', name: '小有规模', desc: '你开始认真地喂养模型了', cond: '累计消耗 ≥ 10,000,000 Token', icon: '📈', rarity: 'common', points: 8, category: 'token', target: 10_000_000, metric: (m) => m.tokens },
  { id: 'tokens_50m', name: '中度沉迷', desc: '朋友问你在干什么，你说：在烧 Token', cond: '累计消耗 ≥ 50,000,000 Token', icon: '🎰', rarity: 'rare', points: 12, category: 'token', target: 50_000_000, metric: (m) => m.tokens },
  { id: 'tokens_100m', name: '重度依赖', desc: '没有 AI 你连 Hello World 都写不利索', cond: '累计消耗 ≥ 100,000,000 Token', icon: '💎', rarity: 'rare', points: 15, category: 'token', target: 100_000_000, metric: (m) => m.tokens },
  { id: 'tokens_500m', name: 'Token 银行家', desc: '你养活了一整个推理集群的零花钱', cond: '累计消耗 ≥ 500,000,000 Token', icon: '🏦', rarity: 'epic', points: 25, category: 'token', target: 500_000_000, metric: (m) => m.tokens },
  { id: 'tokens_1b', name: '十亿玩家', desc: '十亿 Token，像在给模型过年', cond: '累计消耗 ≥ 1,000,000,000 Token', icon: '🚀', rarity: 'epic', points: 35, category: 'token', target: 1_000_000_000, metric: (m) => m.tokens },
  { id: 'daily_10m', name: '火力全开', desc: '键盘在冒烟，模型在喘气', cond: '任意单日消耗 ≥ 10,000,000 Token', icon: '💥', rarity: 'rare', points: 20, category: 'token', target: 10_000_000, metric: (m) => m.maxDailyTokens },
  { id: 'daily_100m', name: 'Token 黑洞', desc: '连光都逃不出你今天的消耗', cond: '任意单日消耗 ≥ 100,000,000 Token', icon: '🕳️', rarity: 'legendary', points: 45, category: 'token', target: 100_000_000, metric: (m) => m.maxDailyTokens, hidden: true },

  // ── 交互 ────────────────────────────────────────────────────
  { id: 'sessions_10', name: '破冰对话', desc: '你们互相认识了一下', cond: '累计会话 ≥ 10', icon: '🤝', rarity: 'common', points: 5, category: 'interaction', target: 10, metric: (m) => m.sessions },
  { id: 'sessions_50', name: '老熟人', desc: 'AI 已经记得你的口味了', cond: '累计会话 ≥ 50', icon: '🫂', rarity: 'common', points: 8, category: 'interaction', target: 50, metric: (m) => m.sessions },
  { id: 'sessions_100', name: '话痨患者', desc: 'AI 已经开始害怕你的下一个问题', cond: '累计会话 ≥ 100', icon: '🗣️', rarity: 'rare', points: 10, category: 'interaction', target: 100, metric: (m) => m.sessions },
  { id: 'sessions_500', name: '论文写手', desc: '你是在写代码还是在写连载小说？', cond: '累计会话 ≥ 500', icon: '📚', rarity: 'epic', points: 20, category: 'interaction', target: 500, metric: (m) => m.sessions },
  { id: 'turns_1000', name: '千回百转', desc: '一个回合接一个回合，天亮了', cond: '累计对话轮次 ≥ 1,000', icon: '🔁', rarity: 'rare', points: 15, category: 'interaction', target: 1000, metric: (m) => m.turns },
  { id: 'prompt_chars_30k', name: '长文输入', desc: '你写的需求比代码还长', cond: '真人输入累计 ≥ 30,000 字符', icon: '✍️', rarity: 'common', points: 10, category: 'interaction', target: 30_000, metric: (m) => m.promptChars },
  { id: 'prompt_chars_120k', name: '手速惊人', desc: '十二万字，够一本中篇小说了', cond: '真人输入累计 ≥ 120,000 字符', icon: '🖋️', rarity: 'epic', points: 22, category: 'interaction', target: 120_000, metric: (m) => m.promptChars },
  { id: 'praise_10', name: '好人卡发放员', desc: '你对 AI 比对对象还客气', cond: '夸奖类表达 ≥ 10 次', icon: '😊', rarity: 'common', points: 8, category: 'interaction', target: 10, metric: (m) => m.sentiment.praise },
  { id: 'insult_30', name: '嘴替本替', desc: '情绪稳定地输出不稳定', cond: '吐槽类表达 ≥ 30 次', icon: '😤', rarity: 'rare', points: 12, category: 'interaction', target: 30, metric: (m) => m.sentiment.insult },

  // ── 时间 ────────────────────────────────────────────────────
  { id: 'night_10', name: '夜猫子', desc: '月亮是你唯一的同事', cond: '20 点后开始的会话 ≥ 10', icon: '🌙', rarity: 'common', points: 8, category: 'time', target: 10, metric: (m) => m.nightSessions },
  { id: 'night_50', name: '深夜常客', desc: '凌晨三点的 DSH 你最熟', cond: '20 点后开始的会话 ≥ 50', icon: '🦉', rarity: 'rare', points: 18, category: 'time', target: 50, metric: (m) => m.nightSessions },
  { id: 'daily_sessions_5', name: '五连开黑', desc: '一天开五局，作息已经放弃你了', cond: '单日会话 ≥ 5', icon: '🎯', rarity: 'common', points: 12, category: 'time', target: 5, metric: (m) => m.maxDailySessions },
  { id: 'active_days_7', name: '一周不断', desc: '连续一周没让模型闲着', cond: '累计活跃天数 ≥ 7', icon: '📅', rarity: 'common', points: 10, category: 'time', target: 7, metric: (m) => m.activeDays },
  { id: 'active_days_30', name: '月度常驻', desc: '这个月你和 DSH 谁也没离开谁', cond: '累计活跃天数 ≥ 30', icon: '🗓️', rarity: 'epic', points: 22, category: 'time', target: 30, metric: (m) => m.activeDays },
  { id: 'streak_14', name: '十四连击', desc: '自律到让 AI 都惭愧', cond: '连续活跃 ≥ 14 天', icon: '🔥', rarity: 'epic', points: 25, category: 'time', target: 14, metric: (m) => m.maxStreak },

  // ── 代码与工具 ──────────────────────────────────────────────
  { id: 'tools_5', name: '工具箱', desc: '开始用工具了，恭喜', cond: '使用过 ≥ 5 种工具', icon: '🧰', rarity: 'common', points: 8, category: 'code', target: 5, metric: (m) => m.distinctTools },
  { id: 'tools_15', name: '全能选手', desc: '什么活儿都能接', cond: '使用过 ≥ 15 种工具', icon: '🎛️', rarity: 'rare', points: 18, category: 'code', target: 15, metric: (m) => m.distinctTools },
  { id: 'tools_25', name: '工具人', desc: '你本人就是一个调度器', cond: '使用过 ≥ 25 种工具', icon: '🦾', rarity: 'epic', points: 30, category: 'code', target: 25, metric: (m) => m.distinctTools },
  { id: 'edits_100', name: '外科手术', desc: '精准切开，缝合，收工', cond: 'edit 工具调用 ≥ 100 次', icon: '🔧', rarity: 'common', points: 12, category: 'code', target: 100, metric: (m) => tool(m, 'edit') },
  { id: 'edits_500', name: '代码整容师', desc: '你的改动记录像一部编年史', cond: 'edit 工具调用 ≥ 500 次', icon: '💉', rarity: 'epic', points: 25, category: 'code', target: 500, metric: (m) => tool(m, 'edit') },
  { id: 'writes_100', name: '造物主', desc: '凭空变出文件，这就是魔法', cond: 'write 工具调用 ≥ 100 次', icon: '🧱', rarity: 'rare', points: 12, category: 'code', target: 100, metric: (m) => tool(m, 'write') },
  { id: 'reads_1000', name: '搬运工', desc: '读过的东西比写过的多得多', cond: 'read 工具调用 ≥ 1,000 次', icon: '📖', rarity: 'rare', points: 15, category: 'code', target: 1000, metric: (m) => tool(m, 'read') },
  { id: 'greps_300', name: '考古学家', desc: '在代码地层里翻找蛛丝马迹', cond: 'grep/glob 调用 ≥ 300 次', icon: '🔍', rarity: 'common', points: 12, category: 'code', target: 300, metric: (m) => tool(m, 'grep') + tool(m, 'glob') },
  { id: 'shells_300', name: '命令行原住民', desc: '图形界面？那是什么', cond: '终端命令调用 ≥ 300 次', icon: '⌨️', rarity: 'rare', points: 15, category: 'code', target: 300, metric: (m) => tool(m, 'pwsh') + tool(m, 'bash') },
  { id: 'subagent_30', name: '召唤师', desc: '一个人就是一支队伍', cond: '子代理调用 ≥ 30 次', icon: '👥', rarity: 'rare', points: 20, category: 'code', target: 30, metric: (m) => tool(m, 'subagent') + tool(m, 'subagent_fork') },
  { id: 'workflow_10', name: '流水线工头', desc: '让一堆代理替你打工', cond: 'workflow 调用 ≥ 10 次', icon: '🏗️', rarity: 'epic', points: 22, category: 'code', target: 10, metric: (m) => tool(m, 'workflow') },
  { id: 'errors_50', name: '试错专家', desc: '失败是成功之母，你有很多母亲', cond: '工具报错 ≥ 50 次', icon: '🧪', rarity: 'common', points: 10, category: 'code', target: 50, metric: (m) => m.toolErrors },

  // ── 精通 ────────────────────────────────────────────────────
  { id: 'models_3', name: '三心二意', desc: '不同的活儿交给不同的模型', cond: '使用过 ≥ 3 个模型', icon: '🔀', rarity: 'common', points: 10, category: 'mastery', target: 3, metric: (m) => m.distinctModels },
  { id: 'models_5', name: '模型收藏家', desc: '你的模型列表像一份菜单', cond: '使用过 ≥ 5 个模型', icon: '🗂️', rarity: 'rare', points: 20, category: 'mastery', target: 5, metric: (m) => m.distinctModels },
  { id: 'models_7', name: '七剑下天山', desc: '七个模型，七种脾气，你都摸透了', cond: '使用过 ≥ 7 个模型', icon: '🗡️', rarity: 'epic', points: 26, category: 'mastery', target: 7, metric: (m) => m.distinctModels },
  { id: 'providers_2', name: '双卡双待', desc: '永远有一条备用线路', cond: '使用过 ≥ 2 个供应商', icon: '📶', rarity: 'common', points: 12, category: 'mastery', target: 2, metric: (m) => m.distinctProviders },
  { id: 'projects_5', name: '多点开花', desc: '五个项目同时推进，很正常', cond: '在 ≥ 5 个工作目录里干活', icon: '🌿', rarity: 'rare', points: 15, category: 'mastery', target: 5, metric: (m) => m.projects },
  { id: 'projects_15', name: '项目海王', desc: '每个目录都留下了你的气息', cond: '在 ≥ 15 个工作目录里干活', icon: '🌊', rarity: 'epic', points: 28, category: 'mastery', target: 15, metric: (m) => m.projects },
  { id: 'cache_rate_50', name: '缓存猎人', desc: '能省的钱一分都不多花', cond: '缓存命中率 ≥ 50%（累计 ≥ 10M Token）', icon: '🏹', rarity: 'rare', points: 18, category: 'mastery', target: 50, metric: (m) => (m.tokens >= 10_000_000 ? Math.round(m.cacheHitRate * 100) : 0) },
  { id: 'max_session_1m', name: '一局百万', desc: '单个会话烧掉一百万，眼睛都不眨', cond: '单会话消耗 ≥ 1,000,000 Token', icon: '🎢', rarity: 'rare', points: 20, category: 'mastery', target: 1_000_000, metric: (m) => m.maxSessionTokens },
  { id: 'efficient_50k', name: '高效选手', desc: '平均每个会话五十万，稳', cond: '单会话平均 ≥ 500,000 Token', icon: '⚡', rarity: 'epic', points: 24, category: 'mastery', target: 500_000, metric: (m) => (m.sessions > 0 ? Math.round(m.tokens / m.sessions) : 0) },

  // ── 彩蛋 ────────────────────────────────────────────────────
  { id: 'code_blocks_1000', name: '代码喷泉', desc: '对话框里流出来的都是代码', cond: '累计输出代码块 ≥ 1,000 个', icon: '⛲', rarity: 'rare', points: 15, category: 'easter', target: 1000, metric: (m) => m.codeBlocks },
  { id: 'assistant_chars_5m', name: '与 AI 长谈', desc: '五百万字符的陪伴', cond: 'AI 输出 ≥ 5,000,000 字符', icon: '💬', rarity: 'epic', points: 18, category: 'easter', target: 5_000_000, metric: (m) => m.assistantChars },
  { id: 'daily_sessions_20', name: '一天二十局', desc: '这不是沉迷，这是热爱', cond: '单日会话 ≥ 20', icon: '🎮', rarity: 'rare', points: 20, category: 'easter', target: 20, metric: (m) => m.maxDailySessions },
  { id: 'midnight_tokens_10m', name: '子夜燃烧', desc: '凌晨四点，你和模型都没睡', cond: '0–4 点消耗 ≥ 10,000,000 Token', icon: '🕯️', rarity: 'legendary', points: 25, category: 'easter', target: 10_000_000, metric: (m) => m.lateNightTokens, hidden: true },
  { id: 'pua_20', name: 'PUA 大师', desc: '“你确定吗？”——第五次', cond: '质疑类表达 ≥ 20 次', icon: '🌀', rarity: 'common', points: 10, category: 'easter', target: 20, metric: (m) => m.sentiment.pua },
  { id: 'beg_5', name: '求求你了', desc: '礼貌是最后的倔强', cond: '恳求类表达 ≥ 5 次', icon: '🙏', rarity: 'common', points: 8, category: 'easter', target: 5, metric: (m) => m.sentiment.beg },
  { id: 'blame_10', name: '甩锅侠', desc: '“这不是我写的，是它写的”', cond: '归咎类表达 ≥ 10 次', icon: '🍳', rarity: 'common', points: 10, category: 'easter', target: 10, metric: (m) => m.sentiment.blame },

  // ── 文本性格：从你真实说过的话里读出来的 ──────────────────────
  { id: 'text_question_100', name: '十万个为什么', desc: '问号是你的主要标点', cond: '带疑问的 prompt ≥ 100 条', icon: '❓', rarity: 'common', points: 10, category: 'text', target: 100, metric: (m) => sig(m, 'question') },
  { id: 'text_question_300', name: '好奇害死猫', desc: '不懂就问，问完再问', cond: '带疑问的 prompt ≥ 300 条', icon: '🐈', rarity: 'rare', points: 18, category: 'text', target: 300, metric: (m) => sig(m, 'question') },
  { id: 'text_short_50', name: '惜字如金', desc: '“改一下”“看看这个”“不对”', cond: '≤12 字的极短 prompt ≥ 50 条', icon: '🤐', rarity: 'common', points: 10, category: 'text', target: 50, metric: (m) => sig(m, 'short') },
  { id: 'text_short_150', name: '电报体大师', desc: '按字收费的话你早破产了——反过来', cond: '≤12 字的极短 prompt ≥ 150 条', icon: '📮', rarity: 'rare', points: 15, category: 'text', target: 150, metric: (m) => sig(m, 'short') },
  { id: 'text_long_5', name: '长文需求', desc: '你写的需求比代码还长', cond: '≥1500 字的长 prompt ≥ 5 条', icon: '📜', rarity: 'rare', points: 15, category: 'text', target: 5, metric: (m) => sig(m, 'long') },
  { id: 'text_long_20', name: '需求小作文', desc: '这已经不是 prompt，是项目章程', cond: '≥1500 字的长 prompt ≥ 20 条', icon: '📕', rarity: 'epic', points: 22, category: 'text', target: 20, metric: (m) => sig(m, 'long') },
  { id: 'text_retry_20', name: '复读机', desc: '“还是不行”“再试一次”', cond: '重试/纠正类 prompt ≥ 20 条', icon: '🔂', rarity: 'common', points: 10, category: 'text', target: 20, metric: (m) => sig(m, 'retry') },
  { id: 'text_retry_60', name: '再试一次就好', desc: '第十二次一定行', cond: '重试/纠正类 prompt ≥ 60 条', icon: '🎰', rarity: 'rare', points: 16, category: 'text', target: 60, metric: (m) => sig(m, 'retry') },
  { id: 'text_doubt_15', name: '杠精预备役', desc: '“你确定？”——你的口头禅', cond: '质疑类 prompt ≥ 15 条', icon: '🧐', rarity: 'common', points: 10, category: 'text', target: 15, metric: (m) => sig(m, 'doubt') },
  { id: 'text_doubt_50', name: '杠精本精', desc: 'AI 看到你的头像就开始自证', cond: '质疑类 prompt ≥ 50 条', icon: '⚖️', rarity: 'rare', points: 16, category: 'text', target: 50, metric: (m) => sig(m, 'doubt') },
  { id: 'text_polite_5', name: '礼貌标兵', desc: '“麻烦你”“谢谢”也是生产力', cond: '礼貌类 prompt ≥ 5 条', icon: '🎩', rarity: 'common', points: 8, category: 'text', target: 5, metric: (m) => sig(m, 'polite') },
  { id: 'text_emoji_3', name: '表情包选手', desc: '文字不够，表情来凑', cond: '带 emoji 的 prompt ≥ 3 条', icon: '🥺', rarity: 'common', points: 8, category: 'text', target: 3, metric: (m) => sig(m, 'emoji') },
  { id: 'text_curious_40', name: '刨根问底', desc: '“为什么”“原理是什么”', cond: '追问原理的 prompt ≥ 40 条', icon: '🔬', rarity: 'rare', points: 14, category: 'text', target: 40, metric: (m) => sig(m, 'curious') },
  { id: 'text_curious_120', name: '原理执念', desc: '不搞懂底层就睡不着', cond: '追问原理的 prompt ≥ 120 条', icon: '🧠', rarity: 'epic', points: 20, category: 'text', target: 120, metric: (m) => sig(m, 'curious') },

  // ── 职场：你聊的业务，暴露了你的工种 ──────────────────────────
  { id: 'work_server_50', name: '后端嘴替', desc: '“接口通了吗”是你的早安', cond: '提到服务端/接口/数据库 ≥ 50 次', icon: '🖧', rarity: 'common', points: 12, category: 'workplace', target: 50, metric: (m) => sig(m, 'server') },
  { id: 'work_git_40', name: '分支管理员', desc: '合并冲突面前面不改色', cond: '提到 git/分支/合并 ≥ 40 次', icon: '🌿', rarity: 'common', points: 10, category: 'workplace', target: 40, metric: (m) => sig(m, 'git') },
  { id: 'work_git_150', name: '合并风暴', desc: '你见过的冲突比别人见过的分支多', cond: '提到 git/分支/合并 ≥ 150 次', icon: '🌪️', rarity: 'rare', points: 18, category: 'workplace', target: 150, metric: (m) => sig(m, 'git') },
  { id: 'work_requirement_25', name: '需求粉碎机', desc: '“策划又改了”', cond: '提到需求/策划/文档 ≥ 25 次', icon: '🗞️', rarity: 'common', points: 12, category: 'workplace', target: 25, metric: (m) => sig(m, 'requirement') },
  { id: 'work_art_25', name: '美术翻译官', desc: '“这个 UI 能不能再大一点”', cond: '提到美术/UI/特效 ≥ 25 次', icon: '🎨', rarity: 'common', points: 10, category: 'workplace', target: 25, metric: (m) => sig(m, 'art') },
  { id: 'work_perf_20', name: '性能猎人', desc: '帧率掉一帧你都能察觉', cond: '提到性能/卡顿/内存 ≥ 20 次', icon: '📉', rarity: 'rare', points: 14, category: 'workplace', target: 20, metric: (m) => sig(m, 'perf') },
  { id: 'work_deploy_20', name: '发布狂魔', desc: '“打完包就上”', cond: '提到上线/打包/发布 ≥ 20 次', icon: '🚚', rarity: 'rare', points: 16, category: 'workplace', target: 20, metric: (m) => sig(m, 'deploy') },
  { id: 'work_unity_8', name: 'Unity 原住民', desc: 'Prefab 是你的第二个家', cond: '提到 Unity/Prefab/热更 ≥ 8 次', icon: '🎮', rarity: 'common', points: 10, category: 'workplace', target: 8, metric: (m) => sig(m, 'unity') },
  { id: 'work_test_2', name: '测试先行', desc: '“先自测一下”', cond: '提到测试/用例/回归 ≥ 2 次', icon: '🧫', rarity: 'common', points: 8, category: 'workplace', target: 2, metric: (m) => sig(m, 'test') },
  { id: 'work_error_8', name: '报错搬运工', desc: '整段堆栈直接糊上去', cond: '粘贴报错/堆栈 ≥ 8 次', icon: '🧯', rarity: 'common', points: 10, category: 'workplace', target: 8, metric: (m) => sig(m, 'errorPaste') },
  { id: 'work_error_30', name: '堆栈考古学家', desc: 'NullReferenceException 的老朋友', cond: '粘贴报错/堆栈 ≥ 30 次', icon: '🏺', rarity: 'rare', points: 16, category: 'workplace', target: 30, metric: (m) => sig(m, 'errorPaste') },
  { id: 'work_refactor_5', name: '重构上瘾', desc: '“顺手整理一下”——然后全改了', cond: '提到重构/拆分/解耦 ≥ 5 次', icon: '🧹', rarity: 'rare', points: 14, category: 'workplace', target: 5, metric: (m) => sig(m, 'refactor') },

  // ── 助手性格：AI 那边的表现也算进你的战绩 ────────────────────
  { id: 'ai_apology_10', name: 'AI 认错', desc: '“你说得对，是我的问题”', cond: 'AI 道歉 ≥ 10 次', icon: '🙇', rarity: 'common', points: 10, category: 'easter', target: 10, metric: (m) => ai(m, 'apology') },
  { id: 'ai_hedge_200', name: '免责声明', desc: '“可能”“大概”“取决于”', cond: 'AI 含糊措辞 ≥ 200 次', icon: '🛡️', rarity: 'rare', points: 14, category: 'easter', target: 200, metric: (m) => ai(m, 'hedge') },
  { id: 'ai_table_200', name: '表格控', desc: '什么都想画成表', cond: 'AI 输出表格 ≥ 200 次', icon: '🧮', rarity: 'common', points: 12, category: 'easter', target: 200, metric: (m) => ai(m, 'table') },
  { id: 'ai_list_300', name: '清单狂魔', desc: '一二三四五，条理清晰', cond: 'AI 输出列表 ≥ 300 次', icon: '🗒️', rarity: 'rare', points: 14, category: 'easter', target: 300, metric: (m) => ai(m, 'list') },
  { id: 'ai_todo_25', name: 'TODO 制造机', desc: '留下 TODO，留给未来的自己', cond: 'AI 输出 TODO/FIXME ≥ 25 次', icon: '📌', rarity: 'common', points: 10, category: 'easter', target: 25, metric: (m) => ai(m, 'todo') },
  { id: 'ai_emoji_100', name: 'AI 卖萌', desc: '它开始用表情跟你说话了', cond: 'AI 回复带 emoji ≥ 100 次', icon: '🤖', rarity: 'common', points: 10, category: 'easter', target: 100, metric: (m) => ai(m, 'emoji') },
  { id: 'ai_long_40', name: '长篇大论', desc: '一次回复四千字，看不完根本看不完', cond: 'AI 超长回复 ≥ 40 次', icon: '📖', rarity: 'rare', points: 16, category: 'easter', target: 40, metric: (m) => ai(m, 'long') },
  { id: 'ai_lang_8', name: '多语言输出', desc: '代码块换着语言来', cond: '输出过 ≥ 8 种代码块语言', icon: '🌐', rarity: 'rare', points: 18, category: 'easter', target: 8, metric: (m) => m.distinctFenceLangs },
  { id: 'ai_csharp_80', name: 'C# 流水线', desc: 'csharp 代码块刷屏', cond: 'csharp 代码块 ≥ 80 个', icon: '🎯', rarity: 'rare', points: 16, category: 'easter', target: 80, metric: (m) => fence(m, 'csharp') },
  { id: 'ai_fences_1000', name: '代码瀑布', desc: '一千个代码块从对话框里流出来', cond: '累计代码块 ≥ 1,000 个', icon: '🌊', rarity: 'epic', points: 20, category: 'easter', target: 1000, metric: (m) => m.totalFences },

  // ── 文件与命令：你真正动过的东西 ─────────────────────────────
  { id: 'file_cs_1000', name: 'C# 手术台', desc: '一千次切进 .cs 文件', cond: '读写 .cs 文件 ≥ 1,000 次', icon: '🔪', rarity: 'rare', points: 18, category: 'code', target: 1000, metric: (m) => ext(m, 'cs') },
  { id: 'file_js_1000', name: '前端搬运工', desc: '.js 文件的无情搬运', cond: '读写 .js 文件 ≥ 1,000 次', icon: '📦', rarity: 'rare', points: 16, category: 'code', target: 1000, metric: (m) => ext(m, 'js') },
  { id: 'file_java_1000', name: '服务端之手', desc: '.java 里也有你的一半功劳', cond: '读写 .java 文件 ≥ 1,000 次', icon: '☕', rarity: 'rare', points: 18, category: 'code', target: 1000, metric: (m) => ext(m, 'java') },
  { id: 'file_py_500', name: '脚本人生', desc: '能写脚本就不手动', cond: '读写 .py 文件 ≥ 500 次', icon: '🐍', rarity: 'common', points: 12, category: 'code', target: 500, metric: (m) => ext(m, 'py') },
  { id: 'file_md_500', name: '文档工程师', desc: '代码写得好，文档也不落下', cond: '读写 .md 文件 ≥ 500 次', icon: '📝', rarity: 'rare', points: 15, category: 'code', target: 500, metric: (m) => ext(m, 'md') },
  { id: 'file_json_800', name: '配置达人', desc: '.json 改到闭眼都不出错', cond: '读写 .json 文件 ≥ 800 次', icon: '🧾', rarity: 'common', points: 12, category: 'code', target: 800, metric: (m) => ext(m, 'json') },
  { id: 'file_prefab_300', name: '预制体雕塑家', desc: '.prefab 就是你的黏土', cond: '读写 .prefab 文件 ≥ 300 次', icon: '🗿', rarity: 'epic', points: 20, category: 'code', target: 300, metric: (m) => ext(m, 'prefab') },
  { id: 'cmd_git_500', name: 'git 重度用户', desc: 'status、diff、log 三件套', cond: '执行 git 命令 ≥ 500 次', icon: '🐙', rarity: 'rare', points: 16, category: 'code', target: 500, metric: (m) => cmd(m, 'git') },
  { id: 'cmd_node_500', name: 'Node 信徒', desc: 'node 一把梭', cond: '执行 node 命令 ≥ 500 次', icon: '💚', rarity: 'common', points: 12, category: 'code', target: 500, metric: (m) => cmd(m, 'node') },
  { id: 'cmd_python_300', name: 'Python 召唤师', desc: '胶水语言的忠实用户', cond: '执行 python 命令 ≥ 300 次', icon: '🧪', rarity: 'common', points: 12, category: 'code', target: 300, metric: (m) => cmd(m, 'python') },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Level curve: every level costs progressively more points. */
export function levelFor(points) {
  let level = 1;
  let need = 40;
  let spent = 0;
  while (points >= spent + need && level < 99) {
    spent += need;
    level += 1;
    need = Math.round(need * 1.35);
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
 * @param {object} metrics
 * @param {Record<string, number>} unlockedAt existing unlock timestamps
 * @param {number} now
 */
export function evaluate(metrics, unlockedAt, now = Date.now()) {
  const unlocked = { ...unlockedAt };
  const items = [];
  const fresh = [];
  let points = 0;

  for (const def of ACHIEVEMENTS) {
    let value = 0;
    try {
      value = Number(def.metric(metrics)) || 0;
    } catch {
      value = 0;
    }
    const ratio = def.target > 0 ? Math.min(1, value / def.target) : 0;
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
      target: def.target,
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