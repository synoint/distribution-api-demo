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
   * Paginated: 15 per page. Statistics are frozen at archive time, not live.
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
   * Project lifecycle actions — Active → Closed → Archived, and back via
   * restore. All three are body-less PATCHes answering 200 with
   * {id, closedAt, archivedAt} (timestamps "Y-m-d H:i:s" or null);
   * 404 for an unknown sample, 409 when the transition is not allowed.
   *
   * PATCH /samples/{id}/close — only from Active (409 otherwise). Cascades
   * to the surveys: every launched survey is closed (final, invoicing
   * starts) and every Draft survey is DELETED.
   */
  router.patch('/samples/:sampleId/close', async (req, res) =>
    res.json(await api.patch(`/samples/${req.params.sampleId}/close`)));

  /** PATCH /samples/{id}/archive — only from Closed (409 otherwise). */
  router.patch('/samples/:sampleId/archive', async (req, res) =>
    res.json(await api.patch(`/samples/${req.params.sampleId}/archive`)));

  /**
   * PATCH /samples/{id}/restore — one step back: Archived → Closed, or
   * Closed → Active. 409 when already Active, or when re-activating would
   * exceed your account's limit of active projects. Restoring does NOT
   * re-open closed surveys or bring back deleted drafts.
   */
  router.patch('/samples/:sampleId/restore', async (req, res) =>
    res.json(await api.patch(`/samples/${req.params.sampleId}/restore`)));

  /**
   * GET /samples/{id}/statistics — live counters for the whole project:
   * {inSurvey, completed, screenOut, qualityTerminate, quotaFull, timedOut,
   *  dropoutRate, incidenceRate, lengthOfInterview, currentCost}
   */
  router.get('/samples/:sampleId/statistics', async (req, res) =>
    res.json(await api.get(`/samples/${req.params.sampleId}/statistics`)));

  return router;
}
