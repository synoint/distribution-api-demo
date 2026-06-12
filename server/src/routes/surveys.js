import { Router } from 'express';
import {
  SETTABLE_SURVEY_STATUSES,
  SURVEY_STATUS_LABELS,
} from '../distribution/constants.js';

/**
 * Surveys — upstream term: "subset". A survey belongs to one project
 * (sample) and carries the fieldwork definition: metadata (LOI, IR, field
 * period, URLs, country, language), targeting (gender, age, regions,
 * profiling), quotas and provider allocation.
 */
export function surveysRouter(api) {
  const router = Router();

  /** GET /samples/{sampleId}/subsets — surveys of a project. */
  router.get('/samples/:sampleId/subsets', async (req, res) =>
    res.json(await api.get(`/samples/${req.params.sampleId}/subsets`)));

  /**
   * POST /samples/{sampleId}/subsets — create a survey. ALL fields required:
   * {
   *   limit:        int    — completes wanted (never 0; capped by project limit)
   *   fieldPeriod:  int    — fieldwork days
   *   countryId:    int    — from /reference/countries
   *   loi:          int    — expected length of interview
   *   ir:           int    — expected incidence rate, %
   *   url:          string — live survey URL, MUST contain the literal "[ID]"
   *                          placeholder (replaced with the response GUID)
   *   testUrl:      string — test link, same placeholder rule
   *   languageId:   int    — from /reference/languages
   *   gender:       int    — 0 Any · 1 Male · 2 Female
   *   minAge:       int|null, maxAge: int|null
   *   regionIds:    int[]  — regions of the chosen country ([] = nationwide)
   *   profilingIds: int[]  — profiling ANSWER ids from /reference/questions
   *   globalQuotaGroups: [] — empty array ⇒ AUTOMATIC quotas (one group per
   *                          targeting dimension, cumulative AND); or pass
   *                          custom groups: [{name, globalQuotas: [{name,
   *                          limit, gender, ageFrom, ageTo, regionIds,
   *                          profilingIds}]}]
   *   providers:    [{provider, percentage, panelIds?, panelistIds?,
   *                   panelistPoolType?}] — percentages total 100
   * }
   * Returns 201; created survey starts in status 1 (Draft). 422 with
   * violation details on validation failure.
   * TEST accounts: providers outside the test provider are silently skipped;
   * if none remain, the API assigns default providers itself.
   */
  router.post('/samples/:sampleId/subsets', async (req, res) =>
    res.status(201).json(await api.post(`/samples/${req.params.sampleId}/subsets`, req.body)));

  /** GET /samples/{sampleId}/subsets/{id} — one survey with quotas, providers, statistics. */
  router.get('/samples/:sampleId/subsets/:subsetId', async (req, res) =>
    res.json(await api.get(`/samples/${req.params.sampleId}/subsets/${req.params.subsetId}`)));

  /**
   * PATCH /samples/{sampleId}/subsets/{id} — modify a survey. Only allowed
   * BEFORE launch (while Draft). The payload is a FULL REPLACEMENT for
   * quotas: include an existing quota/group `id` to update it, omit `id` to
   * create a new one, omit the object entirely to DELETE it.
   * A Closed survey can no longer be modified — the API answers 409.
   */
  router.patch('/samples/:sampleId/subsets/:subsetId', async (req, res) =>
    res.json(await api.patch(`/samples/${req.params.sampleId}/subsets/${req.params.subsetId}`, req.body)));

  /**
   * PATCH /samples/{sampleId}/subsets/{id}/status — drive the lifecycle.
   * Body: {status} — the API only accepts 3 (Live), 4 (Paused), 6 (Closed),
   * and only along allowed transitions (see SURVEY_STATUS_TRANSITIONS).
   * Setting 3 (Live) on a Draft LAUNCHES fieldwork — real cost!
   * We pre-validate the enum locally to demonstrate the rule, then pass
   * through so the upstream API stays authoritative on transitions.
   */
  router.patch('/samples/:sampleId/subsets/:subsetId/status', async (req, res) => {
    const { status } = req.body ?? {};
    if (!SETTABLE_SURVEY_STATUSES.includes(status)) {
      return res.status(400).json({
        source: 'demo-backend',
        detail: `status must be one of ${SETTABLE_SURVEY_STATUSES.join(', ')} ` +
          `(${SETTABLE_SURVEY_STATUSES.map((s) => SURVEY_STATUS_LABELS[s]).join(', ')})`,
      });
    }
    res.json(await api.patch(
      `/samples/${req.params.sampleId}/subsets/${req.params.subsetId}/status`, { status }));
  });

  /**
   * PATCH /samples/{sampleId}/subsets/{id}/limit — change survey/quota
   * limits. Unlike a full modify, this IS allowed after launch.
   * Body: {limit, globalQuotaGroups: [{id, globalQuotas: [{id, limit}]}]}
   * Rules (verified against the live API):
   *  - Limits are PER QUOTA: each quota in the payload carries its own
   *    limit, so quotas within a group may differ (e.g. Male 6 / Female 4).
   *  - The FULL structure is required on every call — all groups with all
   *    their quotas. Omitting `globalQuotaGroups` returns 422 "Quota groups
   *    are required"; omitting individual quotas fails the group count check.
   *  - Within each group the quota limits must SUM to the survey limit
   *    (422 "Quota group limit must match subset limit" otherwise).
   *  - After launch the floor is the highest completes already achieved.
   *  - A Closed survey can no longer be changed — the API answers 409.
   */
  router.patch('/samples/:sampleId/subsets/:subsetId/limit', async (req, res) =>
    res.json(await api.patch(
      `/samples/${req.params.sampleId}/subsets/${req.params.subsetId}/limit`, req.body)));

  return router;
}
