# Custom Component Examples for pi-tui

This directory contains examples demonstrating how to create custom UI components for the pi TUI framework.

## 📄 Examples

### 1. Progress Bar Component (`progress-bar.ts`)

A customizable progress bar with percentage display and animation support.

```typescript
import { Component, Container, Text } from "@quangtynu/pi-tui";

export class ProgressBar extends Container {
	constructor(
		private progress: number, // 0-100
		private width: number = 50,
		private showPercentage: boolean = true
	) {
		super(width, 1);
		this.updateDisplay();
	}

	setProgress(progress: number): void {
		this.progress = Math.max(0, Math.min(100, progress));
		this.updateDisplay();
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
```

### 2. Status Indicator Component (`status-indicator.ts`)

A color-coded status indicator with animated states.

```typescript
import { Component, Text } from "@quangtynu/pi-tui";
import { theme } from "../src/theme/theme.js";

type Status = 'idle' | 'loading' | 'success' | 'error' | 'warning';

export class StatusIndicator extends Component {
	private status: Status;
	private label: string;
	private frame: number = 0;

	constructor(status: Status, label: string) {
		super(20, 1);
		this.status = status;
		this.label = label;
		this.updateDisplay();
	}

	setStatus(status: Status): void {
		this.status = status;
		this.updateDisplay();
	}

	setLabel(label: string): void {
		this.label = label;
		this.updateDisplay();
	}

	animate(): void {
		this.frame = (this.frame + 1) % 4;
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.clear();
		
		const symbols = {
			idle: '○',
			loading: ['◜', '◝', '◞', '◟'][this.frame],
			success: '✓',
			error: '✗',
			warning: '⚠'
		};

		const colors = {
			idle: theme.fg('muted'),
			loading: theme.fg('accent'),
			success: theme.fg('success'),
			error: theme.fg('error'),
			warning: theme.fg('warning')
		};

		const symbol = symbols[this.status];
		const color = colors[this.status];
		
		const text = `${color(symbol)} ${this.label}`;
		this.addChild(new Text(text, 0, 0));
	}
}
```

### 3. Data Table Component (`data-table.ts`)

A scrollable table for displaying tabular data with sorting.

```typescript
import { Component, Container, Text, Spacer, matchesKey } from "@quangtynu/pi-tui";

interface Column {
	key: string;
	label: string;
	width: number;
	sortable?: boolean;
}

interface Row {
	[key: string]: string | number;
}

export class DataTable extends Container {
	private columns: Column[];
	private rows: Row[];
	private sortColumn: string | null = null;
	private sortDirection: 'asc' | 'desc' = 'asc';
	private scrollOffset: number = 0;
	private maxVisibleRows: number;

	constructor(
		columns: Column[],
		rows: Row[],
		maxVisibleRows: number = 10
	) {
		super(80, maxVisibleRows + 2);
		this.columns = columns;
		this.rows = rows;
		this.maxVisibleRows = maxVisibleRows;
		this.updateDisplay();
	}

	sortBy(columnKey: string): void {
		if (this.sortColumn === columnKey) {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortColumn = columnKey;
			this.sortDirection = 'asc';
		}
		
		this.rows.sort((a, b) => {
			const aVal = a[columnKey];
			const bVal = b[columnKey];
			
			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
			}
			
			return this.sortDirection === 'asc'
				? String(aVal).localeCompare(String(bVal))
				: String(bVal).localeCompare(String(aVal));
		});
		
		this.updateDisplay();
	}

	scrollDown(): void {
		const maxOffset = Math.max(0, this.rows.length - this.maxVisibleRows);
		this.scrollOffset = Math.min(this.scrollOffset + 1, maxOffset);
		this.updateDisplay();
	}

	scrollUp(): void {
		this.scrollOffset = Math.max(0, this.scrollOffset - 1);
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.clear();
		
		// Header
		let headerText = '';
		this.columns.forEach(col => {
			let label = col.label.padEnd(col.width);
			if (col.key === this.sortColumn) {
				label += this.sortDirection === 'asc' ? ' ↑' : ' ↓';
			}
			headerText += label;
		});
		
		this.addChild(new Text(headerText, 0, 0));
		this.addChild(new Text('─'.repeat(80), 0, 1));
		
		// Rows
		const visibleRows = this.rows.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleRows);
		visibleRows.forEach((row, index) => {
			let rowText = '';
			this.columns.forEach(col => {
				const value = String(row[col.key] || '');
				rowText += value.padEnd(col.width);
			});
			this.addChild(new Text(rowText, 0, index + 2));
		});
	}
}
```

### 4. Notification Component (`notification.ts`)

A toast-style notification system.

```typescript
import { Component, Container, Text } from "@quangtynu/pi-tui";
import { theme } from "../src/theme/theme.js";

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationOptions {
	type: NotificationType;
	message: string;
	duration?: number;
	onClose?: () => void;
}

export class Notification extends Container {
	private options: NotificationOptions;
	private visible: boolean = true;

	constructor(options: NotificationOptions) {
		super(options.message.length + 10, 3);
		this.options = { duration: 3000, ...options };
		this.updateDisplay();
		
		if (this.options.duration) {
			setTimeout(() => this.hide(), this.options.duration);
		}
	}

	hide(): void {
		this.visible = false;
		this.options.onClose?.();
	}

	private updateDisplay(): void {
		this.clear();
		
		if (!this.visible) return;
		
		const icons = {
			info: 'ℹ',
			success: '✓',
			warning: '⚠',
			error: '✗'
		};

		const colors = {
			info: theme.fg('info'),
			success: theme.fg('success'),
			warning: theme.fg('warning'),
			error: theme.fg('error')
		};

		const icon = icons[this.options.type];
		const color = colors[this.options.type];
		
		const text = `${color(icon)} ${this.options.message}`;
		this.addChild(new Text(text, 1, 1));
	}
}
```

### 5. Command Palette (`command-palette.ts`)

A fuzzy-search command palette inspired by VS Code.

```typescript
import { Component, Container, Input, Text, matchesKey } from "@quangtynu/pi-tui";
import { fuzzyFilter } from "@quangtynu/pi-tui";

interface Command {
	id: string;
	label: string;
	description: string;
	execute: () => void;
}

export class CommandPalette extends Container {
	private input: Input;
	private commands: Command[];
	private filteredCommands: Command[];
	private selectedIndex: number = 0;
	private visible: boolean = false;

	constructor(commands: Command[]) {
		super(60, 15);
		this.commands = commands;
		this.filteredCommands = commands;
		
		this.input = new Input({
			placeholder: 'Type a command...',
			onInput: (value) => this.filterCommands(value),
			onSubmit: () => this.executeSelected()
		});
		
		this.updateDisplay();
	}

	toggle(): void {
		this.visible = !this.visible;
		this.selectedIndex = 0;
		this.input.value = '';
		this.filterCommands('');
		this.updateDisplay();
	}

	private filterCommands(query: string): void {
		if (!query) {
			this.filteredCommands = this.commands;
		} else {
			this.filteredCommands = fuzzyFilter(this.commands, query, {
				getLabel: (cmd) => `${cmd.label} ${cmd.description}`
			});
		}
		this.selectedIndex = 0;
		this.updateDisplay();
	}

	private executeSelected(): void {
		const selected = this.filteredCommands[this.selectedIndex];
		if (selected) {
			selected.execute();
			this.visible = false;
		}
	}

	moveSelection(direction: 'up' | 'down'): void {
		if (!this.visible) return;
		
		if (direction === 'up') {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
		} else {
			this.selectedIndex = Math.min(
				this.filteredCommands.length - 1,
				this.selectedIndex + 1
			);
		}
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.clear();
		
		if (!this.visible) return;
		
		this.addChild(this.input);
		this.addChild(new Text('─'.repeat(60), 0, 1));
		
		const visibleCommands = this.filteredCommands.slice(0, 12);
		visibleCommands.forEach((cmd, index) => {
			const y = index + 2;
			const isSelected = index === this.selectedIndex;
			const prefix = isSelected ? '> ' : '  ';
			const text = `${prefix}${cmd.label} - ${cmd.description}`;
			
			this.addChild(new Text(text, 0, y));
		});
	}
}
```

## 📚 Usage Examples

### Using the Progress Bar

```typescript
import { ProgressBar } from './progress-bar.js';

const progressBar = new ProgressBar(0, 50, true);
container.addChild(progressBar);

// Update progress
for (let i = 0; i <= 100; i += 10) {
	setTimeout(() => progressBar.setProgress(i), i * 100);
}
```

### Using the Data Table

```typescript
import { DataTable } from './data-table.js';

const table = new DataTable(
	[
		{ key: 'name', label: 'Name', width: 20, sortable: true },
		{ key: 'size', label: 'Size', width: 10, sortable: true },
		{ key: 'modified', label: 'Modified', width: 20, sortable: true }
	],
	[
		{ name: 'file1.txt', size: '1.2 KB', modified: '2024-01-15' },
		{ name: 'document.pdf', size: '2.5 MB', modified: '2024-01-14' }
	]
);

container.addChild(table);
```

### Using the Notification System

```typescript
import { Notification } from './notification.js';

const notification = new Notification({
	type: 'success',
	message: 'File saved successfully!',
	duration: 3000,
	onClose: () => console.log('Notification closed')
});

container.addChild(notification);
```

## 🎨 Integration with pi-tui

All components are designed to work seamlessly with the pi-tui framework:

```typescript
import { TUI } from '@quangtynu/pi-tui';
import { ProgressBar } from './progress-bar.js';

const tui = new TUI();
const progressBar = new ProgressBar(0);

tui.container.addChild(progressBar);
tui.start();
```

## 📦 Component Properties

### Common Properties

All components support:
- `x`, `y`: Position
- `width`, `height`: Dimensions
- `visible`: Visibility toggle
- `updateDisplay()`: Manual refresh
- `clear()`: Clear content

### Styling

Components integrate with the theme system:

```typescript
import { theme } from '@quangtynu/pi-tui';

// Use theme colors
theme.fg('success')  // Green
theme.fg('error')    // Red
theme.bg('muted')    // Background
```

## 🧪 Testing Components

```typescript
import { TUI } from '@quangtynu/pi-tui';
import { ProgressBar } from './progress-bar.js';

const tui = new TUI();
const progressBar = new ProgressBar(0);

tui.container.addChild(progressBar);

// Test updates
progressBar.setProgress(50);
// Should display: ███████████████████████░░░░░░░░░░ 50.0%
```

## 🔗 Related Resources

- [pi-tui Documentation](../../packages/tui/README.md)
- [Custom Extension Examples](../custom-extension/README.md)
- [TUI Component Examples](../../packages/tui/src/components/)

---

**Last Updated**: 2026-05-07  
**Version**: 1.0.0