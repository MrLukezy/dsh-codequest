/**
 * CodeQuest for DSH — session folding.
 *
 * One fold per session turns the committed event log into a compact summary:
 * token traffic, tool usage, model/provider mix, activity time, and the user
 * prompt text needed for sentiment counters. Folds are plain JSON so they can
 * be cached and re-aggregated cheaply.
 */

import { userSignals, assistantSignals, toolSignals } from './text.js';

const MAX_PROMPTS = 12;
const MAX_PROMPT_CHARS = 600;

/**
 * Bumped when fold semantics change, so cached folds from an older build are
 * discarded and rebuilt instead of being read with the new metric meanings.
 */
export const FOLD_VERSION = 4;

const SENTIMENT_KEYWORDS = {
  praise: ['谢谢', '感谢', '太好了', '完美', '厉害', '牛逼', '牛啊', '真棒', '优秀', '漂亮', '赞', '辛苦了', '给力', '靠谱', 'great', 'thanks', 'thank you', 'perfect', 'awesome', 'nice work', 'well done'],
  insult: ['垃圾', '蠢', '傻逼', '废物', '弱智', '智障', '什么鬼', '胡说', '放屁', '没用', '太差', '烂', '不对', '错了', '有问题', 'stupid', 'dumb', 'useless', 'garbage', 'nonsense', 'crap'],
  pua: ['你确定', '确定吗', '再想想', '好好想', '认真点', '仔细看', '你行不行', '你到底', '是不是搞错', '是不是', '你没', '你看看', 'are you sure', 'think again', 'really?', 'double check'],
  beg: ['求你了', '求求', '拜托', '麻烦你', '帮帮我', '求你', '麻烦', 'please', 'kindly', 'i beg'],
  blame: ['不是我的错', '你的问题', '你搞的', '你弄坏', '又错了', '你怎么', '你导致', '你的锅', 'your fault', 'you broke', 'you caused'],
};

export function emptySentiment() {
  return { praise: 0, insult: 0, pua: 0, beg: 0, blame: 0 };
}

function localDateKey(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Text of a message payload. `assistant/message` nests it under `message`,
 * while `user/message` carries the message fields directly on `data`.
 */
function textOf(payload) {
  const message = payload && payload.message ? payload.message : payload;
  if (!message || !Array.isArray(message.content)) return '';
  let out = '';
  for (const block of message.content) {
    if (block && block.type === 'text' && typeof block.text === 'string') out += block.text;
  }
  return out;
}

function countCodeFences(text) {
  if (!text) return 0;
  const fences = text.split('```').length - 1;
  return Math.floor(fences / 2);
}

export function emptyFold() {
  return {
    createdAt: 0,
    cwd: null,
    firstAt: 0,
    lastAt: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    total: 0,
    turns: 0,
    steps: 0,
    toolCalls: 0,
    toolErrors: 0,
    tools: {},
    models: {},
    providers: {},
    prompts: [],
    promptChars: 0,
    humanPrompts: 0,
    assistantChars: 0,
    codeBlocks: 0,
    signals: {},
    assistant: { fences: {}, table: 0, list: 0, apology: 0, hedge: 0, todo: 0, emoji: 0, long: 0 },
    exts: {},
    cmds: {},
    daily: {},
    hourly: new Array(24).fill(0),
    error: null,
  };
}

function addUsage(fold, usage, time) {
  if (!usage) return;
  const input = Number(usage.inputTokens) || 0;
  const output = Number(usage.outputTokens) || 0;
  const cacheRead = Number(usage.cacheReadTokens) || 0;
  const cacheWrite = Number(usage.cacheWriteTokens) || 0;
  const reasoning = Number(usage.reasoningTokens) || 0;
  const total = Number(usage.totalTokens) || input + output;
  fold.input += input;
  fold.output += output;
  fold.cacheRead += cacheRead;
  fold.cacheWrite += cacheWrite;
  fold.reasoning += reasoning;
  fold.total += total;

  const at = typeof time === 'number' ? time : Date.now();
  const key = localDateKey(at);
  fold.daily[key] = (fold.daily[key] || 0) + total;
  const hour = new Date(at).getHours();
  fold.hourly[hour] += total;
}

/**
 * Fold a session's committed events into a compact summary.
 * @param {{id:string, createdAt?:number, cwd?:string|null}} header
 * @param {ReadonlyArray<any>} events
 */
export function foldSession(header, events) {
  const fold = emptyFold();
  fold.createdAt = Number(header && header.createdAt) || 0;
  fold.cwd = header && header.cwd ? String(header.cwd) : null;
  const seenTools = new Set();

  for (const event of events || []) {
    if (!event || typeof event.type !== 'string') continue;
    const time = Number(event.time) || fold.createdAt || Date.now();
    if (!fold.firstAt || time < fold.firstAt) fold.firstAt = time;
    if (time > fold.lastAt) fold.lastAt = time;
    const data = event.data || {};

    switch (event.type) {
      case 'turn/start':
        fold.turns += 1;
        break;
      case 'step/start':
        fold.steps += 1;
        break;
      case 'user/message': {
        // Every user-role event carries a `source`: only `kind: 'user'` is a
        // human prompt. Instructions, skill catalogs, time snapshots and other
        // injected context must not count as something the user typed.
        const source = data.source;
        if (source && source.kind !== 'user') break;
        const text = textOf(data);
        if (text) {
          fold.promptChars += text.length;
          fold.humanPrompts += 1;
          if (fold.prompts.length < MAX_PROMPTS) {
            fold.prompts.push(text.slice(0, MAX_PROMPT_CHARS));
          }
          const signals = userSignals(text);
          for (const key of Object.keys(signals)) fold.signals[key] = (fold.signals[key] || 0) + 1;
        }
        break;
      }
      case 'assistant/message': {
        addUsage(fold, data.usage, time);
        const text = textOf(data.message);
        if (text) {
          fold.assistantChars += text.length;
          fold.codeBlocks += countCodeFences(text);
          const signals = assistantSignals(text);
          for (const key of ['table', 'list', 'apology', 'hedge', 'todo', 'emoji', 'long']) {
            if (signals[key]) fold.assistant[key] += 1;
          }
          for (const [lang, count] of Object.entries(signals.fences)) {
            fold.assistant.fences[lang] = (fold.assistant.fences[lang] || 0) + count;
          }
        }
        const source = data.message && data.message.source;
        if (source && source.kind === 'model') {
          if (source.model) fold.models[source.model] = (fold.models[source.model] || 0) + 1;
          if (source.provider) fold.providers[source.provider] = (fold.providers[source.provider] || 0) + 1;
        }
        break;
      }
      case 'request/header': {
        const config = data.header && data.header.config;
        if (config) {
          if (config.model) fold.models[config.model] = (fold.models[config.model] || 0) + 1;
          if (config.provider) fold.providers[config.provider] = (fold.providers[config.provider] || 0) + 1;
        }
        break;
      }
      case 'tool/call': {
        fold.toolCalls += 1;
        const name = typeof data.name === 'string' ? data.name : 'unknown';
        fold.tools[name] = (fold.tools[name] || 0) + 1;
        seenTools.add(name);
        const signals = toolSignals(name, data.arguments);
        if (signals.ext) fold.exts[signals.ext] = (fold.exts[signals.ext] || 0) + 1;
        if (signals.cmd) fold.cmds[signals.cmd] = (fold.cmds[signals.cmd] || 0) + 1;
        break;
      }
      case 'tool/result': {
        if (data.error) fold.toolErrors += 1;
        break;
      }
      default:
        break;
    }
  }

  if (!fold.firstAt) fold.firstAt = fold.createdAt || Date.now();
  if (!fold.lastAt) fold.lastAt = fold.firstAt;
  return fold;
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    target[key] = (target[key] || 0) + (Number(value) || 0);
  }
}

function sentimentOf(prompts) {
  const counters = emptySentiment();
  // One hit per category per prompt: a long prompt that mentions the same
  // feeling five times should not outweigh five separate conversations.
  for (const prompt of prompts) {
    const lower = String(prompt || '').toLowerCase();
    if (!lower) continue;
    for (const [category, keywords] of Object.entries(SENTIMENT_KEYWORDS)) {
      if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) counters[category] += 1;
    }
  }
  return counters;
}

function longestStreak(dates) {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`).getTime();
    const cur = new Date(`${sorted[i]}T00:00:00`).getTime();
    const gapDays = Math.round((cur - prev) / 86_400_000);
    run = gapDays === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Aggregate cached session folds into the metrics the achievement engine reads.
 * @param {Record<string, {fold: object}>} sessions
 */
export function aggregate(sessions) {
  const tools = {};
  const models = {};
  const providers = {};
  const signals = {};
  const assistant = { fences: {}, table: 0, list: 0, apology: 0, hedge: 0, todo: 0, emoji: 0, long: 0 };
  const exts = {};
  const cmds = {};
  const cwds = new Set();
  const activeDates = new Set();
  const dailyTokens = {};
  const dailySessions = {};
  const hourly = new Array(24).fill(0);
  const prompts = [];
  let tokens = 0;
  let input = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let reasoning = 0;
  let output = 0;
  let sessionCount = 0;
  let turns = 0;
  let steps = 0;
  let toolCalls = 0;
  let toolErrors = 0;
  let promptChars = 0;
  let humanPrompts = 0;
  let assistantChars = 0;
  let codeBlocks = 0;
  let maxSessionTokens = 0;
  let nightSessions = 0;
  let earlySessions = 0;
  let weekendSessions = 0;
  let lastAt = 0;
  let firstAt = 0;

  for (const record of Object.values(sessions || {})) {
    const fold = record && record.fold;
    if (!fold) continue;
    sessionCount += 1;
    tokens += fold.total || 0;
    input += fold.input || 0;
    output += fold.output || 0;
    cacheRead += fold.cacheRead || 0;
    cacheWrite += fold.cacheWrite || 0;
    reasoning += fold.reasoning || 0;
    turns += fold.turns || 0;
    steps += fold.steps || 0;
    toolCalls += fold.toolCalls || 0;
    toolErrors += fold.toolErrors || 0;
    promptChars += fold.promptChars || 0;
    humanPrompts += fold.humanPrompts || 0;
    assistantChars += fold.assistantChars || 0;
    codeBlocks += fold.codeBlocks || 0;
    if ((fold.total || 0) > maxSessionTokens) maxSessionTokens = fold.total || 0;
    mergeCounts(tools, fold.tools);
    mergeCounts(models, fold.models);
    mergeCounts(providers, fold.providers);
    mergeCounts(signals, fold.signals);
    mergeCounts(exts, fold.exts);
    mergeCounts(cmds, fold.cmds);
    if (fold.assistant) {
      mergeCounts(assistant.fences, fold.assistant.fences);
      for (const key of ['table', 'list', 'apology', 'hedge', 'todo', 'emoji', 'long']) {
        assistant[key] += Number(fold.assistant[key]) || 0;
      }
    }
    if (fold.cwd) cwds.add(String(fold.cwd).toLowerCase());
    for (const [date, value] of Object.entries(fold.daily || {})) {
      dailyTokens[date] = (dailyTokens[date] || 0) + (Number(value) || 0);
    }
    for (const [hour, value] of (fold.hourly || []).entries()) {
      hourly[hour] += Number(value) || 0;
    }
    for (const prompt of fold.prompts || []) {
      if (prompts.length < 400) prompts.push(prompt);
    }
    const first = fold.firstAt || fold.createdAt;
    if (first) {
      const d = new Date(first);
      const key = localDateKey(first);
      activeDates.add(key);
      dailySessions[key] = (dailySessions[key] || 0) + 1;
      const hour = d.getHours();
      // "Night" covers the evening working block too (20:00+), not only the
      // small hours, so an evening-only habit can still make progress.
      if (hour >= 20 || hour < 5) nightSessions += 1;
      if (hour >= 5 && hour < 8) earlySessions += 1;
      const weekday = d.getDay();
      if (weekday === 0 || weekday === 6) weekendSessions += 1;
      if (!firstAt || first < firstAt) firstAt = first;
    }
    if ((fold.lastAt || 0) > lastAt) lastAt = fold.lastAt || 0;
  }

  const todayKey = localDateKey(Date.now());
  const maxDailyTokens = Object.values(dailyTokens).reduce((max, value) => Math.max(max, value), 0);
  const maxDailySessions = Object.values(dailySessions).reduce((max, value) => Math.max(max, value), 0);
  const lateNightTokens = hourly.slice(0, 5).reduce((sum, value) => sum + value, 0);
  const cacheBase = cacheRead + input;

  return {
    tokens,
    input,
    output,
    cacheRead,
    cacheWrite,
    reasoning,
    tokensToday: dailyTokens[todayKey] || 0,
    sessionsToday: dailySessions[todayKey] || 0,
    sessions: sessionCount,
    turns,
    steps,
    toolCalls,
    toolErrors,
    tools,
    models,
    providers,
    signals,
    assistant,
    exts,
    cmds,
    totalFences: Object.values(assistant.fences).reduce((sum, value) => sum + value, 0),
    distinctFenceLangs: Object.keys(assistant.fences).length,
    distinctTools: Object.keys(tools).length,
    distinctModels: Object.keys(models).length,
    distinctProviders: Object.keys(providers).length,
    projects: cwds.size,
    activeDays: activeDates.size,
    maxStreak: longestStreak([...activeDates]),
    maxDailyTokens,
    maxDailySessions,
    nightSessions,
    earlySessions,
    weekendSessions,
    promptChars,
    humanPrompts,
    assistantChars,
    codeBlocks,
    maxSessionTokens,
    cacheHitRate: cacheBase > 0 ? cacheRead / cacheBase : 0,
    lateNightTokens,
    sentiment: sentimentOf(prompts),
    dailyTokens,
    hourly,
    firstAt,
    lastAt,
    activeDates: [...activeDates].sort(),
  };
}
