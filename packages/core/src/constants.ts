export const NOTE_LIST_PAGE_SIZE = 20;

export const CONTACT_EMAIL = 'link.lin.1987@gmail.com';

export const STORAGE_KEYS = {
  THEME: 'theme',
  SIDEBAR_WIDTH: '@timenote/sidebar_width',
  DESKTOP_SIDEBAR_OPEN: '@timenote/desktop_sidebar_open',
  LAST_NOTEBOOK_TOKEN: '@timenote/last_notebook_token',
  SYNC_CACHE_PREFIX: '@timenote/sync_cache',
  PROVIDERS: '@timenote/providers',
  NOTEBOOK_REMOTES: '@timenote/notebook_remotes',
  /** @internal 迁移终态墓碑。值 '3' = 迁移完成+旧数据已清理。数据保留不删除。 */
  NOTEBOOK_REMOTES_MIGRATED_V2: '@timenote/notebook_remotes_migrated_v2',
} as const;

export const SYNC_TTL_MS = 30 * 60 * 1000;
