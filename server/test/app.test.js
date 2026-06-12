import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { appWith, stubApi } from './helpers.js';
import { DistributionApiError } from '../src/distribution/client.js';

describe('app wiring', () => {
  it('serves the health check', async () => {
    const { app } = appWith();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 JSON for unknown routes', async () => {
    const { app } = appWith();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.detail).toContain('/api/nope');
  });

  it('passes upstream error JSON through with original status', async () => {
    const problem = { type: '/errors/422', title: 'Validation failed', status: 422, detail: 'limit: required' };
    const api = stubApi({ post: vi.fn().mockRejectedValue(new DistributionApiError(422, problem)) });
    const { app } = appWith(api);
    const res = await request(app).post('/api/samples').send({});
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ source: 'distribution-api', ...problem });
  });

  it('hides internals on unexpected errors', async () => {
    const api = stubApi({ get: vi.fn().mockRejectedValue(new Error('boom secret')) });
    const { app } = appWith(api);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/samples');
    errSpy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('boom secret');
  });

  it('exposes domain constants for the frontend', async () => {
    const { app } = appWith();
    const res = await request(app).get('/api/meta/constants');
    expect(res.status).toBe(200);
    expect(res.body.surveyStatusLabels['3']).toBe('Live');
    expect(res.body.settableSurveyStatuses).toEqual([3, 4, 6]);
    expect(res.body.panelistRedirects.complete).toBe('https://r.synoint.com/response/complete');
    expect(res.body.surveyUrlIdPlaceholder).toBe('[ID]');
  });
});
