import path from 'path';
import getPort from 'get-port';
import pm2 from 'pm2';
import chalk from 'chalk';
import open from 'open';
import type { ProcessDescription } from 'pm2';

export default async function run({ open: autoOpen }: { open?: boolean } = {}) {
  let port = await getPort({ port: 30108 });
  const dir = process.cwd();

  pm2.connect(async (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    const exist = await new Promise<ProcessDescription | undefined>((resolve) => {
      pm2.list((err, list) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        const instance = list.find(
          (item) =>
            (item.pm2_env as { TIMENOTE_DATA_DIR?: string }).TIMENOTE_DATA_DIR === dir
        );

        resolve(instance);
      });
    });

    if (exist) {
      console.log('Restart existing instance');
      port = +(exist.pm2_env as { PORT: string }).PORT;

      await new Promise<void>((resolve) => {
        pm2.delete(`timenote-${port}`, (err) => {
          if (err) {
            console.error(err);
            process.exit(1);
          }
          resolve();
        });
      });
    }

    pm2.start(
      {
        name: `timenote-${port}`,
        script: path.join(new URL(import.meta.url).pathname, '../../processes/daemon.js'),
        cwd: dir,
        output: path.join(dir, 'logs', 'output.log'),
        error: path.join(dir, 'logs', 'error.log'),
        env: {
          TIMENOTE_DATA_DIR: dir,
          PORT: `${port}`,
        },
      },
      async (err, apps) => {
        console.log(
          `Time Note ${chalk.cyan(dir)} started at ${chalk.cyan(
            `http://localhost:${port}`
          )}`
        );
        pm2.disconnect();

        if (autoOpen) {
          await open(`http://localhost:${port}`);
        }

        if (err) {
          console.error(err);
          process.exit(1);
        }
      }
    );
  });
}
