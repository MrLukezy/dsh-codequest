/**
 * CodeQuest for DSH — text and tool-argument signals.
 *
 * The fold keeps counters, never raw text: each prompt is classified once into
 * a handful of boolean buckets, assistant replies are reduced to formatting and
 * tone counts, and tool arguments only contribute a file extension and a
 * command word. That keeps `state.json` small while giving the achievement set
 * real content to work with.
 */

/** Prompt buckets. Each is "does this prompt show the trait", not a hit count. */
export const USER_SIGNAL_KEYWORDS = {
  polite: ['请帮我', '请问', '麻烦', '谢谢', '感谢', '辛苦', '拜托', 'please', 'thanks', 'kindly'],
  rude: ['快点', '赶紧', '别废话', '少废话', '你他妈', '傻逼', '废物', '滚蛋', '滚开', '无语', '什么垃圾', 'stupid', 'shut up'],
  doubt: ['你确定', '确定吗', '是不是', '你再', '认真点', '仔细看', '到底', '为什么不行', '有没有搞错', 'are you sure', 'really'],
  retry: ['再试', '重试', '再来', '重新', '换个', '又错', '还是不行', '不对', '失败了', '报错依旧', 'retry', 'again'],
  cheer: ['太好了', '完美', '牛逼', '厉害', '真棒', '给力', '漂亮', 'awesome', 'perfect', 'nice work'],
  emo: ['好累', '累死', '困了', '加班', '熬夜', '崩了', '烦死', '顶不住', '救命', '心累', '麻了', '摆烂', '不想干', 'tired', 'exhausted'],
  coffee: ['咖啡', '奶茶', '可乐', '红牛', 'coffee', 'latte'],
  friday: ['周五', '周末', '下班', '摸鱼', '放假', '假期', 'friday', 'weekend'],
  errorPaste: ['exception', 'error:', '报错', '崩溃', 'nullreference', 'stack trace', 'traceback', 'at game.', '未将对象引用', '空引用'],
  codePaste: ['```', 'public class', 'function ', 'def ', 'import ', 'select ', 'namespace ', 'void ', '=> {'],
  curious: ['为什么', '怎么会', '原理', '机制', '底层', 'how does', 'why does', '怎么回事'],
  requirement: ['需求', '策划', 'prd', '文档', '方案', '设计稿', '验收'],
  art: ['美术', '原画', '图标', '特效', '动画', '立绘', '贴图', 'UI'],
  server: ['服务器', '后端', '接口', '协议', '数据库', 'sql', 'redis', 'mongodb', '网关'],
  unity: ['unity', 'prefab', 'editor', 'ugui', 'shader', 'c#', 'monobehaviour', '热更'],
  test: ['测试', '用例', 'QA', '回归', '自测', 'test'],
  deploy: ['上线', '发布', '打包', '热更', '灰度', '部署', '发版', 'release'],
  perf: ['性能', '卡顿', '内存', 'gc', '帧率', '优化', '耗时', 'profile'],
  refactor: ['重构', '整理', '拆分', '解耦', '清理', '优化结构', '重写'],
  git: ['git', '分支', '合并', '冲突', 'commit', 'pull request', 'PR'],
  apologize: ['抱歉', '对不起', 'sorry', '我的错', '我搞错'],
};

const LATIN_KEYWORD_RE = /^[a-z0-9#+\-.\s]+$/i;
const regexCache = new Map();

/**
 * Latin keywords match on word boundaries so `ui` does not fire inside
 * "build" and `pr` does not fire inside "spring"; CJK keywords stay substring
 * matches, and their lists use phrases rather than single characters.
 */
function matchesKeyword(haystack, keyword) {
  if (!LATIN_KEYWORD_RE.test(keyword)) return haystack.includes(keyword.toLowerCase());
  let regex = regexCache.get(keyword);
  if (!regex) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    regexCache.set(keyword, regex);
  }
  return regex.test(haystack);
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const CJK_RE = /[\u4e00-\u9fff]/;
const ASCII_WORD_RE = /[a-zA-Z]{3,}/g;

/** @returns {Record<string, number>} */
export function userSignals(text) {
  const out = {};
  if (!text) return out;
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  for (const [key, keywords] of Object.entries(USER_SIGNAL_KEYWORDS)) {
    if (keywords.some((keyword) => matchesKeyword(lower, keyword))) out[key] = 1;
  }
  if (/[?？]/.test(text) || /(吗|怎么|为什么|如何|是否|能不能|可不可以)/.test(text)) out.question = 1;
  if (trimmed.length <= 12) out.short = 1;
  if (trimmed.length >= 1500) out.long = 1;
  if (EMOJI_RE.test(text)) out.emoji = 1;
  if (CJK_RE.test(text)) out.chinese = 1;
  const words = text.match(ASCII_WORD_RE) || [];
  // "English" means the prompt is actually written in English: no CJK at all
  // and enough real words to rule out a bare path or identifier dump.
  if (!CJK_RE.test(text) && words.length >= 8) out.english = 1;
  if (/(！{2,}|!{2,}|太棒|终于|牛逼|起飞|爽！)/.test(text)) out.excited = 1;
  return out;
}

const APOLOGY_RE = /(抱歉|你说得对|我错了|确实是我的问题|sorry|my mistake|apologies)/i;
const HEDGE_RE = /(可能|大概|建议|或许|取决于|不一定|看情况|probably|might|depends)/i;
const TODO_RE = /(TODO|FIXME|XXX:)/;

/** @returns {object} assistant reply signals */
export function assistantSignals(text) {
  const out = { fences: {}, table: 0, list: 0, apology: 0, hedge: 0, todo: 0, emoji: 0, long: 0 };
  if (!text) return out;

  const fences = text.match(/```([a-zA-Z0-9+#-]*)/g) || [];
  for (const fence of fences) {
    const lang = fence.slice(3).trim().toLowerCase() || 'plain';
    out.fences[lang] = (out.fences[lang] || 0) + 1;
  }
  if (/^\s*\|.*\|/m.test(text)) out.table = 1;
  if (/^\s*([-*+]|\d+\.)\s+/m.test(text)) out.list = 1;
  if (APOLOGY_RE.test(text)) out.apology = 1;
  if (HEDGE_RE.test(text)) out.hedge = 1;
  if (TODO_RE.test(text)) out.todo = 1;
  if (EMOJI_RE.test(text)) out.emoji = 1;
  if (text.length >= 4000) out.long = 1;
  return out;
}

const EXT_RE = /\.([a-z0-9]{1,8})\b/gi;
const KNOWN_EXTS = new Set([
  'cs', 'ts', 'tsx', 'js', 'jsx', 'py', 'json', 'md', 'prefab', 'asset', 'sql', 'java',
  'sh', 'ps1', 'html', 'css', 'yml', 'yaml', 'xml', 'meta', 'txt', 'lua', 'go', 'rs',
]);
const COMMAND_WORDS = ['git', 'npm', 'pnpm', 'node', 'python', 'dotnet', 'docker', 'ssh', 'curl', 'rg', 'grep'];

/** @returns {{ext?: string, cmd?: string}} */
export function toolSignals(name, argsRaw) {
  const out = {};
  if (typeof argsRaw !== 'string' || argsRaw.length === 0) return out;
  const sample = argsRaw.length > 4000 ? argsRaw.slice(0, 4000) : argsRaw;

  const pathMatch = sample.match(/"(?:file_path|path|filePath)"\s*:\s*"([^"]{1,400})"/);
  const target = pathMatch ? pathMatch[1] : sample;
  const exts = target.match(EXT_RE) || [];
  for (const raw of exts) {
    const ext = raw.slice(1).toLowerCase();
    if (KNOWN_EXTS.has(ext)) {
      out.ext = ext;
      break;
    }
  }

  if (name === 'pwsh' || name === 'bash' || name === 'terminal_open') {
    const cmdMatch = sample.match(/"(?:command|cmd)"\s*:\s*"([^"]{0,200})/);
    const cmd = (cmdMatch ? cmdMatch[1] : sample).trim().toLowerCase();
    for (const word of COMMAND_WORDS) {
      if (cmd.startsWith(word) || cmd.includes(` ${word} `)) {
        out.cmd = word;
        break;
      }
    }
  }
  return out;
}