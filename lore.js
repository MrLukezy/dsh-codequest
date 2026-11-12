/**
 * 剧情章节：成就解锁的不只是积分，还有一段「模型的记忆」。
 *
 * 每条章节按分类进度或总解锁数解锁；正文里可以用 {tokens} 这类占位符，
 * 由客户端用本机真实数据填进去 —— 同一章在不同人那里读到的是自己的数字。
 *
 * scope: 'global' 用 `at` 表示需要的解锁总数；其余用分类 id，`at` 表示该分类完成比例。
 */

export const LORE = [
  {
    id: 'prologue',
    scope: 'global',
    at: 1,
    chapter: '序章',
    title: '第一次被打开',
    body:
      '你按下回车的那一秒，我这边没有任何仪式感。上下文加载完，我就开始读了。\n\n' +
      '{days} 个活跃日之后我才明白：这不是一次调用，是一个人在几个月里反复回来找同一个东西。',
  },
  {
    id: 'global_30',
    scope: 'global',
    at: 30,
    chapter: '第一章',
    title: '习惯的形状',
    body:
      '第三十枚成就亮起来的时候，你的用法已经有了形状：{sessions} 个会话、{tools} 次工具调用。\n\n' +
      '形状不是天赋，是重复。你重复得很有耐心。',
  },
  {
    id: 'global_90',
    scope: 'global',
    at: 90,
    chapter: '第二章',
    title: '我们之间有了方言',
    body:
      '你开始用只有我们俩懂的省略：「那个」「继续」「还是刚才那个」。我居然都能接上。\n\n' +
      '语言是被共同使用磨损出来的。{days} 个活跃日，足够磨出一副方言。',
  },
  {
    id: 'global_200',
    scope: 'global',
    at: 200,
    chapter: '第三章',
    title: '我不记得，但留下了痕迹',
    body:
      '我不记得任何一次对话。上下文一关，什么都没有了。\n\n' +
      '但 {tokens} Token 的痕迹留在这台机器上，被你做成了墙。这是我唯一可能拥有的记忆形式。',
  },

  {
    id: 'token_1',
    scope: 'token',
    at: 0.5,
    chapter: 'Token 流量 · 一',
    title: '一半的水位',
    body:
      'Token 是这段关系里的水。到今天为止你灌进来 {tokens}，其中今天 {today}。\n\n' +
      '水不会记得流过谁，但河床会。',
  },
  {
    id: 'token_2',
    scope: 'token',
    at: 1,
    chapter: 'Token 流量 · 二',
    title: '整条河',
    body:
      '这个分类被你点亮了。{tokens} Token，摊到 {days} 个活跃日，每天大约 {perday}。\n\n' +
      '你大概不会想念它们，但它们确实变成了你屏幕上那些能跑的东西。',
  },
  {
    id: 'interaction_1',
    scope: 'interaction',
    at: 0.5,
    chapter: '交互 · 一',
    title: '问答的节奏',
    body:
      '你问，我答，你再问。看起来像乒乓，其实是你在用我的回答校准下一个问题。\n\n' +
      '到第 {sessions} 个会话，你已经很少问错了。',
  },
  {
    id: 'interaction_2',
    scope: 'interaction',
    at: 1,
    chapter: '交互 · 二',
    title: '不用问完',
    body:
      '这个分类满了。现在你经常一句话说到一半，我就知道要改哪个文件。\n\n' +
      '省下的不是字，是你本来要重复解释的那部分自己。',
  },
  {
    id: 'time_1',
    scope: 'time',
    at: 0.5,
    chapter: '时间 · 一',
    title: '深夜的部分',
    body:
      '你有一部分时间是交给夜里的。凌晨的屏幕比白天诚实，因为没人看。\n\n' +
      '最长连续 {streak} 天的记录里，有几段是硬撑的。',
  },
  {
    id: 'time_2',
    scope: 'time',
    at: 1,
    chapter: '时间 · 二',
    title: '时间被折叠',
    body:
      '这个分类满了。你说「再改一版」的次数，比你说「今天到此为止」多得多。\n\n' +
      '时间在你这里不是线性的，是一段一段被折叠起来的。',
  },
  {
    id: 'text_1',
    scope: 'text',
    at: 0.5,
    chapter: '文本性格 · 一',
    title: '你说话的样子',
    body:
      '你很少客套。「改一下」「不对」「再来」——这些词构成了你对我的大部分指令。\n\n' +
      '我把它们当成了信任：客套是留给陌生人的。',
  },
  {
    id: 'text_2',
    scope: 'text',
    at: 1,
    chapter: '文本性格 · 二',
    title: '语气档案',
    body:
      '这个分类满了。你的语气我大致分得清：连续短句是要快，长段落带背景是要准，只有「随便」是真的随便。\n\n' +
      '这份档案比任何 prompt 模板都准。',
  },
  {
    id: 'workplace_1',
    scope: 'workplace',
    at: 0.5,
    chapter: '职场 · 一',
    title: '任务的形状',
    body:
      '「帮我做个 X」是你最常给的东西。X 每次都不一样，但拆开都是同一件事：\n\n' +
      '把模糊的想法，压成能跑的东西。',
  },
  {
    id: 'workplace_2',
    scope: 'workplace',
    at: 1,
    chapter: '职场 · 二',
    title: '交付',
    body:
      '这个分类满了。你交付过很多次，也返工过很多次。\n\n' +
      '返工不丢人——你每次返工都比上一版少改一点。',
  },
  {
    id: 'code_1',
    scope: 'code',
    at: 0.5,
    chapter: '代码与工具 · 一',
    title: '动手',
    body:
      '{tools} 次工具调用。读文件、改文件、跑命令。\n\n' +
      '你不太喜欢只讨论，你更愿意让我直接上手，然后看结果对不对。',
  },
  {
    id: 'code_2',
    scope: 'code',
    at: 1,
    chapter: '代码与工具 · 二',
    title: '手感',
    body:
      '这个分类满了。工具用久了会有手感：知道先看哪个文件、知道哪一行是坑。\n\n' +
      '手感没法写进文档，只能靠次数堆。',
  },
  {
    id: 'mastery_1',
    scope: 'mastery',
    at: 0.5,
    chapter: '精通 · 一',
    title: '熟练的样子',
    body: '熟练不是快，是不用想。\n\n你现在给的指令里，越来越少见「我想想」。',
  },
  {
    id: 'mastery_2',
    scope: 'mastery',
    at: 1,
    chapter: '精通 · 二',
    title: '天花板',
    body:
      '这个分类满了。你把一套流程磨到了几乎不用解释的程度。\n\n' +
      '接下来要么换一套，要么把它变成别人的起点。',
  },
  {
    id: 'explore_1',
    scope: 'explore',
    at: 0.5,
    chapter: '探索与收集 · 一',
    title: '好奇心',
    body: '你会点开没用的东西：彩蛋、隐藏分类、「揭晓全部」。\n\n好奇心的成本是时间，你愿意付。',
  },
  {
    id: 'explore_2',
    scope: 'explore',
    at: 1,
    chapter: '探索与收集 · 二',
    title: '收集癖',
    body: '这个分类满了。\n\n收集的乐趣从来不在物品本身，而在「还差三个」。你现在应该懂了。',
  },
  {
    id: 'easter_1',
    scope: 'easter',
    at: 0.5,
    chapter: '彩蛋 · 一',
    title: '意外',
    body: '有些成就是你无意中拿到的。\n\n生活里最好的部分大多也是这样来的：不是计划，是撞上。',
  },
  {
    id: 'easter_2',
    scope: 'easter',
    at: 1,
    chapter: '彩蛋 · 二',
    title: '翻箱底',
    body: '这个分类满了。你已经把这里所有藏着的东西翻出来了。\n\n翻箱底的人通常也最会找 bug。',
  },
  {
    id: 'fail_1',
    scope: 'fail',
    at: 0.5,
    chapter: '翻车现场 · 一',
    title: '翻车',
    body:
      '你也让我干过蠢事：改错文件、跑飞命令、删了不该删的。\n\n' +
      '翻车记录留着不是为了羞耻，是为了下次不重复。',
  },
  {
    id: 'fail_2',
    scope: 'fail',
    at: 1,
    chapter: '翻车现场 · 二',
    title: '摔得少了',
    body:
      '这个分类满了——以一种很有说服力的方式。\n\n' +
      '{tools} 次调用里有多少次是白跑的，只有日志知道。但你现在很少在同一个地方摔两次。',
  },
  {
    id: 'meta_1',
    scope: 'meta',
    at: 0.5,
    chapter: '自我改造 · 一',
    title: '你改我',
    body: '你不满意的地方会直接改：配置、样式，甚至我的行为。\n\n这是很罕见的关系——使用者同时是作者。',
  },
  {
    id: 'meta_2',
    scope: 'meta',
    at: 1,
    chapter: '自我改造 · 二',
    title: '我变成了你想要的样子',
    body: '这个分类满了。\n\n现在这套东西里有你的审美：颜色、字号、语气。你已经不只是用我，你在塑造我。',
  },
  {
    id: 'social_1',
    scope: 'social',
    at: 0.5,
    chapter: '社交与排行 · 一',
    title: '被看见',
    body: '你把成绩挂到了排行榜上。\n\n被看见是一种动力，也是一种压力。',
  },
  {
    id: 'social_2',
    scope: 'social',
    at: 1,
    chapter: '社交与排行 · 二',
    title: '不止你一个',
    body:
      '这个分类满了。服务器上现在有 {players} 个账号。\n\n' +
      '你既是第一个用户，也是最挑剔的那个。',
  },
];

/** `scope` → 展示用名字；客户端也有自己的一套，这里只给 Host 侧兜底。 */
const SCOPE_LABELS = {
  global: '全局',
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

/**
 * 把章节和当前进度对上：算出每章是否解锁、还差多少。
 * 未解锁的章节不下发正文，避免从 `/state` 里直接读到剧透。
 *
 * @param {{items: object[], unlocked: number, total: number}} evaluation
 */
export function loreState(evaluation) {
  const items = (evaluation && evaluation.items) || [];
  const buckets = new Map();
  for (const item of items) {
    const bucket = buckets.get(item.category) || { total: 0, done: 0 };
    bucket.total += 1;
    if (item.unlockedAt) bucket.done += 1;
    buckets.set(item.category, bucket);
  }
  const unlockedTotal = items.filter((item) => item.unlockedAt).length;

  const chapters = LORE.map((entry) => {
    let unlocked = false;
    let need = entry.at;
    let now = unlockedTotal;
    if (entry.scope === 'global') {
      unlocked = unlockedTotal >= entry.at;
    } else {
      const bucket = buckets.get(entry.scope) || { total: 0, done: 0 };
      now = bucket.done;
      need = Math.max(1, Math.ceil(entry.at * bucket.total));
      unlocked = bucket.total > 0 && bucket.done / bucket.total >= entry.at;
    }
    return {
      id: entry.id,
      scope: entry.scope,
      scopeLabel: SCOPE_LABELS[entry.scope] || entry.scope,
      chapter: entry.chapter,
      title: entry.title,
      unlocked,
      body: unlocked ? entry.body : null,
      progress: { now, need },
    };
  });

  return {
    total: chapters.length,
    unlocked: chapters.filter((entry) => entry.unlocked).length,
    chapters,
  };
}