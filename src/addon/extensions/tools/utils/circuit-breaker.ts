/**
 * Circuit Breaker Pattern
 *
 * Prevents cascade failures by stopping calls to an external service
 * after a threshold of failures is reached.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Fail fast, no requests allowed (for timeout period)
 * - HALF-OPEN: Allow limited requests to test if service recovered
 */

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  private readonly failureThreshold: number;
  private readonly timeoutMs: number;      // How long to stay OPEN before trying HALF-OPEN
  private readonly halfOpenMax: number;    // Max requests in HALF-OPEN before deciding

  constructor(options: {
    failureThreshold?: number;  // failures before open (default 5)
    timeoutMs?: number;         // reset timeout (default 60s)
    halfOpenMax?: number;       // max tries in half-open (default 1)
  } = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.timeoutMs = options.timeoutMs ?? 60 * 1000;
    this.halfOpenMax = options.halfOpenMax ?? 1;
  }

  async execute(fn: () => Promise<any>): Promise<any> {
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.timeoutMs) {
        this.state = 'half-open';
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    if (this.state === 'half-open' && this.failures >= this.halfOpenMax) {
      throw new Error('Circuit breaker is HALF-OPEN - too many failures');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'closed' && this.failures >= this.failureThreshold) {
      this.state = 'open';
    } else if (this.state === 'half-open') {
      // Any failure in half-open returns to open
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  isAvailable(): boolean {
    return this.state !== 'open';
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  timeoutMs?: number;
  halfOpenMax?: number;
}

export function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(options);
}
