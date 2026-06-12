/**
 * All browser requests go to the demo backend (/api/*) — never directly to
 * the Distribution API: the Access-token must stay server-side.
 *
 * Errors (both demo-backend validation and passed-through Distribution API
 * error JSON) are normalized to an Error with {status, problem}.
 */
async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(payload?.detail ?? payload?.title ?? `Request failed (${res.status})`);
    err.status = res.status;
    err.problem = payload;
    throw err;
  }
  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
};
