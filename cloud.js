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
  /** @param {string} base e.g. http://your-host.example/codequest/api */
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

  syncAchievements(achievements) {
    return this.request('/sync/achievements', {
      method: 'POST',
      body: { achievements },
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

  leaderboard(limit = 50) {
    return this.request(`/leaderboard/achievements?limit=${encodeURIComponent(limit)}`, { auth: false });
  }

  publicStats() {
    return this.request('/stats/public', { auth: false });
  }
}

/**
 * Build the season progress snapshot the server MAX-merges.
 * @param {object} metrics aggregate metrics from scan.js
 */
export function progressFromMetrics(metrics) {
  return {
    totalTokens: Math.max(0, Math.round(metrics.tokens || 0)),
    totalSessions: Math.max(0, Math.round(metrics.sessions || 0)),
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