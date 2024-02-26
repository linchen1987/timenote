import pm2 from 'pm2';
import chalk from 'chalk';

export default async function run() {
  const cwd = process.cwd();

  pm2.connect((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    pm2.list((err, list) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      const instance = list.find(
        (item) =>
          (item.pm2_env as { TIMENOTE_DATA_DIR?: string }).TIMENOTE_DATA_DIR === cwd
      );

      if (!instance) {
        console.log(
          chalk.red('Space service not found in current directory or has already stopped')
        );
        process.exit(1);
      }

      pm2.delete(instance!.pm_id!, (err) => {
        console;
        pm2.disconnect();
        if (err) {
          console.error(err);
          process.exit(1);
        }
      });
    });
  });
}
