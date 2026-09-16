import { registerDriver } from '@timenote/core';
import { LocalFsDriver } from '@timenote/core/fs/adapters/localfs/node';
import { Command } from 'commander';
import { registerCloneCommand } from './commands/clone.js';
import { registerConfigCommand } from './commands/config.js';
import { registerDesktopCommand } from './commands/desktop.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerNoteCommand } from './commands/note.js';
import { registerRemoteCommand } from './commands/remote.js';
import { registerPullCommand, registerPushCommand, registerSyncCommand } from './commands/sync.js';
import { DesktopCliError } from './lib/desktop-client.js';

registerDriver('localfs', LocalFsDriver);

const program = new Command();

program.name('timenote').description('CLI for managing timenote notebooks').version('0.1.0');

registerConfigCommand(program);
registerCloneCommand(program);
registerRemoteCommand(program);
registerPullCommand(program);
registerPushCommand(program);
registerSyncCommand(program);
registerNoteCommand(program);
registerDesktopCommand(program);
registerMcpCommand(program);

program.parseAsync(process.argv).catch((e: unknown) => {
  if (e instanceof DesktopCliError) {
    console.error(`[${e.code}] ${e.message}${e.retryable ? ' (retryable)' : ''}`);
    process.exitCode = e.exitCode;
    return;
  }
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
