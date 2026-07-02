#!/usr/bin/env node
/**
 * EntryDetailView Tests (from session-tree-command)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies to allow importing session-tree-command
vi.mock('@earendil-works/pi-coding-agent', () => ({
  DynamicBorder: class DynamicBorder {},
  TreeSelectorComponent: class TreeSelectorComponent {
    constructor(...args: any[]) {}
    getTreeList() { return { getSelectedNode: () => null }; }
    handleInput() {}
  },
}));
vi.mock('@earendil-works/pi-tui', () => ({
  Container: class Container { children: any[] = []; addChild(child: any) { this.children.push(child); } },
  Text: class Text { constructor(public content: any) {} },
  Spacer: class Spacer {},
}));
vi.mock('../utils/widget-helpers.js', () => ({
  addSectionHeader: vi.fn(),
}));

// Now import the EntryDetailView class
import { EntryDetailView } from '../extensions/commands/session-tree-command.js';

function createMessageEntry(overrides: any = {}) {
  return {
    id: 'entry-1',
    parentId: null,
    type: 'message',
    timestamp: Date.now(),
    message: { role: 'user', content: [{ type: 'text', text: 'Hello world' }] },
    ...overrides,
  };
}

function createEntry(overrides: any = {}) {
  return {
    id: 'entry-1',
    parentId: null,
    type: 'message',
    timestamp: Date.now(),
    message: { role: 'user', content: [{ type: 'text', text: 'Hello world' }] },
    ...overrides,
  };
}

describe('EntryDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('render - message', () => {
    it('renders message entry details', () => {
      const view = new EntryDetailView(createEntry());
      const lines = view.render(80);
      // Should include common fields
      expect(lines.some(l => l.includes('Entry ID: entry-1'))).toBe(true);
      expect(lines.some(l => l.includes('Type: message'))).toBe(true);
      // Should include message details
      expect(lines.some(l => l.includes('Role: user'))).toBe(true);
      expect(lines.some(l => l.includes('Text: Hello world'))).toBe(true);
    });
  });

  describe('render - branch_summary', () => {
    it('renders branch summary entry details', () => {
      const entry = createEntry({
        type: 'branch_summary',
        fromId: 'branch-123',
        summary: 'This is a summary of the branch changes.',
      });
      const view = new EntryDetailView(entry);
      const lines = view.render(80);
      expect(lines.some(l => l.includes('Branch Summary'))).toBe(true);
      expect(lines.some(l => l.includes('From: branch-123'))).toBe(true);
      expect(lines.some(l => l.includes('Summary: This is a summary'))).toBe(true);
    });
  });

  describe('render - compaction', () => {
    it('renders compaction entry details', () => {
      const entry = createEntry({
        type: 'compaction',
        tokensBefore: 1234,
        firstKeptEntryId: 'keep-1',
        summary: 'Compacted old messages.',
      });
      const view = new EntryDetailView(entry);
      const lines = view.render(80);
      expect(lines.some(l => l.includes('Compaction Summary'))).toBe(true);
      expect(lines.some(l => l.includes('Tokens before: 1234'))).toBe(true);
      expect(lines.some(l => l.includes('First kept: keep-1'))).toBe(true);
    });
  });

  describe('render - custom_message', () => {
    it('renders custom message entry details', () => {
      const entry = createEntry({
        type: 'custom_message',
        customType: 'tool_call',
        display: 'Tool Call',
        content: 'ls -la',
      });
      const view = new EntryDetailView(entry);
      const lines = view.render(80);
      expect(lines.some(l => l.includes('Custom Message'))).toBe(true);
      expect(lines.some(l => l.includes('Custom type: tool_call'))).toBe(true);
      expect(lines.some(l => l.includes('Display: Tool Call'))).toBe(true);
      expect(lines.some(l => l.includes('Content: ls -la'))).toBe(true);
    });
  });

  describe('render - label', () => {
    it('renders label entry details', () => {
      const entry = createEntry({
        type: 'label',
        targetId: 'target-999',
        label: 'important',
      });
      const view = new EntryDetailView(entry);
      const lines = view.render(80);
      expect(lines.some(l => l.includes('Label'))).toBe(true);
      expect(lines.some(l => l.includes('Target: target-999'))).toBe(true);
      expect(lines.some(l => l.includes('Label: important'))).toBe(true);
    });
  });

  describe('render - unknown type', () => {
    it('shows unknown entry type message', () => {
      const entry = createEntry({ type: 'unknown_type' as any });
      const view = new EntryDetailView(entry);
      const lines = view.render(80);
      expect(lines.some(l => l.includes('Unknown entry type: unknown_type'))).toBe(true);
    });
  });

  describe('caching', () => {
    it('caches rendered lines for same width', () => {
      const view = new EntryDetailView(createEntry());
      const lines1 = view.render(80);
      const lines2 = view.render(80);
      expect(lines1).toBe(lines2); // same reference due to caching
    });

    it('recalculates when width changes', () => {
      const view = new EntryDetailView(createEntry());
      const lines1 = view.render(80);
      const lines2 = view.render(40);
      expect(lines1).not.toBe(lines2);
      // content should be wrapped differently
      expect(lines2.length).toBeGreaterThanOrEqual(lines1.length);
    });

    it('invalidates cache on setEntry', () => {
      const view = new EntryDetailView(createEntry());
      const lines1 = view.render(80);
      view.setEntry(createEntry({ id: 'entry-2' }));
      const lines2 = view.render(80);
      expect(lines1).not.toBe(lines2);
      expect(lines2.some(l => l.includes('Entry ID: entry-2'))).toBe(true);
    });
  });
});
