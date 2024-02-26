import fs from 'fs-extra';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import path from 'path';
import bs58 from 'bs58';

import { SPACES_CONFIG_NAME } from './constants';

export const ensureSpacesConfig = async (rootDir: string) => {
  const file = path.join(rootDir, SPACES_CONFIG_NAME);
  if (!fs.existsSync(file)) {
    await fs.ensureDir(rootDir);
    fs.writeJSONSync(file, []);
  }
};

export const toBs58 = (str: string) => bs58.encode(Buffer.from(str, 'utf8')).toString();
export const fromBs58 = (str: string) => bs58.decode(str).toString();
export const toMd5 = (str: string) => createHash('md5').update(str).digest('hex');
