import type { User } from '../User';

export interface AuthUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  updateLastLogin(userId: string, at: Date): Promise<void>;
  incrementFailedLogin(userId: string): Promise<void>;
}
