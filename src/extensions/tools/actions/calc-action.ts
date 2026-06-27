/**
 * Calc Action
 *
 * Evaluates a basic math expression safely WITHOUT using eval().
 * Uses a custom recursive descent parser with proper operator precedence.
 * Supports: + - * / operators, parentheses, integer/float numbers
 * Maximum safety: no dynamic code execution
 */

export const calcAction = {
  execute: async (params: { expression: string }) => {
    const result = safeEvaluate(params.expression);
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

// ============================================================================
// Safe Math Expression Evaluator
// ============================================================================

interface Token {
  type: 'number' | 'operator';
  value: number | string;
  precedence: number;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const precedence: Record<string, number> = { '*': 2, '/': 2, '+': 1, '-': 1 };
  
  while (i < expr.length) {
    const char = expr[i];
    
    // Skip whitespace
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      i++;
      continue;
    }
    
    // Number (integer or float)
    if ((char >= '0' && char <= '9') || char === '.') {
      let numStr = '';
      let hasDecimal = false;
      while (i < expr.length) {
        const c = expr[i];
        if (c >= '0' && c <= '9') {
          numStr += c;
          i++;
        } else if (c === '.' && !hasDecimal) {
          hasDecimal = true;
          numStr += c;
          i++;
        } else {
          break;
        }
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) throw new Error(`Invalid number: ${numStr}`);
      tokens.push({ type: 'number', value: num, precedence: 0 });
      continue;
    }
    
    // Operator
    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'operator', value: char, precedence: precedence[char] });
      i++;
      continue;
    }
    
    // Parentheses
    if (char === '(' || char === ')') {
      tokens.push({ type: 'operator', value: char, precedence: char === '(' ? 3 : -1 });
      i++;
      continue;
    }
    
    throw new Error(`Invalid character: '${char}' at position ${i}`);
  }
  
  return tokens;
}

// Shunting-yard: convert infix to RPN (postfix)
function toRPN(tokens: Token[]): number[] {
  const output: number[] = [];
  const operators: Token[] = [];
  
  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token.value as number);
    } else if (token.value === '(') {
      operators.push(token);
    } else if (token.value === ')') {
      // Pop until '('
      while (operators.length > 0 && operators[operators.length - 1].value !== '(') {
        output.push(operators.pop()!.precedence);
      }
      if (operators.length === 0) throw new Error('Mismatched parentheses');
      operators.pop(); // Remove '('
    } else {
      // operator + - * /
      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.value === '(') break;
        if (top.precedence >= token.precedence) {
          output.push(operators.pop()!.precedence);
        } else {
          break;
        }
      }
      operators.push(token);
    }
  }
  
  // Drain remaining
  while (operators.length > 0) {
    const op = operators.pop()!;
    if (op.value === '(' || op.value === ')') throw new Error('Mismatched parentheses');
    output.push(op.precedence);
  }
  
  return output;
}

// Evaluate RPN stack
function evaluateRPN(rpn: number[]): number {
  const stack: number[] = [];
  
  for (const token of rpn) {
    if (token >= 0) {
      stack.push(token);
    } else {
      // Map precedence back to operator
      const operators = ['+', '-', '*', '/'];
      const operator = operators[-token - 1]!;
      if (stack.length < 2) throw new Error('Insufficient operands');
      const b = stack.pop()!;
      const a = stack.pop()!;
      let result: number;
      
      switch (operator) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': 
          if (b === 0) throw new Error('Division by zero');
          result = a / b; 
          break;
        default: throw new Error(`Unknown operator: ${operator}`);
      }
      
      stack.push(result);
    }
  }
  
  if (stack.length !== 1) throw new Error('Invalid expression');
  return stack[0];
}

function safeEvaluate(expression: string): number {
  if (!expression || typeof expression !== 'string') {
    throw new Error('Expression must be a non-empty string');
  }
  
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new Error('Expression cannot be empty');
  }
  
  // Allowed chars: digits, operators, parentheses, decimal point, whitespace
  if (!/^[0-9+\-*/().\s]+$/.test(trimmed)) {
    throw new Error('Invalid expression. Only numbers, operators (+, -, *, /), parentheses, and decimal points allowed.');
  }
  
  // Check for consecutive operators (simple heuristic)
  if (/[+\-*/]{2,}/.test(trimmed.replace(/[()\s]/g, ''))) {
    throw new Error('Invalid expression: consecutive operators');
  }
  
  // Tokenize
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw new Error('Empty expression');
  
  // Convert to RPN
  const rpn = toRPN(tokens);
  
  // Evaluate
  const result = evaluateRPN(rpn);
  
  // Validate result
  if (!isFinite(result) || isNaN(result)) {
    throw new Error('Calculation resulted in invalid number');
  }
  
  return result;
}
