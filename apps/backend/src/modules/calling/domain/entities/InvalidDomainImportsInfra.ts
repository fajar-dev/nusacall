// TEST FIXTURE: Violates layer boundary (domain importing infrastructure)
import { TypeOrmCallRepository } from '../../infrastructure/TypeOrmCallRepository';

export class InvalidDomainImportsInfra {
  repo = new TypeOrmCallRepository();
}
