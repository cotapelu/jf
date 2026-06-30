import { vi, describe, it, expect } from 'vitest';

// Set environment variable to enable test-only commands BEFORE importing the module
process.env.COVERAGE_TEST = 'true';
vi.resetModules();

// Now import the tool
const { createSkillLoaderTool } = await import('../skill-reader.js');

describe('skill-reader branch coverage', () => {
  let tool: any;

  beforeAll(() => {
    tool = createSkillLoaderTool();
  });

  it('covers if(meta) false branch (command without commandMeta)', async () => {
    // This command exists in commands but not in commandMeta
    const result = await tool.execute('test1', { command: 'test_no_meta', args: {} }, undefined, undefined, {});
    // After discovering meta is undefined, it will try to load the module and fail
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Command module missing execute function');
  });

  it('covers if(schema?.properties) false branch (no properties)', async () => {
    const result = await tool.execute('test2', { command: 'test_no_properties', args: {} }, undefined, undefined, {});
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    // Should not have any parameter lines (they start with two spaces and contain '(')
    const lines = text.split('\n');
    const paramLines = lines.filter(l => l.startsWith('  ') && l.includes('('));
    expect(paramLines.length).toBe(0);
    // Should have Examples section because we provided examples
    expect(text).toContain('Examples:');
  });

  it('covers ternary true branch, OR fallback for missing type/desc, and examples false branch', async () => {
    const result = await tool.execute('test3', { command: 'test_branch_all', args: {} }, undefined, undefined, {});
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    // Check that required property shows asterisk
    // The line should look like "  reqProp* (any): Required property (no type)"
    // Because no type provided, fallback to 'any'
    expect(text).toMatch(/reqProp\* \(any\):/);
    // Check that property missing type: we already used reqProp with no type to cover fallback; but we also have noType with no type
    // Expect a line for noType with type 'any'
    expect(text).toMatch(/noType\*? \(any\):/); // noType is not required but still type fallback
    // Check that property missing description: noDesc has type but no description, desc should be empty
    // The line will be like "  noDesc (string): " (empty desc). So colon followed immediately by nothing or spaces.
    expect(text).toMatch(/noDesc \(string\):\s*$/);
    // Ensure Examples section is absent because examples is empty array
    expect(text).not.toContain('Examples:');
  });
});
