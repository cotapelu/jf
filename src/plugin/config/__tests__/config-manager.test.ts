import { describe, it, expect } from 'vitest';
import { CONFIG_DIR_NAME } from '../config-manager';

describe('config-manager', () => {
  it('exports CONFIG_DIR_NAME', () => {
    expect(CONFIG_DIR_NAME).toBe('.piclaw');
  });
});
