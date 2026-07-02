/**
 * UUID Action
 *
 * Generates a random UUID v4.
 */

export const uuidAction = {
  execute: async () => {
    const uuid = crypto.randomUUID();
    return {
      content: [{ type: "text", text: `Generated UUID: ${uuid}` }],
      details: { uuid },
    };
  },
  getParameters: () => ({ type: "object", properties: {} }),
};
