import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { appWith } from './helpers.js';

describe('reference routes', () => {
  it('proxies collection and single-item lookups', async () => {
    const { app, api } = appWith();
    await request(app).get('/api/reference/countries').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/reference/countries');

    await request(app).get('/api/reference/countries/7').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/reference/countries/7');

    await request(app).get('/api/reference/providers/3/countries/1/languages').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/reference/providers/3/countries/1/languages');
  });

  it('forwards query params for panels and questions', async () => {
    const { app, api } = appWith();
    await request(app).get('/api/reference/panels?country=1&provider=3').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/reference/panels', { query: { country: '1', provider: '3' } });

    await request(app).get('/api/reference/questions?countryId=2').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/reference/questions', { query: { countryId: '2' } });
  });
});

describe('project (sample) routes', () => {
  it('lists, creates (201), reads, patches and reads statistics', async () => {
    const { app, api } = appWith();

    await request(app).get('/api/samples').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/samples');

    await request(app).post('/api/samples').send({ name: 'Demo', limit: 10 }).expect(201);
    expect(api.post).toHaveBeenLastCalledWith('/samples', { name: 'Demo', limit: 10 });

    await request(app).get('/api/samples/6017').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/samples/6017');

    await request(app).patch('/api/samples/6017').send({ limit: 12 }).expect(200);
    expect(api.patch).toHaveBeenLastCalledWith('/samples/6017', { limit: 12 });

    await request(app).get('/api/samples/6017/statistics').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/samples/6017/statistics');
  });
});

describe('survey (subset) routes', () => {
  it('lists, creates (201), reads, modifies and changes limits', async () => {
    const { app, api } = appWith();

    await request(app).get('/api/samples/1/subsets').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/samples/1/subsets');

    const body = { limit: 100, countryId: 1 };
    await request(app).post('/api/samples/1/subsets').send(body).expect(201);
    expect(api.post).toHaveBeenLastCalledWith('/samples/1/subsets', body);

    await request(app).get('/api/samples/1/subsets/151').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/samples/1/subsets/151');

    await request(app).patch('/api/samples/1/subsets/151').send({ ir: 80 }).expect(200);
    expect(api.patch).toHaveBeenLastCalledWith('/samples/1/subsets/151', { ir: 80 });

    const limits = { limit: 120, globalQuotaGroups: [] };
    await request(app).patch('/api/samples/1/subsets/151/limit').send(limits).expect(200);
    expect(api.patch).toHaveBeenLastCalledWith('/samples/1/subsets/151/limit', limits);
  });

  it('accepts only settable statuses (3, 4, 6) and rejects others locally', async () => {
    const { app, api } = appWith();

    await request(app).patch('/api/samples/1/subsets/151/status').send({ status: 4 }).expect(200);
    expect(api.patch).toHaveBeenLastCalledWith('/samples/1/subsets/151/status', { status: 4 });

    const res = await request(app).patch('/api/samples/1/subsets/151/status').send({ status: 99 });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('3, 4, 6');
    expect(api.patch).toHaveBeenCalledTimes(1); // upstream not called for invalid input
  });
});

describe('survey provider routes', () => {
  it('lists, adds (201) and reads allocations', async () => {
    const { app, api } = appWith();

    await request(app).get('/api/subsets/151/providers').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/subsets/151/providers');

    const body = { provider: 3, percentage: 100 };
    await request(app).post('/api/subsets/151/providers').send(body).expect(201);
    expect(api.post).toHaveBeenLastCalledWith('/subsets/151/providers', body);

    await request(app).get('/api/subsets/151/providers/3').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/subsets/151/providers/3');
  });
});

describe('quota routes', () => {
  it('reads groups, quotas and quota statistics', async () => {
    const { app, api } = appWith();

    await request(app).get('/api/subsets/151/global-quota-groups').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/subsets/151/global-quota-groups');

    await request(app).get('/api/global-quota-groups/9/global-quotas').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/global-quota-groups/9/global-quotas');

    await request(app).get('/api/global-quotas/42/statistics').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/global-quotas/42/statistics');
  });
});

describe('response routes', () => {
  it('reads responses by guid and by survey', async () => {
    const { app, api } = appWith();

    await request(app).get('/api/responses/abc123').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/responses/abc123');

    await request(app).get('/api/subsets/151/responses').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/subsets/151/responses');
  });

  it('reconciles with settable statuses only', async () => {
    const { app, api } = appWith();

    await request(app).patch('/api/subsets/151/responses/abc/status').send({ status: 5 }).expect(200);
    expect(api.patch).toHaveBeenLastCalledWith('/subsets/151/responses/abc/status', { status: 5 });

    const res = await request(app).patch('/api/subsets/151/responses/abc/status').send({ status: 1 });
    expect(res.status).toBe(400); // IN_SURVEY is not manually settable
    expect(api.patch).toHaveBeenCalledTimes(1);
  });
});

describe('statistics routes', () => {
  it('reads statistics and feasibility', async () => {
    const { app, api } = appWith();

    await request(app).get('/api/subsets/151/statistics').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/subsets/151/statistics');

    await request(app).get('/api/subsets/151/feasibility').expect(200);
    expect(api.get).toHaveBeenLastCalledWith('/subsets/151/feasibility');
  });
});
