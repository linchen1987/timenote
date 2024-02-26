import { version } from '@timenote/core';
import { program } from 'commander';

program.version(version);

program
  .command('start')
  .description('Start new service in the current working directory')
  .option('--open', 'Open the service in browser after started')
  .action((option) => {
    import('./commands/start.js').then((module) => module.default(option));
  });

program
  .command('stop')
  .description('Stop service in the current working directory')
  .action(() => {
    import('./commands/stop.js').then((module) => module.default());
  });

program
  .command('list')
  .description('List all services')
  .action(() => {
    import('./commands/list.js').then((module) => module.default());
  });

program
  .command('open')
  .description('Open service in the current working directory')
  .action(() => {
    import('./commands/open.js').then((module) => module.default());
  });

program.parse(process.argv);
