/**
 * Heat Score Algorithm
 * Calculates dynamic relevance score based on:
 * - Base weight (user-set importance)
 * - Access frequency (how often used)
 * - Recency (how recently accessed)
 */

export interface HeatScoreOptions {
	/** Weight multiplier for access frequency (default: 0.3) */
	frequencyFactor?: number;
	/** Weight multiplier for recency in days (default: 0.5) */
	recencyFactor?: number;
	/** Half-life in days for recency decay (default: 7) */
	recencyHalfLifeDays?: number;
}

/**
 * Calculate heat score for a memory
 * Score = weight * (1 + log(access_count + 1) * freq_factor) * recency_factor
 *
 * Recency factor uses exponential decay: 2^(-days / half_life)
 */
export function calculateHeatScore(
	weight: number,
	accessCount: number,
	lastAccessedAt: number, // timestamp in ms
	options: HeatScoreOptions = {},
): number {
	const { frequencyFactor = 0.3, recencyFactor = 0.5, recencyHalfLifeDays = 7 } = options;

	// Frequency component (log scale to prevent runaway)
	const frequencyComponent = 1 + Math.log(accessCount + 1) * frequencyFactor;

	// Recency component (exponential decay)
	const daysSinceAccess = (Date.now() - lastAccessedAt) / (1000 * 60 * 60 * 24);
	const recencyComponent = 2 ** (-daysSinceAccess / recencyHalfLifeDays) * recencyFactor + (1 - recencyFactor);

	// Final score
	const heat = weight * frequencyComponent * recencyComponent;

	return Math.max(0, Math.min(1, heat)); // Clamp to [0, 1]
}

/**
 * Update memory's access stats when retrieved
 */
export function updateAccessStats(
	accessCount: number,
	_lastAccessedAt: number,
): { access_count: number; last_accessed_at: number } {
	return {
		access_count: accessCount + 1,
		last_accessed_at: Date.now(),
	};
}
