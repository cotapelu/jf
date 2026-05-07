import { Component, Text } from "@quangtynu/pi-tui";

type Status = 'idle' | 'loading' | 'success' | 'error' | 'warning';

/**
 * A color-coded status indicator with animated states
 */
export class StatusIndicator extends Component {
	private status: Status;
	private label: string;
	private frame: number = 0;
	private animationInterval: NodeJS.Timeout | null = null;

	constructor(status: Status, label: string) {
		super(30, 1);
		this.status = status;
		this.label = label;
		this.updateDisplay();
		
		if (status === 'loading') {
			this.startAnimation();
		}
	}

	/**
	 * Update the status and refresh display
	 * @param status - New status value
	 */
	setStatus(status: Status): void {
		this.status = status;
		
		if (status === 'loading' && !this.animationInterval) {
			this.startAnimation();
		} else if (status !== 'loading' && this.animationInterval) {
			this.stopAnimation();
		}
		
		this.updateDisplay();
	}

	/**
	 * Update the label text
	 * @param label - New label text
	 */
	setLabel(label: string): void {
		this.label = label;
		this.updateDisplay();
	}

	/**
	 * Start loading animation
	 */
	private startAnimation(): void {
		this.animationInterval = setInterval(() => {
			this.frame = (this.frame + 1) % 4;
			this.updateDisplay();
		}, 200) as unknown as NodeJS.Timeout;
	}

	/**
	 * Stop loading animation
	 */
	private stopAnimation(): void {
		if (this.animationInterval) {
			clearInterval(this.animationInterval);
			this.animationInterval = null;
		}
	}

	private updateDisplay(): void {
		this.clear();
		
		const symbols = {
			idle: '○',
			loading: ['◜', '◝', '◞', '◟'][this.frame] || '◜',
			success: '✓',
			error: '✗',
			warning: '⚠'
		} as const;

		const getColor = (status: Status): string => {
			switch (status) {
				case 'idle': return '\x1b[90m'; // dim
				case 'loading': return '\x1b[36m'; // cyan
				case 'success': return '\x1b[32m'; // green
				case 'error': return '\x1b[31m'; // red
				case 'warning': return '\x1b[33m'; // yellow
			}
		};

		const reset = '\x1b[0m';
		const color = getColor(this.status);
		const symbol = symbols[this.status];
		
		const text = `${color}${symbol}${reset} ${this.label}`;
		this.addChild(new Text(text, 0, 0));
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.stopAnimation();
	}
}
