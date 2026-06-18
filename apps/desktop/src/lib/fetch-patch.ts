import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return originalFetch(input, init);
  }

  return tauriFetch(input as string | URL, init);
};
