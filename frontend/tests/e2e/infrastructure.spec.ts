import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Infrastructure Verification', () => {
  // Scenario 10: Non-root container verification
  test('all application containers run as non-root', async () => {
    // This test runs verify-non-root.sh which checks all Docker images
    try {
      const { stdout } = await execAsync('../../scripts/verify-non-root.sh');
      expect(stdout).not.toContain('FAIL');
    } catch (error) {
      // Script exits with code 1 if any container runs as root
      test.fail(true, 'One or more containers run as root');
    }
  });
});
