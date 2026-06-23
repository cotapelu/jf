import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutonomousAgent } from '../agent.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// Mock utils
vi.mock('../utils/coverage', () => ({ getCoverageReport: vi.fn() }));
vi.mock('../utils/complexity', () => ({ analyzeComplexity: vi.fn() }));
vi.mock('../utils/security', () => ({
  scanForSecrets: vi.fn(),
  checkNpmAudit: vi.fn(),
  checkOutdated: vi.fn(),
}));
vi.mock('../utils/git', () => ({
  getGitStatus: vi.fn(),
  commitAll: vi.fn(),
  pushCommits: vi.fn(),
  hasRemote: vi.fn(),
}));

import { getCoverageReport } from '../utils/coverage.js';
import { analyzeComplexity } from '../utils/complexity.js';
import { scanForSecrets, checkNpmAudit, checkOutdated } from '../utils/security.js';
import { getGitStatus, commitAll, pushCommits, hasRemote } from '../utils/git.js';

function createMockApi(): ExtensionAPI {
  return {
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(() => undefined),
    registerMessageRenderer: vi.fn(),
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
    appendEntry: vi.fn(),
    setSessionName: vi.fn(),
    getSessionName: vi.fn(),
    setLabel: vi.fn(),
    exec: vi.fn(async () => ({ code: 0, stdout: '', stderr: '' })),
    getActiveTools: vi.fn(() => []),
    getAllTools: vi.fn(() => []),
    setActiveTools: vi.fn(),
    refreshTools: vi.fn(),
    getCommands: vi.fn(() => []),
    setModel: vi.fn(async () => true),
    getThinkingLevel: vi.fn(() => 0),
    setThinkingLevel: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as any,
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
  } as any;
}

describe('AutonomousAgent - Flow Tests', () => {
  let mockApi: ExtensionAPI;
  let agent: AutonomousAgent;

  beforeEach(() => {
    mockApi = createMockApi();
    agent = new AutonomousAgent(mockApi as any);
    vi.clearAllMocks();
  });

  describe('discoverViolations', () => {
    it('should combine violations from all sources', async () => {
      (agent as any).runLintCheck = vi.fn().mockResolvedValue([{ type: 'LINT', severity: 'HIGH' as const, details: '' }]);
      (agent as any).runTypeCheck = vi.fn().mockResolvedValue([]);
      (agent as any).runTestCheck = vi.fn().mockResolvedValue([]);
      (agent as any).runBuildCheck = vi.fn().mockResolvedValue([]);
      (agent as any).runSecurityCheck = vi.fn().mockResolvedValue([]);
      (agent as any).runComplexityCheck = vi.fn().mockResolvedValue([]);

      const violations = await (agent as any).discoverViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('LINT');
      expect((agent as any).runLintCheck).toHaveBeenCalled();
    });
  });

  describe('runLintCheck', () => {
    it('should return violation on non-zero exit', async () => {
      (mockApi.exec as any).mockResolvedValue({ code: 1, stdout: 'errors', stderr: '' });
      const violations = await (agent as any).runLintCheck();
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe('HIGH');
    });

    it('should return empty on success', async () => {
      (mockApi.exec as any).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      const violations = await (agent as any).runLintCheck();
      expect(violations).toHaveLength(0);
    });
  });

  describe('runTypeCheck', () => {
    it('should return violation on error', async () => {
      (mockApi.exec as any).mockResolvedValue({ code: 1, stdout: 'errors', stderr: '' });
      const violations = await (agent as any).runTypeCheck();
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe('CRITICAL');
    });
  });

  describe('runTestCheck', () => {
    it('should return violation on test failure', async () => {
      (mockApi.exec as any).mockResolvedValue({ code: 1, stdout: 'failing', stderr: '' });
      (getCoverageReport as any).mockReturnValue(null);
      const violations = await (agent as any).runTestCheck();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('TEST');
    });

    it('should return violation on low coverage', async () => {
      (mockApi.exec as any).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      (getCoverageReport as any).mockReturnValue({ statements: 70, branches: 60, functions: 65, lines: 68 });
      const violations = await (agent as any).runTestCheck();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('COVERAGE');
    });

    it('should return empty when tests pass and coverage ok', async () => {
      (mockApi.exec as any).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      (getCoverageReport as any).mockReturnValue({ statements: 90, branches: 85, functions: 92, lines: 88 });
      const violations = await (agent as any).runTestCheck();
      expect(violations).toHaveLength(0);
    });
  });

  describe('runSecurityCheck', () => {
    it('should return violation if secrets found', async () => {
      (scanForSecrets as any).mockResolvedValue({ secretsFound: true, vulnerabilities: 1 });
      (checkNpmAudit as any).mockResolvedValue({ vulnerabilities: 0 });
      const violations = await (agent as any).runSecurityCheck();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('SECRETS');
    });

    it('should return violation if npm audit finds vulns', async () => {
      (scanForSecrets as any).mockResolvedValue({ secretsFound: false, vulnerabilities: 0 });
      (checkNpmAudit as any).mockResolvedValue({ vulnerabilities: 2 });
      const violations = await (agent as any).runSecurityCheck();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('VULNERABILITIES');
    });
  });

  describe('runComplexityCheck', () => {
    it('should return violation if any function exceeds thresholds', async () => {
      (analyzeComplexity as any).mockResolvedValue([
        { file: 'a.ts', function: 'foo', complexity: 12, lines: 25 },
      ]);
      const violations = await (agent as any).runComplexityCheck();
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('COMPLEXITY');
    });
  });

  describe('proactiveAnalysis', () => {
    it('should collect improvements from all suggestion methods', async () => {
      (agent as any).suggestCoverageImprovements = vi.fn().mockResolvedValue([{ type: 'TESTS', module: 'cov', description: 'inc', impact: '' }]);
      (agent as any).suggestComplexityRefactors = vi.fn().mockResolvedValue([]);
      (agent as any).suggestDependencyUpdates = vi.fn().mockResolvedValue([]);
      (agent as any).suggestSecurityHardening = vi.fn().mockResolvedValue([]);
      (agent as any).suggestDocumentationImprovements = vi.fn().mockResolvedValue([]);

      const improvements = await (agent as any).proactiveAnalysis();

      expect(improvements).toHaveLength(1);
      expect(improvements[0].type).toBe('TESTS');
    });
  });

  describe('suggestCoverageImprovements', () => {
    it('should suggest when coverage between target and higher', async () => {
      (getCoverageReport as any).mockResolvedValue({ statements: 82, branches: 80, functions: 81, lines: 83 });
      const suggestions = await (agent as any).suggestCoverageImprovements();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('TESTS');
    });

    it('should not suggest if already high', async () => {
      (getCoverageReport as any).mockResolvedValue({ statements: 90, branches: 90, functions: 90, lines: 90 });
      const suggestions = await (agent as any).suggestCoverageImprovements();
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('suggestComplexityRefactors', () => {
    it('should suggest for functions complexity>=8 or lines>=15', async () => {
      (analyzeComplexity as any).mockResolvedValue([
        { file: 'a.ts', function: 'big', complexity: 8, lines: 10 },
        { file: 'b.ts', function: 'big2', complexity: 5, lines: 20 },
      ]);
      const suggestions = await (agent as any).suggestComplexityRefactors();
      expect(suggestions).toHaveLength(2);
    });
  });

  describe('prioritizeTasks', () => {
    it('should sort by severity order', () => {
      const violations = [
        { type: 'A', severity: 'MEDIUM' as const, details: '' },
        { type: 'B', severity: 'CRITICAL' as const, details: '' },
      ];
      const tasks = (agent as any).prioritizeTasks(violations, []);
      expect(tasks[0].priority).toBe('CRITICAL');
      expect(tasks[1].priority).toBe('MEDIUM');
    });

    it('should treat SECURITY improvement as HIGH', () => {
      const improvements = [{ type: 'SECURITY' as const, module: 'sec', description: 'sec', impact: '' }];
      const tasks = (agent as any).prioritizeTasks([], improvements);
      expect(tasks[0].priority).toBe('HIGH');
    });
  });

  describe('executeTask', () => {
    it('should succeed for violation', async () => {
      const task = { id: 'v1', type: 'violation' as const, priority: 'HIGH' as const, description: 'Fix', createdAt: new Date(), violation: { type: 'A', severity: 'HIGH', details: '' } };
      (agent as any).fixViolation = vi.fn().mockResolvedValue({ committed: false, testDelta: 0, coverageDelta: { statements: 0, branches: 0, functions: 0, lines: 0 }, securityActions: [] });
      (agent as any).verifyQualityGate = vi.fn().mockResolvedValue(true);

      const result = await (agent as any).executeTask(task);

      expect(result.success).toBe(true);
      expect((agent as any).fixViolation).toHaveBeenCalledWith(task);
    });

    it('should fail if verifyQualityGate fails', async () => {
      const task = { id: 'v1', type: 'violation' as const, priority: 'HIGH' as const, description: 'Fix', createdAt: new Date(), violation: { type: 'A', severity: 'HIGH', details: '' } };
      (agent as any).fixViolation = vi.fn().mockResolvedValue({});
      (agent as any).verifyQualityGate = vi.fn().mockResolvedValue(false);

      const result = await (agent as any).executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Quality gate verification failed');
    });
  });

  describe('verifyQualityGate', () => {
    it('should return true when test and lint pass', async () => {
      (mockApi.exec as any).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      // Two calls: test then lint
      const result = await (agent as any).verifyQualityGate();
      expect(result).toBe(true);
      expect(mockApi.exec).toHaveBeenCalledTimes(2);
    });

    it('should return false if test fails', async () => {
      (mockApi.exec as any).mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' });
      const result = await (agent as any).verifyQualityGate();
      expect(result).toBe(false);
    });

    it('should return false if lint fails after test passes', async () => {
      (mockApi.exec as any)
        .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // test pass
        .mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' }); // lint fail
      const result = await (agent as any).verifyQualityGate();
      expect(result).toBe(false);
    });
  });

  describe('commitTask', () => {
    it('should commit and push if dirty and remote exists', async () => {
      (getGitStatus as any).mockResolvedValue({ dirty: true, files: ['a.ts'] });
      (commitAll as any).mockResolvedValue({ success: true });
      (hasRemote as any).mockResolvedValue(true);
      (pushCommits as any).mockResolvedValue({ success: true });

      await (agent as any).commitTask({ id: '1', type: 'violation' as const, priority: 'HIGH' as const, description: 'Fix', createdAt: new Date() }, { success: true, duration: 1, changesCommitted: true } as any);

      expect(commitAll).toHaveBeenCalled();
      expect(pushCommits).toHaveBeenCalled();
    });

    it('should not commit if not dirty', async () => {
      (getGitStatus as any).mockResolvedValue({ dirty: false, files: [] });
      await (agent as any).commitTask({ id: '1', type: 'violation' as const, priority: 'HIGH' as const, description: 'Fix', createdAt: new Date() }, { success: true, duration: 1, changesCommitted: true } as any);
      expect(commitAll).not.toHaveBeenCalled();
    });

    it('should not push if no remote', async () => {
      (getGitStatus as any).mockResolvedValue({ dirty: true, files: ['a.ts'] });
      (commitAll as any).mockResolvedValue({ success: true });
      (hasRemote as any).mockResolvedValue(false);
      await (agent as any).commitTask({ id: '1', type: 'violation' as const, priority: 'HIGH' as const, description: 'Fix', createdAt: new Date() }, { success: true, duration: 1, changesCommitted: true } as any);
      expect(pushCommits).not.toHaveBeenCalled();
    });
  });

  describe('truncate', () => {
    it('should truncate long text to max-3 + ...', () => {
      const truncate = (agent as any).truncate;
      expect(truncate('hello world', 5)).toBe('he...');
      expect(truncate('short', 10)).toBe('short');
      expect(truncate('exactly ten', 10)).toBe('exactly...'); // length 11 > 10
    });
  });

  describe('runCycle - flow nuances', () => {
    it('should skip if already running', async () => {
      (agent as any).isCycleRunning = true;
      vi.spyOn(agent as any, 'sleep').mockResolvedValue(undefined);
      const discoverSpy = vi.spyOn(agent as any, 'discoverViolations');
      await (agent as any).runCycle();
      expect(discoverSpy).not.toHaveBeenCalled();
      (agent as any).isCycleRunning = false;
    });

    it('should increment cycleCount each run', async () => {
      vi.spyOn(agent as any, 'discoverViolations').mockResolvedValue([]);
      vi.spyOn(agent as any, 'proactiveAnalysis').mockResolvedValue([]);
      vi.spyOn(agent as any, 'sleep').mockResolvedValue(undefined);
      const initial = agent.getStatus().cycleCount;
      await (agent as any).runCycle();
      expect(agent.getStatus().cycleCount).toBe(initial + 1);
    });

    it('should increment tasksCompleted when task succeeds', async () => {
      vi.spyOn(agent as any, 'discoverViolations').mockResolvedValue([{ type: 'A', severity: 'HIGH' as const, details: '' }]);
      vi.spyOn(agent as any, 'proactiveAnalysis').mockResolvedValue([]);
      vi.spyOn(agent as any, 'sleep').mockResolvedValue(undefined);
      const task = { id: '1', type: 'violation' as const, priority: 'HIGH' as const, description: 'Fix', createdAt: new Date(), violation: { type: 'A', severity: 'HIGH', details: '' } };
      vi.spyOn(agent as any, 'prioritizeTasks').mockReturnValue([task]);
      vi.spyOn(agent as any, 'executeTask').mockResolvedValue({ success: true, duration: 1, changesCommitted: false });
      vi.spyOn(agent as any, 'logMetrics').mockResolvedValue(undefined);
      const before = agent.getStatus().tasksCompleted;
      await (agent as any).runCycle();
      expect(agent.getStatus().tasksCompleted).toBe(before + 1);
    });

    it('should increment tasksFailed when executeTask throws', async () => {
      vi.spyOn(agent as any, 'discoverViolations').mockResolvedValue([{ type: 'A', severity: 'HIGH' as const, details: '' }]);
      vi.spyOn(agent as any, 'prioritizeTasks').mockReturnValue([{ id: '1', type: 'violation' as const, priority: 'HIGH' as const, description: 'Fix', createdAt: new Date() }]);
      vi.spyOn(agent as any, 'executeTask').mockRejectedValue(new Error('fail'));
      vi.spyOn(agent as any, 'sleep').mockResolvedValue(undefined);
      const before = agent.getStatus().tasksFailed;
      await (agent as any).runCycle();
      expect(agent.getStatus().tasksFailed).toBe(before + 1);
    });
  });

  describe('executeTask - improvement path', () => {
    it('should call implementImprovement and succeed', async () => {
      const task = { id: 'i1', type: 'improvement' as const, priority: 'MEDIUM' as const, description: 'Improve', createdAt: new Date(), improvement: { type: 'TESTS' as const, module: 'x', description: 'desc', impact: '' } };
      const implSpy = vi.spyOn(agent as any, 'implementImprovement').mockResolvedValue({ committed: false, testDelta: 0, coverageDelta: { statements: 0, branches: 0, functions: 0, lines: 0 }, performanceDelta: undefined, securityActions: [] });
      const verifySpy = vi.spyOn(agent as any, 'verifyQualityGate').mockResolvedValue(true);
      const result = await (agent as any).executeTask(task);
      expect(implSpy).toHaveBeenCalledWith(task);
      expect(result.success).toBe(true);
      implSpy.mockRestore();
      verifySpy.mockRestore();
    });
  });

  describe('prioritizeTasks - improvements only', () => {
    it('should order improvements by type priority', () => {
      const improvements = [
        { type: 'DOCUMENTATION' as const, module: 'doc', description: 'docs', impact: '' },
        { type: 'SECURITY' as const, module: 'sec', description: 'sec', impact: '' },
        { type: 'REFACTOR' as const, module: 'ref', description: 'ref', impact: '' },
      ];
      const tasks = (agent as any).prioritizeTasks([], improvements);
      expect(tasks[0].priority).toBe('HIGH'); // SECURITY
      expect(tasks[1].priority).toBe('MEDIUM'); // REFACTOR
      expect(tasks[2].priority).toBe('LOW'); // DOCUMENTATION
    });
  });
});
