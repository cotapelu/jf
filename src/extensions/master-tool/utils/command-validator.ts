#!/usr/bin/env node

/**
 * Command Validator
 *
 * Security & safety checks for command execution.
 * - Rate limiting
 * - Output size validation
 * - Prototype pollution detection
 * - Input size limits
 * - Schema validation using TypeBox
 */

import { Compile } from "typebox/compile";
import type { TSchema } from "typebox";
import type { CommandMetadata, CommandResult } from "../types/command-module.js";

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string[];
    message: string;
    schema?: any;
  }>;
}

export class CommandValidator {
  // Rate limiting: { commandName: { count: number, resetTime: number } }
  private rateLimits = new Map<string, { count: number; resetTime: number }>();
  private readonly rateLimitPerMinute: number;

  constructor(options: { rateLimitPerMinute?: number } = {}) {
    this.rateLimitPerMinute = options.rateLimitPerMinute ?? 0; // 0 = unlimited
  }

  /**
   * Check rate limit for command
   */
  checkRateLimit(commandName: string): { allowed: boolean; remaining?: number; resetIn?: number } {
    if (this.rateLimitPerMinute <= 0) {
      return { allowed: true };
    }

    const now = Date.now();
    const entry = this.rateLimits.get(commandName);

    if (!entry || now > entry.resetTime) {
      this.rateLimits.set(commandName, {
        count: 1,
        resetTime: now + 60 * 1000
      });
      return { allowed: true, remaining: this.rateLimitPerMinute - 1, resetIn: 60 };
    }

    if (entry.count >= this.rateLimitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.ceil((entry.resetTime - now) / 1000)
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.rateLimitPerMinute - entry.count,
      resetIn: Math.ceil((entry.resetTime - now) / 1000)
    };
  }

  /**
   * Validate args against TypeBox schema
   */
  validateWithSchema(args: any, schema: TSchema, commandName?: string): ValidationResult {
    try {
      const validator = Compile(schema);
      const ok = validator.Check(args);
      if (ok) {
        return { valid: true };
      }
      const errors = validator.Errors(args) as any[];
      const formatted = errors.map(e => ({
        path: e.path || [],
        message: e.message,
        schema: e.schema
      }));
      return { valid: false, errors: formatted };
    } catch (error: any) {
      return { valid: false, errors: [{ path: [], message: error?.message || "Validation error" }] };
    }
  }

  /**
   * Validate result (output size, etc.)
   */
  validateResult(result: CommandResult, maxSize: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const totalSize = (result.stdout?.length ?? 0) + (result.stderr?.length ?? 0);
    if (totalSize > maxSize) {
      errors.push(`Output too large: ${totalSize} bytes (max ${maxSize})`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Detect prototype pollution patterns
   */
  private hasPrototypePollution(obj: any): boolean {
    const visited = new WeakSet();
    const check = (o: any): boolean => {
      if (typeof o !== 'object' || o === null) return false;
      if (visited.has(o)) return false;
      visited.add(o);
      if (Object.prototype.hasOwnProperty.call(o, '__proto__')) return true;
      if (Object.prototype.hasOwnProperty.call(o, 'constructor')) return true;
      if (Object.prototype.hasOwnProperty.call(o, 'prototype')) return true;
      for (const v of Object.values(o)) {
        if (check(v)) return true;
      }
      return false;
    };
    return check(obj);
  }

  /**
   * Validate args security
   */
  validateSecurity(args: any, metadata: CommandMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.hasPrototypePollution(args)) {
      errors.push("Potential prototype pollution detected");
    }

    try {
      const jsonStr = JSON.stringify(args);
      if (jsonStr.length > 100 * 1024) {
        errors.push("Arguments too large (max 100KB)");
      }
    } catch {
      errors.push("Cannot serialize arguments");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Clear rate limits (for testing or admin)
   */
  clearRateLimits(): void {
    this.rateLimits.clear();
  }
}

// Singleton per validator instance
let globalValidator: CommandValidator | null = null;

export function getValidator(options?: { rateLimitPerMinute?: number }): CommandValidator {
  if (!globalValidator) {
    globalValidator = new CommandValidator(options);
  }
  return globalValidator;
}

export function resetValidator(): void {
  globalValidator = null;
}
