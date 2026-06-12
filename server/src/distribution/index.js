import { config } from '../config.js';
import { DistributionApiClient } from './client.js';

/** Shared client instance used by all route modules. */
export const distributionApi = new DistributionApiClient(config.distributionApi);

export * from './client.js';
export * from './constants.js';
