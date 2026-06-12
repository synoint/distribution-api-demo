/**
 * DistributionApiClient — the minimal, correct way to call the Syno
 * Distribution API from any HTTP-capable stack. It encapsulates the three
 * things every consumer must get right:
 *
 *  1. AUTH     Every request carries the `Access-token: <key>` header.
 *              The key is issued by Syno International, is ~140 characters
 *              long, and must be kept secret (a leak generates real costs).
 *
 *  2. CONTENT  POST bodies are `application/json`.
 *              PATCH bodies MUST be `application/merge-patch+json` —
 *              the API rejects PATCH requests with a plain JSON content type.
 *
 *  3. ERRORS   The API is a standard JSON REST API: non-2xx responses carry
 *              a JSON body — typically {status, detail, title, violations[]}
 *              for validation failures, or {message} for auth errors. All
 *              shapes are normalized into DistributionApiError so callers
 *              handle one error type.
 */
export class DistributionApiError extends Error {
  constructor(status, problem) {
    const detail =
      problem?.detail ?? problem?.message ?? problem?.title ?? 'Distribution API request failed';
    super(`Distribution API ${status}: ${detail}`);
    this.name = 'DistributionApiError';
    this.status = status;
    this.detail = detail;
    this.problem = problem;
  }
}

export class DistributionApiClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl   e.g. "https://distribution-api.synoint.com"
   * @param {string} options.apiKey    the Access-token value
   * @param {typeof fetch} [options.fetchImpl]  injectable for tests
   */
  constructor({ baseUrl, apiKey, fetchImpl = fetch }) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  /** GET a resource or collection. Optional query params are appended. */
  get(path, { query } = {}) {
    return this.#request('GET', path, { query });
  }

  /** POST creates a resource; expect 201 with the created resource back. */
  post(path, body) {
    return this.#request('POST', path, { body, contentType: 'application/json' });
  }

  /** PATCH partially updates a resource (JSON Merge Patch, RFC 7396). */
  patch(path, body) {
    return this.#request('PATCH', path, { body, contentType: 'application/merge-patch+json' });
  }

  async #request(method, path, { query, body, contentType } = {}) {
    let url = this.baseUrl + path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    }
    if (params.size > 0) url += `?${params}`;

    const headers = { 'Access-token': this.apiKey, Accept: 'application/json' };
    if (contentType) headers['Content-Type'] = contentType;

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new DistributionApiError(response.status, payload);
    return payload;
  }
}
