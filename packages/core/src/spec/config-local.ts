import { z } from 'zod';

export const RemoteConfigSchema = z.object({
  url: z.string(),
  default: z.boolean().optional(),
  name: z.string().optional(),
});

export type RemoteConfig = z.infer<typeof RemoteConfigSchema>;

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevelName = (typeof LOG_LEVELS)[number];

export const LoggingConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  level: z.enum(LOG_LEVELS).optional().default('info'),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

export const ConfigLocalSchema = z.object({
  remotes: z.array(RemoteConfigSchema).optional().default([]),
  logging: LoggingConfigSchema.optional(),
});

export type ConfigLocal = z.infer<typeof ConfigLocalSchema>;

export function createEmptyConfigLocal(): ConfigLocal {
  return { remotes: [] };
}
