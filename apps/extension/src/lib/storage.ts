export const ExtensionStorage = {
  async get(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },

  async getAll(): Promise<Record<string, string>> {
    return await chrome.storage.local.get(null);
  },
};
