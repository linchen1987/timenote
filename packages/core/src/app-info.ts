/// <reference path="./build/build-time-globals.d.ts" />

declare global {
  interface Window {
    __TIMENOTE_BUILD_TIME__?: string;
  }
}

const UNKNOWN = 'unknown';

export type AppPlatform = 'web' | 'extension' | 'desktop';

/**
 * Resolve the current build timestamp. On the client the value is mirrored to
 * `window.__TIMENOTE_BUILD_TIME__` (inspectable in devtools) and read back from
 * there as the single runtime source of truth.
 */
export function getBuildTime(): string {
  const injected = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : UNKNOWN;
  if (typeof window !== 'undefined') {
    if (!window.__TIMENOTE_BUILD_TIME__) {
      window.__TIMENOTE_BUILD_TIME__ = injected;
    }
    return window.__TIMENOTE_BUILD_TIME__;
  }
  return injected;
}

export function getBuildTimeDate(): Date | null {
  const date = new Date(getBuildTime());
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Best-effort platform detection so the same shared UI can identify which app
 * it is running in. Web is SSR-safe (returns `'web'` when `window` is absent).
 */
export function detectPlatform(): AppPlatform {
  if (typeof window === 'undefined') return 'web';
  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) return 'desktop';
  const chrome = (globalThis as { chrome?: { runtime?: { id?: string } } }).chrome;
  if (typeof chrome?.runtime?.id === 'string') return 'extension';
  return 'web';
}
