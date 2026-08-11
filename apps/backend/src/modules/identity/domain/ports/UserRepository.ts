import type { User } from '../User';

export interface CreateUserData {
  organizationId: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: string;
  status?: string;
}

export interface UpdateUserData {
  fullName?: string;
  role?: string;
  status?: string;
  passwordHash?: string;
}

export interface UserRepository {
  save(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(organizationId: string, email: string): Promise<User | null>;
  findByOrganizationId(organizationId: string): Promise<User[]>;
}
