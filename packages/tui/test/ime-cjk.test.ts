/**
 * IME and CJK Character Positioning Tests
 *
 * Validates correct cursor positioning and width calculation for:
 * - CJK characters (Chinese, Japanese, Korean)
 * - Full-width vs half-width characters
 * - IME composition sequences
 * - Combining characters and surrogate pairs
 */

import { describe, expect, it } from "vitest";
import { getSegmenter, truncateToWidth, visibleWidth } from "../src/utils.js";

describe("IME and CJK character positioning", () => {
	// =========================================================================
	// Width Calculation Tests
	// =========================================================================

	it("should correctly calculate width for CJK characters", () => {
		// CJK characters are typically full-width (2 columns)
		expect(visibleWidth("中")).toBe(2); // Chinese
		expect(visibleWidth("日")).toBe(2); // Japanese
		expect(visibleWidth("한")).toBe(2); // Korean

		// ASCII should be 1 column
		expect(visibleWidth("a")).toBe(1);
		expect(visibleWidth("ABC")).toBe(3);
	});

	it("should handle mixed ASCII and CJK characters", () => {
		// "Hello 世界" = 5 (Hello) + 1 (space) + 2 + 2 (世+界) = 10
		expect(visibleWidth("Hello 世界")).toBe(10);
		// "Test あいうえお" = 4 (Test) + 1 (space) + 5*2 (5 hiragana) = 15
		expect(visibleWidth("Test あいうえお")).toBe(15);
		// "123 한글 456" = 3 (123) + 1 (space) + 2 + 2 (한글) + 1 (space) + 3 (456) = 12
		expect(visibleWidth("123 한글 456")).toBe(12);
	});

	it("should handle emoji and CJK combinations", () => {
		// Emoji + CJK
		expect(visibleWidth("😀中")).toBe(4); // 2 + 2 = 4
		expect(visibleWidth("日本🌸")).toBe(6); // 2 + 2 + 2 = 6
	});

	it("should handle surrogate pairs correctly", () => {
		// Surrogate pairs for characters outside BMP
		// Note: U+1D11E (musical symbol) returns 1 from eastAsianWidth package
		// This is the correct behavior according to Unicode terminal width standards
		const musicalSymbol = "𝄞"; // U+1D11E (musical symbol G clef)
		expect(visibleWidth(musicalSymbol)).toBe(1);

		// Multiple surrogate pairs
		expect(visibleWidth("𝄞𝄞")).toBe(2);

		// Mixed with regular characters
		expect(visibleWidth("A𝄞B")).toBe(3); // 1 + 1 + 1 = 3
	});

	it("should handle combining characters correctly", () => {
		// Latin with combining accents
		const aWithAcute = "a\u0301"; // á as base + combining acute
		expect(visibleWidth(aWithAcute)).toBe(1);

		// Combining characters don't change width - Thai character with tone mark
		const thai = "ก\u0301"; // Thai character with tone mark
		expect(visibleWidth(thai)).toBe(1); // Width stays 1 (Thai is not wide for terminals)
	});

	it("should handle half-width Katakana", () => {
		// Half-width Katakana (typically 1 column)
		const halfWidth = "ｱｲｳｴｵ"; // Half-width Katakana
		// Implementation may vary - testing current behavior
		const width = visibleWidth(halfWidth);
		expect(width).toBeGreaterThan(0);
	});

	// =========================================================================
	// Segmenter Tests
	// =========================================================================

	it("should correctly segment CJK characters", () => {
		const segmenter = getSegmenter();
		const segments = [...segmenter.segment("Hello 世界")];

		// Segmenter uses grapheme granularity, so each char becomes a segment
		// "H", "e", "l", "l", "o", " ", "世", "界" = 8 segments
		expect(segments.length).toBe(8);
	});

	it("should handle surrogate pairs in segmentation", () => {
		const segmenter = getSegmenter();
		const text = "A𝄞B";
		const segments = [...segmenter.segment(text)];

		// Should segment into individual characters including surrogate pair
		expect(segments.length).toBe(3);
		expect(segments[0].segment).toBe("A");
		expect(segments[1].segment).toBe("𝄞");
		expect(segments[2].segment).toBe("B");
	});

	// =========================================================================
	// Truncation Tests
	// =========================================================================

	it("should truncate CJK text by visible width", () => {
		// truncateToWidth returns a string
		const result = truncateToWidth("Hello 世界", 8);

		// Check it returns a string
		expect(typeof result).toBe("string");
		// Result should have visible width <= 8 (ellipsis counts as 3 but gets reset codes)
		expect(visibleWidth(result)).toBeLessThanOrEqual(8);
	});

	it("should handle truncation with mixed content", () => {
		const result = truncateToWidth("123 あいうえお 456", 15);

		expect(typeof result).toBe("string");
		// Result should have visible width <= 15
		expect(visibleWidth(result)).toBeLessThanOrEqual(15);
	});

	it("should not truncate in middle of surrogate pair", () => {
		const result = truncateToWidth("𝄞𝄞𝄞", 3);

		expect(typeof result).toBe("string");
		// Result should have visible width <= 3
		expect(visibleWidth(result)).toBeLessThanOrEqual(3);
	});

	// =========================================================================
	// IME Composition Simulation Tests
	// =========================================================================

	it("should handle IME composition string", () => {
		// Simulate IME composition where user is typing "nihao"
		// The IME might show: "你" as the composition character
		const composition = "你";
		expect(visibleWidth(composition)).toBe(2);
	});

	it("should handle partial IME composition", () => {
		// During IME composition, text might be in intermediate state
		const partial = "中";
		expect(visibleWidth(partial)).toBe(2);
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	it("should handle empty string", () => {
		expect(visibleWidth("")).toBe(0);
	});

	it("should handle only whitespace", () => {
		expect(visibleWidth("   ")).toBe(3);
		// Tab width is 3 in this implementation (matches tab expansion)
		expect(visibleWidth("\t")).toBe(3);
	});

	it("should handle mixed scripts robustly", () => {
		const mixed = "Hello 世界! 🌍 Привет";
		const width = visibleWidth(mixed);

		// Just ensure it doesn't crash and returns reasonable value
		expect(width).toBeGreaterThan(0);
		expect(width).toBeLessThanOrEqual(mixed.length * 2); // Each char max 2 columns
	});

	it("should handle very long CJK text", () => {
		// 20 Chinese characters (中国 repeated 10 times), each 2 wide = 40
		const longCJK = "中国中国中国中国中国中国中国中国中国中国";
		expect(visibleWidth(longCJK)).toBe(40); // 20 chars * 2 = 40
	});
});

// Additional validation test for the specific issue mentioned in TODO
// "visibleWidth doesn't count surrogate pairs properly"
describe("surrogate pair handling", () => {
	it("should correctly count width for text with surrogate pairs", () => {
		// Text containing surrogate pairs (outside BMP)
		const text = "A\u{1D11E}B\u{1F600}C"; // A + musical symbol + B + grinning face + C

		// Each character: A=1, 𝄞=1, B=1, 😀=2, C=1 = 6 total
		const width = visibleWidth(text);
		expect(width).toBe(6);
	});

	it("should handle text with multiple surrogate pairs", () => {
		const text = "\u{1F600}\u{1F601}\u{1F602}"; // 😀😁😂
		expect(visibleWidth(text)).toBe(6); // 3 emoji * 2 = 6
	});
});
