import { describe, it, expect } from 'vitest';
import { parseConfig } from '../src/bootstrap/config';

describe('bootstrap/config.ts', () => {
  it('should parse valid environment variables and return defaults', () => {
    const validEnv = {
      NODE_ENV: 'test',
      PORT: '8080',
      APP_ROLE: 'api',
      DATABASE_HOST: 'db.example.com',
      JWT_SECRET: 'super-secret-key-1234567890',
    };

    const cfg = parseConfig(validEnv);
    expect(cfg.NODE_ENV).toBe('test');
    expect(cfg.PORT).toBe(8080);
    expect(cfg.APP_ROLE).toBe('api');
    expect(cfg.DATABASE_HOST).toBe('db.example.com');
    expect(cfg.DATABASE_PORT).toBe(3306);
    expect(cfg.JWT_SECRET).toBe('super-secret-key-1234567890');
  });

  it('should throw an error when environment variables are invalid', () => {
    const invalidEnv = {
      APP_ROLE: 'invalid_role',
      PORT: 'not_a_number',
      JWT_SECRET: 'short',
    };

    expect(() => parseConfig(invalidEnv)).toThrow('Invalid environment variables');
  });
});
