import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatSession,
  countNodes,
  formatListOutput,
  renderTree,
} from '../tools/session/utils.js';
import type { SessionMetadata, SessionTreeNode } from '../tools/session/registry.js';
import type { MultiSessionManager } from '../tools/session/manager.js';

describe('formatSession', () => {
  it('formats active session with name and tags', () => {
    const meta: SessionMetadata = {
      id: 's1',
      name: 'Test Session',
      isActive: true,
      createdAt: new Date('2024-01-01T12:00:00Z'),
      filePath: '/data/s1.jsonl',
      tags: ['tag1', 'tag2'],
      parentId: undefined,
      state: undefined,
      sessionRef: undefined,
    } as any;
    const out = formatSession(meta);
    expect(out).toContain('🟢');
    expect(out).toContain('s1');
    expect(out).toContain('"Test Session"');
    expect(out).toContain('[tag1, tag2]');
    expect(out).toContain('s1.jsonl');
  });

  it('handles inactive and unnamed session with no tags', () => {
    const meta: SessionMetadata = {
      id: 's2',
      name: undefined,
      isActive: false,
      createdAt: new Date(),
      filePath: '/data/s2.jsonl',
      tags: [],
      parentId: undefined,
      state: undefined,
      sessionRef: undefined,
    } as any;
    const out = formatSession(meta);
    expect(out).toContain('⚪');
    expect(out).toContain('(unnamed)');
    expect(out).toContain('s2.jsonl');
  });
});

describe('countNodes', () => {
  it('counts a single node as 1', () => {
    const node: SessionTreeNode = {
      session: {} as any,
      children: [],
    };
    expect(countNodes(node)).toBe(1);
  });

  it('counts a tree correctly', () => {
    const node: SessionTreeNode = {
      session: { id: 'root' } as any,
      children: [
        { session: { id: 'c1' } as any, children: [] },
        {
          session: { id: 'c2' } as any,
          children: [{ session: { id: 'gc1' } as any, children: [] }],
        },
      ],
    };
    // root + c1 + c2 + gc1 = 4
    expect(countNodes(node)).toBe(4);
  });
});

describe('formatListOutput', () => {
  let mgr: MultiSessionManager;
  let activeMock: any;

  beforeEach(() => {
    activeMock = { id: 'active1' };
    mgr = { getActive: vi.fn(() => activeMock) } as any;
  });

  it('formats list of sessions with active marker', () => {
    const sessions: SessionMetadata[] = [
      {
        id: 'active1',
        name: 'Active',
        isActive: true,
        createdAt: new Date(),
        filePath: '/data/a.jsonl',
        tags: [],
        parentId: undefined,
        state: undefined,
        sessionRef: undefined,
      } as any,
      {
        id: 'inactive2',
        name: 'Inactive',
        isActive: false,
        createdAt: new Date(),
        filePath: '/data/i.jsonl',
        tags: ['x'],
        parentId: undefined,
        state: undefined,
        sessionRef: undefined,
      } as any,
    ];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('🟢 active1');
    expect(out).toContain('⚪ inactive2');
    expect(out).toContain('"Active"');
    expect(out).toContain('[x]');
    expect(out).toContain('2 total');
  });

  it('shows 0 active when none active', () => {
    activeMock = null;
    (mgr.getActive as any).mockReturnValue(null);
    const sessions: SessionMetadata[] = [
      {
        id: 'a',
        name: 'A',
        isActive: false,
        createdAt: new Date(),
        filePath: '/data/a.jsonl',
        tags: [],
        parentId: undefined,
        state: undefined,
        sessionRef: undefined,
      } as any,
    ];
    const out = formatListOutput(sessions, mgr);
    expect(out).toContain('0 active');
  });
});

describe('renderTree', () => {
  it('renders a single node', () => {
    const node: SessionTreeNode = {
      session: { id: 'n1', name: 'Node 1', isActive: false } as any,
      children: [],
    };
    const lines = renderTree([node]);
    expect(lines).toEqual(['└── ⚪ n1 "Node 1"']);
  });

  it('renders nested tree with connectors', () => {
    const child: SessionTreeNode = {
      session: { id: 'child', name: 'Child', isActive: true } as any,
      children: [],
    };
    const root: SessionTreeNode = {
      session: { id: 'root', name: 'Root', isActive: false } as any,
      children: [child],
    };
    const lines = renderTree([root]);
    expect(lines[0]).toBe('└── ⚪ root "Root"');
    expect(lines[1]).toBe('    └── 🟢 child "Child"');
  });

  it('renders nested tree with connectors', () => {
    const child: SessionTreeNode = {
      session: { id: 'child', name: 'Child', isActive: true } as any,
      children: [],
    };
    const root: SessionTreeNode = {
      session: { id: 'root', name: 'Root', isActive: false } as any,
      children: [child],
    };
    const lines = renderTree([root]);
    expect(lines[0]).toBe('└── ⚪ root "Root"');
    expect(lines[1]).toBe('    └── 🟢 child "Child"');
  });

  it('handles multiple siblings', () => {
    const c1: SessionTreeNode = { session: { id: 'c1', name: 'C1', isActive: false } as any, children: [] };
    const c2: SessionTreeNode = { session: { id: 'c2', name: 'C2', isActive: false } as any, children: [] };
    const lines = renderTree([c1, c2]);
    expect(lines[0]).toContain('├──');
    expect(lines[1]).toContain('└──');
  });
});
