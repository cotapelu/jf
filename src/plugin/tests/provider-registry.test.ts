#!/usr/bin/env node

import { describe, it, expect } from 'vitest';
import { CUSTOM_PROVIDERS } from '../extensions/providers/registry.js';

describe('provider registry', () => {
  it('includes kilo provider', () => {
    expect(CUSTOM_PROVIDERS).toContain('kilo');
  });
});
