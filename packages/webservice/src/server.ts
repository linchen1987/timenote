import express from 'express';
import fs from 'fs-extra';
require('express-async-errors');
import type { Request, Response } from './types';
import { NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import initApiRoutes from './routes/api';

import { version } from '@timenote/core';

import { ServiceOptions } from './types';
import { ensureSpacesConfig, toMd5 } from './utils';

const app = express();

const PORT = process.env.BLOCKLET_PORT || process.env.PORT || 3001;

const init = async (options: ServiceOptions) => {
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());

  const parsedOptions = { ...options };

  const isPlayground = process.env.TN_MODE === 'playground';

  if (!options.rootDir) {
    throw new Error('rootDir is required');
  }

  app.use(async (req: Request, res, next) => {
    req.rootDir = options.rootDir;

    next();
  });

  if (isPlayground) {
    const playgroundDir = process.env.BLOCKLET_APP_DIR
      ? path.join(process.env.BLOCKLET_APP_DIR, 'playground')
      : path.join(__dirname, 'playground');
    app.post('/api/playground/login', async (req, res) => {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).send('userId is required');
      }

      const scope = toMd5(userId);
      const scopedRootDir = path.join(options.rootDir!, scope);

      // set initial space
      if (!fs.existsSync(scopedRootDir)) {
        await fs.copy(path.join(playgroundDir, 'default'), scopedRootDir);
      }

      res.cookie('tn_playground_user', scopedRootDir);
      res.json({
        token: scope,
      });
    });

    app.use(async (req: Request, res, next) => {
      if (req.originalUrl.includes('/manifest.json')) {
        // get spaceId from */s/:scope/:spaceId/manifest.json
        const regex = /\/s\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)\/manifest.json$/;
        const match = req.originalUrl.match(regex);

        if (match) {
          const scope = match[1];
          const scopedRootDir = path.join(options.rootDir!, scope);

          if (!fs.existsSync(scopedRootDir)) {
            res.status(404).send('space not exist');
            return;
          }

          req.rootDir = scopedRootDir;
        }

        next();
        return;
      }

      const userId = req.cookies['tn_playground_user'];
      if (!userId) {
        res.sendFile(path.join(playgroundDir, 'login.html'));
        return;
      }

      if (!userId) {
        // should not be here
        res.status(401).send('userId is required');
        return;
      }

      if (/[^a-zA-Z0-9]/.test(userId)) {
        res.status(400).send('Invalid userId');
        return;
      }

      const scopedRootDir = path.join(options.rootDir!, userId);
      await ensureSpacesConfig(scopedRootDir);
      req.rootDir = scopedRootDir;

      next();
    });
  }

  const apiRoutes = initApiRoutes(parsedOptions);

  app.use('/api', apiRoutes);

  const publicDir = process.env.BLOCKLET_APP_DIR
    ? path.join(process.env.BLOCKLET_APP_DIR, 'dist')
    : path.join(__dirname, process.env.NODE_ENV === 'development' ? '..' : '.', 'public');

  ['/logo', '/logo_v1'].forEach((route) => {
    app.get(route, (_, res) => {
      res.sendFile(path.join(publicDir, 'logo.svg'));
    });
  });

  // serve static files from public directory
  app.use(express.static(publicDir));

  app.get('*', (_, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send(`Something broke! ${err.message}`);
  });

  // Start server
  app.listen(PORT, () => {
    const mode = process.env.TN_MODE || process.env.NODE_ENV || 'production';
    console.log(
      `Server started on http://localhost:${PORT}. Core version: ${version}. Mode: ${mode}`
    );
  });
};

export default init;
