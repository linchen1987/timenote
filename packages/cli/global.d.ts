// FIXME declare does not work

declare module 'pm2' {
  interface Pm2Env {
    TIMENOTE_DATA_DIR: string;
  }
  interface ProcessDescription {
    pm2_env?: {
      TIMENOTE_DATA_DIR: string;
    };
  }
}
