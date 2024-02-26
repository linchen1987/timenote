const { spawnSync } = require('child_process');
const { chmodSync, existsSync, mkdirSync, symlinkSync } = require('fs');
const { dirname, join } = require('path');

const logger = console;

async function ensureSqliteBinaryFile() {
  logger.info(`ensure sqlite3 installed`);

  try {
    require('sqlite3');
    logger.info(`sqlite3 already installed`);
    return;
  } catch {
    /* empty */
  }
  logger.info('try install sqlite3');

  const appDir = process.env.BLOCKLET_APP_DIR;

  spawnSync('npm', ['run', 'install'], {
    cwd: join(appDir, 'node_modules/sqlite3'),
    stdio: 'inherit',
    shell: true,
  });
}

module.exports = {
  ensureSqliteBinaryFile,
};
