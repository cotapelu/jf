# BÁO CÁO CHI TIẾT - packages/tui/

## Tổng quan

Package `packages/tui/` là một thư viện TUI (Terminal User Interface) hoàn chỉnh với differential rendering, hỗ trợ nhiều thành phần UI, xử lý input phức tạp, và khả năng tùy chỉnh cao.

**Thống kê:**
- Tổng số file source: ~25 files
- Tổng số dòng code: ~8,000+ lines
- Số component: 12+ components
- Số utility: 10+ utilities

---

## 1. Core TUI System (tui.ts - 1255 lines)

### 1.1 Component Interface

```typescript
export interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```

**Đặc điểm:**
- Tất cả component phải implement interface này
- `render()` trả về array of strings (mỗi string là một dòng)
- `handleInput()` optional cho keyboard input
- `wantsKeyRelease` để nhận key release events (Kitty protocol)
- `invalidate()` để clear cache khi cần re-render

### 1.2 Focusable Interface

```typescript
export interface Focusable {
  focused: boolean;
}
```

**Đặc điểm:**
- Component có thể nhận focus
- Khi `focused = true`, component emit `CURSOR_MARKER` tại vị trí cursor
- TUI tìm marker này và position hardware cursor cho IME

### 1.3 TUI Class - Main Container

**Key Features:**

#### Differential Rendering
- Chỉ render những dòng thay đổi
- Tối ưu performance với synchronized output (`\x1b[?2026h` / `\x1b[?2026l`)
- Track `previousLines`, `previousWidth`, `previousHeight`
- Full render khi width/height thay đổi

#### Overlay System
```typescript
showOverlay(component: Component, options?: OverlayOptions): OverlayHandle
```

**Overlay Options:**
- `width`: absolute hoặc percentage (e.g., "50%")
- `minWidth`: minimum width
- `maxHeight`: maximum height
- `anchor`: position anchor (center, top-left, top-right, etc.)
- `offsetX`, `offsetY`: offset từ anchor
- `row`, `col`: absolute hoặc percentage position
- `margin`: margin từ terminal edges
- `visible`: callback để kiểm tra visibility
- `nonCapturing`: không capture keyboard focus

**Overlay Handle:**
- `hide()`: remove vĩnh viễn
- `setHidden()`: toggle visibility
- `focus()`, `unfocus()`: control focus
- `isFocused()`: check focus state

#### Focus Management
```typescript
setFocus(component: Component | null): void
```
- Auto manage focus state
- Restore focus khi overlay hide
- Support overlay stack với focus order

#### Cursor Positioning
```typescript
private positionHardwareCursor(cursorPos, totalLines): void
```
- Extract cursor position từ `CURSOR_MARKER`
- Move hardware cursor cho IME candidate window
- Track `hardwareCursorRow` separately từ logical cursor

#### Rendering Pipeline
1. Render tất cả components
2. Composite overlays vào base content
3. Extract cursor position
4. Apply line resets
5. Differential rendering:
   - Find first/last changed lines
   - Move cursor đến first changed line
   - Render changed lines
   - Clear extra lines nếu content shrunk

#### Debug Features
- `PI_TUI_DEBUG=1`: log render details
- `PI_DEBUG_REDRAW=1`: log redraw reasons
- `DEBUG_TUI=1`: console error debugging
- Crash log khi line width exceeds terminal width

---

## 2. Terminal Interface (terminal.ts - 360 lines)

### 2.1 Terminal Interface

```typescript
export interface Terminal {
  start(onInput, onResize): void;
  stop(): void;
  drainInput(maxMs?, idleMs?): Promise<void>;
  write(data: string): void;
  get columns(): number;
  get rows(): number;
  get kittyProtocolActive(): boolean;
  moveBy(lines: number): void;
  hideCursor(): void;
  showCursor(): void;
  clearLine(): void;
  clearFromCursor(): void;
  clearScreen(): void;
  setTitle(title: string): void;
}
```

### 2.2 ProcessTerminal Implementation

**Key Features:**

#### Raw Mode Setup
```typescript
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
process.stdin.resume();
```

#### Bracketed Paste Mode
```typescript
process.stdout.write("\x1b[?2004h"); // Enable
process.stdout.write("\x1b[?2004l"); // Disable
```
- Terminal wrap paste content với `\x1b[200~` ... `\x1b[201~`

#### Kitty Keyboard Protocol
```typescript
// Query support
process.stdout.write("\x1b[?u");

// Response: \x1b[?<flags>u

// Enable with flags
process.stdout.write("\x1b[>7u"); // Flag 1+2+4
```

**Flags:**
- Flag 1: disambiguate escape codes
- Flag 2: report event types (press/repeat/release)
- Flag 4: report alternate keys (shifted, base layout)

#### xterm modifyOtherKeys Fallback
```typescript
// Enable if Kitty protocol not supported
process.stdout.write("\x1b[>4;2m");
```

#### Windows VT Input Support
```typescript
// Enable ENABLE_VIRTUAL_TERMINAL_INPUT (0x0200)
// Required cho Shift+Tab và modified keys
```

#### StdinBuffer Integration
```typescript
private setupStdinBuffer(): void {
  this.stdinBuffer = new StdinBuffer({ timeout: 10 });
  this.stdinBuffer.on("data", (sequence) => {
    // Check Kitty protocol response
    // Forward to input handler
  });
  this.stdinBuffer.on("paste", (content) => {
    // Wrap với bracketed paste markers
  });
}
```

#### Input Draining
```typescript
async drainInput(maxMs = 1000, idleMs = 50): Promise<void> {
  // Disable Kitty protocol
  // Drain stdin để tránh key release leaks
  // Wait cho idleMs timeout hoặc maxMs max
}
```

**Use case:** Tránh Kitty key release events leaking vào parent shell qua slow SSH

#### Write Logging
```typescript
const writeLogPath = (() => {
  const env = process.env.PI_TUI_WRITE_LOG || "";
  // Create log file in directory hoặc use as file path
})();
```

---

## 3. Text Utilities (utils.ts - 1068 lines)

### 3.1 Grapheme Segmentation

```typescript
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function getSegmenter(): Intl.Segmenter {
  return segmenter;
}
```

**Đặc điểm:**
- Shared instance cho performance
- Support Unicode grapheme clusters (emojis, combining characters)

### 3.2 Visible Width Calculation

```typescript
export function visibleWidth(str: string): number
```

**Features:**
- Cache cho non-ASCII strings (512 entries)
- Normalize tabs → 3 spaces
- Strip ANSI escape codes
- Handle wide characters (CJK, emojis)
- Regional indicator symbols (flag emojis) = 2 width

**Width Calculation:**
```typescript
function graphemeWidth(segment: string): number {
  // Zero-width clusters
  if (zeroWidthRegex.test(segment)) return 0;

  // Emoji check với pre-filter
  if (couldBeEmoji(segment) && rgiEmojiRegex.test(segment)) return 2;

  // Regional indicators
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return 2;

  // East Asian width
  let width = eastAsianWidth(cp);

  // Trailing halfwidth/fullwidth forms
  if (segment.length > 1) {
    for (const char of segment.slice(1)) {
      if (c >= 0xff00 && c <= 0xffef) {
        width += eastAsianWidth(c);
      }
    }
  }

  return width;
}
```

### 3.3 ANSI Code Extraction

```typescript
export function extractAnsiCode(str: string, pos: number):
  { code: string; length: number } | null
```

**Supported Sequences:**
- CSI: `\x1b[...m/G/K/H/J`
- OSC: `\x1b]...BEL` hoặc `\x1b]...ESC\`
- APC: `\x1b_...BEL` hoặc `\x1b_...ESC\`

### 3.4 ANSI Code Tracker

```typescript
class AnsiCodeTracker {
  private bold, dim, italic, underline, blink, inverse, hidden, strikethrough;
  private fgColor, bgColor;

  process(ansiCode: string): void;
  getActiveCodes(): string;
  hasActiveCodes(): boolean;
  getLineEndReset(): string; // Reset underline only
}
```

**Features:**
- Track individual attributes separately
- Support 256-color và RGB colors
- `getLineEndReset()` chỉ reset underline (bleeds vào padding)

### 3.5 Text Wrapping

```typescript
export function wrapTextWithAnsi(text: string, width: number): string[]
```

**Features:**
- Word wrapping với ANSI codes preserved
- Active ANSI codes preserved across line breaks
- Handle long words với character-level wrapping
- Trim trailing whitespace

**Algorithm:**
1. Split input by newlines
2. Track ANSI state across lines
3. For each line:
   - Split into tokens (word boundaries)
   - Accumulate tokens until width exceeded
   - Break long tokens character-by-character
   - Apply line-end reset cho underline

### 3.6 Text Truncation

```typescript
export function truncateToWidth(
  text: string,
  maxWidth: number,
  ellipsis: string = "...",
  pad: boolean = false
): string
```

**Features:**
- Preserve ANSI codes
- Add ellipsis khi truncated
- Optional padding to exact width
- Handle tabs (→ 3 spaces)

**Algorithm:**
1. Fast path cho pure ASCII
2. Calculate target width = maxWidth - ellipsisWidth
3. Keep contiguous prefix until target width
4. Add ellipsis
5. Pad nếu requested

### 3.7 Column Slicing

```typescript
export function sliceByColumn(line: string, startCol: number, length: number, strict = false): string
export function sliceWithWidth(line: string, startCol: number, length: number, strict = false):
  { text: string; width: number }
```

**Features:**
- Extract range of visible columns
- Handle ANSI codes và wide chars
- `strict = true`: exclude wide chars at boundary

### 3.8 Segment Extraction

```typescript
export function extractSegments(
  line: string,
  beforeEnd: number,
  afterStart: number,
  afterLen: number,
  strictAfter = false
): { before, beforeWidth, after, afterWidth }
```

**Use case:** Overlay compositing - extract content before/after overlay region

**Features:**
- Single-pass optimized
- Preserve styling from before overlay
- Track ANSI state cho after segment

### 3.9 Background Application

```typescript
export function applyBackgroundToLine(line: string, width: number, bgFn: (text: string) => string): string
```

**Features:**
- Pad line to full width
- Apply background function
- Preserve existing ANSI codes

---

## 4. Keyboard Input Handling

### 4.1 Keys Module (keys.ts - referenced)

**Key Features:**
- Parse escape sequences
- Detect Kitty protocol
- Match key combinations
- Decode Kitty printable characters

### 4.2 Keybindings System (keybindings.ts - 244 lines)

#### Keybinding Definitions

```typescript
export interface KeybindingDefinition {
  defaultKeys: KeyId | KeyId[];
  description?: string;
}

export const TUI_KEYBINDINGS = {
  "tui.editor.cursorUp": { defaultKeys: "up", description: "Move cursor up" },
  "tui.editor.cursorLeft": { defaultKeys: ["left", "ctrl+b"], description: "Move cursor left" },
  // ... 30+ keybindings
};
```

**Categories:**
- Editor navigation (up, down, left, right, word, line start/end, page up/down)
- Editor editing (delete char/word/line, yank, yank pop, undo)
- Input actions (new line, submit, tab, copy)
- Selection actions (up, down, page up/down, confirm, cancel)

#### KeybindingsManager

```typescript
export class KeybindingsManager {
  private definitions: KeybindingDefinitions;
  private userBindings: KeybindingsConfig;
  private keysById = new Map<Keybinding, KeyId[]>();
  private conflicts: KeybindingConflict[];

  matches(data: string, keybinding: Keybinding): boolean;
  getKeys(keybinding: Keybinding): KeyId[];
  getDefinition(keybinding: Keybinding): KeybindingDefinition;
  getConflicts(): KeybindingConflict[];
  setUserBindings(userBindings: KeybindingsConfig): void;
  getResolvedBindings(): KeybindingsConfig;
}
```

**Features:**
- Merge user bindings với defaults
- Detect conflicts (multiple keybindings cho same key)
- Normalize keys (remove duplicates)
- Resolve final bindings

### 4.3 StdinBuffer (stdin-buffer.ts - 386 lines)

#### Purpose

Buffer stdin input và emit complete sequences. Cần thiết vì stdin data events có thể arrive in partial chunks, đặc biệt cho escape sequences như mouse events.

**Example:**
```
Mouse SGR sequence: \x1b[<35;20;5m
- Event 1: \x1b
- Event 2: [<35
- Event 3: ;20;5m
```

#### Sequence Detection

```typescript
function isCompleteSequence(data: string): "complete" | "incomplete" | "not-escape"
```

**Supported Sequences:**
- CSI: `\x1b[...` (ends with 0x40-0x7E)
- OSC: `\x1b]...BEL` hoặc `\x1b]...ESC\`
- DCS: `\x1bP...ESC\` (XTVersion responses)
- APC: `\x1b_...ESC\` (Kitty graphics)
- SS3: `\x1bO.`
- Meta: `\x1b.`

**CSI Special Handling:**
- Old-style mouse: `\x1b[M` + 3 bytes
- SGR mouse: `\x1b<digits;digits;digits[Mm]`

#### Bracketed Paste Detection

```typescript
const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";
```

**Behavior:**
- Detect paste start marker
- Buffer paste content
- Emit via `paste` event
- Handle remaining input after paste

#### StdinBuffer Class

```typescript
export class StdinBuffer extends EventEmitter<StdinBufferEventMap> {
  private buffer: string = "";
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly timeoutMs: number;
  private pasteMode: boolean = false;
  private pasteBuffer: string = "";

  process(data: string | Buffer): void;
  flush(): string[];
  clear(): void;
  getBuffer(): string;
  destroy(): void;
}
```

**Events:**
- `data`: complete sequence emitted
- `paste`: paste content emitted

**Timeout Behavior:**
- Default 10ms timeout
- Flush buffer nếu incomplete sau timeout
- Prevents stuck buffer

---

## 5. Editor Components

### 5.1 Input Component (input.ts - 503 lines)

#### Features

**Single-line text input với:**
- Horizontal scrolling
- Grapheme-aware cursor movement
- Bracketed paste support
- Undo support
- Kill ring integration
- Word navigation

#### State Management

```typescript
interface InputState {
  value: string;
  cursor: number;
}
```

#### Input Handling

**Keybindings:**
- Navigation: left, right, word left/right, line start/end
- Deletion: backspace, delete, delete word backward/forward, delete to line start/end
- Kill ring: yank, yank pop
- Undo: undo
- Submit: enter
- Cancel: escape

**Bracketed Paste:**
```typescript
if (data.includes("\x1b[200~")) {
  this.isInPaste = true;
  this.pasteBuffer = "";
  // Buffer paste content
  // On \x1b[201~, process paste
}
```

**Undo Coalescing:**
```typescript
private insertCharacter(char: string): void {
  // Consecutive word chars coalesce vào một undo unit
  if (isWhitespaceChar(char) || this.lastAction !== "type-word") {
    this.pushUndo();
  }
  this.lastAction = "type-word";
}
```

#### Word Navigation

**Word Boundaries:**
- Whitespace
- Punctuation: `(){}[]<>.,;:'"!?+\-=*/\\|&%^$#@~\``

**Algorithm:**
```typescript
private moveWordBackwards(): void {
  // Skip trailing whitespace
  // Skip punctuation run hoặc word run
}
```

#### Rendering

**Horizontal Scrolling:**
```typescript
if (totalWidth < availableWidth) {
  visibleText = this.value;
} else {
  // Calculate scroll window
  const scrollWidth = this.cursor === this.value.length
    ? availableWidth - 1
    : availableWidth;
  const cursorCol = visibleWidth(this.value.slice(0, this.cursor));
  // Center cursor in scroll window
}
```

**Cursor Display:**
- Hardware cursor marker (`CURSOR_MARKER`) khi focused
- Inverse video cho fake cursor
- Handle cursor at end (space with inverse)

### 5.2 Editor Component (editor.ts - 1546+ lines)

#### Features

**Multi-line editor với:**
- Word wrapping
- Vertical scrolling
- Autocomplete support
- Paste marker system
- History navigation
- Kill ring integration
- Undo support
- Character jump mode
- Sticky column behavior

#### State Management

```typescript
interface EditorState {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
}
```

#### Paste Marker System

**Purpose:** Handle large pastes (> 10 lines hoặc > 1000 chars)

**Implementation:**
```typescript
// Insert marker
const marker = pastedLines.length > 10
  ? `[paste #${pasteId} +${pastedLines.length} lines]`
  : `[paste #${pasteId} ${totalChars} chars]`;
this.pastes.set(pasteId, filteredText);
this.insertTextAtCursorInternal(marker);

// Expand when needed
private expandPasteMarkers(text: string): string {
  // Replace markers với actual content
}
```

**Marker-Aware Segmentation:**
```typescript
function segmentWithMarkers(text: string, validIds: Set<number>): Iterable<Intl.SegmentData> {
  // Merge graphemes trong paste markers thành single atomic segments
  // Chỉ merge markers với valid IDs
}
```

#### Word Wrapping

```typescript
export function wordWrapLine(line: string, maxWidth: number, preSegmented?: Intl.SegmentData[]): TextChunk[]
```

**Features:**
- Word-aware wrapping
- Character-level fallback cho long words
- Track position in original line
- Handle paste markers as atomic units

**Algorithm:**
1. Segment line into graphemes
2. Accumulate until width exceeded
3. Backtrack to last wrap opportunity (whitespace before non-whitespace)
4. Force-break nếu no viable opportunity
5. Re-wrap wide segments (e.g., paste markers)

#### Vertical Scrolling

**Scroll Calculation:**
```typescript
const maxVisibleLines = Math.max(5, Math.floor(terminalRows * 0.3));

// Adjust scroll offset
if (cursorLineIndex < this.scrollOffset) {
  this.scrollOffset = cursorLineIndex;
} else if (cursorLineIndex >= this.scrollOffset + maxVisibleLines) {
  this.scrollOffset = cursorLineIndex - maxVisibleLines + 1;
}
```

**Scroll Indicators:**
```
─── ↑ 5 more ────────────────
[content]
─── ↓ 10 more ───────────────
```

#### Sticky Column Behavior

**Purpose:** Preserve visual column khi moving up/down across wrapped lines

**Decision Table:**
```
| P | S | T | U | Scenario                     | Set Preferred | Move To     |
|---|---|---|---|------------------------------|---------------|-------------|
| 0 | * | 0 | - | Start nav, target fits       | null          | current     |
| 0 | * | 1 | - | Start nav, target shorter    | current       | target end  |
| 1 | 0 | 0 | 0 | Clamped, target fits pref    | null          | preferred   |
| 1 | 0 | 0 | 1 | Clamped, target can't fit    | keep          | target end  |
| 1 | 0 | 1 | - | Clamped, target shorter      | keep          | target end  |
| 1 | 1 | 0 | - | Rewrapped, target fits       | null          | current     |
| 1 | 1 | 1 | - | Rewrapped, target shorter    | current       | target end  |
```

Where:
- P = preferred col is set
- S = cursor in middle of source line
- T = target line shorter than current visual col
- U = target line shorter than preferred col

#### Autocomplete System

**Trigger Conditions:**
- `/` at start of line (slash commands)
- `@` after whitespace or at start (file references)
- Typing letters in slash command context
- Typing letters in @ file reference context

**Autocomplete States:**
- `null`: not active
- `"regular"`: regular autocomplete
- `"force"`: force autocomplete (Ctrl+Space)

**Autocomplete List:**
- Overlay with SelectList
- Max visible items configurable
- Tab to accept, Enter to confirm
- Escape to cancel

**Apply Completion:**
```typescript
const result = this.autocompleteProvider.applyCompletion(
  this.state.lines,
  this.state.cursorLine,
  this.state.cursorCol,
  selected,
  this.autocompletePrefix
);
```

#### History Navigation

**Behavior:**
- Up/down arrows navigate history khi editor empty
- Enter history browsing mode khi first up arrow
- Exit history mode khi typing
- Save to file via callback

**Implementation:**
```typescript
private navigateHistory(direction: 1 | -1): void {
  // Capture state khi first entering history
  if (this.historyIndex === -1 && newIndex >= 0) {
    this.pushUndoSnapshot();
  }
  // Navigate history
  // Restore state
}
```

#### Character Jump Mode

**Purpose:** Jump to next/previous occurrence of a character

**Triggers:**
- `Ctrl+]`: jump forward
- `Ctrl+Alt+]`: jump backward

**Behavior:**
- Enter jump mode on trigger
- Wait for next character
- Jump to that character
- Cancel on repeat trigger or control character

#### Rendering

**Layout Pipeline:**
1. Word wrap each logical line
2. Map cursor position to visual line
3. Adjust scroll offset
4. Render visible lines
5. Add scroll indicators
6. Add autocomplete list if active

**Cursor Display:**
- Hardware cursor marker khi focused và no autocomplete
- Inverse video cho fake cursor
- Handle cursor at end of line
- Handle cursor in padding

---

## 6. Other Components

### 6.1 Box Component (box.ts - 137 lines)

**Features:**
- Container với padding
- Background color support
- Child management
- Cache optimization

**Rendering:**
```typescript
render(width: number): string[] {
  const contentWidth = width - paddingX * 2;
  const leftPad = " ".repeat(paddingX);

  // Render children
  const childLines = [];
  for (const child of this.children) {
    const lines = child.render(contentWidth);
    for (const line of lines) {
      childLines.push(leftPad + line);
    }
  }

  // Apply background và padding
  // Top padding
  // Content with background
  // Bottom padding
}
```

**Cache:**
- Cache rendered output
- Invalidate on child changes
- Detect bgFn changes via sampling

### 6.2 Text Component (text.ts - referenced)

**Features:**
- Simple text display
- Padding support
- Theme support

### 6.3 TruncatedText Component (truncated-text.ts - referenced)

**Features:**
- Truncate text to fit width
- Add ellipsis
- Preserve ANSI codes

### 6.4 Image Component (image.ts - referenced)

**Features:**
- Display terminal images
- Kitty/ITerm2 protocol support
- Fallback to text

### 6.5 Spacer Component (spacer.ts - 28 lines)

**Features:**
- Render empty lines
- Configurable line count

### 6.6 Loader Component (loader.ts - 55 lines)

**Features:**
- Animated spinner (10 frames)
- Update every 80ms
- Configurable colors
- Message display

**Frames:**
```
⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
```

### 6.7 CancellableLoader Component (cancellable-loader.ts - 40 lines)

**Features:**
- Extends Loader
- AbortSignal support
- Escape to cancel
- onAbort callback

**Usage:**
```typescript
const loader = new CancellableLoader(tui, cyan, dim, "Working...");
loader.onAbort = () => done(null);
doWork(loader.signal).then(done);
```

### 6.8 SelectList Component (select-list.ts - referenced)

**Features:**
- Select from list of items
- Keyboard navigation
- Two-column layout
- Truncation support

### 6.9 SettingsList Component (settings-list.ts - referenced)

**Features:**
- Display settings
- Toggle/edit values
- Keyboard navigation

### 6.10 Markdown Component (markdown.ts - 825 lines)

**Features:**
- Markdown rendering
- Theme support
- Code highlighting
- Table rendering
- List nesting
- Blockquotes

**Supported Elements:**
- Headings (H1-H6)
- Paragraphs
- Code blocks (with syntax highlighting)
- Inline code
- Lists (ordered, unordered, nested)
- Tables (with wrapping)
- Blockquotes
- Horizontal rules
- Links (with URL display)
- Bold, italic, strikethrough, underline

**Theme Interface:**
```typescript
export interface MarkdownTheme {
  heading: (text: string) => string;
  link: (text: string) => string;
  linkUrl: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string) => string;
  codeBlockBorder: (text: string) => string;
  quote: (text: string) => string;
  quoteBorder: (text: string) => string;
  hr: (text: string) => string;
  listBullet: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  strikethrough: (text: string) => string;
  underline: (text: string) => string;
  highlightCode?: (code: string, lang?: string) => string[];
  codeBlockIndent?: string;
}
```

**Default Text Style:**
```typescript
export interface DefaultTextStyle {
  color?: (text: string) => string;
  bgColor?: (text: string) => string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}
```

**Rendering Pipeline:**
1. Parse markdown với `marked.lexer()`
2. Render each token
3. Wrap lines to width
4. Apply padding và background
5. Cache result

**Table Rendering:**
- Calculate column widths
- Wrap cells to fit
- Render borders
- Handle overflow

**List Rendering:**
- Support nested lists
- Proper indentation
- Bullet/number styling

**Blockquote Rendering:**
- Indent content
- Apply quote style
- Handle nested content

---

## 7. Utility Modules

### 7.1 Fuzzy Matching (fuzzy.ts - 133 lines)

**Features:**
- Fuzzy match query against text
- Score-based ranking
- Space-separated tokens
- Alphanumeric/numeric swap

**Scoring:**
- Consecutive matches: -5 per consecutive
- Word boundary matches: -10
- Gap penalty: +2 per gap
- Position penalty: +0.1 per position

**Algorithm:**
```typescript
export function fuzzyMatch(query: string, text: string): FuzzyMatch {
  // Try direct match
  // Try alphanumeric/numeric swap (e.g., "abc123" ↔ "123abc")
  // Return best match
}
```

**Filtering:**
```typescript
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  // All tokens must match
  // Sort by total score
}
```

### 7.2 Undo Stack (undo-stack.ts - 28 lines)

**Features:**
- Generic undo stack
- Clone-on-push semantics
- Deep clone với `structuredClone()`

**API:**
```typescript
export class UndoStack<S> {
  push(state: S): void;
  pop(): S | undefined;
  clear(): void;
  get length(): number;
}
```

### 7.3 Kill Ring (kill-ring.ts - 46 lines)

**Features:**
- Emacs-style kill/yank operations
- Ring buffer
- Accumulate consecutive kills
- Yank pop cycling

**API:**
```typescript
export class KillRing {
  push(text: string, opts: { prepend: boolean; accumulate?: boolean }): void;
  peek(): string | undefined;
  rotate(): void;
  get length(): number;
}
```

**Accumulation:**
```typescript
// Consecutive kills merge into single entry
if (opts.accumulate && this.ring.length > 0) {
  const last = this.ring.pop()!;
  this.ring.push(opts.prepend ? text + last : last + text);
}
```

**Yank Pop:**
```typescript
// Move last entry to front
rotate(): void {
  if (this.ring.length > 1) {
    const last = this.ring.pop()!;
    this.ring.unshift(last);
  }
}
```

### 7.4 Autocomplete (autocomplete.ts - referenced)

**Features:**
- Autocomplete provider interface
- Combined providers
- Slash command support

**Interfaces:**
```typescript
export interface AutocompleteItem {
  label: string;
  value: string;
  description?: string;
}

export interface AutocompleteSuggestions {
  items: AutocompleteItem[];
  prefix: string;
}

export interface AutocompleteProvider {
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number
  ): Promise<AutocompleteSuggestions>;

  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    selected: AutocompleteItem,
    prefix: string
  ): { lines: string[]; cursorLine: number; cursorCol: number };
}

export interface SlashCommand {
  command: string;
  description: string;
  handler: (args: string) => void;
}
```

### 7.5 Terminal Image (terminal-image.ts - referenced)

**Features:**
- Kitty graphics protocol
- ITerm2 protocol
- Cell size detection
- Image dimension detection
- Capability detection

**Protocols:**
- Kitty: `\x1b_G...`
- ITerm2: `\x1b]1337;...`

**Functions:**
```typescript
export function renderImage(options: ImageRenderOptions): string;
export function getCapabilities(): TerminalCapabilities;
export function setCellDimensions(dimensions: CellDimensions): void;
export function getCellDimensions(): CellDimensions;
export function getImageDimensions(buffer: Buffer): ImageDimensions;
export function deleteKittyImage(id: number): void;
export function deleteAllKittyImages(): void;
```

### 7.6 Editor Component Interface (editor-component.ts - referenced)

**Purpose:** Interface cho custom editors

**Interface:**
```typescript
export interface EditorComponent {
  getText(): string;
  setText(text: string): void;
  insertTextAtCursor(text: string): void;
  getCursor(): { line: number; col: number };
  setCursor(line: number, col: number): void;
  focus(): void;
  blur(): void;
  destroy(): void;
}
```

---

## 8. Architecture Patterns

### 8.1 Component Architecture

**Design Principles:**
- Pure render functions (no side effects)
- Immutable state updates
- Cache invalidation on changes
- Differential rendering optimization

**Component Lifecycle:**
1. Constructor: initialize state
2. `render()`: produce output lines
3. `handleInput()`: process keyboard input
4. `invalidate()`: clear cache

### 8.2 Event Handling

**Input Flow:**
```
stdin → StdinBuffer → TUI.handleInput() → focusedComponent.handleInput()
```

**Event Types:**
- Regular keypresses
- Escape sequences
- Bracketed paste
- Kitty protocol events
- Mouse events (via StdinBuffer)

### 8.3 Rendering Pipeline

**Full Pipeline:**
```
TUI.requestRender()
  → scheduleRender() (debounced)
  → doRender()
    → render() (all components)
    → compositeOverlays()
    → extractCursorPosition()
    → applyLineResets()
    → differential rendering
    → positionHardwareCursor()
```

**Differential Rendering:**
1. Find first/last changed lines
2. Move cursor to first changed line
3. Render changed lines only
4. Clear extra lines if needed
5. Update cursor position

### 8.4 Focus Management

**Focus Stack:**
```
base content → overlay 1 → overlay 2 → ... → focused overlay
```

**Focus Transitions:**
- Show overlay: focus overlay (if capturing)
- Hide overlay: restore previous focus
- Hide/show overlay: update focus accordingly
- Visibility change: redirect focus if needed

### 8.5 State Management

**Editor State:**
```typescript
interface EditorState {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
}
```

**Undo Stack:**
- Clone-on-push
- Deep clone với `structuredClone()`
- Restore on undo

**History:**
- Array of past inputs
- Index-based navigation
- Limit to 100 entries
- Save to file via callback

---

## 9. Performance Optimizations

### 9.1 Differential Rendering

**Benefits:**
- Only render changed lines
- Reduce terminal output
- Minimize flicker
- Faster updates

**Implementation:**
- Track `previousLines`
- Find first/last changed lines
- Move cursor efficiently
- Use synchronized output

### 9.2 Caching

**Component Caching:**
- Cache rendered output
- Invalidate on changes
- Detect changes via sampling

**Width Caching:**
- Cache visible width calculations
- 512 entry LRU cache
- Invalidate on text changes

### 9.3 Debouncing

**Render Debouncing:**
- Minimum 16ms between renders
- Prevent excessive renders
- Batch rapid changes

**Autocomplete Debouncing:**
- 20ms debounce for autocomplete
- Prevent excessive API calls

### 9.4 Efficient String Operations

**Grapheme Segmentation:**
- Shared Intl.Segmenter instance
- Reuse across operations

**ANSI Code Tracking:**
- Track state incrementally
- Avoid re-parsing

**Segment Extraction:**
- Single-pass algorithms
- Minimize allocations

---

## 10. Cross-Platform Support

### 10.1 Terminal Compatibility

**Supported Terminals:**
- Kitty (full keyboard protocol)
- iTerm2 (images, keyboard protocol)
- VS Code integrated terminal
- tmux (modifyOtherKeys)
- Windows Terminal (VT input)
- Termux (special handling)

### 10.2 Keyboard Protocol Detection

**Kitty Protocol:**
```typescript
// Query support
process.stdout.write("\x1b[?u");

// Response: \x1b[?<flags>u

// Enable
process.stdout.write("\x1b[>7u");
```

**Fallback:**
```typescript
// xterm modifyOtherKeys
process.stdout.write("\x1b[>4;2m");
```

### 10.3 Windows Support

**VT Input:**
```typescript
// Enable ENABLE_VIRTUAL_TERMINAL_INPUT
const koffi = require("koffi");
const k32 = koffi.load("kernel32.dll");
// ... set console mode
```

**Dynamic Require:**
- Only load koffi on Windows
- Avoid bundling 74MB of binaries

### 10.4 Termux Handling

**Height Changes:**
- Detect Termux session
- Skip full redraw on height change
- Prevent history replay

---

## 11. Debugging Features

### 11.1 Environment Variables

**Debug Flags:**
- `PI_TUI_DEBUG=1`: Log render details
- `PI_DEBUG_REDRAW=1`: Log redraw reasons
- `DEBUG_TUI=1`: Console error debugging
- `PI_HARDWARE_CURSOR=1`: Show hardware cursor
- `PI_CLEAR_ON_SHRINK=0`: Disable clear on shrink
- `PI_TUI_WRITE_LOG=/path`: Write terminal output to log

### 11.2 Crash Logging

**Width Overflow:**
```typescript
if (visibleWidth(line) > width) {
  // Write crash log
  const crashLogPath = path.join(os.homedir(), ".pi", "agent", "pi-crash.log");
  fs.writeFileSync(crashLogPath, crashData);

  // Clean up and throw
  this.stop();
  throw new Error("Rendered line exceeds terminal width");
}
```

### 11.3 Render Debugging

**Debug Output:**
```
[DIFF] fc=10 lc=15 prev=20 new=25 app=true as=false mt=10 hw=15 pTop=5 vTop=5 max=30 cs=true
```

**Fields:**
- `fc`: first changed line
- `lc`: last changed line
- `prev`: previous lines count
- `new`: new lines count
- `app`: appended lines
- `as`: append start optimization
- `mt`: move target
- `hw`: hardware cursor row
- `pTop`: previous viewport top
- `vTop`: viewport top
- `max`: max lines rendered
- `cs`: clear on shrink

---

## 12. Testing

### 12.1 Test Files

**Test Coverage:**
- `test/markdown.test.ts`: Markdown rendering
- `test/overlay-short-content.test.ts`: Overlay rendering
- `test/tui-render.test.ts`: TUI rendering
- `test/terminal-image.test.ts`: Image rendering
- `test/tui-overlay-style-leak.test.ts`: Overlay style handling
- `test/test-themes.ts`: Theme testing
- `test/truncated-text.test.ts`: Text truncation
- `test/viewport-overwrite-repro.ts`: Viewport handling
- `test/virtual-terminal.ts`: Terminal emulation
- `test/stdin-buffer.test.ts`: Input buffering
- `test/fuzzy.test.ts`: Fuzzy matching
- `test/overlay-options.test.ts`: Overlay options
- `test/key-tester.ts`: Key testing
- `test/chat-simple.ts`: Simple chat UI
- `test/image-test.ts`: Image testing
- `test/wrap-ansi.test.ts`: ANSI wrapping
- `test/bug-regression-isimageline-startswith-bug.test.ts`: Bug regression
- `test/tui-cell-size-input.test.ts`: Cell size input
- `test/truncate-to-width.test.ts`: Width truncation
- `test/regression-regional-indicator-width.test.ts`: Regional indicator width
- `test/overlay-non-capturing.test.ts`: Non-capturing overlays
- `test/select-list.test.ts`: Select list
- `test/autocomplete.test.ts`: Autocomplete
- `test/editor.test.ts`: Editor
- `test/input.test.ts`: Input
- `test/keys.test.ts`: Keys
- `test/keybindings.test.ts`: Keybindings

### 12.2 Test Utilities

**Virtual Terminal:**
- Emulate terminal behavior
- Test rendering without real terminal
- Support escape sequences

**Key Tester:**
- Test key parsing
- Verify key matching
- Test keyboard protocols

---

## 13. Dependencies

### 13.1 External Dependencies

**Core:**
- `events`: EventEmitter for StdinBuffer
- `marked`: Markdown parsing
- `get-east-asian-width`: East Asian width calculation

**Development:**
- `vitest`: Testing framework
- `typescript`: Type checking
- `mime-types`, `mime-db`: MIME type detection

### 13.2 Internal Dependencies

**None** - Package is self-contained

---

## 14. Configuration

### 14.1 Package Configuration

**package.json:**
```json
{
  "name": "@kilo/tui",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

### 14.2 Build Configuration

**tsconfig.build.json:**
- TypeScript build configuration
- Output to `dist/`
- Declaration generation

### 14.3 Test Configuration

**vitest.config.ts:**
- Vitest configuration
- Test environment setup

---

## 15. Documentation

### 15.1 README

**Topics Covered:**
- Installation
- Basic usage
- Component examples
- Theme customization
- Keybinding configuration

### 15.2 API Documentation

**Exported APIs:**
- Components: Box, Text, Input, Editor, Markdown, etc.
- Utilities: visibleWidth, truncateToWidth, wrapTextWithAnsi
- Classes: TUI, KeybindingsManager, UndoStack, KillRing
- Types: Component, Focusable, OverlayOptions, etc.

---

## 16. Future Enhancements

### 16.1 Potential Improvements

**Performance:**
- Virtual scrolling cho large content
- Incremental rendering
- Render worker threads

**Features:**
- More component types
- Rich text editing
- Syntax highlighting
- Multi-cursor support

**Accessibility:**
- Screen reader support
- High contrast themes
- Keyboard navigation improvements

---

## 17. Summary

**Package `packages/tui/` là một thư viện TUI hoàn chỉnh với:**

**Strengths:**
- ✅ Differential rendering optimization
- ✅ Comprehensive component library
- ✅ Advanced keyboard handling (Kitty protocol, bracketed paste)
- ✅ Word wrapping với ANSI support
- ✅ Overlay system với flexible positioning
- ✅ Autocomplete integration
- ✅ Undo/redo support
- ✅ Kill ring (Emacs-style)
- ✅ Cross-platform support
- ✅ Extensive debugging features
- ✅ Good test coverage

**Architecture:**
- Clean component interface
- Event-driven input handling
- Efficient rendering pipeline
- Flexible theming system
- Extensible keybinding system

**Use Cases:**
- CLI applications
- Terminal-based tools
- Interactive prompts
- Code editors
- Chat interfaces
- Dashboard displays

**Total Lines of Code:** ~8,000+ lines
**Files:** ~25 source files
**Components:** 12+ components
**Utilities:** 10+ utilities

---

**Report Generated:** 2026-04-16
**Package:** packages/tui/
**Status:** ✅ Complete Analysis
