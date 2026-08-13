import type { Call } from '../entities/Call';

export interface CallRepositoryPort {
  save(call: Call): Promise<void>;
  findById(organizationId: string, callId: string): Promise<Call | null>;
  findByWacid(wacid: string): Promise<Call | null>;
}
