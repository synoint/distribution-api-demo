import express from 'express';
import { errorHandler, notFound } from './middleware/error.js';
import { referenceRouter } from './routes/reference.js';
import { projectsRouter } from './routes/projects.js';
import { surveysRouter } from './routes/surveys.js';
import { providersRouter } from './routes/providers.js';
import { quotasRouter } from './routes/quotas.js';
import { responsesRouter } from './routes/responses.js';
import { statisticsRouter } from './routes/statistics.js';
import { metaRouter } from './routes/meta.js';

/**
 * App factory. The Distribution API client is injected (`api`) so tests can
 * stub it — and so this file shows at a glance how the demo backend maps
 * onto the upstream API:
 *
 *   /api/reference/*                          reference data lookups
 *   /api/samples*                             projects (samples)
 *   /api/samples/:sampleId/subsets*           surveys (subsets) + status/limit
 *   /api/subsets/:subsetId/providers*         provider allocation
 *   /api/subsets/:subsetId/global-quota-groups*  quotas (read)
 *   /api/global-quota-groups/* /global-quotas/*  quotas (read)
 *   /api/responses/* /api/subsets/:id/responses* reconciliation
 *   /api/subsets/:subsetId/statistics|feasibility  monitoring & costs
 *   /api/meta/constants                       demo-only: domain constants
 */
export function createApp({ api } = {}) {
  if (!api) throw new Error('createApp requires a Distribution API client (api)');

  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/reference', referenceRouter(api));
  app.use('/api', projectsRouter(api));
  app.use('/api', surveysRouter(api));
  app.use('/api', providersRouter(api));
  app.use('/api', quotasRouter(api));
  app.use('/api', responsesRouter(api));
  app.use('/api', statisticsRouter(api));
  app.use('/api', metaRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
