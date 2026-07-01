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
   * GET /samples — list all projects (general, unfiltered).
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
   * GET /samples/closed[?page=N] — projects whose surveys are all closed.
   * Response: {samples: [{id, name, limit, createdAt, closedAt, statistics}],
   *            meta: {total, page, perPage, pages}}
   * Paginated: 15 per page. Statistics are live.
   * `closedAt` and `archivedAt` are exposed only on this and /archived — not
   * on the general GET /samples collection.
   */
  router.get('/samples/closed', async (req, res) =>
    res.json(await api.get('/samples/closed', { query: { page: req.query.page } })));

  /**
   * GET /samples/archived[?page=N] — fully archived historical projects.
   * Response: {samples: [{id, name, limit, createdAt, closedAt, archivedAt, statistics}],
   *            meta: {total, page, perPage, pages}}
   * Paginated: 15 per page. Statistics come from archived snapshots (target_group_archive
   * JSON), not live queries — values are frozen at archive time.
   */
  router.get('/samples/archived', async (req, res) =>
    res.json(await api.get('/samples/archived', { query: { page: req.query.page } })));

  /**
   * GET /samples/{id} — one project. Note: `subsets` contains IRI strings
   * ("/samples/{id}/subsets/{sid}"), not embedded objects — fetch
   * GET /samples/{id}/subsets for the full survey resources.
   */
  router.get('/samples/:sampleId', async (req, res) =>
    res.json(await api.get(`/samples/${req.params.sampleId}`)));

  /**
   * PATCH /samples/{id} — only `name` and `limit` are mutable.
   * Rule: `limit` can never be set below the completes already achieved.
   * Returns 409 Conflict when the sample is not active (closed or archived).
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
