import type { Plugin } from 'vite';

/**
 * Injects the build timestamp as a compile-time constant (`__APP_BUILD_TIME__`)
 * via Vite `define`. The value is captured once per build invocation, so all
 * environments (client + SSR) receive the identical string. The matching type
 * declaration lives in `build-time-globals.d.ts` (esbuild ignores `.d.ts`, so it
 * does not create a binding that would block replacement).
 */
export function buildTimePlugin(): Plugin {
  return {
    name: 'timenote-build-time',
    config() {
      const buildTime = new Date().toISOString();
      return {
        define: {
          __APP_BUILD_TIME__: JSON.stringify(buildTime),
        },
      };
    },
  };
}
