import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

describe('Layer Boundary Enforcement (ESLint boundaries plugin)', () => {
  it('should fail linting when a domain file imports from infrastructure', () => {
    const fixturePath = path.resolve(
      __dirname,
      '../src/modules/calling/domain/entities/InvalidDomainImportsInfra.ts',
    );

    let failed = false;
    let stdout = '';

    try {
      execSync(`npx eslint "${fixturePath}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error: unknown) {
      failed = true;
      if (error && typeof error === 'object' && 'stdout' in error) {
        stdout = String(error.stdout);
      }
    }

    expect(failed).toBe(true);
    expect(stdout).toContain('boundaries/element-types');
    expect(stdout).toContain("File is of type 'domain'");
    expect(stdout).toContain("Dependency is of type 'infrastructure'");
  });
});
