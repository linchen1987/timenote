import pm2 from 'pm2';
import Table from 'cli-table3';
import chalk from 'chalk';

export default async function run() {
  pm2.connect((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    pm2.list((err, list) => {
      var table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Name'),
          chalk.cyan('Port'),
          chalk.cyan('Path'),
          chalk.cyan('Status'),
        ],
      });

      list.forEach((item) => {
        const env = item.pm2_env as {
          TIMENOTE_DATA_DIR?: string;
          PORT?: string;
          status: string;
        };
        table.push([item.pid, item.name, env.PORT, env.TIMENOTE_DATA_DIR, env.status]);
      });

      console.log(table.toString());

      pm2.disconnect();
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  });
}
