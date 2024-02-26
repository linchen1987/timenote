#!/usr/bin/env node

import os from 'node:os';
import path from 'node:path';

process.env.PM2_HOME = path.join(os.homedir(), '.timenote/pm2');

import('../lib/index.js');
