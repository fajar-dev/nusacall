import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Attempt to load .env file if available (Node 22 native support)
const rootEnvPath = resolve(__dirname, '../../../../.env');
if (existsSync(rootEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch {
    // Ignore error if env file is already loaded
  }
}

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_ROLE: z.enum(['api', 'worker', 'scheduler', 'all']).default('all'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(3306),
  DATABASE_USER: z.string().default('nusacall'),
  DATABASE_PASSWORD: z.string().default('nusacall'),
  DATABASE_NAME: z.string().default('nusacall'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Auth / Security
  JWT_SECRET: z.string().min(16).default('default_jwt_secret_must_be_at_least_16_chars'),
});

export type Config = z.infer<typeof configSchema>;

export function parseConfig(env: Record<string, unknown> = process.env): Config {
  const mergedEnv = {
    ...env,
    DATABASE_HOST: env.DATABASE_HOST || env.DB_HOST || 'localhost',
    DATABASE_PORT: env.DATABASE_PORT || env.MYSQL_PORT || env.DB_PORT || 3306,
    DATABASE_USER: env.DATABASE_USER || env.DB_USER || 'nusacall',
    DATABASE_PASSWORD: env.DATABASE_PASSWORD || env.DB_PASSWORD || 'nusacall',
    DATABASE_NAME: env.DATABASE_NAME || env.DB_NAME || 'nusacall',
    REDIS_HOST: env.REDIS_HOST || 'localhost',
    REDIS_PORT: env.REDIS_PORT || 6379,
  };

  const result = configSchema.safeParse(mergedEnv);
  if (!result.success) {
    const errors = result.error.format();
    throw new Error(`Invalid environment variables: ${JSON.stringify(errors)}`);
  }
  return result.data;
}

export const config: Config = parseConfig();
