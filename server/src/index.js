import { createApp } from './app.js';
import { config } from './config.js';
import { distributionApi } from './distribution/index.js';

const app = createApp({ api: distributionApi });
app.listen(config.port, () => {
  console.log(`Demo backend listening on http://localhost:${config.port}`);
});
