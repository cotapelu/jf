/**
 * Date Action
 *
 * Returns current date/time in ISO and locale formats.
 */

export const dateAction = {
  execute: async () => {
    const now = new Date();
    return {
      content: [
        { type: "text", text: `Current date/time: ${now.toISOString()}` },
        { type: "text", text: `Human readable: ${now.toLocaleString()}` }
      ],
      details: { iso: now.toISOString(), timestamp: now.getTime(), locale: now.toLocaleString() },
    };
  },
  getParameters: () => ({ type: "object", properties: {} }),
};
