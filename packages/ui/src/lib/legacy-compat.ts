// Normalization logic lives in @timenote/core now so the CLI file store,
// desktop file store, and this browser localStorage store all share one
// implementation. Re-exported here under the legacy name for back-compat.
export { normalizeVolumeEntry as normalizeLegacyEntry } from '@timenote/core';
