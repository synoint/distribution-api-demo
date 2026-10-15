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
   *        percentage?: int (1–100; when omitted the API applies a
   *                          default share),
   *        panelIds?: int[] (see /reference/panels?country=…)}
   * Each provider can be added once per survey. The provider must support
   * the survey's country and language (422 otherwise). On a Live survey the
   * new provider starts fielding immediately. A Closed survey can no longer
   * be changed — the API answers 409.
   */
  router.post('/subsets/:subsetId/providers', async (req, res) =>
    res.status(201).json(await api.post(`/subsets/${req.params.subsetId}/providers`, req.body)));

  /** GET /subsets/{subsetId}/providers/{provider} — one allocation, by PROVIDER id. */
  router.get('/subsets/:subsetId/providers/:provider', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/providers/${req.params.provider}`)));

  /**
   * DELETE /subsets/{subsetId}/providers/{id} — remove an allocation.
   * Note the identifier: `id` of the allocation row (as returned by the
   * collection / POST), NOT the provider id used by the GET above.
   * Only allowed while the survey is Draft (409 once launched); 404 when the
   * allocation does not belong to this survey. Answers 204 No Content.
   * Removing every provider is allowed — default providers are then
   * assigned automatically at launch.
   */
  router.delete('/subsets/:subsetId/providers/:id', async (req, res) => {
    await api.delete(`/subsets/${req.params.subsetId}/providers/${req.params.id}`);
    res.status(204).end();
  });

  return router;
}
