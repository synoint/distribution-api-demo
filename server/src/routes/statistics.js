import { Router } from 'express';

/**
 * Survey statistics & feasibility.
 *
 * Statistics (live counters, poll during fieldwork):
 *   {inSurvey, completed, screenOut, qualityTerminate, quotaFull, timedOut,
 *    dropoutRate, incidenceRate, lengthOfInterview, currentCost}
 *   `currentCost` is the accrued fieldwork cost so far (e.g. "12.5EUR").
 *
 * Feasibility (run BEFORE launching!):
 *   {feasible, estimatedCpi, estimatedCost}
 *   feasible      — completes realistically achievable with this targeting
 *   estimatedCpi  — cost per complete (falls with higher IR, rises with LOI)
 *   estimatedCost — projected total for the survey's limit
 */
export function statisticsRouter(api) {
  const router = Router();

  /** GET /subsets/{subsetId}/statistics — live fieldwork counters. */
  router.get('/subsets/:subsetId/statistics', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/statistics`)));

  /** GET /subsets/{subsetId}/feasibility — pre-launch cost & reach estimate. */
  router.get('/subsets/:subsetId/feasibility', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/feasibility`)));

  return router;
}
