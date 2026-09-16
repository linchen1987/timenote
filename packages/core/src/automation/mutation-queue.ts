/**
 * Per-key serial mutation queue. All note mutations for one vault go through
 * the same key so UI saves, agent writes and deletions interleave as
 * sequential transactions instead of racing on read-modify-write cycles.
 */

export interface MutationQueue {
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

export function createMutationQueue(): MutationQueue {
  const tails = new Map<string, Promise<unknown>>();

  return {
    async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const prev = tails.get(key) ?? Promise.resolve();
      const next = prev.then(fn, fn);
      tails.set(
        key,
        next.catch(() => {
          // swallow: failures must not block later queued mutations
        }),
      );
      return next;
    },
  };
}
