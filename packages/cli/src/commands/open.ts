import path from 'path';
import pm2 from 'pm2';
import chalk from 'chalk';
import open from 'open';
import type { ProcessDescription } from 'pm2';

export default async function run() {
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

    if (!exist) {
      console.log(chalk.red('Space service not found'));
      console.log('');
      console.log(
        `Please go to the space directory and run ${chalk.cyan('timenote start --open')}`
      );
      process.exit(1);
    }

    const port = (exist.pm2_env as { PORT: string }).PORT;

    await open(`http://localhost:${port}`);

    process.exit(0);
  });
}
