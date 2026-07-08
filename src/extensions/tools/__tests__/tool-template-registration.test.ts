import { describe, it, expect, vi } from 'vitest';
import { registerToolTemplate } from '../tool-template.js';

describe('tool-template registration', () => {
  it('registerToolTemplate registers tool with API', () => {
    const api = { registerTool: vi.fn() };
    registerToolTemplate(api);
    expect(api.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'tool_template',
        label: 'Tool Template',
        description: expect.any(String),
        parameters: expect.any(Object),
      })
    );
  });
});
