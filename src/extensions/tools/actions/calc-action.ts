/**
 * Calc Action
 *
 * Evaluates a basic math expression safely.
 */

export const calcAction = {
  execute: async (params: { expression: string }) => {
    const expr = params.expression.replace(/\s/g, '');
    // Simple validation: only digits, operators +-*/, parentheses, decimal points
    if (!/^[0-9+\-*/().]+$/.test(expr)) {
      throw new Error('Invalid expression. Only numbers and operators (+, -, *, /) allowed.');
    }
     
    const result = eval(expr);
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error('Invalid calculation result');
    }
    return {
      content: [{ type: "text", text: `${params.expression} = ${result}` }],
      details: { expression: params.expression, result },
    };
  },
  getParameters: () => ({
    type: "object",
    properties: {
      expression: { type: "string", description: "Math expression to evaluate (e.g., '2 + 3 * 4')" }
    },
    required: ['expression'],
  }),
};
