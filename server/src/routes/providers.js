import { Router } from 'express';

/**
 * Survey provider allocation — which supply sources field the survey.
 *
 * Each entry allocates a share of the survey's limit to one provider:
 * a single provider gets {provider, percentage: 100}; mixing providers
 * splits the limit (e.g. 60/40) — percentages should total 100.
 * Cost note: with mixed providers the average CPI applies proportionally.
 */
export function providersRouter(api) {
  const router = Router();

  /** GET /subsets/{subsetId}/providers — current allocation. */
  router.get('/subsets/:subsetId/providers', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/providers`)));

  /**
   * POST /subsets/{subsetId}/providers — add an allocation.
   * Body: {provider: int (required, see /reference/providers),
   *        percentage: int (required),
   *        panelIds?: int[] (see /reference/panels?country=…),
   *        panelistIds?: int[], panelistPoolType?: int}
   * A Closed survey can no longer be changed — the API answers 409.
   */
  router.post('/subsets/:subsetId/providers', async (req, res) =>
    res.status(201).json(await api.post(`/subsets/${req.params.subsetId}/providers`, req.body)));

  /** GET /subsets/{subsetId}/providers/{provider} — one allocation. */
  router.get('/subsets/:subsetId/providers/:provider', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/providers/${req.params.provider}`)));

  return router;
}
