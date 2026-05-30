import { Command } from 'commander';
import { registerCloneCommand } from './commands/clone.js';
import { registerConfigCommand } from './commands/config.js';
import { registerNoteCommand } from './commands/note.js';
import { registerRemoteCommand } from './commands/remote.js';
import { registerPullCommand, registerPushCommand, registerSyncCommand } from './commands/sync.js';

const program = new Command();

program.name('timenote').description('CLI for managing timenote notebooks').version('0.1.0');

registerConfigCommand(program);
registerCloneCommand(program);
registerRemoteCommand(program);
registerPullCommand(program);
registerPushCommand(program);
registerSyncCommand(program);
registerNoteCommand(program);

program.parse();
