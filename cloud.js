/**
 * CodeQuest for DSH — client for the codequest-server API
 * (account, achievement sync, season progress, leaderboard).
 */

const TIMEOUT_MS = 15_000;

export class CloudError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'CloudError';
    this.status = status;
  }
}

export class CloudClient {
  /** @param {string} base e.g. https://your-host.example/codequest/api */
  constructor(base) {
    this.base = String(base || '').replace(/\/+$/, '');
    this.token = null;
  }

  setToken(token) {
    this.token = token || null;
  }

  /** @returns {Promise<any>} */
  async request(path, { method = 'GET', body, auth = true } = {}) {
    const url = `${this.base}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error && error.name === 'TimeoutError' ? 'timeout' : String((error && error.message) || error);
      throw new CloudError(`network_error: ${reason}`, 0);
    }

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new CloudError(`bad_response_${response.status}`, response.status);
    }
    if (!response.ok || data.ok === false) {
      throw new CloudError(String(data.error || `http_${response.status}`), response.status);
    }
    return data;
  }

  async register(email, password, displayName) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      auth: false,
      body: { email, password, displayName },
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  /**
   * Passwordless sign-in with the DeepSeek account already signed into the
   * Harness. The Host computes the signature; this only forwards it.
   */
  async dshLogin(payload) {
    const data = await this.request('/auth/dsh', {
      method: 'POST',
      auth: false,
      body: payload,
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  me() {
    return this.request('/auth/me');
  }

  startSeason(statsEpochMs) {
    return this.request('/sync/season', {
      method: 'POST',
      body: { statsEpochMs: statsEpochMs ?? Date.now() },
    });
  }

  /** @param {boolean} replace when true the list is the whole collection (retires ids) */
  syncAchievements(achievements, replace = false, deviceId = '') {
    return this.request('/sync/achievements', {
      method: 'POST',
      body: { achievements, replace, deviceId },
    });
  }

  syncProgress(progress) {
    return this.request('/sync/progress', {
      method: 'POST',
      body: { progress },
    });
  }

  pull() {
    return this.request('/sync/pull');
  }

  /**
   * @param {number} limit
   * @param {string} kind achievements | season | points | level | tokens |
   *   sessions | streak | days | tools | code | today
   */
  leaderboard(limit = 50, kind = 'achievements') {
    const query = `limit=${encodeURIComponent(limit)}&kind=${encodeURIComponent(kind)}`;
    return this.request(`/leaderboard?${query}`, { auth: false });
  }

  /** Sessions (devices) currently signed in to this account. */
  devices() {
    return this.request('/auth/devices');
  }

  /** Sign out every other device, keeping this one. */
  revokeOtherDevices() {
    return this.request('/auth/devices/revoke-others', { method: 'POST' });
  }

  publicStats() {
    return this.request('/stats/public', { auth: false });
  }
}

/**
 * Build the season progress snapshot the server MAX-merges.
 * @param {object} metrics aggregate metrics from scan.js
 */
export function progressFromMetrics(metrics, evaluation) {
  const num = (value) => Math.max(0, Math.round(Number(value) || 0));
  return {
    totalTokens: num(metrics.tokens),
    totalSessions: num(metrics.sessions),
    // Extra scalars so the server can rank more than one board. Every one is
    // monotonic on the server side (MAX merge), so a stale client cannot
    // push someone down a leaderboard.
    points: num(evaluation && evaluation.points),
    level: Math.max(1, num(evaluation && evaluation.level)),
    maxStreak: num(metrics.maxStreak),
    activeDays: num(metrics.activeDays),
    todayTokens: num(metrics.tokensToday),
    toolCalls: num(metrics.toolCalls),
    codeBlocks: num(metrics.codeBlocks),
    promptChars: num(metrics.promptChars),
    updatedAt: Date.now(),
    sentiment: {
      praise: metrics.sentiment?.praise || 0,
      insult: metrics.sentiment?.insult || 0,
      pua: metrics.sentiment?.pua || 0,
      beg: metrics.sentiment?.beg || 0,
      blame: metrics.sentiment?.blame || 0,
    },
    sources: { dsh: Math.max(0, Math.round(metrics.tokens || 0)) },
  };
}


