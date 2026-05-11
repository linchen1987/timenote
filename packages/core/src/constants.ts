export const NOTE_LIST_PAGE_SIZE = 20;

export const CONTACT_EMAIL = 'link.lin.1987@gmail.com';

export const STORAGE_KEYS = {
  THEME: 'theme',
  NOTES: '@timenote/notes',
  STORAGE_TYPE: '@timenote/storage_type',
  WEBDAV_URL: '@timenote/webdav_url',
  WEBDAV_USERNAME: '@timenote/webdav_username',
  WEBDAV_PASSWORD: '@timenote/webdav_password',
  S3_BUCKET: '@timenote/s3_bucket',
  S3_ENDPOINT: '@timenote/s3_endpoint',
  S3_ACCESS_KEY_ID: '@timenote/s3_access_key_id',
  S3_SECRET_ACCESS_KEY: '@timenote/s3_secret_access_key',
  S3_REGION: '@timenote/s3_region',
  SIDEBAR_WIDTH: '@timenote/sidebar_width',
  DESKTOP_SIDEBAR_OPEN: '@timenote/desktop_sidebar_open',
  LAST_NOTEBOOK_TOKEN: '@timenote/last_notebook_token',
  SYNC_CACHE_PREFIX: '@timenote/sync_cache',
  PROVIDERS: '@timenote/providers',
  NOTEBOOK_REMOTES: '@timenote/notebook_remotes',
} as const;

export const SYNC_TTL_MS = 30 * 60 * 1000;
