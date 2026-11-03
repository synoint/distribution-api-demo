import { Router } from 'express';
import { REPRICING_STATUSES } from '../distribution/constants.js';

/**
 * Repricing — Syno re-evaluates a launched provider's CPI from the survey's
 * actual LOI and incidence rate as completes come in. When the price rises,
 * that provider stops collecting (its `status` becomes 7 Halted, its
 * `statusReason` "repricing_pending") until you accept or decline the new
 * price. Other providers of the survey keep collecting; the survey itself
 * pauses only when the repriced provider was the last one collecting.
 *
 * The same information is visible on every subset provider
 * (GET /subsets/{id}/providers and the survey's `providers`):
 *   status            read-only status id of the provider, null before launch
 *   statusReason      "repricing_pending" | "low_quality" | null
 *   pendingRepricing  {id, currentCpi, newCpi, createdAt} | null
 */
export function repricingsRouter(api) {
  const router = Router();

  /**
   * GET /subsets/{subsetId}/repricings[?status=pending] — newest first.
   * Response: {repricings: [{id, subsetProviderId, provider, currentCpi,
   *   newCpi, status, createdAt, resolvedAt}]}
   * CPIs are in the account's default currency. `status` is one of
   * pending | accepted | declined | superseded (a newer price replaced it
   * before a decision). A provider has at most one pending repricing.
   * We pre-validate the filter locally (upstream answers 422 for an unknown
   * value), then pass through.
   */
  router.get('/subsets/:subsetId/repricings', async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !REPRICING_STATUSES.includes(status)) {
      return res.status(400).json({
        source: 'demo-backend',
        detail: `status must be one of ${REPRICING_STATUSES.join(', ')}`,
      });
    }
    res.json(await api.get(`/subsets/${req.params.subsetId}/repricings`, { query: { status } }));
  });

  /**
   * PATCH /subsets/{subsetId}/repricings/{id}/accept — body-less.
   * The provider resumes collecting at the new CPI (it stays paused if its
   * completes limit is already reached). Answers 200 with the repricing.
   * 409 when the repricing is no longer pending (already decided, or
   * superseded by a newer price) or the survey is Closed; 404 when the
   * repricing does not belong to this survey.
   */
  router.patch('/subsets/:subsetId/repricings/:id/accept', async (req, res) =>
    res.json(await api.patch(`/subsets/${req.params.subsetId}/repricings/${req.params.id}/accept`)));

  /**
   * PATCH /subsets/{subsetId}/repricings/{id}/decline — body-less.
   * The provider stops collecting for good (it completes). Same 404/409
   * rules as accept. Closing the survey also declines any pending repricing.
   */
  router.patch('/subsets/:subsetId/repricings/:id/decline', async (req, res) =>
    res.json(await api.patch(`/subsets/${req.params.subsetId}/repricings/${req.params.id}/decline`)));

  return router;
}
