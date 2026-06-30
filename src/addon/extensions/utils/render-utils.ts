#!/usr/bin/env node

/**
 * Render Utilities
 *
 * Shared helper functions for creating styled TUI Text components
 * and styled strings to reduce duplication across renderers.
 */

import { Text } from "@earendil-works/pi-tui";

/**
 * Render an error message with error color styling.
 */
export function renderError(theme: any, message: string): Text {
  return new Text(theme.fg("error", message), 0, 0);
}

/**
 * Render a success message with success color styling.
 */
export function renderSuccess(theme: any, message: string): Text {
  return new Text(theme.fg("success", message), 0, 0);
}

/**
 * Render a muted/dimmed message.
 */
export function renderMuted(theme: any, message: string): Text {
  return new Text(theme.fg("muted", message), 0, 0);
}

/**
 * Render an accent-colored message.
 */
export function renderAccent(theme: any, message: string): Text {
  return new Text(theme.fg("accent", message), 0, 0);
}

/**
 * Render a warning-colored message.
 */
export function renderWarning(theme: any, message: string): Text {
  return new Text(theme.fg("warning", message), 0, 0);
}

/**
 * Inline styled string helpers for embedding in larger text blocks.
 * These return the styled string directly (no Text wrapper).
 */
export function styleError(theme: any, message: string): string {
  return theme.fg("error", message);
}

export function styleSuccess(theme: any, message: string): string {
  return theme.fg("success", message);
}

export function styleMuted(theme: any, message: string): string {
  return theme.fg("muted", message);
}

export function styleAccent(theme: any, message: string): string {
  return theme.fg("accent", message);
}

export function styleWarning(theme: any, message: string): string {
  return theme.fg("warning", message);
}

export function styleText(theme: any, message: string): string {
  return theme.fg("text", message);
}
