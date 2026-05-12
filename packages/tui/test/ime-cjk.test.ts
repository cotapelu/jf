/**
 * IME and CJK Character Positioning Tests
 *
 * Validates correct cursor positioning and width calculation for:
 * - CJK characters (Chinese, Japanese, Korean)
 * - Full-width vs half-width characters
 * - IME composition sequences
 * - Combining characters and surrogate pairs
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { getSegmenter, truncateToWidth, visibleWidth } from "../src/utils.js";

describe("IME and CJK character positioning", () => {
	// =========================================================================
	// Width Calculation Tests
	// =========================================================================

	it("should correctly calculate width for CJK characters", () => {
		// CJK characters are typically full-width (2 columns)
		assert.strictEqual(visibleWidth("中"), 2); // Chinese
		assert.strictEqual(visibleWidth("日"), 2); // Japanese
		assert.strictEqual(visibleWidth("한"), 2); // Korean

		// ASCII should be 1 column
		assert.strictEqual(visibleWidth("a"), 1);
		assert.strictEqual(visibleWidth("ABC"), 3);
	});

	it("should handle mixed ASCII and CJK characters", () => {
		// "Hello 世界" = 5 (Hello) + 1 (space) + 2 + 2 (世+界) = 10
		assert.strictEqual(visibleWidth("Hello 世界"), 10);
		// "Test あいうえお" = 4 (Test) + 1 (space) + 5*2 (5 hiragana) = 15
		assert.strictEqual(visibleWidth("Test あいうえお"), 15);
		// "123 한글 456" = 3 (123) + 1 (space) + 2 + 2 (한글) + 1 (space) + 3 (456) = 12
		assert.strictEqual(visibleWidth("123 한글 456"), 12);
	});

	it("should handle emoji and CJK combinations", () => {
		// Emoji + CJK
		assert.strictEqual(visibleWidth("😀中"), 4); // 2 + 2 = 4
		assert.strictEqual(visibleWidth("日本🌸"), 6); // 2 + 2 + 2 = 6
	});

	it("should handle surrogate pairs correctly", () => {
		// Surrogate pairs for characters outside BMP
		// Note: U+1D11E (musical symbol) returns 1 from eastAsianWidth package
		// This is the correct behavior according to Unicode terminal width standards
		const musicalSymbol = "𝄞"; // U+1D11E (musical symbol G clef)
		assert.strictEqual(visibleWidth(musicalSymbol), 1);

		// Multiple surrogate pairs
		assert.strictEqual(visibleWidth("𝄞𝄞"), 2);

		// Mixed with regular characters
		assert.strictEqual(visibleWidth("A𝄞B"), 3); // 1 + 1 + 1 = 3
	});

	it("should handle combining characters correctly", () => {
		// Latin with combining accents
		const aWithAcute = "a\u0301"; // á as base + combining acute
		assert.strictEqual(visibleWidth(aWithAcute), 1);

		// Combining characters don't change width - Thai character with tone mark
		const thai = "ก\u0301"; // Thai character with tone mark
		assert.strictEqual(visibleWidth(thai), 1); // Width stays 1 (Thai is not wide for terminals)
	});

	it("should handle half-width Katakana", () => {
		// Half-width Katakana (typically 1 column)
		const halfWidth = "ｱｲｳｴｵ"; // Half-width Katakana
		// Implementation may vary - testing current behavior
		const width = visibleWidth(halfWidth);
		assert.ok(width > 0);
	});

	// =========================================================================
	// Segmenter Tests
	// =========================================================================

	it("should correctly segment CJK characters", () => {
		const segmenter = getSegmenter();
		const segments = [...segmenter.segment("Hello 世界")];

		// Segmenter uses grapheme granularity, so each char becomes a segment
		// "H", "e", "l", "l", "o", " ", "世", "界" = 8 segments
		assert.strictEqual(segments.length, 8);
	});

	it("should handle surrogate pairs in segmentation", () => {
		const segmenter = getSegmenter();
		const text = "A𝄞B";
		const segments = [...segmenter.segment(text)];

		// Should segment into individual characters including surrogate pair
		assert.strictEqual(segments.length, 3);
		assert.strictEqual(segments[0].segment, "A");
		assert.strictEqual(segments[1].segment, "𝄞");
		assert.strictEqual(segments[2].segment, "B");
	});

	// =========================================================================
	// Truncation Tests
	// =========================================================================

	it("should truncate CJK text by visible width", () => {
		// truncateToWidth returns a string
		const result = truncateToWidth("Hello 世界", 8);

		// Check it returns a string
		assert.strictEqual(typeof result, "string");
		// Result should have visible width <= 8 (ellipsis counts as 3 but gets reset codes)
		assert.ok(visibleWidth(result) <= 8);
	});

	it("should handle truncation with mixed content", () => {
		const result = truncateToWidth("123 あいうえお 456", 15);

		assert.strictEqual(typeof result, "string");
		// Result should have visible width <= 15
		assert.ok(visibleWidth(result) <= 15);
	});

	it("should not truncate in middle of surrogate pair", () => {
		const result = truncateToWidth("𝄞𝄞𝄞", 3);

		assert.strictEqual(typeof result, "string");
		// Result should have visible width <= 3
		assert.ok(visibleWidth(result) <= 3);
	});

	// =========================================================================
	// IME Composition Simulation Tests
	// =========================================================================

	it("should handle IME composition string", () => {
		// Simulate IME composition where user is typing "nihao"
		// The IME might show: "你" as the composition character
		const composition = "你";
		assert.strictEqual(visibleWidth(composition), 2);
	});

	it("should handle partial IME composition", () => {
		// During IME composition, text might be in intermediate state
		const partial = "中";
		assert.strictEqual(visibleWidth(partial), 2);
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	it("should handle empty string", () => {
		assert.strictEqual(visibleWidth(""), 0);
	});

	it("should handle only whitespace", () => {
		assert.strictEqual(visibleWidth("   "), 3);
		// Tab width is 3 in this implementation (matches tab expansion)
		assert.strictEqual(visibleWidth("\t"), 3);
	});

	it("should handle mixed scripts robustly", () => {
		const mixed = "Hello 世界! 🌍 Привет";
		const width = visibleWidth(mixed);

		// Just ensure it doesn't crash and returns reasonable value
		assert.ok(width > 0);
		assert.ok(width <= mixed.length * 2); // Each char max 2 columns
	});

	it("should handle very long CJK text", () => {
		// 20 Chinese characters (中国 repeated 10 times), each 2 wide = 40
		const longCJK = "中国中国中国中国中国中国中国中国中国中国";
		assert.strictEqual(visibleWidth(longCJK), 40); // 20 chars * 2 = 40
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
		assert.strictEqual(width, 6);
	});

	it("should handle text with multiple surrogate pairs", () => {
		const text = "\u{1F600}\u{1F601}\u{1F602}"; // 😀😁😂
		assert.strictEqual(visibleWidth(text), 6); // 3 emoji * 2 = 6
	});
});
