import { Entity } from '../../../../shared/domain/Entity';

export class Call extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}
