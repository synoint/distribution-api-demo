/**
 * Application configuration, read once at boot (env loaded via `node --env-file=.env`).
 *
 * The Distribution API key is a secret: it stays on this server and must
 * never be exposed to the browser or written to logs.
 */
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 3001),
  distributionApi: {
    baseUrl: required('DISTRIBUTION_API_URL').replace(/\/$/, ''),
    apiKey: required('DISTRIBUTION_API_KEY'),
  },
};
