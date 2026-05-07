import { Component, Container, Text } from "@quangtynu/pi-tui";

/**
 * A customizable progress bar component with percentage display
 */
export class ProgressBar extends Container {
	constructor(
		private progress: number, // 0-100
		private width: number = 50,
		private showPercentage: boolean = true
	) {
		super(width, 1);
		this.updateDisplay();
	}

	/**
	 * Update the progress value and refresh display
	 * @param progress - Progress percentage (0-100)
	 */
	setProgress(progress: number): void {
		this.progress = Math.max(0, Math.min(100, progress));
		this.updateDisplay();
	}

	/**
	 * Get current progress value
	 * @returns Current progress percentage
	 */
	getProgress(): number {
		return this.progress;
	}

	private updateDisplay(): void {
		this.clear();
		
		const filled = Math.floor((this.progress / 100) * this.width);
		const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled);
		
		const text = this.showPercentage 
			? `${bar} ${this.progress.toFixed(1)}%`
			: bar;
		
		this.addChild(new Text(text, 0, 0));
	}
}
