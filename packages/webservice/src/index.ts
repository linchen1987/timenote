import dotenvFlow from 'dotenv-flow';
import fs from 'fs-extra';
dotenvFlow.config();

import path from 'path';
import { ensureSpacesConfig } from './utils';

import initServer from './server';

(async () => {
  const rootDir =
    process.env.BLOCKLET_DATA_DIR ||
    process.env.TIMENOTE_DATA_DIR ||
    path.join(process.cwd(), '.dev');
  await fs.ensureDir(rootDir);
  ensureSpacesConfig(rootDir);
  await initServer({ rootDir });
})();
