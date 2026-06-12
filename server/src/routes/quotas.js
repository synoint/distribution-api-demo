import { Router } from 'express';

/**
 * Quotas — read-only views. (Quotas are CREATED with the survey and EDITED
 * via the survey modify/limit endpoints — see routes/surveys.js.)
 *
 * Model: a survey has quota GROUPS; each group has quotas. Targeting across
 * groups is cumulative (AND): a respondent must match every group to be
 * invited. Custom-quota rules enforced upstream (422 on violation):
 *  - across groups: only one group may target regions, one gender, one age;
 *  - within a group: no two quotas with the same gender, no overlapping age
 *    ranges, and all quotas must share the same set of targeting properties.
 */
export function quotasRouter(api) {
  const router = Router();

  /** GET /subsets/{subsetId}/global-quota-groups — groups of a survey. */
  router.get('/subsets/:subsetId/global-quota-groups', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/global-quota-groups`)));

  router.get('/subsets/:subsetId/global-quota-groups/:id', async (req, res) =>
    res.json(await api.get(`/subsets/${req.params.subsetId}/global-quota-groups/${req.params.id}`)));

  /** GET /global-quota-groups/{groupId}/global-quotas — quotas in a group. */
  router.get('/global-quota-groups/:groupId/global-quotas', async (req, res) =>
    res.json(await api.get(`/global-quota-groups/${req.params.groupId}/global-quotas`)));

  router.get('/global-quota-groups/:groupId/global-quotas/:id', async (req, res) =>
    res.json(await api.get(`/global-quota-groups/${req.params.groupId}/global-quotas/${req.params.id}`)));

  /** GET /global-quotas/{quotaId}/statistics — fill progress of one quota. */
  router.get('/global-quotas/:quotaId/statistics', async (req, res) =>
    res.json(await api.get(`/global-quotas/${req.params.quotaId}/statistics`)));

  return router;
}
