import path from 'path';
import fs from 'fs-extra';
import { Router, NextFunction } from 'express';
import type { Request, Response } from '../../types';
import ShortUniqueId from 'short-unique-id';
import omit from 'lodash/omit';

import { create } from '@timenote/core';

import { ServiceOptions } from '../../types';
import CONSTANTS from '../../utils/constants';
import env from '../../utils/env';
import { getMenus, createMenu, deleteMenu, moveMenu } from './menus';
import { getPosts, getPost, createPost, updatePost, deletePost } from './posts';

const SPACES_DIR = 'spaces';

const router = Router();

const base32Arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '2', '3', '4', '5', '6', '7']; // prettier-ignore
const uid = new ShortUniqueId({ length: 3, dictionary: base32Arr });

const getSpaceDir = (rootDir: string, spaceId: string) => {
  return path.join(rootDir, SPACES_DIR, spaceId);
};

const spacePool = new Map();

const _getSpace = async (rootDir: string, spaceId: string) => {
  const dataDir = getSpaceDir(rootDir, spaceId);
  if (spacePool.has(dataDir)) {
    return spacePool.get(dataDir);
  }
  if (!fs.existsSync(dataDir)) {
    throw new Error('space not exist');
  }

  const promise = create({ dataDir });

  // avoid create space twice
  spacePool.set(dataDir, promise);

  const space = await promise;

  spacePool.set(dataDir, space);

  return space;
};

type SpaceConfig = {
  id: string;
  name: string;
  dataDir: string;
  createdAt: string;
};

const findSpaceDir = (rootDir: string): string => {
  let exist = true;
  let id = '';
  while (exist) {
    id = uid.rnd();
    const dataDir = path.join(rootDir, SPACES_DIR, id);
    exist = fs.existsSync(dataDir);
  }
  return id;
};

const parseQuery = ({
  offset,
  limit,
  q,
  sort_field,
}: {
  offset?: string;
  limit?: string;
  q?: string;
  sort_field?: 'created_at' | 'updated_at';
}) => {
  const sortField: 'createdAt' | 'updatedAt' =
    sort_field === 'created_at' ? 'createdAt' : 'updatedAt';
  return {
    offset: parseInt(String(offset)) || 0,
    limit: parseInt(String(limit)) || 20,
    query: q,
    sortField,
  };
};

const init = (options: ServiceOptions): Router => {
  // const { rootDir } = options;
  // const getRootDir = typeof rootDir === 'string' ? () => rootDir : rootDir;

  const getSpace = async (req: Request, res: Response, next: NextFunction) => {
    const { spaceId } = req.params;
    const rootDir = req.rootDir!;

    try {
      const space = await _getSpace(rootDir!, spaceId);
      req.space = space;
      next();
    } catch (error: any) {
      const statusCode = error?.message === 'space not exist' ? 404 : 500;
      res.status(statusCode).send(error?.message);
    }
  };

  router.get('/spaces', async (req: Request, res) => {
    const rootDir = req.rootDir!;
    const file = path.join(rootDir, CONSTANTS.SPACES_CONFIG_NAME);
    const list: SpaceConfig[] = await fs.readJSON(file);
    res.json(list.map((item) => omit(item, ['dataDir'])));
  });

  router.post('/create-space', async (req: Request, res) => {
    const { name } = req.body;
    const rootDir = req.rootDir!;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const id = findSpaceDir(rootDir);

    const spaceConfig: SpaceConfig = {
      id,
      name,
      dataDir: id,
      createdAt: new Date().toISOString(),
    };

    const dataDir = path.join(rootDir, SPACES_DIR, spaceConfig.dataDir);

    // create space
    await create({
      dataDir,
    });

    // update spaces config
    const file = path.join(rootDir, CONSTANTS.SPACES_CONFIG_NAME);
    const spacesConfig: SpaceConfig[] = await fs.readJSON(file);
    spacesConfig.push(spaceConfig);
    await fs.writeJSON(file, spacesConfig);

    res.json(omit(spaceConfig, ['dataDir']));
  });

  router.get('/s/:spaceId/posts', getSpace, getPosts);

  router.get('/s/:spaceId/post/:id', getSpace, getPost);

  router.post('/s/:spaceId/createPost', getSpace, createPost);

  router.post('/s/:spaceId/updatePost/:id', getSpace, updatePost);

  router.post('/s/:spaceId/deletePost/:id', getSpace, deletePost);

  // menu

  router.get('/s/:spaceId/menus', getSpace, getMenus);
  router.post('/s/:spaceId/createMenu', getSpace, createMenu);
  router.post('/s/:spaceId/deleteMenu', getSpace, deleteMenu);
  router.post('/s/:spaceId/moveMenu', getSpace, moveMenu);

  ['/s/:playgroundScope/:spaceId/manifest.json', '/s/:spaceId/manifest.json'].forEach(
    (prefix) => {
      router.get(prefix, getSpace, async (req: Request, res) => {
        const rootDir = req.rootDir!;
        const file = path.join(rootDir, CONSTANTS.SPACES_CONFIG_NAME);
        const list: SpaceConfig[] = await fs.readJSON(file);
        const space = list.find((item) => item.id === req.params.spaceId);

        const prefix = process.env.NODE_ENV === 'development' ? '[Dev] ' : '';
        res.json({
          name: `${prefix}${space?.name}`,
          description: `${space?.name}`,
          start_url: `${env.serviceMountPoint}/s/${space?.id}`,
          scope: `${env.serviceMountPoint}/s/${space?.id}`,
          display: 'standalone',
          theme_color: '#000000',
          background_color: '#ffffff',
          icons: [
            {
              src: `${env.serviceMountPoint}/logo_v1`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: `${env.serviceMountPoint}/logo_v1`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        });
      });
    }
  );

  return router;
};

export default init;
