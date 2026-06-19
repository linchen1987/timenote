import type { FsClient } from '../fs/types';
import { ConfigLocalSchema, type LoggingConfig, LoggingConfigSchema } from '../spec/config-local';
import { LOG_DIR, logPath, META_DIR, metaPath } from '../spec/vault-layout';

const LOG_FILE = logPath('activity');
const MAX_LINES = 500;
const PRUNE_CHECK_INTERVAL = 64;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogConfig {
  enabled: boolean;
  level: LogLevel;
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface Logger {
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  scoped(category: string): Logger;
}

export function formatLine(entry: LogEntry): string {
  let line = `${entry.ts} [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}`;
  if (entry.data && Object.keys(entry.data).length > 0) {
    line += ` ${JSON.stringify(entry.data)}`;
  }
  return line;
}

export function parseLine(line: string): LogEntry | null {
  const m = line.match(/^(\S+) \[(\w+)\] \[([^\]]+)\] (.*)$/);
  if (!m) return null;
  const [, ts, rawLevel, category, rest] = m;
  const level = rawLevel.toLowerCase() as LogLevel;
  let message = rest;
  let data: Record<string, unknown> | undefined;
  if (rest.endsWith('}')) {
    const idx = rest.lastIndexOf(' {');
    if (idx !== -1) {
      try {
        data = JSON.parse(rest.slice(idx + 1));
        message = rest.slice(0, idx);
      } catch {}
    }
  }
  return { ts, level, category, message, data };
}

async function fallbackAppend(transport: FsClient, path: string, content: string): Promise<void> {
  let existing = '';
  try {
    existing = await transport.read(path);
  } catch {}
  await transport.write(path, existing + content);
}

async function pruneIfNeeded(transport: FsClient): Promise<void> {
  let raw: string;
  try {
    raw = await transport.read(LOG_FILE);
  } catch {
    return;
  }
  const lines = raw.split('\n').filter(Boolean);
  if (lines.length <= MAX_LINES) return;
  const kept = lines.slice(lines.length - MAX_LINES);
  await transport.write(LOG_FILE, `${kept.join('\n')}\n`);
}

// 递归深度守卫：防止 Logger 写入时触发日志装饰器导致无限循环。
// 全局共享——多 vault 并发时存在理论上的误杀（另一 vault 的合法日志被跳过），
// 但窗口极小（OPFS append ~ms 级）、后果轻微（漏一条日志）、零死循环风险。
// 如需精确化，可改为 WeakSet 按 Logger 实例追踪。
let logWriteDepth = 0;

export function isInsideLogWrite(): boolean {
  return logWriteDepth > 0;
}

export function createLogger(
  getClient: () => Promise<FsClient> | FsClient,
  config: LogConfig,
): Logger {
  const queue: { promise: Promise<void> } = { promise: Promise.resolve() };
  let appendCount = 0;

  function enqueue(fn: () => Promise<void>): void {
    queue.promise = queue.promise.then(fn).catch(() => {});
  }

  function doLog(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (!config.enabled) return;
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[config.level]) return;
    const entry: LogEntry = { ts: new Date().toISOString(), level, category, message, data };
    const line = `${formatLine(entry)}\n`;
    enqueue(async () => {
      logWriteDepth++;
      try {
        const client = await getClient();
        await client.ensureDir(LOG_DIR);
        if (client.append) {
          await client.append(LOG_FILE, line);
        } else {
          await fallbackAppend(client, LOG_FILE, line);
        }
        appendCount++;
        if (appendCount % PRUNE_CHECK_INTERVAL === 0) {
          await pruneIfNeeded(client);
        }
      } finally {
        logWriteDepth--;
      }
    });
  }

  function makeLogger(category: string): Logger {
    return {
      log: (level, msg, data) => doLog(level, category, msg, data),
      debug: (msg, data) => doLog('debug', category, msg, data),
      info: (msg, data) => doLog('info', category, msg, data),
      warn: (msg, data) => doLog('warn', category, msg, data),
      error: (msg, data) => doLog('error', category, msg, data),
      scoped: (childCategory) => makeLogger(childCategory),
    };
  }

  return makeLogger('root');
}

export async function readLogs(transport: FsClient): Promise<LogEntry[]> {
  let raw: string;
  try {
    raw = await transport.read(LOG_FILE);
  } catch {
    return [];
  }
  const lines = raw.split('\n').filter(Boolean);
  const entries: LogEntry[] = [];
  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) entries.push(entry);
  }
  return entries.reverse();
}

export async function clearLogs(transport: FsClient): Promise<void> {
  await transport.ensureDir(LOG_DIR);
  await transport.write(LOG_FILE, '');
}

interface ConfigShape {
  remotes?: unknown[];
  logging?: LoggingConfig;
}

async function readConfig(transport: FsClient): Promise<ConfigShape> {
  try {
    const raw = await transport.read(metaPath('configLocal'));
    return ConfigLocalSchema.parse(JSON.parse(raw)) as ConfigShape;
  } catch {
    return { remotes: [] };
  }
}

async function writeConfig(transport: FsClient, config: ConfigShape): Promise<void> {
  await transport.ensureDir(META_DIR);
  await transport.write(metaPath('configLocal'), JSON.stringify(config, null, 2));
}

export async function readLoggingConfig(transport: FsClient): Promise<LoggingConfig> {
  const config = await readConfig(transport);
  const parsed = LoggingConfigSchema.safeParse(config.logging ?? {});
  return parsed.success ? parsed.data : { enabled: false, level: 'info' };
}

export async function writeLoggingConfig(
  transport: FsClient,
  logging: LoggingConfig,
): Promise<void> {
  const config = await readConfig(transport);
  config.logging = logging;
  await writeConfig(transport, config);
}
