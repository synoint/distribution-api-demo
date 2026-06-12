import { Router } from 'express';
import {
  SETTABLE_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
} from '../distribution/constants.js';

/**
 * Responses — one record per respondent attempt, identified by a GUID
 * (alphanumeric ≤ 40 chars, unique per survey — the value substituted for
 * the [ID] placeholder in your survey URL; capture it on survey entry).
 *
 * Reconciliation: after fieldwork you may correct statuses — e.g. reject a
 * complete that failed your quality checks (→ 4 Quality terminate) or
 * compensate a respondent (→ 5 Completed). Only allowed until the survey is
 * Closed; Closed starts invoicing and freezes everything.
 */
export function responsesRouter(api) {
  const router = Router();

  /** GET /responses/{guid} — look up a single response anywhere. */
  router.get('/responses/:guid', async (req, res) =>
    res.json(await api.get(`/responses/${req.params.guid}`)));

  /** GET /subsets/{subsetId}/responses — all responses of a survey. */
  router.get('/subsets/:subsetId/responses', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/responses`)));

  /**
   * PATCH /subsets/{subsetId}/responses/{guid}/status — reconcile one
   * response. Body: {status} ∈ [2 Screen-out, 3 Quota full, 4 Quality
   * terminate, 5 Completed, 11 Group quota full]. Pre-validated
   * locally to demonstrate the rule; upstream stays authoritative.
   */
  router.patch('/subsets/:subsetId/responses/:guid/status', async (req, res) => {
    const { status } = req.body ?? {};
    if (!SETTABLE_RESPONSE_STATUSES.includes(status)) {
      return res.status(400).json({
        source: 'demo-backend',
        detail: `status must be one of ${SETTABLE_RESPONSE_STATUSES.join(', ')} ` +
          `(${SETTABLE_RESPONSE_STATUSES.map((s) => RESPONSE_STATUS_LABELS[s]).join(', ')})`,
      });
    }
    res.json(await api.patch(
      `/subsets/${req.params.subsetId}/responses/${req.params.guid}/status`, { status }));
  });

  return router;
}
