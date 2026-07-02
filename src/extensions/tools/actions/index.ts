/**
 * Actions Index
 *
 * Re-exports all actions and provides the unified actions registry.
 */

export { echoAction } from "./echo-action.js";
export { systemInfoAction } from "./system-info-action.js";
export { dateAction } from "./date-action.js";
export { uuidAction } from "./uuid-action.js";
export { randomAction } from "./random-action.js";
export { calcAction } from "./calc-action.js";

import type { Action } from "./types.js";
import { echoAction } from "./echo-action.js";
import { systemInfoAction } from "./system-info-action.js";
import { dateAction } from "./date-action.js";
import { uuidAction } from "./uuid-action.js";
import { randomAction } from "./random-action.js";
import { calcAction } from "./calc-action.js";

/**
 * Registry of all available actions for the universal tool.
 * This object maps action names to their implementations.
 *
 * Add new actions here following the pattern:
 *   newActionName: newActionObject
 */
export const actions: Record<string, Action> = {
  echo: echoAction,
  system_info: systemInfoAction,
  date: dateAction,
  uuid: uuidAction,
  random: randomAction,
  calc: calcAction,
};
