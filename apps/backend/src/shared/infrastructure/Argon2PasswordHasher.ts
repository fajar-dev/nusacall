import argon2 from 'argon2';
import type { PasswordHasher } from '../domain/ports/PasswordHasher';

export class Argon2PasswordHasher implements PasswordHasher {
  public async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  public async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
