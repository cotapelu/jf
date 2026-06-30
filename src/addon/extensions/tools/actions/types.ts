/**
 * Action interface
 *
 * Defines the structure of an action within the universal tool.
 */

export interface Action {
  /**
   * Execute the action with given parameters.
   * @param params - Action-specific parameters
   * @returns Tool result with content and optional details
   */
  execute: (params: any) => Promise<any>;

  /**
   * Optional: Return JSON Schema for this action's parameters.
   * If not provided, the action accepts any parameters (runtime validation still applies).
   */
  getParameters?: () => any;
}
