/**
 * AgentMessageBus encapsulates message bus operations for a team.
 * Manages channels and message history. Thread safety via external lock.
 */
type Message = { from: string; content: string; timestamp: number };

/**
 * Simple message bus for team communication.
 * Each channel stores an array of messages.
 */
export class AgentMessageBus {
  private bus: Map<string, Message[]> = new Map();

  /**
   * Sends a message to a channel (optionally to a specific recipient).
   * In this simplified version, messages are broadcast to the channel.
   * @param channel - Channel name.
   * @param content - Message text.
   * @param _to - Optional recipient (currently unused, broadcast only).
   */
  sendMessage(channel: string, content: string, _to?: string): void {
    // Broadcast to channel
    this.publish(channel, "parent", content);
  }

  /**
   * Retrieves messages from a channel, optionally limited to the last N.
   * @param channel - Channel name.
   * @param limit - Maximum number of messages to return.
   * @returns Array of messages (oldest first, or last N if limit).
   */
  getMessages(channel: string, limit?: number): Message[] {
    const msgs = this.bus.get(channel) || [];
    return limit ? msgs.slice(-limit) : msgs;
  }

  /**
   * Publishes a message to a channel with a specific sender.
   * @param channel - Channel name.
   * @param from - Sender identifier.
   * @param content - Message text.
   */
  publish(channel: string, from: string, content: string): void {
    if (!this.bus.has(channel)) {
      this.bus.set(channel, []);
    }
    this.bus.get(channel)!.push({ from, content, timestamp: Date.now() });
  }

  /**
   * Clears all messages from all channels.
   * Used during team reset/initialize.
   */
  clear(): void {
    this.bus.clear();
  }

  /**
   * For debugging/diagnostic purposes: gets the entire bus state.
   * @returns Map of channel -> messages.
   */
  getState(): Map<string, Message[]> {
    return new Map(this.bus);
  }
}
