import path from 'path';
import fs from 'fs-extra';
import { LIB_VERSION } from './version';

import initStates from './states';
import initManager from './manager';

export const create = async (options: { dataDir?: string; mode?: 'script' }) => {
  const dataDir = options.dataDir || process.cwd();
  const { mode } = options;
  await fs.ensureDir(dataDir);
  const dbPath = path.join(dataDir, 'core.db');
  const states = await initStates({ dbPath, mode });
  const manager = await initManager({ states });

  return {
    createPost: manager.createPost,
    getPosts: manager.getPosts,
    getPost: manager.getPost,
    updatePost: manager.updatePost,
    deletePost: manager.deletePost,

    // menus
    getMenus: manager.getMenus,
    getMenu: manager.getMenu,
    createMenu: manager.createMenu,
    updateMenu: manager.updateMenu,
    deleteMenu: manager.deleteMenu,
    moveMenu: manager.moveMenu,
    version: LIB_VERSION,
  };
};

export type Space = Awaited<ReturnType<typeof create>>;

export const version = LIB_VERSION;
