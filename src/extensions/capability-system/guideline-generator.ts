#!/usr/bin/env node
/**
 * Smart Guideline Generator
 *
 * Tự động sinh prompt guidelines chất lượng cao từ TypeBox schema.
 * Không cần manual write guidelines cho từng capability.
 */

// ============================================================================
// TYPES
// ============================================================================

interface GeneratedGuidelines {
  parameters: string[];
  examples: string[];
  returns?: string[];
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate comprehensive guidelines from schema.
 * 
 * @param capabilityId - Full ID (e.g., "dev.test")
 * @param inputSchema - TypeBox input schema (plain object)
 * @param outputSchema - Optional output schema
 * @param customGuidelines - Additional custom guidelines from manifest (preserved)
 * @returns Array of guideline strings ready for promptGuidelines
 */
export function generateCapabilityGuidelines(
  capabilityId: string,
  inputSchema: any,
  outputSchema?: any,
  customGuidelines: string[] = []
): string[] {
  const generated = generateFromSchema(capabilityId, inputSchema, outputSchema);
  
  // Merge: custom first, then auto-generated
  return [
    ...customGuidelines,
    ...generated.parameters,
    "",
    ...generated.examples,
    ...(generated.returns ? ["", ...generated.returns] : [])
  ].filter(line => line !== ""); // Remove empty lines
}

// ============================================================================
// SCHEMA PROCESSING
// ============================================================================

function generateFromSchema(
  capabilityId: string,
  inputSchema: any,
  outputSchema?: any
): GeneratedGuidelines {
  const paramsSection = generateParametersSection(inputSchema);
  const examples = generateExamples(capabilityId, inputSchema);
  const returns = outputSchema ? generateReturnsSection(outputSchema) : undefined;

  return {
    parameters: paramsSection,
    examples,
    returns
  };
}

function generateParametersSection(schema: any): string[] {
  const lines: string[] = ["Parameters:"];

  if (schema.type !== "object" || !schema.properties) {
    lines.push("  (No structured parameters)");
    return lines;
  }

  const props = schema.properties as Record<string, any>;
  const required = schema.required || [];

  for (const [key, prop] of Object.entries(props)) {
    lines.push(...processProperty(key, prop, required));
  }

  return lines;
}

function processProperty(key: string, prop: any, required: string[]): string[] {
  const type = prop.type || "any";
  const description = prop.description || "";
  const isRequired = required.includes(key);
  const reqTag = isRequired ? "[Required]" : "[Optional]";
  const typeStr = formatType(type);
  const example = getExampleValue(prop);
  const exampleStr = example !== undefined ? `Example: \`${JSON.stringify(example)}\`` : "";
  const result: string[] = [`  • \`${key}\` (${typeStr}) ${reqTag} ${description}`];
  if (exampleStr) result.push(`    ${exampleStr}`);
  return result;
}

function generateExamples(capabilityId: string, schema: any): string[] {
  const lines: string[] = ["Examples:"];

  if (schema.type !== "object" || !schema.properties) {
    lines.push(`  • Minimal: { "capability": "${capabilityId}", "params": {} }`);
    return lines;
  }

  const props = schema.properties as Record<string, any>;
  const required = schema.required || [];

  lines.push(buildMinimalExample(capabilityId, props, required));
  const fullExample = buildFullExample(capabilityId, props);
  if (fullExample) lines.push(fullExample);
  lines.push(...generateVariations(capabilityId, props, required));

  return lines;
}

function buildMinimalExample(capabilityId: string, props: Record<string, any>, required: string[]): string {
  const minimalParams: Record<string, any> = {};
  for (const key of required) {
    if (props[key]) {
      minimalParams[key] = getExampleValue(props[key]);
    }
  }
  return `  • Minimal: ${JSON.stringify({ capability: capabilityId, params: minimalParams })}`;
}

function buildFullExample(capabilityId: string, props: Record<string, any>): string | null {
  const fullParams: Record<string, any> = {};
  for (const [key, prop] of Object.entries(props)) {
    fullParams[key] = getExampleValue(prop);
  }
  if (Object.keys(fullParams).length === 0) return null;
  return `  • Full: ${JSON.stringify({ capability: capabilityId, params: fullParams })}`;
}

function generateVariations(
  capabilityId: string,
  props: Record<string, any>,
  required: string[]
): string[] {
  const variations: string[] = [];
  for (const [key, prop] of Object.entries(props)) {
    if (required.includes(key)) continue;
    const type = prop.type;
    if (!type) continue;
    variations.push(...processVariationForProp(capabilityId, key, prop, type));
  }
  return variations.slice(0, 3);
}

function processVariationForProp(capabilityId: string, key: string, prop: any, type: any): string[] {
  const result: string[] = [];
  if (type === "boolean") {
    result.push(`  • With ${key}=true: { "capability": "${capabilityId}", "params": { "${key}": true } }`);
    result.push(`  • With ${key}=false: { "capability": "${capabilityId}", "params": { "${key}": false } }`);
  } else if (type === "array") {
    result.push(`  • With ${key}=["item1", "item2"]: { "capability": "${capabilityId}", "params": { "${key}": ["item1", "item2"] } }`);
  } else if (type === "string" && prop.enum) {
    const exampleVal = prop.enum[0];
    result.push(`  • With ${key}="${exampleVal}": { "capability": "${capabilityId}", "params": { "${key}": "${exampleVal}" } }`);
  }
  return result;
}

function generateReturnsSection(schema: any): string[] {
  const lines: string[] = ["Returns:"];
  
  if (schema.type !== "object" || !schema.properties) {
    lines.push("  Returns a result object with content, details, and isError fields.");
    return lines;
  }

  const props = schema.properties as Record<string, any>;
  
  for (const [key, prop] of Object.entries(props)) {
    const type = prop.type || "any";
    const description = prop.description || "";
    lines.push(`  • \`${key}\` (${type}): ${description}`);
  }

  lines.push("");
  lines.push("Standard fields always present:");
  lines.push("  • \`content\`: Array of {type, text/url} responses");
  lines.push("  • \`isError\`: boolean indicating success/failure");
  lines.push("  • \`details\`: Additional context object");

  return lines;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatType(type: any): string {
  if (typeof type === "string") return type;
  if (Array.isArray(type)) return type.join(" | ");
  if (type === null) return "null";
  return JSON.stringify(type);
}

function getExampleValue(prop: any, parentDescription: string = ""): any {
  if (prop.example !== undefined) return prop.example;
  if (prop.default !== undefined) return prop.default;
  const description = prop.description || parentDescription;
  const type = prop.type;
  const handlers: Record<string, () => any> = {
    string: () => getStringExample(prop, description),
    number: () => 0,
    boolean: () => getBooleanExample(description),
    array: () => getArrayExample(prop, description),
    object: () => (prop.properties ? getObjectExample(prop, description) : undefined)
  };
  const handler = handlers[type];
  if (handler) return handler();
  return undefined;
}

function getStringExample(prop: any, description: string): any {
  // Try enum first
  if (prop.enum && prop.enum.length > 0) return prop.enum[0];

  const lowerDesc = description.toLowerCase();
  const patterns: Array<{ keywords: string[]; example: any }> = [
    { keywords: ['file', 'path', '.ts', '.js'], example: 'src/example.test.ts' },
    { keywords: ['name'], example: 'example' },
    { keywords: ['url', 'link', 'http'], example: 'https://example.com' },
    { keywords: ['email'], example: 'user@example.com' },
    { keywords: ['directory', 'folder'], example: './src' },
    { keywords: ['branch'], example: 'main' },
    { keywords: ['commit'], example: 'HEAD' }
  ];

  for (const { keywords, example } of patterns) {
    if (keywords.some(k => lowerDesc.includes(k))) {
      return example;
    }
  }
  return 'example';
}

function getBooleanExample(description: string): boolean {
  // Common boolean defaults from description
  if (description.includes("enable") || description.includes("watch") || description.includes("verbose")) return true;
  if (description.includes("dry run") || description.includes("quiet")) return false;
  return false;
}

function getArrayExample(prop: any, parentDescription: string): any[] {
  const items = prop.items;
  if (items) {
    const itemExample = getExampleValue(items, parentDescription);
    return [itemExample];
  }
  return [];
}

function getObjectExample(prop: any, parentDescription: string): Record<string, any> {
  const objExample: Record<string, any> = {};
  for (const [k, p] of Object.entries(prop.properties)) {
    objExample[k] = getExampleValue(p, parentDescription);
  }
  return objExample;
}

// ============================================================================
// EXPORT
// ============================================================================

export function extractMinimalParams(schema: any): Record<string, any> {
  if (schema.type !== "object" || !schema.properties) return {};
  const props = schema.properties as Record<string, any>;
  const required = schema.required || [];
  const minimal: Record<string, any> = {};

  for (const key of required) {
    if (props[key]) {
      minimal[key] = getExampleValue(props[key]);
    }
  }

  return minimal;
}

export default generateCapabilityGuidelines;
export { getExampleValue };

