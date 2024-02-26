const { ensureSqliteBinaryFile } = require('./libs/ensure-sqlite');

const logger = console;

(async () => {
  try {
    await ensureSqliteBinaryFile();
    process.exit(0);
  } catch (err) {
    logger.error(`pre-start error`, err.message);
    process.exit(1);
  }
})();
