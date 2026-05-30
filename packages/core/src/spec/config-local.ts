import { z } from 'zod';

export const RemoteConfigSchema = z.object({
  url: z.string(),
  default: z.boolean().optional(),
  name: z.string().optional(),
});

export type RemoteConfig = z.infer<typeof RemoteConfigSchema>;

export const ConfigLocalSchema = z.object({
  remotes: z.array(RemoteConfigSchema).optional().default([]),
});

export type ConfigLocal = z.infer<typeof ConfigLocalSchema>;

export function createEmptyConfigLocal(): ConfigLocal {
  return { remotes: [] };
}
