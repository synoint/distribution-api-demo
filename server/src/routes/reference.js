import { Router } from 'express';

/**
 * Reference data — read-only lookups used to build a survey (subset).
 * All routes proxy 1:1 to the Distribution API under /reference.
 *
 * Where each dataset is used:
 *  - countries  → `countryId` (a single country detail also lists its region
 *                 types and regions → `regionIds` targeting)
 *  - languages  → `languageId`
 *  - genders    → `gender` (0 Any · 1 Male · 2 Female)
 *  - statuses   → survey lifecycle status ids/names
 *  - providers  → `providers[].provider` (supply sources; per-provider
 *                 countries/languages narrow what can be targeted)
 *  - panels     → `providers[].panelIds` (dedicated panelist pools)
 *  - questions  → profiling questions; chosen answer ids → `profilingIds`
 */
export function referenceRouter(api) {
  const router = Router();

  // GET /reference/countries — all countries with IR/LOI/age bounds and region types
  router.get('/countries', async (req, res) => res.json(await api.get('/reference/countries')));
  // GET /reference/countries/{id} — single country incl. regions per region type
  router.get('/countries/:id', async (req, res) =>
    res.json(await api.get(`/reference/countries/${req.params.id}`)));

  router.get('/languages', async (req, res) => res.json(await api.get('/reference/languages')));
  router.get('/languages/:id', async (req, res) =>
    res.json(await api.get(`/reference/languages/${req.params.id}`)));

  router.get('/genders', async (req, res) => res.json(await api.get('/reference/genders')));
  router.get('/genders/:id', async (req, res) =>
    res.json(await api.get(`/reference/genders/${req.params.id}`)));

  router.get('/statuses', async (req, res) => res.json(await api.get('/reference/statuses')));
  router.get('/statuses/:id', async (req, res) =>
    res.json(await api.get(`/reference/statuses/${req.params.id}`)));

  // Note: TEST accounts receive only the test provider here, not the full
  // marketplace catalog.
  router.get('/providers', async (req, res) => res.json(await api.get('/reference/providers')));
  router.get('/providers/:id', async (req, res) =>
    res.json(await api.get(`/reference/providers/${req.params.id}`)));
  // Countries a provider can field in
  router.get('/providers/:providerId/countries', async (req, res) =>
    res.json(await api.get(`/reference/providers/${req.params.providerId}/countries`)));
  // Languages a provider supports within one country
  router.get('/providers/:providerId/countries/:countryId/languages', async (req, res) =>
    res.json(await api.get(
      `/reference/providers/${req.params.providerId}/countries/${req.params.countryId}/languages`)));

  // GET /reference/panels?country={countryId}&provider={providerId} — both
  // filters optional. Note: TEST accounts always receive the dedicated test
  // panel; the filters are ignored upstream for them.
  router.get('/panels', async (req, res) =>
    res.json(await api.get('/reference/panels', {
      query: { country: req.query.country, provider: req.query.provider },
    })));
  router.get('/panels/:id', async (req, res) =>
    res.json(await api.get(`/reference/panels/${req.params.id}`)));

  // GET /reference/questions?countryId={id} — profiling questions with
  // answers. Collection key in the response: `profilingQuestions`; the
  // answer ids are what go into a survey's `profilingIds`.
  router.get('/questions', async (req, res) =>
    res.json(await api.get('/reference/questions', { query: { countryId: req.query.countryId } })));

  return router;
}
