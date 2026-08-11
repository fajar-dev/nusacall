import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_ROLE: z.enum(['api', 'worker', 'scheduler', 'all']).default('all'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Database
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(3306),
  DATABASE_USER: z.string().default('root'),
  DATABASE_PASSWORD: z.string().default('secret'),
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
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.format();
    throw new Error(`Invalid environment variables: ${JSON.stringify(errors)}`);
  }
  return result.data;
}

export const config: Config = parseConfig();
