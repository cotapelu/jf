import { buildSessionToolDefinition } from '../definition';

describe('session tool definition', () => {
  it('should build a valid ToolDefinition', () => {
    const def = buildSessionToolDefinition();

    // Required ToolDefinition fields
    expect(def).toHaveProperty('name', 'session');
    expect(def).toHaveProperty('label', 'Session Management');
    expect(def).toHaveProperty('description');
    expect(def).toHaveProperty('parameters');
    expect(def).toHaveProperty('promptSnippet');
    expect(def).toHaveProperty('promptGuidelines');

    // Check description content
    expect(def.description).toContain('Comprehensive session management');
    expect(def.description).toContain('docs/SESSION_BUS.md');

    // Check prompt snippet
    expect(def.promptSnippet).toContain('session tool to manage sessions');

    // Check guidelines are non-empty array
    expect(Array.isArray(def.promptGuidelines)).toBe(true);
    expect(def.promptGuidelines.length).toBeGreaterThan(0);

    // Parameters schema
    const params = def.parameters as { type: string; properties: Record<string, unknown> };
    expect(params.type).toBe('object');
    expect(params.properties).toHaveProperty('operation');
    expect(params.required).toContain('operation');
  });

  it('should have all operation enum values', () => {
    const def = buildSessionToolDefinition();
    const params = def.parameters as { properties: { operation: { enum: string[] } } };
    const operations = params.properties.operation.enum;

    const expectedOps = [
      'create', 'switch', 'list', 'info', 'rename', 'tag', 'delete', 'export',
      'tree', 'history', 'status', 'diagnostics', 'cleanup', 'prepare_child',
      'child_read', 'child_write', 'parent_read', 'complete_child',
    ];

    expect(operations).toEqual(expectedOps);
  });

  it('should have correct contract schema for prepare_child', () => {
    const def = buildSessionToolDefinition();
    const params = def.parameters as { properties: { contract: { properties: Record<string, unknown> } } };
    const contract = params.properties.contract;

    expect(contract).toHaveProperty('properties');
    expect(contract.properties).toHaveProperty('mission');
    expect(contract.properties).toHaveProperty('allowedFiles');
    expect(contract.properties).toHaveProperty('outputPath');
    expect(contract.properties).toHaveProperty('doneCriteria');
  });

  it('should not have any undefined fields', () => {
    const def = buildSessionToolDefinition();

    // Check all top-level fields are defined
    expect(def.name).toBeDefined();
    expect(def.label).toBeDefined();
    expect(def.description).toBeDefined();
    expect(def.promptSnippet).toBeDefined();
    expect(Array.isArray(def.promptGuidelines)).toBe(true);
    expect(def.parameters).toBeDefined();
  });
});
