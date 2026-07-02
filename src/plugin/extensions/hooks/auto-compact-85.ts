/**
 * Auto-Compaction at 85% Context Usage
 *
 * Khi context usage vượt 85%, tự động chạy compaction.
 * Hook này chạy song song với auto-compaction mặc định của pi-coding-agent v0.78.0.
 */

const COMPACTION_THRESHOLD_PERCENT = 85;

export default function (pi: import("@earendil-works/pi-coding-agent").ExtensionAPI) {
  pi.on("turn_end", async (_event, ctx) => {
    const usage = ctx.getContextUsage();
    if (usage?.percent && usage.percent > COMPACTION_THRESHOLD_PERCENT) {
      ctx.compact();
    }
  });
}
