/** Query timing diagnostics; disabled unless explicitly enabled outside production. */
export function createPerfTimedFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  const enabled = process.env.PERF_TIMING === '1'
    && process.env.VERCEL_ENV !== 'production'
    && typeof window === 'undefined';
  if (!enabled) return baseFetch;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = performance.now();
    const rawUrl = input instanceof Request ? input.url : String(input);
    let path = 'unknown';
    try { path = new URL(rawUrl).pathname; } catch { /* Do not log malformed URLs. */ }
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    try {
      const response = await baseFetch(input, init);
      console.info(`[perf-query] ${method} ${path} status=${response.status} duration_ms=${Math.round(performance.now() - startedAt)}`);
      return response;
    } catch (error) {
      console.info(`[perf-query] ${method} ${path} status=network_error duration_ms=${Math.round(performance.now() - startedAt)}`);
      throw error;
    }
  };
}
