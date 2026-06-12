import { Router } from 'express';

/**
 * Projects — upstream term: "sample".
 *
 * A project is the top-level container. Its `limit` is a HARD cap on
 * completes across ALL surveys under it combined — this is the primary cost
 * control. Example: project limit 100 with three surveys limited 100/150/200
 * stops everything once 100 combined completes are reached.
 */
export function projectsRouter(api) {
  const router = Router();

  /**
   * GET /samples — list projects.
   * Response: {samples: [{id, name, limit, createdAt, statistics}]}
   */
  router.get('/samples', async (req, res) => res.json(await api.get('/samples')));

  /**
   * POST /samples — create a project.
   * Body: {name: string (required, ≤255), limit: int (required)}
   * Returns 201 with the created sample.
   */
  router.post('/samples', async (req, res) =>
    res.status(201).json(await api.post('/samples', req.body)));

  /**
   * GET /samples/{id} — one project. Note: `subsets` contains IRI strings
   * ("/samples/{id}/subsets/{sid}"), not embedded objects — fetch
   * GET /samples/{id}/subsets for the full survey resources.
   */
  router.get('/samples/:sampleId', async (req, res) =>
    res.json(await api.get(`/samples/${req.params.sampleId}`)));

  /**
   * PATCH /samples/{id} — only `name` and `limit` are mutable, at any time.
   * Rule: `limit` can never be set below the completes already achieved.
   * (Content type upstream: application/merge-patch+json — handled by the client.)
   */
  router.patch('/samples/:sampleId', async (req, res) =>
    res.json(await api.patch(`/samples/${req.params.sampleId}`, req.body)));

  /**
   * GET /samples/{id}/statistics — live counters for the whole project:
   * {inSurvey, completed, screenOut, qualityTerminate, quotaFull, timedOut,
   *  dropoutRate, incidenceRate, lengthOfInterview, currentCost}
   */
  router.get('/samples/:sampleId/statistics', async (req, res) =>
    res.json(await api.get(`/samples/${req.params.sampleId}/statistics`)));

  return router;
}
