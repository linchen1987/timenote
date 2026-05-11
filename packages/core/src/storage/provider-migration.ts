import { STORAGE_KEYS } from '../constants';
import { saveProvider } from './provider-registry';

const LEGACY_KEYS = [
  STORAGE_KEYS.STORAGE_TYPE,
  STORAGE_KEYS.WEBDAV_URL,
  STORAGE_KEYS.WEBDAV_USERNAME,
  STORAGE_KEYS.WEBDAV_PASSWORD,
  STORAGE_KEYS.S3_BUCKET,
  STORAGE_KEYS.S3_ENDPOINT,
  STORAGE_KEYS.S3_ACCESS_KEY_ID,
  STORAGE_KEYS.S3_SECRET_ACCESS_KEY,
  STORAGE_KEYS.S3_REGION,
] as const;

function cleanLegacyKeys(): void {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

export function migrateLegacyProviders(): void {
  if (typeof window === 'undefined') return;

  const storageType = localStorage.getItem(STORAGE_KEYS.STORAGE_TYPE);
  if (!storageType) return;

  try {
    if (storageType === 'webdav') {
      const url = localStorage.getItem(STORAGE_KEYS.WEBDAV_URL);
      const username = localStorage.getItem(STORAGE_KEYS.WEBDAV_USERNAME);
      const password = localStorage.getItem(STORAGE_KEYS.WEBDAV_PASSWORD);
      if (url && username) {
        saveProvider({
          type: 'webdav',
          webdav: { url, username, password: password ?? '' },
        });
      }
    } else if (storageType === 's3') {
      const bucket = localStorage.getItem(STORAGE_KEYS.S3_BUCKET);
      const endpoint = localStorage.getItem(STORAGE_KEYS.S3_ENDPOINT);
      const accessKeyId = localStorage.getItem(STORAGE_KEYS.S3_ACCESS_KEY_ID);
      const secretAccessKey = localStorage.getItem(STORAGE_KEYS.S3_SECRET_ACCESS_KEY);
      const region = localStorage.getItem(STORAGE_KEYS.S3_REGION);
      if (bucket && accessKeyId) {
        saveProvider({
          type: 's3',
          s3: {
            bucket,
            endpoint: endpoint || undefined,
            accessKeyId,
            secretAccessKey: secretAccessKey ?? '',
            region: region || undefined,
          },
        });
      }
    }

    cleanLegacyKeys();
  } catch (e) {
    console.error('[migrateLegacyProviders] failed:', e);
  }
}
