import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

/**
 * Get Time Tool
 *
 * Returns current time in specified timezone.
 */
export const getTimeTool: ToolDefinition = {
  name: 'get_time',
  label: 'Get Time',
  description: "Get current time in ISO format. timezone param: 'UTC', 'Asia/Ho_Chi_Minh', etc.",
  promptSnippet: 'get_time: get current time in a timezone',
  promptGuidelines: [
    'Use this tool when the user asks for the current time, timezone conversion, or time-related queries.',
    "Specify a timezone like 'UTC', 'Asia/Ho_Chi_Minh', or 'America/New_York'.",
    'If no timezone is specified, it defaults to UTC.',
  ],
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: "Timezone identifier (e.g., 'UTC', 'Asia/Ho_Chi_Minh', 'America/New_York')",
      },
    },
  },
  async execute(
    _toolCallId: string,
    params: { timezone?: string },
    _signal?: AbortSignal,
    _onUpdate?: (result: any) => void,
    _ctx?: any
  ) {
    try {
      const now = new Date();
      const timezone = params.timezone || 'UTC';
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      };
      const formatted = now.toLocaleString('en-CA', options).replace(',', '');
      return {
        content: [{ type: 'text', text: `Current time in ${timezone}: ${formatted}` }],
        details: { timestamp: now.toISOString() },
      };
    } catch (err) {
      return {
        content: [
          { type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
        details: {},
      };
    }
  },
};
