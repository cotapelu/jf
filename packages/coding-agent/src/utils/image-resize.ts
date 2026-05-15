import type { ImageContent } from "@earendil-works/pi-ai";
import { applyExifOrientation } from "./exif-orientation.js";
import { loadPhoton } from "./photon.js";

export interface ImageResizeOptions {
	maxWidth?: number;
	maxHeight?: number;
	maxBytes?: number;
	jpegQuality?: number;
}

export interface ResizedImage {
	data: string;
	mimeType: string;
	originalWidth: number;
	originalHeight: number;
	width: number;
	height: number;
	wasResized: boolean;
}

const DEFAULT_MAX_BYTES = 4.5 * 1024 * 1024;

const DEFAULT_OPTIONS: Required<ImageResizeOptions> = {
	maxWidth: 2000,
	maxHeight: 2000,
	maxBytes: DEFAULT_MAX_BYTES,
	jpegQuality: 80,
};

interface EncodedCandidate {
	data: string;
	encodedSize: number;
	mimeType: string;
}

function encodeCandidate(buffer: Uint8Array, mimeType: string): EncodedCandidate {
	const data = Buffer.from(buffer).toString("base64");
	return {
		data,
		encodedSize: Buffer.byteLength(data, "utf-8"),
		mimeType,
	};
}

function calculateTargetDimensions(
	originalWidth: number,
	originalHeight: number,
	maxWidth: number,
	maxHeight: number,
): { width: number; height: number } {
	let w = originalWidth;
	let h = originalHeight;
	if (w > maxWidth) {
		h = Math.round((h * maxWidth) / w);
		w = maxWidth;
	}
	if (h > maxHeight) {
		w = Math.round((w * maxHeight) / h);
		h = maxHeight;
	}
	return { width: w, height: h };
}

function tryEncoderAtSize(
	photon: any,
	image: any,
	width: number,
	height: number,
	jpegQualities: number[],
): EncodedCandidate[] {
	const resized = photon.resize(image, width, height, photon.SamplingFilter.Lanczos3);
	try {
		const candidates: EncodedCandidate[] = [encodeCandidate(resized.get_bytes(), "image/png")];
		for (const quality of jpegQualities) {
			candidates.push(encodeCandidate(resized.get_bytes_jpeg(quality), "image/jpeg"));
		}
		return candidates;
	} finally {
		resized.free();
	}
}

function tryFirstCandidate(
	photon: any,
	image: any,
	width: number,
	height: number,
	qualitySteps: number[],
	maxBytes: number,
): EncodedCandidate | null {
	const candidates = tryEncoderAtSize(photon, image, width, height, qualitySteps);
	for (const candidate of candidates) {
		if (candidate.encodedSize < maxBytes) return candidate;
	}
	return null;
}

function findNextSize(currentWidth: number, currentHeight: number): { width: number; height: number } | null {
	if (currentWidth === 1 && currentHeight === 1) return null;
	const nextWidth = currentWidth === 1 ? 1 : Math.max(1, Math.floor(currentWidth * 0.75));
	const nextHeight = currentHeight === 1 ? 1 : Math.max(1, Math.floor(currentHeight * 0.75));
	if (nextWidth === currentWidth && nextHeight === currentHeight) return null;
	return { width: nextWidth, height: nextHeight };
}

function encodeLoop(
	photon: any,
	image: any,
	startWidth: number,
	startHeight: number,
	qualitySteps: number[],
	maxBytes: number,
): EncodedCandidate | null {
	let current: { width: number; height: number } | null = { width: startWidth, height: startHeight };

	while (current) {
		const { width, height } = current;
		const candidate = tryFirstCandidate(photon, image, width, height, qualitySteps, maxBytes);
		if (candidate) return candidate;
		const next = findNextSize(width, height);
		current = next;
	}

	return null;
}

interface PreparedImage {
	photon: any;
	image: any;
	originalWidth: number;
	originalHeight: number;
	format: string;
	originalData: string;
}

async function prepareImage(img: ImageContent): Promise<PreparedImage | null> {
	const photon = await loadPhoton();
	if (!photon) return null;

	const inputBuffer = Buffer.from(img.data, "base64");
	const inputBytes = new Uint8Array(inputBuffer);
	const rawImage = photon.PhotonImage.new_from_byteslice(inputBytes);
	const image = applyExifOrientation(photon, rawImage, inputBytes);
	if (image !== rawImage) rawImage.free();

	return {
		photon,
		image,
		originalWidth: image.get_width(),
		originalHeight: image.get_height(),
		format: img.mimeType?.split("/")[1] ?? "png",
		originalData: img.data,
	};
}

function isWithinLimits(
	originalWidth: number,
	originalHeight: number,
	inputBase64Size: number,
	maxWidth: number,
	maxHeight: number,
	maxBytes: number,
): boolean {
	return originalWidth <= maxWidth && originalHeight <= maxHeight && inputBase64Size < maxBytes;
}

function createResizedResult(
	prepared: PreparedImage,
	candidate: EncodedCandidate,
	targetWidth: number,
	targetHeight: number,
): ResizedImage {
	return {
		data: candidate.data,
		mimeType: candidate.mimeType,
		originalWidth: prepared.originalWidth,
		originalHeight: prepared.originalHeight,
		width: targetWidth,
		height: targetHeight,
		wasResized: true,
	};
}

function processResize(
	prepared: PreparedImage,
	opts: Required<ImageResizeOptions>,
	inputBase64Size: number,
): ResizedImage | null {
	if (isWithinLimits(prepared.originalWidth, prepared.originalHeight, inputBase64Size, opts.maxWidth, opts.maxHeight, opts.maxBytes)) {
		return {
			data: prepared.originalData,
			mimeType: `image/${prepared.format}`,
			originalWidth: prepared.originalWidth,
			originalHeight: prepared.originalHeight,
			width: prepared.originalWidth,
			height: prepared.originalHeight,
			wasResized: false,
		};
	}

	const target = calculateTargetDimensions(prepared.originalWidth, prepared.originalHeight, opts.maxWidth, opts.maxHeight);
	const qualitySteps = Array.from(new Set([opts.jpegQuality, 85, 70, 55, 40]));
	const candidate = encodeLoop(prepared.photon, prepared.image, target.width, target.height, qualitySteps, opts.maxBytes);

	if (candidate) {
		return createResizedResult(prepared, candidate, target.width, target.height);
	}

	return null;
}

/**
 * Resize an image to fit within the specified max dimensions and encoded file size.
 * Returns null if the image cannot be resized below maxBytes.
 */
export async function resizeImage(img: ImageContent, options?: ImageResizeOptions): Promise<ResizedImage | null> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const inputBase64Size = Buffer.byteLength(img.data, "utf-8");
	const prepared = await prepareImage(img);
	if (!prepared) return null;

	try {
		return processResize(prepared, opts, inputBase64Size);
	} finally {
		prepared.image.free();
	}
}

/**
 * Format a dimension note for resized images.
 */
export function formatDimensionNote(result: ResizedImage): string | undefined {
	if (!result.wasResized) return undefined;
	const scale = result.originalWidth / result.width;
	return `[Image: original ${result.originalWidth}x${result.originalHeight}, displayed at ${result.width}x${result.height}. Multiply coordinates by ${scale.toFixed(2)} to map to original image.]`;
}
