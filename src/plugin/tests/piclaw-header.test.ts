#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@earendil-works/pi-tui', () => ({ Text: class { constructor(public content: string) {} } }));
import piclawHeader from '../extensions/piclaw-header.js';

describe('piclaw-header', () => {
  let mockApi: any;
  beforeEach(() => {
    mockApi = { on: vi.fn() };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: '0.0.1' }) }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers session_start', () => {
    piclawHeader(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
  });

  it('sets header when hasUI', async () => {
    const ctx: any = { hasUI: true, ui: { setHeader: vi.fn() } };
    piclawHeader(mockApi);
    const [, listener] = mockApi.on.mock.calls[0];
    await listener('session_start', ctx);
    expect(ctx.ui.setHeader).toHaveBeenCalled();
  });

  it('does not set header when no UI', async () => {
    const ctx: any = { hasUI: false };
    piclawHeader(mockApi);
    const [, listener] = mockApi.on.mock.calls[0];
    await listener('session_start', ctx);
    expect(ctx.ui?.setHeader).toBeUndefined();
  });
});
