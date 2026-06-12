import { DistributionApiError } from '../distribution/client.js';

/**
 * Express 5 forwards rejected promises from async handlers here automatically
 * (no wrapper utilities needed).
 *
 * Upstream Distribution API errors pass through with their original status
 * and JSON error body, so the frontend (and the reader of this code) sees
 * exactly what the API said — e.g. a 422 listing which survey fields failed
 * validation in its `violations` array.
 */
export function errorHandler(err, req, res, next) {
  if (err instanceof DistributionApiError) {
    return res
      .status(err.status)
      .json({ source: 'distribution-api', ...(err.problem ?? { detail: err.detail }) });
  }
  console.error(err);
  res.status(500).json({ source: 'demo-backend', detail: 'Internal error in the demo backend' });
}

export function notFound(req, res) {
  res.status(404).json({ source: 'demo-backend', detail: `No demo route for ${req.method} ${req.path}` });
}
