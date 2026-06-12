import { vi } from 'vitest';
import { createApp } from '../src/app.js';

/** Stubbed Distribution API client — routes are tested without network. */
export function stubApi(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue({ stub: 'get' }),
    post: vi.fn().mockResolvedValue({ stub: 'post' }),
    patch: vi.fn().mockResolvedValue({ stub: 'patch' }),
    ...overrides,
  };
}

export function appWith(api = stubApi()) {
  return { app: createApp({ api }), api };
}
