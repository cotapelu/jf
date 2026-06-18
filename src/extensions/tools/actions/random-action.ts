/**
 * Random Action
 *
 * Generates a random integer within an optional range.
 */

export const randomAction = {
  execute: async (params: { min?: number; max?: number }) => {
    const min = params.min ?? 0;
    const max = params.max ?? 100;
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    return {
      content: [{ type: "text", text: `Random number: ${num} (range: ${min}-${max})` }],
      details: { value: num, min, max },
    };
  },
  getParameters: () => ({
    type: "object",
    properties: {
      min: { type: "number", description: "Minimum value (inclusive, default: 0)" },
      max: { type: "number", description: "Maximum value (inclusive, default: 100)" }
    },
    required: [],
  }),
};
