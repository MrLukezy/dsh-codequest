/**
 * CodeQuest for DSH — Web GUI half.
 *
 * Registers a Conversation view ("CodeQuest") that renders the achievement
 * wall, usage dashboard, cloud account panel and leaderboard. All data comes
 * from the Host half's same-origin JSON routes; this module owns no state that
 * the Host cannot rebuild.
 */

window.__ModuleLoader__.load({
  id: 'dsh-codequest',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useCallback, useRef } = React;

    const NS = 'dsh-codequest';

    const DICT = {
      zh: {
        tab: 'CodeQuest',
        title: 'CodeQuest · DSH 成就',
        subtitle: '把每一次会话，变成看得见的成长',
        level: '等级',
        points: '积分',
        nextLevel: '距离下一级',
        achievements: '成就',
        dashboard: '数据',
        leaderboard: '排行榜',
        noServer: '还没有配置排行榜服务器，在「账号 → 服务器地址」里填一个就能上榜',
        board_achievements: '成就数',
        board_points: '积分',
        board_level: '等级',
        board_tokens: 'Token',
        board_sessions: '会话',
        board_streak: '连续天数',
        board_days: '活跃天数',
        board_tools: '工具调用',
        board_code: '代码块',
        board_today: '今日 Token',
        board_season: '赛季',
        account: '账号',
        unlocked: '已解锁',
        locked: '未解锁',
        all: '全部',
        search: '搜索成就',
        noMatch: '没有匹配的成就',
        recentUnlocks: '最近解锁',
        sort_default: '默认',
        sort_closest: '接近达成',
        sort_rare: '稀有度',
        sort_recent: '最近解锁',
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
        scanning: '扫描会话中',
        scanIdle: '会话已同步',
        refresh: '刷新',
        totalTokens: '累计 Token',
        todayTokens: '今日 Token',
        sessions: '会话',
        toolCalls: '工具调用',
        activeDays: '活跃天数',
        cacheHit: '缓存命中',
        streak: '最长连续',
        turns: '对话轮次',
        projects: '工作目录',
        models: '模型',
        recent: '最近 30 天流量',
        topTools: '常用工具',
        hourly: '时段分布',
        sentiment: '情绪关键词',
        persona: '文本性格（从你说过的话里读出来的）',
        files: '常改的文件类型',
        commands: '常用命令',
        prompts: '真人 prompt',
        praise: '夸奖',
        insult: '吐槽',
        pua: '质疑',
        beg: '恳求',
        blame: '甩锅',
        login: '登录',
        register: '注册',
        logout: '退出登录',
        email: '邮箱',
        password: '密码',
        displayName: '昵称（可选）',
        sync: '同步到排行榜',
        synced: '同步完成',
        notLoggedIn: '未登录，登录后即可参与排行榜',
        rank: '排名',
        player: '玩家',
        achCount: '成就数',
        emptyBoard: '排行榜暂无数据',
        loading: '加载中…',
        cloudBase: '服务器地址',
        save: '保存',
        hidden: '隐藏成就',
        secret: '???',
        error: '出错了',
        common: '普通',
        rare: '稀有',
        epic: '史诗',
        legendary: '传说',
        condition: '达成条件',
        progress: '当前进度',
        remaining: '还差',
        unlockedAt: '解锁于',
        close: '关闭',
        hiddenHint: '解锁后才会揭晓',
        unlockedToast: '成就解锁',
        hudOpen: '展开',
        hudClose: '收起',
        hudHide: '不再显示',
        show: '显示',
        hide: '隐藏',
        hudShow: '悬浮窗',
        hudShowHint: '在右下角显示使用曲线',
        dshAccount: 'DeepSeek 账号',
        dshLogin: '用 DeepSeek 账号登录排行榜',
        dshLoginDone: '已用 DeepSeek 账号登录',
        dshLoginCreated: '已创建账号并登录',
        dshSignedOut: '未检测到已登录的 DeepSeek 账号，请先在 Harness 里登录',
        dshNoService: '当前 Harness 没有账号服务，请用邮箱密码登录',
        dshLinked: '已绑定 DeepSeek',
        viaDsh: 'DeepSeek 免密',
        loggedInAs: '当前账号',
        unknownUser: '未知用户',
        emailFallback: '改用邮箱 + 密码（备用）',
        sharedSecret: '共享密钥',
        sharedSecretSet: '已设置，留空不修改',
        sharedSecretHint: '免密登录的签名密钥，需与服务端 DSH_SHARED_SECRET 一致',
        working: '处理中…',
      },
      en: {
        tab: 'CodeQuest',
        title: 'CodeQuest · DSH Achievements',
        subtitle: 'Turn every session into visible progress',
        level: 'Level',
        points: 'Points',
        nextLevel: 'To next level',
        achievements: 'Achievements',
        dashboard: 'Stats',
        leaderboard: 'Leaderboard',
        noServer: 'No leaderboard server configured yet — set one under Account → Server',
        board_achievements: 'Achievements',
        board_points: 'Points',
        board_level: 'Level',
        board_tokens: 'Tokens',
        board_sessions: 'Sessions',
        board_streak: 'Streak',
        board_days: 'Active days',
        board_tools: 'Tool calls',
        board_code: 'Code blocks',
        board_today: 'Today tokens',
        board_season: 'Season',
        account: 'Account',
        unlocked: 'Unlocked',
        locked: 'Locked',
        all: 'All',
        search: 'Search achievements',
        noMatch: 'No matching achievements',
        recentUnlocks: 'Recently unlocked',
        sort_default: 'Default',
        sort_closest: 'Closest',
        sort_rare: 'Rarity',
        sort_recent: 'Recent',
        token: 'Token',
        interaction: 'Interaction',
        time: 'Time',
        text: 'Text persona',
        workplace: 'Workplace',
        code: 'Code & Tools',
        mastery: 'Mastery',
        easter: 'Easter Eggs',
        explore: 'Exploration',
        fail: 'Blunders',
        meta: 'Self-hacking',
        social: 'Social',
        scanning: 'Scanning sessions',
        scanIdle: 'Sessions synced',
        refresh: 'Refresh',
        totalTokens: 'Total tokens',
        todayTokens: 'Today',
        sessions: 'Sessions',
        toolCalls: 'Tool calls',
        activeDays: 'Active days',
        cacheHit: 'Cache hit',
        streak: 'Best streak',
        turns: 'Turns',
        projects: 'Projects',
        models: 'Models',
        recent: 'Last 30 days',
        topTools: 'Top tools',
        hourly: 'Hourly usage',
        sentiment: 'Sentiment',
        persona: 'Text persona (read from what you actually typed)',
        files: 'File types touched',
        commands: 'Commands run',
        prompts: 'Human prompts',
        praise: 'Praise',
        insult: 'Snark',
        pua: 'Doubt',
        beg: 'Begging',
        blame: 'Blame',
        login: 'Log in',
        register: 'Sign up',
        logout: 'Log out',
        email: 'Email',
        password: 'Password',
        displayName: 'Display name (optional)',
        sync: 'Sync to leaderboard',
        synced: 'Synced',
        notLoggedIn: 'Not signed in — log in to join the leaderboard',
        rank: 'Rank',
        player: 'Player',
        achCount: 'Achievements',
        emptyBoard: 'No leaderboard data yet',
        loading: 'Loading…',
        cloudBase: 'Server URL',
        save: 'Save',
        hidden: 'Hidden',
        secret: '???',
        error: 'Something went wrong',
        common: 'Common',
        rare: 'Rare',
        epic: 'Epic',
        legendary: 'Legendary',
        condition: 'Requirement',
        progress: 'Progress',
        remaining: 'Remaining',
        unlockedAt: 'Unlocked at',
        close: 'Close',
        hiddenHint: 'Revealed once unlocked',
        unlockedToast: 'Achievement unlocked',
        hudOpen: 'Expand',
        hudClose: 'Collapse',
        hudHide: 'Hide',
        show: 'Show',
        hide: 'Hide',
        hudShow: 'Floating HUD',
        hudShowHint: 'Show the usage curve in the bottom-right corner',
        dshAccount: 'DeepSeek account',
        dshLogin: 'Sign in to the leaderboard with DeepSeek',
        dshLoginDone: 'Signed in with your DeepSeek account',
        dshLoginCreated: 'Account created and signed in',
        dshSignedOut: 'No DeepSeek account detected — sign in to the Harness first',
        dshNoService: 'This Harness exposes no account service; use email and password',
        dshLinked: 'DeepSeek linked',
        viaDsh: 'passwordless',
        loggedInAs: 'Signed in as',
        unknownUser: 'Unknown user',
        emailFallback: 'Use email + password instead',
        sharedSecret: 'Shared secret',
        sharedSecretSet: 'Already set — leave blank to keep',
        sharedSecretHint: 'Signing key for passwordless login; must match the server DSH_SHARED_SECRET',
        working: 'Working…',
      },
    };

    const SIGNAL_LABELS = {
      question: '疑问',
      short: '极短指令',
      long: '长文需求',
      retry: '重试纠正',
      doubt: '质疑',
      polite: '礼貌',
      emoji: '表情',
      curious: '追问原理',
      server: '服务端',
      git: 'git/分支',
      requirement: '需求/策划',
      art: '美术/UI',
      perf: '性能',
      deploy: '发布',
      unity: 'Unity',
      test: '测试',
      errorPaste: '报错堆栈',
      refactor: '重构',
      cheer: '夸奖',
      rude: '暴躁',
      emo: 'emo',
      coffee: '咖啡',
      friday: '周末/摸鱼',
      english: '英文',
      chinese: '中文',
      codePaste: '贴代码',
      excited: '激动',
      apologize: '道歉',
    };

    const RARITY = {
      common: { color: '#8b95a5', label: 'Common' },
      rare: { color: '#3b82f6', label: 'Rare' },
      epic: { color: '#a855f7', label: 'Epic' },
      legendary: { color: '#f59e0b', label: 'Legendary' },
    };

    const CATEGORY_ORDER = [
  'token',
  'interaction',
  'time',
  'text',
  'workplace',
  'code',
  'mastery',
  'explore',
  'easter',
  'fail',
  'meta',
  'social',
];

/**
 * Header avatar: one portrait per title tier (7 tiers, matching `titleFor`),
 * served from `/level/level_<tier>.webp`.
 */
function levelTier(level) {
  if (level >= 40) return 7;
  if (level >= 30) return 6;
  if (level >= 22) return 5;
  if (level >= 15) return 4;
  if (level >= 10) return 3;
  if (level >= 6) return 2;
  return 1;
}

function levelArtUrl(level) {
  return `${apiBase()}/level/level_${levelTier(level)}.webp`;
}

    function apiBase() {
      const pathname = window.location.pathname || '/';
      const cut = pathname.lastIndexOf('/');
      const dir = cut >= 0 ? pathname.slice(0, cut + 1) : '/';
      return `${dir}dsh-codequest`;
    }

    async function api(path, body) {
      const response = await fetch(`${apiBase()}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      if (!text) return { ok: false, error: `http_${response.status}` };
      try {
        return JSON.parse(text);
      } catch {
        return { ok: false, error: `bad_response_${response.status}` };
      }
    }

    function fmtInt(value) {
      const n = Number(value) || 0;
      return n.toLocaleString('en-US');
    }

    function fmtTokens(value) {
      const n = Number(value) || 0;
      if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
      return String(n);
    }

    const styles = `
.cq-root{display:flex;flex-direction:column;gap:14px;height:100%;min-height:0;overflow:auto;padding:16px 18px 28px;color:var(--dsw-alias-label-primary,#1f2328);font-size:13px;line-height:1.5}
.cq-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:4px 0 6px}
.cq-avatar{position:relative;width:68px;height:68px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,#4d6bfe 32%,transparent),color-mix(in srgb,#a855f7 16%,transparent));box-shadow:inset 0 0 0 2px color-mix(in srgb,#4d6bfe 45%,transparent),0 6px 20px color-mix(in srgb,#4d6bfe 28%,transparent)}
.cq-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
.cq-avatar b{position:absolute;right:-3px;bottom:-3px;min-width:25px;height:25px;padding:0 5px;border-radius:999px;background:linear-gradient(135deg,#4d6bfe,#a855f7);color:#fff;font-size:11.5px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.28);z-index:1}
.cq-avatar small{position:absolute;left:50%;transform:translateX(-50%);bottom:-18px;white-space:nowrap;font-size:9.5px;font-weight:700;letter-spacing:.02em;color:var(--dsw-alias-label-secondary,#5b6472)}
.cq-badge small{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-secondary,#5b6472);border:1px solid var(--dsw-alias-border-l2,#e3e6eb);border-radius:999px;font-size:9px;padding:0 6px;line-height:14px;white-space:nowrap}
.cq-headtext{min-width:0;flex:1}
.cq-title{font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cq-sub{color:var(--dsw-alias-label-secondary,#5b6472);font-size:11.5px}
.cq-chip{border:1px solid var(--dsw-alias-border-l2,#e3e6eb);border-radius:999px;padding:1px 8px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#5b6472);font-weight:600;white-space:nowrap}
.cq-btn{border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);border-radius:8px;padding:5px 12px;font:inherit;font-size:12px;cursor:pointer;transition:border-color .15s,background-color .15s}
.cq-btn:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.cq-btn:disabled{opacity:.5;cursor:default}
.cq-btn.primary{background:var(--dsw-alias-button-primary-fill,#4d6bfe);border-color:transparent;color:#fff;font-weight:600}
.cq-levelbar{height:7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-secondary,#5b6472) 18%,transparent);overflow:hidden;margin-top:6px}
.cq-levelbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#4d6bfe,#a855f7)}
.cq-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6eb);padding-bottom:0}
.cq-tab{border:0;background:none;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-secondary,#5b6472);padding:7px 12px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.cq-tab.on{color:var(--dsw-alias-brand-primary,#4d6bfe);border-bottom-color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:650}
.cq-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px}
.cq-stat{border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:10px;padding:9px 11px}
.cq-stat b{display:block;font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.2px}
.cq-stat span{color:var(--dsw-alias-label-secondary,#5b6472);font-size:10.5px}
.cq-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.cq-search{flex:1;min-width:160px}
.cq-recent{display:flex;align-items:center;gap:8px;overflow:hidden}
.cq-recentlabel{flex:none;font-size:10.5px;font-weight:700;color:var(--dsw-alias-label-secondary,#5b6472);letter-spacing:.02em}
.cq-recentrow{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.cq-recentchip{display:flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:none;border-radius:999px;padding:2px 9px 2px 6px;font:inherit;font-size:11px;color:var(--dsw-alias-label-primary,#1f2328);cursor:pointer;white-space:nowrap}
.cq-recentchip:hover{background:color-mix(in srgb,#4d6bfe 10%,transparent)}
.cq-filters{display:flex;gap:6px;flex-wrap:wrap}
.cq-chips{display:flex;flex-wrap:wrap;gap:6px}
.cq-fchip{border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:none;border-radius:999px;padding:2px 10px;font:inherit;font-size:11px;color:var(--dsw-alias-label-secondary,#5b6472);cursor:pointer}
.cq-fchip.on{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 45%,transparent);color:var(--dsw-alias-brand-primary,#4d6bfe)}
.cq-group{display:flex;flex-direction:column;gap:8px}
.cq-grouphead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 0 1px;border-bottom:1px dashed var(--dsw-alias-border-l2,#e3e6eb)}
.cq-grouptitle{font-size:12.5px;font-weight:700}
.cq-groupcount{font-size:10.5px;font-weight:700;color:var(--dsw-alias-brand-primary,#4d6bfe);font-variant-numeric:tabular-nums}
.cq-grouppts{font-size:10px;color:var(--dsw-alias-label-secondary,#5b6472);font-variant-numeric:tabular-nums}
.cq-groupprog{flex:1;min-width:60px;height:4px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-secondary,#5b6472) 16%,transparent);overflow:hidden;margin-left:auto}
.cq-groupprog i{display:block;height:100%;background:linear-gradient(90deg,#4d6bfe,#a855f7)}
.cq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(178px,1fr));gap:9px}
.cq-card{position:relative;border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:linear-gradient(158deg,color-mix(in srgb,var(--cq-r) 9%,var(--dsw-alias-bg-layer-1,#fff)),var(--dsw-alias-bg-layer-1,#fff) 62%);border-radius:12px;padding:10px 11px;display:flex;gap:10px;align-items:flex-start;min-height:78px;overflow:hidden}
.cq-card.locked{opacity:.92;border-style:dashed}
.cq-card.on{border-color:color-mix(in srgb,var(--cq-r) 55%,transparent);box-shadow:0 4px 16px color-mix(in srgb,var(--cq-r) 20%,transparent)}
.cq-card.on[data-r="legendary"]{box-shadow:0 0 0 1px color-mix(in srgb,#f59e0b 45%,transparent),0 6px 22px color-mix(in srgb,#f59e0b 30%,transparent)}
.cq-card.on[data-r="epic"]{box-shadow:0 0 0 1px color-mix(in srgb,#a855f7 40%,transparent),0 6px 20px color-mix(in srgb,#a855f7 26%,transparent)}
.cq-icon{width:46px;height:46px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--cq-r) 30%,transparent),color-mix(in srgb,var(--cq-r) 10%,transparent));box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--cq-r) 60%,transparent),0 2px 9px color-mix(in srgb,var(--cq-r) 24%,transparent)}
.cq-icon img{width:100%;height:100%;object-fit:cover;display:block}
.cq-icon span{font-size:21px;line-height:1}
.cq-card.locked .cq-icon{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--cq-r) 28%,transparent)}
.cq-card.locked .cq-icon img{opacity:.55}
.cq-lock{position:absolute;top:5px;right:7px;font-size:10px;line-height:1;opacity:.7}
.cq-cname{font-size:12px;font-weight:650;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.cq-cdesc{font-size:10.5px;color:var(--dsw-alias-label-secondary,#5b6472);margin-top:1px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cq-prog{height:4px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-secondary,#5b6472) 16%,transparent);margin-top:6px;overflow:hidden}
.cq-prog i{display:block;height:100%;background:var(--cq-r)}
.cq-meta{font-size:9.5px;color:var(--dsw-alias-label-secondary,#5b6472);margin-top:3px;font-variant-numeric:tabular-nums}
.cq-card{cursor:pointer;transition:transform .12s ease,box-shadow .15s ease}
.cq-card:hover{transform:translateY(-1px)}
.cq-card:focus-visible{outline:2px solid color-mix(in srgb,var(--cq-r) 70%,transparent);outline-offset:2px}
.cq-overlay{position:fixed;right:16px;bottom:92px;z-index:60;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none;max-width:min(320px,calc(100vw - 32px))}
.cq-overlay>*{pointer-events:auto}
.cq-hud{display:flex;flex-direction:column;align-items:flex-end}
.cq-hudpill{display:flex;align-items:center;gap:2px;border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 92%,transparent);backdrop-filter:blur(10px);border-radius:999px;padding:3px 4px 3px 5px;box-shadow:0 6px 20px rgba(20,26,40,.14)}
.cq-hudpillmain{display:flex;align-items:center;gap:6px;border:0;background:none;font:inherit;font-size:11.5px;color:var(--dsw-alias-label-primary,#1f2328);cursor:pointer;padding:2px 3px}
.cq-hudpillmain img{width:22px;height:22px;border-radius:50%;object-fit:cover}
.cq-hudpillmain b{font-size:11.5px;font-weight:800;color:#4d6bfe}
.cq-hudpillmain span{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#5b6472)}
.cq-hudcard{width:272px;border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 94%,transparent);backdrop-filter:blur(12px);border-radius:14px;padding:11px 12px 10px;box-shadow:0 10px 30px rgba(20,26,40,.18)}
.cq-hudhead{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.cq-hudhead img{width:30px;height:30px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px color-mix(in srgb,#4d6bfe 40%,transparent)}
.cq-hudtitle{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cq-hudsub{font-size:10.5px;color:var(--dsw-alias-label-secondary,#5b6472);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cq-hudx{border:0;background:none;font:inherit;font-size:15px;line-height:1;color:var(--dsw-alias-label-secondary,#5b6472);cursor:pointer;padding:0 2px}
.cq-hudrow{display:flex;justify-content:space-between;font-size:10.5px;color:var(--dsw-alias-label-secondary,#5b6472);margin:6px 0 2px}
.cq-spark{display:block;width:100%}
.cq-toasts{display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.cq-toast{display:flex;align-items:center;gap:9px;min-width:212px;max-width:280px;border:1px solid color-mix(in srgb,#4d6bfe 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 96%,transparent);backdrop-filter:blur(10px);border-radius:12px;padding:8px 11px;font:inherit;cursor:pointer;box-shadow:0 10px 26px rgba(20,26,40,.2);animation:cqToastIn .22s ease-out}
@keyframes cqToastIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
.cq-toasticon{width:36px;height:36px;flex:none;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 38%,rgba(77,107,254,.3),rgba(168,85,247,.12));font-size:17px}
.cq-toasticon img{width:100%;height:100%;object-fit:cover}
.cq-toasttitle{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#4d6bfe}
.cq-toastname{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:650;color:var(--dsw-alias-label-primary,#1f2328)}
.cq-toastname b{font-size:10.5px;color:#a855f7;font-variant-numeric:tabular-nums}
.cq-modal{position:fixed;inset:0;z-index:80;background:rgba(16,20,32,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px}
.cq-modalbox{width:min(420px,100%);max-height:82vh;overflow:auto;border-radius:16px;border:1px solid color-mix(in srgb,var(--cq-r) 45%,transparent);background:linear-gradient(160deg,color-mix(in srgb,var(--cq-r) 12%,var(--dsw-alias-bg-layer-1,#fff)),var(--dsw-alias-bg-layer-1,#fff) 55%);box-shadow:0 24px 60px rgba(12,16,28,.35);padding:16px 17px 18px}
.cq-modalhead{display:flex;align-items:flex-start;gap:12px}
.cq-modalart{width:76px;height:76px;flex:none;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--cq-r) 32%,transparent),color-mix(in srgb,var(--cq-r) 10%,transparent));box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--cq-r) 60%,transparent),0 6px 18px color-mix(in srgb,var(--cq-r) 26%,transparent);font-size:30px}
.cq-modalart img{width:100%;height:100%;object-fit:cover}
.cq-modaltitle{font-size:16px;font-weight:750;line-height:1.3}
.cq-modalchips{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.cq-modalx{margin-left:auto;border:0;background:none;font:inherit;font-size:14px;color:var(--dsw-alias-label-secondary,#5b6472);cursor:pointer;padding:2px 4px}
.cq-modaldesc{margin-top:12px;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-primary,#1f2328)}
.cq-modalsection{margin-top:12px;border-top:1px dashed var(--dsw-alias-border-l2,#e3e6eb);padding-top:10px}
.cq-modallabel{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;font-weight:700;color:var(--dsw-alias-label-secondary,#5b6472);margin-bottom:5px}
.cq-modallabel b{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#1f2328)}
.cq-modalvalue{font-size:12px;line-height:1.5}
.cq-modalnote{margin-top:6px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#5b6472)}
.cq-prog.big{height:8px}
.cq-dshrow{display:flex;align-items:center;gap:10px;margin-top:8px}
.cq-dshavatar{width:38px;height:38px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 2px color-mix(in srgb,#4d6bfe 35%,transparent)}
.cq-dshavatar.fallback{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4d6bfe,#a855f7);color:#fff;font-weight:800;font-size:15px}
.cq-dshname{font-size:12.5px;font-weight:700}
.cq-disclose{border:0;background:none;font:inherit;font-size:11.5px;color:var(--dsw-alias-label-secondary,#5b6472);cursor:pointer;display:flex;align-items:center;gap:6px;padding:0}
.cq-disclose:hover{color:var(--dsw-alias-brand-primary,#4d6bfe)}
.cq-prefrow{display:flex;align-items:center;gap:12px}
.cq-pts{font-size:9.5px;font-weight:700;color:var(--cq-r);white-space:nowrap}
.cq-panel{border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:12px;padding:12px 14px}
.cq-panel h4{margin:0 0 8px;font-size:12px;font-weight:650;color:var(--dsw-alias-label-secondary,#5b6472)}
.cq-bars{display:flex;align-items:flex-end;gap:3px;height:86px}
.cq-bars div{flex:1;min-width:3px;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#4d6bfe,#8b5cf6);position:relative}
.cq-bars div span{position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:8px;color:var(--dsw-alias-label-secondary,#5b6472);white-space:nowrap;display:none}
.cq-hours{display:grid;grid-template-columns:repeat(24,1fr);gap:2px}
.cq-hours i{height:22px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) var(--a,10%),transparent);display:block}
.cq-list{display:flex;flex-direction:column;gap:5px}
.cq-row{display:flex;align-items:baseline;gap:8px;font-size:11.5px}
.cq-row b{font-variant-numeric:tabular-nums;margin-left:auto}
.cq-row .bar{height:4px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 55%,transparent);flex:none}
.cq-sent{display:flex;gap:6px;flex-wrap:wrap}
.cq-sent span{border:1px solid var(--dsw-alias-border-l2,#e3e6eb);border-radius:999px;padding:1px 9px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#5b6472)}
.cq-sent b{color:var(--dsw-alias-label-primary,#1f2328);margin-left:4px}
.cq-form{display:flex;flex-direction:column;gap:8px;max-width:320px}
.cq-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#e3e6eb);background:var(--dsw-alias-bg-layer-2,#f6f7f9);border-radius:8px;padding:7px 10px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#1f2328)}
.cq-input:focus{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 45%,transparent);outline-offset:0}
.cq-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cq-note{font-size:11px;color:var(--dsw-alias-label-secondary,#5b6472)}
.cq-err{font-size:11px;color:var(--dsw-alias-state-error-primary,#d33)}
.cq-board{display:flex;flex-direction:column;gap:2px}
.cq-brow{display:grid;grid-template-columns:36px 1fr 74px;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;font-size:12px}
.cq-player{display:flex;align-items:center;gap:7px;min-width:0}
.cq-pavatar{width:22px;height:22px;flex:none;border-radius:50%;object-fit:cover;box-shadow:0 0 0 1px var(--dsw-alias-border-l2,#e3e6eb)}
.cq-pavatar.fallback{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4d6bfe,#a855f7);color:#fff;font-size:10.5px;font-weight:800}
.cq-brow:nth-child(odd){background:color-mix(in srgb,var(--dsw-alias-label-secondary,#5b6472) 5%,transparent)}
.cq-brow.top{background:linear-gradient(90deg,color-mix(in srgb,#f59e0b 14%,transparent),transparent)}
.cq-brow.me{background:color-mix(in srgb,#4d6bfe 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#4d6bfe 30%,transparent)}
.cq-rank{font-weight:800;color:var(--dsw-alias-label-secondary,#5b6472);font-variant-numeric:tabular-nums}
.cq-empty{padding:22px;text-align:center;color:var(--dsw-alias-label-secondary,#5b6472);font-size:12px}
`;

    /**
     * The stylesheet must exist for every entry point, not only for the
     * Conversation View: a `shell.overlay` entry renders outside that tree, so
     * a style tag nested in the view would leave the overlay unstyled (raw
     * block content, no positioning, blocking clicks). Inject once into <head>.
     */
    let stylesInjected = false;

    function ensureStyles() {
      if (stylesInjected) return;
      try {
        if (typeof document === 'undefined') return;
        // A reload of this module must replace the previous stylesheet, not
        // silently keep stale rules from the last version.
        const old = document.getElementById('dsh-codequest-style');
        if (old) old.remove();
        const tag = document.createElement('style');
        tag.id = 'dsh-codequest-style';
        tag.setAttribute('data-plugin', NS);
        tag.textContent = styles;
        (document.head || document.documentElement).appendChild(tag);
        stylesInjected = true;
      } catch {
        /* SSR or a locked-down document: the views still render unstyled */
      }
    }

    function StyleTag() {
      ensureStyles();
      return null;
    }

    /**
 * One poller for the whole plugin: the tab, the floating HUD and the unlock
 * toasts all read the same snapshot instead of hammering `/state` three times.
 */
    const questStore = {
      data: null,
      error: null,
      listeners: new Set(),
      timer: 0,
      pending: null,
      async refresh() {
        if (this.pending) return this.pending;
        this.pending = (async () => {
          try {
            const next = await api('/state');
            if (next && next.ok) {
              this.data = next;
              this.error = null;
            } else {
              this.error = (next && next.error) || 'state_failed';
            }
          } catch (err) {
            this.error = String((err && err.message) || err);
          } finally {
            this.pending = null;
            for (const listener of [...this.listeners]) listener();
          }
        })();
        return this.pending;
      },
      start() {
        if (this.timer) return;
        this.timer = window.setInterval(() => void this.refresh(), 15_000);
        void this.refresh();
      },
      subscribe(listener) {
        this.listeners.add(listener);
        this.start();
        return () => {
          this.listeners.delete(listener);
          if (this.listeners.size === 0 && this.timer) {
            window.clearInterval(this.timer);
            this.timer = 0;
          }
        };
      },
      /** Wake every subscriber without a network round-trip (local pref changes). */
      notify() {
        for (const listener of [...this.listeners]) listener();
      },
    };

    function useQuestStore() {
      const [, bump] = useState(0);
      useEffect(() => {
        let alive = true;
        const off = questStore.subscribe(() => {
          if (alive) bump((n) => n + 1);
        });
        return () => {
          alive = false;
          off();
        };
      }, []);
      return { data: questStore.data, error: questStore.error, reload: () => questStore.refresh() };
    }

    function useCodeQuest() {
      return useQuestStore();
    }

    function LevelHeader({ data, t }) {
      const p = data.progress;
      const pct = p.levelNeed > 0 ? Math.min(100, (p.levelInto / p.levelNeed) * 100) : 0;
      const avatar = levelArtUrl(p.level);
      return h(
        'div',
        { className: 'cq-head' },
        h(
          'div',
          { className: 'cq-avatar' },
          h('img', {
            src: avatar,
            alt: '',
            decoding: 'async',
            onError: (event) => {
              event.currentTarget.style.display = 'none';
            },
          }),
          h('b', null, String(p.level)),
          h('small', null, p.title),
        ),
        h(
          'div',
          { className: 'cq-headtext' },
          h('div', { className: 'cq-title' }, t('title'), h('span', { className: 'cq-chip' }, `${p.points} ${t('points')}`)),
          h('div', { className: 'cq-sub' }, t('subtitle')),
          h(
            'div',
            { className: 'cq-levelbar', title: `${p.levelInto}/${p.levelNeed}` },
            h('i', { style: { width: `${pct}%` } }),
          ),
          h('div', { className: 'cq-sub', style: { marginTop: '3px' } }, `${t('nextLevel')} ${p.levelNeed - p.levelInto} ${t('points')}`),
        ),
        h('span', { className: 'cq-chip' }, `${t('unlocked')} ${p.unlocked}/${p.total}`),
      );
    }

    function StatCards({ data, t }) {
      const s = data.stats;
      const cards = [
        [t('totalTokens'), fmtTokens(s.tokens)],
        [t('todayTokens'), fmtTokens(s.tokensToday)],
        [t('sessions'), fmtInt(s.sessions)],
        [t('prompts'), fmtInt(s.humanPrompts)],
        [t('toolCalls'), fmtInt(s.toolCalls)],
        [t('activeDays'), fmtInt(s.activeDays)],
        [t('cacheHit'), `${Math.round(s.cacheHitRate * 100)}%`],
      ];
      return h(
        'div',
        { className: 'cq-stats' },
        cards.map(([label, value]) => h('div', { className: 'cq-stat', key: label }, h('b', null, value), h('span', null, label))),
      );
    }

    function AchievementCard({ item, t, onOpen }) {
      const rarity = RARITY[item.rarity] || RARITY.common;
      const locked = !item.unlockedAt;
      const secret = locked && item.hidden;
      const pct = Math.round(item.ratio * 100);
      const artUrl = item.art ? `${apiBase()}/icon/${item.art}.webp` : null;
      return h(
        'div',
        {
          className: `cq-card${locked ? ' locked' : ' on'}`,
          style: { '--cq-r': rarity.color },
          'data-r': item.rarity,
          role: 'button',
          tabIndex: 0,
          title: `${item.cond}\n${fmtInt(item.value)} / ${fmtInt(item.target)}`,
          onClick: onOpen,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (onOpen) onOpen();
            }
          },
        },
        h(
          'div',
          { className: 'cq-icon' },
          artUrl && !secret
            ? h('img', {
                src: artUrl,
                alt: '',
                loading: 'lazy',
                decoding: 'async',
                onError: (event) => {
                  const img = event.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling;
                  if (fallback) fallback.style.display = 'flex';
                },
              })
            : null,
          h(
            'span',
            { style: { display: artUrl && !secret ? 'none' : 'flex' } },
            secret ? '❓' : item.icon,
          ),
        ),
        locked ? h('span', { className: 'cq-lock' }, '🔒') : null,
        h(
          'div',
          { style: { minWidth: 0, flex: 1 } },
          h(
            'div',
            { className: 'cq-cname' },
            secret ? t('secret') : item.name,
            h('span', { className: 'cq-pts' }, `+${item.points}`),
          ),
          h('div', { className: 'cq-cdesc' }, secret ? t('hidden') : item.desc),
          h('div', { className: 'cq-prog' }, h('i', { style: { width: `${locked ? pct : 100}%` } })),
          h('div', { className: 'cq-meta' }, locked ? `${pct}%` : new Date(item.unlockedAt).toLocaleDateString()),
        ),
      );
    }

    /** Last N local days as `YYYY-MM-DD` keys, oldest first. */
    function lastDays(dailyTokens, count) {
      const out = [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      for (let back = count - 1; back >= 0; back -= 1) {
        const day = new Date(now.getTime() - back * 86_400_000);
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        out.push({ key, value: Number((dailyTokens || {})[key]) || 0 });
      }
      return out;
    }

    function Sparkline({ values, width, height }) {
      const max = Math.max(1, ...values);
      const step = values.length > 1 ? width / (values.length - 1) : width;
      const points = values.map((value, index) => {
        const x = index * step;
        const y = height - 2 - (value / max) * (height - 4);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return h(
        'svg',
        { className: 'cq-spark', width, height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none' },
        h('polygon', { points: `0,${height} ${points.join(' ')} ${width},${height}`, fill: 'rgba(77,107,254,.16)' }),
        h('polyline', {
          points: points.join(' '),
          fill: 'none',
          stroke: '#4d6bfe',
          strokeWidth: 1.6,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        }),
      );
    }

    const HUD_KEY = 'dsh-codequest.hud';
    const SEEN_KEY = 'dsh-codequest.seen';

    function readSeen() {
      try {
        const raw = window.localStorage.getItem(SEEN_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed) : null;
      } catch {
        return null;
      }
    }

    function writeSeen(ids) {
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
      } catch {
        /* private mode: toasts just replay next reload */
      }
    }

    /** Set by `apply()` to the locale-bound translator; overlay entries get no props. */
    let pluginT = (key) => DICT.zh[key] || key;

    /** `hidden` | `pill` | `open` — remembered per browser. */
    function readHudMode() {
      try {
        const raw = window.localStorage.getItem(HUD_KEY);
        return raw === 'hidden' || raw === 'open' ? raw : 'pill';
      } catch {
        return 'pill';
      }
    }

    function writeHudMode(mode) {
      try {
        window.localStorage.setItem(HUD_KEY, mode);
      } catch {
        /* private mode: the choice just does not survive a reload */
      }
      questStore.notify();
    }

    /** Floating usage curve: a small pill by default, expandable, hideable. */
    function QuestHud(props) {
      const t = (props && props.t) || pluginT;
      const { data } = useQuestStore();
      const mode = readHudMode();
      if (mode === 'hidden' || !data) return null;

      const p = data.progress;
      const s = data.stats;
      const days = lastDays(s.dailyTokens, 14);
      const values = days.map((day) => day.value);
      const pct = p.levelNeed > 0 ? Math.min(100, (p.levelInto / p.levelNeed) * 100) : 0;
      const avatar = levelArtUrl(p.level);
      const hide = (event) => {
        if (event) event.stopPropagation();
        writeHudMode('hidden');
      };

      if (mode === 'pill') {
        return h(
          'div',
          { className: 'cq-hud' },
          h(
            'div',
            { className: 'cq-hudpill' },
            h(
              'button',
              {
                type: 'button',
                className: 'cq-hudpillmain',
                onClick: () => writeHudMode('open'),
                title: t('hudOpen'),
              },
              h('img', { src: avatar, alt: '' }),
              h('b', null, `Lv.${p.level}`),
              h('span', null, fmtTokens(s.tokensToday)),
              h(Sparkline, { values, width: 40, height: 15 }),
            ),
            h('button', { type: 'button', className: 'cq-hudx', onClick: hide, title: t('hudHide') }, '✕'),
          ),
        );
      }

      return h(
        'div',
        { className: 'cq-hud' },
        h(
          'div',
          { className: 'cq-hudcard' },
          h(
            'div',
            { className: 'cq-hudhead' },
            h('img', { src: avatar, alt: '' }),
            h(
              'div',
              { style: { minWidth: 0, flex: 1 } },
              h('div', { className: 'cq-hudtitle' }, `Lv.${p.level} ${p.title}`),
              h('div', { className: 'cq-hudsub' }, `${t('todayTokens')} ${fmtTokens(s.tokensToday)} · ${t('streak')} ${s.maxStreak || 0}`),
            ),
            h('button', { type: 'button', className: 'cq-hudx', onClick: () => writeHudMode('pill'), title: t('hudClose') }, '−'),
            h('button', { type: 'button', className: 'cq-hudx', onClick: hide, title: t('hudHide') }, '✕'),
          ),
          h(Sparkline, { values, width: 240, height: 44 }),
          h(
            'div',
            { className: 'cq-hudrow' },
            h('span', null, `${t('unlocked')} ${p.unlocked}/${p.total}`),
            h('span', null, `${p.points} ${t('points')}`),
          ),
          h('div', { className: 'cq-levelbar' }, h('i', { style: { width: `${pct}%` } })),
          h('div', { className: 'cq-hudsub', style: { marginTop: '5px' } }, `${t('nextLevel')} ${p.levelNeed - p.levelInto} ${t('points')}`),
        ),
      );
    }

    function QuestToast({ entry, t, onDone }) {
      useEffect(() => {
        const timer = window.setTimeout(onDone, 6000);
        return () => window.clearTimeout(timer);
      }, [onDone]);
      const item = entry.item;
      return h(
        'button',
        { type: 'button', className: 'cq-toast', onClick: onDone, title: item.desc },
        h(
          'div',
          { className: 'cq-toasticon' },
          item.art
            ? h('img', { src: `${apiBase()}/icon/${item.art}.webp`, alt: '' })
            : h('span', null, item.icon || '🏆'),
        ),
        h(
          'div',
          { style: { minWidth: 0, flex: 1, textAlign: 'left' } },
          h('div', { className: 'cq-toasttitle' }, t('unlockedToast')),
          h('div', { className: 'cq-toastname' }, item.name, h('b', null, `+${item.points}`)),
        ),
      );
    }

    /** Bottom-right toasts for achievements unlocked while the page is open. */
    function QuestToasts(props) {
      const t = (props && props.t) || pluginT;
      const { data } = useQuestStore();
      const [entries, setEntries] = useState([]);
      const seen = useRef(null);

      useEffect(() => {
        if (!data || !Array.isArray(data.achievements)) return;
        const unlocked = data.achievements.filter((item) => item.unlockedAt);
        const ids = new Set(unlocked.map((item) => item.id));
        if (seen.current === null) {
          const stored = readSeen();
          seen.current = stored || ids;
          if (!stored) writeSeen(ids);
          return;
        }
        const fresh = unlocked.filter((item) => !seen.current.has(item.id));
        if (fresh.length === 0) {
          if (ids.size !== seen.current.size) {
            seen.current = ids;
            writeSeen(ids);
          }
          return;
        }
        for (const item of fresh) seen.current.add(item.id);
        writeSeen(seen.current);
        setEntries((prev) => [...fresh.map((item) => ({ key: `${item.id}:${Date.now()}`, item })), ...prev].slice(0, 4));
      }, [data]);

      const dismiss = useCallback((key) => {
        setEntries((prev) => prev.filter((entry) => entry.key !== key));
      }, []);

      if (entries.length === 0) return null;
      return h(
        'div',
        { className: 'cq-toasts' },
        entries.map((entry) =>
          h(QuestToast, { key: entry.key, entry, t, onDone: () => dismiss(entry.key) }),
        ),
      );
    }

    /** One overlay column: unlock toasts on top, the usage HUD below. */
    function QuestOverlay(props) {
      const t = (props && props.t) || pluginT;
      ensureStyles();
      return h(
        'div',
        { className: 'cq-overlay' },
        h(QuestToasts, { t }),
        h(QuestHud, { t }),
      );
    }

    /** Sort modes shared by the wall: default grouping, closest-to-unlock, recent. */
    const SORT_MODES = ['default', 'closest', 'rare', 'recent'];

    function AchievementsTab({ data, t }) {
      const [category, setCategory] = useState('all');
      const [detail, setDetail] = useState(null);
      const [query, setQuery] = useState('');
      const [sort, setSort] = useState('default');

      const needle = query.trim().toLowerCase();

      const groups = useMemo(() => {
        const buckets = new Map();
        for (const item of data.achievements || []) {
          if (needle) {
            const hay = `${item.name} ${item.desc} ${item.cond} ${item.id}`.toLowerCase();
            if (!hay.includes(needle)) continue;
          }
          if (!buckets.has(item.category)) buckets.set(item.category, []);
          buckets.get(item.category).push(item);
        }
        return CATEGORY_ORDER.filter((key) => buckets.has(key)).map((key) => {
          const items = buckets.get(key);
          const sorted = [...items].sort((a, b) => {
            if (sort === 'closest') {
              const left = a.unlockedAt ? 2 : a.ratio;
              const right = b.unlockedAt ? 2 : b.ratio;
              return right - left;
            }
            if (sort === 'rare') {
              const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
              return (order[a.rarity] ?? 9) - (order[b.rarity] ?? 9) || b.ratio - a.ratio;
            }
            if (sort === 'recent') {
              return (b.unlockedAt || 0) - (a.unlockedAt || 0);
            }
            if (Boolean(a.unlockedAt) !== Boolean(b.unlockedAt)) return a.unlockedAt ? -1 : 1;
            return b.ratio - a.ratio;
          });
          return {
            key,
            items: sorted,
            unlocked: items.filter((item) => item.unlockedAt).length,
            total: items.length,
            points: items.reduce((sum, item) => sum + (item.unlockedAt ? item.points : 0), 0),
            maxPoints: items.reduce((sum, item) => sum + item.points, 0),
          };
        });
      }, [data.achievements, needle, sort]);

      // "最近解锁" timeline: newest first, independent of the current filter.
      const recent = useMemo(
        () =>
          (data.achievements || [])
            .filter((item) => item.unlockedAt)
            .sort((a, b) => b.unlockedAt - a.unlockedAt)
            .slice(0, 6),
        [data.achievements],
      );

      const visible = category === 'all' ? groups : groups.filter((group) => group.key === category);
      const chips = [['all', t('all')], ...groups.map((group) => [group.key, t(group.key)])];
      const shown = groups.reduce((sum, group) => sum + group.total, 0);

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(
          'div',
          { className: 'cq-toolbar' },
          h('input', {
            className: 'cq-input cq-search',
            placeholder: t('search'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          h(
            'div',
            { className: 'cq-chips' },
            SORT_MODES.map((mode) =>
              h(
                'button',
                {
                  key: mode,
                  type: 'button',
                  className: `cq-fchip${sort === mode ? ' on' : ''}`,
                  onClick: () => setSort(mode),
                },
                t(`sort_${mode}`),
              ),
            ),
          ),
          needle
            ? h('span', { className: 'cq-note' }, `${shown} / ${(data.achievements || []).length}`)
            : null,
        ),
        recent.length > 0
          ? h(
              'div',
              { className: 'cq-recent' },
              h('span', { className: 'cq-recentlabel' }, t('recentUnlocks')),
              h(
                'div',
                { className: 'cq-recentrow' },
                recent.map((item) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      key: item.id,
                      className: 'cq-recentchip',
                      title: `${item.name} · ${new Date(item.unlockedAt).toLocaleDateString()}`,
                      onClick: () => setDetail(item),
                    },
                    h('span', null, item.icon),
                    h('span', null, item.name),
                  ),
                ),
              ),
            )
          : null,
        h(
          'div',
          { className: 'cq-filters' },
          chips.map(([key, label]) =>
            h(
              'button',
              {
                key,
                type: 'button',
                className: `cq-fchip${category === key ? ' on' : ''}`,
                onClick: () => setCategory(key),
              },
              label,
            ),
          ),
        ),
        visible.length === 0
          ? h('div', { className: 'cq-empty' }, t('noMatch'))
          : null,
        visible.map((group) =>
          h(
            'section',
            { key: group.key, className: 'cq-group' },
            h(
              'div',
              { className: 'cq-grouphead' },
              h('span', { className: 'cq-grouptitle' }, t(group.key)),
              h('span', { className: 'cq-groupcount' }, `${group.unlocked}/${group.total}`),
              h('span', { className: 'cq-grouppts' }, `${group.points}/${group.maxPoints} ${t('points')}`),
              h(
                'span',
                { className: 'cq-groupprog' },
                h('i', { style: { width: `${group.total ? (group.unlocked / group.total) * 100 : 0}%` } }),
              ),
            ),
            h(
              'div',
              { className: 'cq-grid' },
              group.items.map((item) => h(AchievementCard, { key: item.id, item, t, onOpen: () => setDetail(item) })),
            ),
          ),
        ),
        detail ? h(AchievementDetail, { item: detail, t, onClose: () => setDetail(null) }) : null,
      );
    }

    /** Full-card detail: art, condition, live progress and unlock state. */
    function AchievementDetail({ item, t, onClose }) {
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      const rarity = RARITY[item.rarity] || RARITY.common;
      const secret = item.hidden && !item.unlockedAt;
      const pct = Math.round(item.ratio * 100);
      const remaining = Math.max(0, item.target - item.value);

      return h(
        'div',
        { className: 'cq-modal', onClick: onClose },
        h(
          'div',
          {
            className: 'cq-modalbox',
            style: { '--cq-r': rarity.color },
            onClick: (event) => event.stopPropagation(),
            role: 'dialog',
            'aria-modal': 'true',
          },
          h(
            'div',
            { className: 'cq-modalhead' },
            h(
              'div',
              { className: 'cq-modalart' },
              item.art && !secret
                ? h('img', { src: `${apiBase()}/icon/${item.art}.webp`, alt: '' })
                : h('span', null, secret ? '❓' : item.icon),
            ),
            h(
              'div',
              { style: { minWidth: 0, flex: 1 } },
              h('div', { className: 'cq-modaltitle' }, secret ? t('hidden') : item.name),
              h(
                'div',
                { className: 'cq-modalchips' },
                h('span', { className: 'cq-chip', style: { color: rarity.color, borderColor: rarity.color } }, t(item.rarity)),
                h('span', { className: 'cq-chip' }, t(item.category)),
                h('span', { className: 'cq-chip' }, `+${item.points} ${t('points')}`),
              ),
            ),
            h('button', { type: 'button', className: 'cq-modalx', onClick: onClose, 'aria-label': t('close') }, '✕'),
          ),
          h('div', { className: 'cq-modaldesc' }, secret ? t('hiddenHint') : item.desc),
          h(
            'div',
            { className: 'cq-modalsection' },
            h('div', { className: 'cq-modallabel' }, t('condition')),
            h('div', { className: 'cq-modalvalue' }, item.cond),
          ),
          h(
            'div',
            { className: 'cq-modalsection' },
            h(
              'div',
              { className: 'cq-modallabel' },
              t('progress'),
              h(
                'b',
                null,
                secret
                  ? '—'
                  : `${fmtInt(Math.min(item.value, item.target))} / ${fmtInt(item.target)}  (${pct}%)`,
              ),
            ),
            h('div', { className: 'cq-prog big' }, h('i', { style: { width: `${Math.min(100, pct)}%` } })),
            h(
              'div',
              { className: 'cq-modalnote' },
              item.unlockedAt
                ? `${t('unlockedAt')} ${new Date(item.unlockedAt).toLocaleString()}`
                : secret
                  ? t('hiddenHint')
                  : `${t('remaining')} ${fmtInt(remaining)}`,
            ),
          ),
        ),
      );
    }

    function DashboardTab({ data, t }) {
      const s = data.stats;
      const daily = Object.entries(s.dailyTokens || {}).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-30);
      const maxDaily = daily.reduce((max, [, value]) => Math.max(max, value), 0) || 1;
      const maxHour = (s.hourly || []).reduce((max, value) => Math.max(max, value), 0) || 1;
      const maxTool = (s.topTools || []).reduce((max, item) => Math.max(max, item.value), 0) || 1;
      const maxExt = (s.topExts || []).reduce((max, item) => Math.max(max, item.value), 0) || 1;
      const maxCmd = (s.topCmds || []).reduce((max, item) => Math.max(max, item.value), 0) || 1;

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        h(
          'div',
          { className: 'cq-panel' },
          h('h4', null, t('recent')),
          h(
            'div',
            { className: 'cq-bars' },
            daily.map(([date, value]) =>
              h('div', {
                key: date,
                style: { height: `${Math.max(3, (value / maxDaily) * 100)}%` },
                title: `${date}: ${fmtTokens(value)}`,
              }),
            ),
          ),
        ),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '10px' } },
          h(
            'div',
            { className: 'cq-panel' },
            h('h4', null, t('topTools')),
            h(
              'div',
              { className: 'cq-list' },
              (s.topTools || []).map((item) =>
                h(
                  'div',
                  { className: 'cq-row', key: item.key },
                  h('span', { style: { fontFamily: 'var(--ds-font-family-code,monospace)' } }, item.key),
                  h('span', { className: 'bar', style: { width: `${(item.value / maxTool) * 46}px` } }),
                  h('b', null, fmtInt(item.value)),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'cq-panel' },
            h('h4', null, t('hourly')),
            h(
              'div',
              { className: 'cq-hours' },
              (s.hourly || []).map((value, hour) =>
                h('i', {
                  key: hour,
                  title: `${hour}:00 · ${fmtTokens(value)}`,
                  style: { '--a': `${Math.max(6, Math.round((value / maxHour) * 95))}%` },
                }),
              ),
            ),
            h('h4', { style: { marginTop: '12px' } }, t('sentiment')),
            h(
              'div',
              { className: 'cq-sent' },
              ['praise', 'insult', 'pua', 'beg', 'blame'].map((key) =>
                h('span', { key }, t(key), h('b', null, fmtInt(s.sentiment[key]))),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'cq-panel' },
          h('h4', null, t('persona')),
          h(
            'div',
            { className: 'cq-sent' },
            (s.topSignals || []).map((item) =>
              h('span', { key: item.key }, SIGNAL_LABELS[item.key] || item.key, h('b', null, fmtInt(item.value))),
            ),
          ),
        ),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '10px' } },
          h(
            'div',
            { className: 'cq-panel' },
            h('h4', null, t('files')),
            h(
              'div',
              { className: 'cq-list' },
              (s.topExts || []).map((item) =>
                h(
                  'div',
                  { className: 'cq-row', key: item.key },
                  h('span', { style: { fontFamily: 'var(--ds-font-family-code,monospace)' } }, `.${item.key}`),
                  h('span', { className: 'bar', style: { width: `${(item.value / maxExt) * 46}px` } }),
                  h('b', null, fmtInt(item.value)),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'cq-panel' },
            h('h4', null, t('commands')),
            h(
              'div',
              { className: 'cq-list' },
              (s.topCmds || []).map((item) =>
                h(
                  'div',
                  { className: 'cq-row', key: item.key },
                  h('span', { style: { fontFamily: 'var(--ds-font-family-code,monospace)' } }, item.key),
                  h('span', { className: 'bar', style: { width: `${(item.value / maxCmd) * 46}px` } }),
                  h('b', null, fmtInt(item.value)),
                ),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'cq-panel' },
          h('h4', null, t('models')),
          h(
            'div',
            { className: 'cq-list' },
            (s.topModels || []).map((item) =>
              h('div', { className: 'cq-row', key: item.key }, h('span', null, item.key), h('b', null, fmtInt(item.value))),
            ),
          ),
        ),
        h(
          'div',
          { className: 'cq-panel cq-prefrow' },
          h(
            'div',
            { style: { minWidth: 0, flex: 1 } },
            h('div', { style: { fontSize: '12px', fontWeight: 700 } }, t('hudShow')),
            h('div', { className: 'cq-note' }, t('hudShowHint')),
          ),
          h(
            'button',
            {
              className: 'cq-btn',
              type: 'button',
              onClick: () => writeHudMode(readHudMode() === 'hidden' ? 'pill' : 'hidden'),
            },
            readHudMode() === 'hidden' ? t('show') : t('hide'),
          ),
        ),
      );
    }

    /** Boards the server can rank. Labels come from the client dictionary. */
    const BOARDS = [
      { key: 'achievements', field: 'achievementCount' },
      { key: 'points', field: 'value' },
      { key: 'level', field: 'value' },
      { key: 'tokens', field: 'value' },
      { key: 'sessions', field: 'value' },
      { key: 'streak', field: 'value' },
      { key: 'days', field: 'value' },
      { key: 'tools', field: 'value' },
      { key: 'code', field: 'value' },
      { key: 'today', field: 'value' },
      { key: 'season', field: 'value' },
    ];

    function LeaderboardTab({ t, data }) {
      const [board, setBoard] = useState('achievements');
      const [items, setItems] = useState(null);
      const [error, setError] = useState(null);
      const configured = Boolean(data && data.cloud && data.cloud.base);

      const load = useCallback(async () => {
        if (!configured) return;
        setItems(null);
        const result = await api(`/cloud/leaderboard?kind=${encodeURIComponent(board)}`, {});
        if (result && result.ok) {
          setItems(result.items || []);
          setError(null);
        } else {
          setError((result && result.error) || 'leaderboard_failed');
        }
      }, [board, configured]);

      useEffect(() => {
        void load();
      }, [load]);

      const field = (BOARDS.find((entry) => entry.key === board) || BOARDS[0]).field;
      const myId = data && data.cloud && data.cloud.user ? data.cloud.user.id : null;

      const chips = h(
        'div',
        { className: 'cq-chips', style: { marginBottom: '10px' } },
        BOARDS.map((entry) =>
          h(
            'button',
            {
              type: 'button',
              key: entry.key,
              className: `cq-fchip${board === entry.key ? ' on' : ''}`,
              onClick: () => setBoard(entry.key),
            },
            t(`board_${entry.key}`),
          ),
        ),
      );

      if (!configured) {
        return h('div', null, chips, h('div', { className: 'cq-empty' }, t('noServer')));
      }
      if (error) return h('div', null, chips, h('div', { className: 'cq-empty' }, `${t('error')}: ${error}`));
      if (!items) return h('div', null, chips, h('div', { className: 'cq-empty' }, t('loading')));
      if (items.length === 0) return h('div', null, chips, h('div', { className: 'cq-empty' }, t('emptyBoard')));

      return h(
        'div',
        { className: 'cq-board' },
        chips,
        h(
          'div',
          { className: 'cq-brow', style: { color: 'var(--dsw-alias-label-secondary)', fontSize: '10.5px' } },
          h('span', null, t('rank')),
          h('span', null, t('player')),
          h('span', { style: { textAlign: 'right' } }, t(`board_${board}`)),
        ),
        items.map((row) =>
          h(
            'div',
            { className: `cq-brow${row.rank <= 3 ? ' top' : ''}${row.userId === myId ? ' me' : ''}`, key: row.userId },
            h('span', { className: 'cq-rank' }, `#${row.rank}`),
            h(
              'span',
              { className: 'cq-player' },
              row.avatarUrl
                ? h('img', { className: 'cq-pavatar', src: row.avatarUrl, alt: '', loading: 'lazy' })
                : h('span', { className: 'cq-pavatar fallback' }, String(row.displayName || '?').slice(0, 1).toUpperCase()),
              h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.displayName),
            ),
            h('span', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, fmtInt(row[field])),
          ),
        ),
      );
    }

    function AccountTab({ data, t, reload }) {
      const [email, setEmail] = useState('');
      const [password, setPassword] = useState('');
      const [displayName, setDisplayName] = useState('');
      const [base, setBase] = useState(data.cloud.base);
      const [busy, setBusy] = useState(false);
      const [message, setMessage] = useState(null);
      const [identity, setIdentity] = useState(null);
      const [showEmail, setShowEmail] = useState(false);
      const [secret, setSecret] = useState('');

      useEffect(() => {
        let alive = true;
        void (async () => {
          try {
            const result = await api('/account');
            if (alive && result && result.ok) setIdentity(result);
          } catch {
            /* the Harness may not expose an account service at all */
          }
        })();
        return () => {
          alive = false;
        };
      }, []);

      const call = useCallback(
        async (path, body, okText) => {
          setBusy(true);
          setMessage(null);
          try {
            const result = await api(path, body || {});
            if (result && result.ok) {
              setMessage(okText);
              await reload();
            } else {
              setMessage(`${t('error')}: ${(result && result.error) || 'unknown'}`);
            }
          } catch (err) {
            setMessage(`${t('error')}: ${String((err && err.message) || err)}`);
          } finally {
            setBusy(false);
          }
        },
        [reload, t],
      );

      const dshLogin = useCallback(async () => {
        setBusy(true);
        setMessage(null);
        try {
          const result = await api('/cloud/dsh-login', {});
          if (!result || !result.ok) {
            setMessage(`${t('error')}: ${(result && result.error) || 'unknown'}`);
            return;
          }
          setMessage(result.created ? t('dshLoginCreated') : t('dshLoginDone'));
          await api('/cloud/sync', {});
          await reload();
        } catch (err) {
          setMessage(`${t('error')}: ${String((err && err.message) || err)}`);
        } finally {
          setBusy(false);
        }
      }, [reload, t]);

      const loggedIn = data.cloud.loggedIn;
      const user = data.cloud.user;
      const profile = identity && identity.signedIn ? identity.profile : null;
      const signedInDsh = Boolean(profile);
      const who = profile ? profile.name || profile.contact || profile.id : '';

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(
          'div',
          { className: 'cq-panel' },
          h('h4', null, t('dshAccount')),
          signedInDsh
            ? h(
                'div',
                { className: 'cq-dshrow' },
                profile.avatarUrl
                  ? h('img', { className: 'cq-dshavatar', src: profile.avatarUrl, alt: '' })
                  : h('div', { className: 'cq-dshavatar fallback' }, String(who || 'D').slice(0, 1).toUpperCase()),
                h(
                  'div',
                  { style: { minWidth: 0, flex: 1 } },
                  h('div', { className: 'cq-dshname' }, who || t('unknownUser')),
                  h('div', { className: 'cq-note' }, profile.contact || profile.id || ''),
                ),
              )
            : h(
                'div',
                { className: 'cq-note' },
                identity && identity.available === false ? t('dshNoService') : t('dshSignedOut'),
              ),
          h(
            'div',
            { className: 'cq-actions', style: { marginTop: '10px' } },
            loggedIn
              ? h(
                  'button',
                  { className: 'cq-btn primary', type: 'button', disabled: busy, onClick: () => void call('/cloud/sync', {}, t('synced')) },
                  t('sync'),
                )
              : h(
                  'button',
                  { className: 'cq-btn primary', type: 'button', disabled: busy || !signedInDsh, onClick: () => void dshLogin() },
                  busy ? t('working') : t('dshLogin'),
                ),
            loggedIn
              ? h(
                  'button',
                  { className: 'cq-btn', type: 'button', disabled: busy, onClick: () => void call('/cloud/logout', {}, t('logout')) },
                  t('logout'),
                )
              : null,
          ),
          loggedIn
            ? h(
                'div',
                { className: 'cq-note', style: { marginTop: '8px' } },
                `${t('loggedInAs')} ${(user && (user.displayName || user.email)) || ''}`,
                data.cloud.authMode === 'dsh' ? ` · ${t('viaDsh')}` : '',
                user && user.dshLinked ? ` · ${t('dshLinked')}` : '',
                data.cloud.lastSyncAt ? ` · ${t('synced')} ${new Date(data.cloud.lastSyncAt).toLocaleString()}` : '',
              )
            : null,
          message ? h('div', { className: 'cq-note', style: { marginTop: '8px' } }, message) : null,
          data.cloud.lastError ? h('div', { className: 'cq-err', style: { marginTop: '6px' } }, data.cloud.lastError) : null,
        ),
        h(
          'div',
          { className: 'cq-panel' },
          h(
            'button',
            { type: 'button', className: 'cq-disclose', onClick: () => setShowEmail((prev) => !prev) },
            showEmail ? '▾' : '▸',
            t('emailFallback'),
          ),
          showEmail
            ? h(
                'div',
                { className: 'cq-form', style: { marginTop: '10px' } },
                h('input', { className: 'cq-input', placeholder: t('email'), value: email, onChange: (e) => setEmail(e.target.value) }),
                h('input', {
                  className: 'cq-input',
                  placeholder: t('password'),
                  type: 'password',
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                }),
                h('input', {
                  className: 'cq-input',
                  placeholder: t('displayName'),
                  value: displayName,
                  onChange: (e) => setDisplayName(e.target.value),
                }),
                h(
                  'div',
                  { className: 'cq-actions' },
                  h(
                    'button',
                    { className: 'cq-btn', type: 'button', disabled: busy, onClick: () => void call('/cloud/login', { email, password }, t('login')) },
                    t('login'),
                  ),
                  h(
                    'button',
                    { className: 'cq-btn', type: 'button', disabled: busy, onClick: () => void call('/cloud/register', { email, password, displayName }, t('register')) },
                    t('register'),
                  ),
                ),
              )
            : null,
        ),
        h(
          'div',
          { className: 'cq-panel' },
          h('h4', null, t('cloudBase')),
          h(
            'div',
            { className: 'cq-actions' },
            h('input', { className: 'cq-input', style: { flex: 1, minWidth: '220px' }, value: base, onChange: (e) => setBase(e.target.value) }),
            h('button', { className: 'cq-btn', type: 'button', disabled: busy, onClick: () => void call('/config', { cloudBase: base }, t('save')) }, t('save')),
          ),
          h('div', { className: 'cq-note', style: { marginTop: '10px' } }, t('sharedSecretHint')),
          h(
            'div',
            { className: 'cq-actions' },
            h('input', {
              className: 'cq-input',
              style: { flex: 1, minWidth: '220px' },
              type: 'password',
              placeholder: data.cloud.hasSecret ? t('sharedSecretSet') : t('sharedSecret'),
              value: secret,
              onChange: (e) => setSecret(e.target.value),
            }),
            h(
              'button',
              { className: 'cq-btn', type: 'button', disabled: busy, onClick: () => void call('/config', { sharedSecret: secret }, t('save')) },
              t('save'),
            ),
          ),
        ),
      );
    }

    function CodeQuestView() {
      const { data, error, reload } = useCodeQuest();
      const [tab, setTab] = useState('achievements');
      const [locale, setLocale] = useState('zh');

      useEffect(() => {
        const lang = (document.documentElement.lang || navigator.language || 'zh').toLowerCase();
        setLocale(lang.startsWith('en') ? 'en' : 'zh');
      }, []);

      const dict = DICT[locale] || DICT.zh;
      const t = useCallback((key) => dict[key] || key, [dict]);

      if (error && !data) {
        return h('div', { className: 'cq-root' }, h(StyleTag), h('div', { className: 'cq-empty' }, `${t('error')}: ${error}`));
      }
      if (!data) {
        return h('div', { className: 'cq-root' }, h(StyleTag), h('div', { className: 'cq-empty' }, t('loading')));
      }

      const tabs = [
        ['achievements', t('achievements')],
        ['dashboard', t('dashboard')],
        ['leaderboard', t('leaderboard')],
        ['account', t('account')],
      ];

      return h(
        'div',
        { className: 'cq-root' },
        h(StyleTag),
        h(LevelHeader, { data, t }),
        h(StatCards, { data, t }),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
          h(
            'div',
            { className: 'cq-tabs', style: { flex: 1 } },
            tabs.map(([key, label]) =>
              h('button', { key, type: 'button', className: `cq-tab${tab === key ? ' on' : ''}`, onClick: () => setTab(key) }, label),
            ),
          ),
          h(
            'button',
            {
              className: 'cq-btn',
              type: 'button',
              onClick: async () => {
                await api('/refresh', {});
                window.setTimeout(() => void reload(), 1200);
              },
            },
            t('refresh'),
          ),
          h(
            'span',
            { className: 'cq-note' },
            data.scan.scanning ? `${t('scanning')} ${data.scan.done}/${data.scan.total}` : t('scanIdle'),
          ),
        ),
        tab === 'achievements' ? h(AchievementsTab, { data, t }) : null,
        tab === 'dashboard' ? h(DashboardTab, { data, t }) : null,
        tab === 'leaderboard' ? h(LeaderboardTab, { t, data }) : null,
        tab === 'account' ? h(AccountTab, { data, t, reload }) : null,
      );
    }

    return {
      inject: ['slots'],
      // `__views` exists for the packaged render test; it is not part of the
      // Client registration contract.
      __views: {
        CodeQuestView,
        LevelHeader,
        AchievementsTab,
        DashboardTab,
        LeaderboardTab,
        AccountTab,
        AchievementCard,
        AchievementDetail,
        QuestOverlay,
        QuestHud,
        QuestToasts,
      },
      /** Test seam: lets the packaged render test seed a snapshot. */
      __store: questStore,
      apply(ctx) {
        let t = (key) => (DICT.zh[key] || key);
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.effect(() => ctx.locale.register(NS, DICT), 'dsh-codequest: dictionaries');
            const bound = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : null;
            if (typeof bound === 'function') {
              t = (key) => {
                const value = bound(key);
                return typeof value === 'string' && value !== '' ? value : DICT.zh[key] || key;
              };
            }
          }
        } catch {
          /* fall back to the built-in dictionary */
        }
        pluginT = t;
        ensureStyles();

        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            {
              name: 'conversation.view',
              id: 'codequest',
              order: 25,
              locale: NS,
              label: () => t('tab'),
            },
            CodeQuestView,
          ),
        );

        // Frame-wide floating layer: toasts stack above the usage HUD in one
        // column so they never overlap. `shell.overlay` is click-through, so
        // the wrapper opts back in only where it draws.
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'codequest-overlay', order: 60, locale: NS },
            QuestOverlay,
          ),
        );
      },
    };
  },
});











