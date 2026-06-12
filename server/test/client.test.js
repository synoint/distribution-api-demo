import { describe, it, expect, vi } from 'vitest';
import { DistributionApiClient, DistributionApiError } from '../src/distribution/client.js';

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const makeClient = (fetchImpl) =>
  new DistributionApiClient({ baseUrl: 'https://api.test', apiKey: 'secret-key', fetchImpl });

describe('DistributionApiClient', () => {
  it('sends the Access-token header and parses JSON on GET', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { samples: [] }));
    const client = makeClient(fetchImpl);
    const body = await client.get('/samples');
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/samples', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ 'Access-token': 'secret-key' }),
    }));
    expect(body).toEqual({ samples: [] });
  });

  it('POSTs JSON with application/json content type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { id: 1 }));
    await makeClient(fetchImpl).post('/samples', { name: 'X', limit: 10 });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'X', limit: 10 });
  });

  it('PATCHes with application/merge-patch+json (required by the API)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: 1 }));
    await makeClient(fetchImpl).patch('/samples/1', { limit: 50 });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(init.headers['Content-Type']).toBe('application/merge-patch+json');
  });

  it('builds query strings, skipping undefined params', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { panels: [] }));
    await makeClient(fetchImpl).get('/reference/panels', { query: { country: 1, x: undefined } });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/reference/panels?country=1');
  });

  it('throws DistributionApiError carrying the error JSON fields on 4xx', async () => {
    const problem = { type: '/errors/422', title: 'Validation failed', status: 422, detail: 'limit: required' };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422, problem));
    const err = await makeClient(fetchImpl).post('/samples', {}).catch((e) => e);
    expect(err).toBeInstanceOf(DistributionApiError);
    expect(err.status).toBe(422);
    expect(err.detail).toBe('limit: required');
    expect(err.problem).toEqual(problem);
  });

  it('handles 401 {"message": ...} auth error bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Access token invalid' }));
    const err = await makeClient(fetchImpl).get('/samples').catch((e) => e);
    expect(err).toBeInstanceOf(DistributionApiError);
    expect(err.status).toBe(401);
    expect(err.detail).toBe('Access token invalid');
  });

  it('returns null for 204 No Content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await makeClient(fetchImpl).get('/whatever')).toBeNull();
  });
});
