import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  Task,
  ExecuteResult,
  CoverageDelta,
  Violation,
  Improvement,
  AgentStatus,
  AgentMetrics,
  Severity,
  PerformanceDelta,
} from './types.js';
import { getCoverageReport } from './utils/coverage.js';
import { analyzeComplexity } from './utils/complexity.js';
import { scanForSecrets, checkNpmAudit, checkOutdated } from './utils/security.js';
import { getGitStatus, commitAll, pushCommits, hasRemote } from './utils/git.js';

const CYCLE_INTERVAL = 2 * 60 * 60 * 1000; // 2h
const SLEEP_BETWEEN = 5 * 60 * 1000; // 5min
const COVERAGE_TARGET = 80;
const COMPLEXITY_THRESHOLD = 10;
const LINES_THRESHOLD = 20;

export class AutonomousAgent {
  private api: ExtensionAPI;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isCycleRunning = false;
  private status: AgentStatus = {
    isRunning: false,
    tasksCompleted: 0,
    tasksFailed: 0,
    cycleCount: 0,
  };

  constructor(api: ExtensionAPI) {
    this.api = api;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.status.isRunning = true;
    console.log('[AutonomousAgent] Starting autonomous cycles...');

    await this.runCycle();

    this.intervalId = setInterval(() => {
      this.runCycle().catch(err => {
        console.error('[AutonomousAgent] Cycle error:', err);
        this.logError(err);
      });
    }, CYCLE_INTERVAL);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.status.isRunning = false;
    console.log('[AutonomousAgent] Stopped');
  }

  getStatus(): AgentStatus {
    return { ...this.status };
  }

  private async runCycle(): Promise<void> {
    if (this.isCycleRunning) {
      console.log('[AutonomousAgent] Previous cycle still running, skipping');
      return;
    }
    this.isCycleRunning = true;

    const startTime = Date.now();
    console.log(`[AutonomousAgent] === Cycle ${this.status.cycleCount + 1} at ${new Date().toISOString()} ===`);

    try {
      const violations = await this.discoverViolations();
      const improvements = await this.proactiveAnalysis();

      const taskQueue = this.prioritizeTasks(violations, improvements);

      if (taskQueue.length === 0) {
        console.log('[AutonomousAgent] No tasks. Codebase is perfect.');
        return; // Skip sleep, will sleep after finally
      }

      const task = taskQueue[0];
      console.log(`[AutonomousAgent] Executing: ${task.description} (${task.priority})`);
      this.status.currentTask = task;

      const result = await this.executeTask(task);
      await this.logMetrics(task, result, Date.now() - startTime);

      if (this.shouldUpdateDocs(task, result)) {
        await this.updateEvolutionDocs(task, result);
      }

      if (result.changesCommitted) {
        await this.commitTask(task, result);
      }

      if (result.success) {
        this.status.tasksCompleted++;
      } else {
        this.status.tasksFailed++;
      }
      this.status.currentTask = undefined;

    } catch (err) {
      console.error('[AutonomousAgent] Cycle failed:', err);
      await this.logError(err);
      this.status.tasksFailed++;
    } finally {
      this.isCycleRunning = false;
      this.status.cycleCount++;
      await this.sleep(SLEEP_BETWEEN);
    }
  }

  private async discoverViolations(): Promise<Violation[]> {
    const violations: Violation[] = [];
    violations.push(...await this.runLintCheck());
    violations.push(...await this.runTypeCheck());
    violations.push(...await this.runTestCheck());
    violations.push(...await this.runBuildCheck());
    violations.push(...await this.runSecurityCheck());
    violations.push(...await this.runComplexityCheck());
    return violations;
  }

  private async runLintCheck(): Promise<Violation[]> {
    try {
      const result = await this.api.exec('npm', ['run', 'lint'], { cwd: process.cwd() });
      if (result.code !== 0) {
        return [{ type: 'LINT', severity: 'HIGH', details: this.truncate(result.stdout, 200) }];
      }
    } catch {
      return [{ type: 'LINT', severity: 'HIGH', details: 'Lint command failed' }];
    }
    return [];
  }

  private async runTypeCheck(): Promise<Violation[]> {
    try {
      const result = await this.api.exec('npx', ['tsc', '--noEmit'], { cwd: process.cwd() });
      if (result.code !== 0) {
        return [{ type: 'TYPESCRIPT', severity: 'CRITICAL', details: this.truncate(result.stdout, 200) }];
      }
    } catch {
      return [{ type: 'TYPESCRIPT', severity: 'CRITICAL', details: 'Type check failed' }];
    }
    return [];
  }

  private async runTestCheck(): Promise<Violation[]> {
    try {
      const result = await this.api.exec('npm', ['test', '--', '--coverage'], { cwd: process.cwd() });
      if (result.code !== 0) {
        return [{ type: 'TEST', severity: 'CRITICAL', details: this.truncate(result.stdout, 200) }];
      }

      const coverage = await getCoverageReport(process.cwd());
      if (coverage) {
        const thresholds = { statements: COVERAGE_TARGET, branches: COVERAGE_TARGET, functions: COVERAGE_TARGET, lines: COVERAGE_TARGET };
        const missing: string[] = [];
        for (const key of Object.keys(thresholds) as (keyof CoverageDelta)[]) {
          const threshold = thresholds[key];
          const value = coverage[key];
          if (value < threshold) {
            missing.push(`${key}: ${value.toFixed(1)}% < ${threshold}%`);
          }
        }
        if (missing.length > 0) {
          return [{ type: 'COVERAGE', severity: 'HIGH', details: `Coverage below target: ${missing.join(', ')}` }];
        }
      }
    } catch {
      return [{ type: 'TEST', severity: 'CRITICAL', details: 'Test command failed' }];
    }
    return [];
  }

  private async runBuildCheck(): Promise<Violation[]> {
    try {
      const result = await this.api.exec('npm', ['run', 'build'], { cwd: process.cwd() });
      if (result.code !== 0) {
        return [{ type: 'BUILD', severity: 'CRITICAL', details: this.truncate(result.stdout, 200) }];
      }
    } catch {
      return [{ type: 'BUILD', severity: 'CRITICAL', details: 'Build failed' }];
    }
    return [];
  }

  private async runSecurityCheck(): Promise<Violation[]> {
    const violations: Violation[] = [];

    const secretScan = await scanForSecrets(process.cwd());
    if (secretScan.secretsFound) {
      violations.push({ type: 'SECRETS', severity: 'CRITICAL', details: secretScan.details || 'Secrets detected' });
    }

    const audit = await checkNpmAudit(this.api);
    if (audit.vulnerabilities > 0) {
      violations.push({ type: 'VULNERABILITIES', severity: 'HIGH', details: `${audit.vulnerabilities} npm vulnerabilities` });
    }

    return violations;
  }

  private async runComplexityCheck(): Promise<Violation[]> {
    try {
      const reports = await analyzeComplexity(process.cwd());
      const highComplexity = reports.filter(r => r.complexity > COMPLEXITY_THRESHOLD || r.lines > LINES_THRESHOLD);
      if (highComplexity.length > 0) {
        return [{ type: 'COMPLEXITY', severity: 'HIGH', details: `Found ${highComplexity.length} high complexity functions` }];
      }
    } catch {
      // ignore
    }
    return [];
  }

  private async proactiveAnalysis(): Promise<Improvement[]> {
    const improvements: Improvement[] = [];
    improvements.push(...await this.suggestCoverageImprovements());
    improvements.push(...await this.suggestComplexityRefactors());
    improvements.push(...await this.suggestDependencyUpdates());
    improvements.push(...await this.suggestSecurityHardening());
    improvements.push(...await this.suggestDocumentationImprovements());
    return improvements;
  }

  private async suggestCoverageImprovements(): Promise<Improvement[]> {
    try {
      const coverage = await getCoverageReport(process.cwd());
      if (!coverage) return [];

      const targets = { statements: 85, branches: 85, functions: 85, lines: 85 };
      const suggestions: Improvement[] = [];

      for (const key of Object.keys(targets) as (keyof CoverageDelta)[]) {
        const current = coverage[key];
        const target = targets[key];
        if (current >= COVERAGE_TARGET && current < target) {
          suggestions.push({ type: 'TESTS', module: 'coverage', description: `Increase ${key} coverage from ${current.toFixed(1)}% to ${target}%`, impact: `Better test coverage for ${key}` });
        }
      }
      return suggestions;
    } catch {
      return [];
    }
  }

  private async suggestComplexityRefactors(): Promise<Improvement[]> {
    try {
      const reports = await analyzeComplexity(process.cwd());
      const nearThreshold = reports.filter(r => r.complexity >= 8 || r.lines >= 15);
      const suggestions: Improvement[] = [];

      for (const r of nearThreshold) {
        suggestions.push({ type: 'REFACTOR', module: r.file, description: `Refactor ${r.function} (complexity: ${r.complexity}, lines: ${r.lines})`, impact: `Reduce complexity to ≤6` });
      }
      return suggestions;
    } catch {
      return [];
    }
  }

  private async suggestDependencyUpdates(): Promise<Improvement[]> {
    const suggestions: Improvement[] = [];
    try {
      const outdated = await checkOutdated(this.api);
      for (const line of outdated) {
        const [pkg] = line.split(':');
        suggestions.push({ type: 'UPGRADE', module: pkg, description: `Update ${line}`, impact: 'Security patches, bug fixes' });
      }
    } catch {
      // ignore
    }
    return suggestions;
  }

  private async suggestSecurityHardening(): Promise<Improvement[]> {
    // Placeholder for future checks: rate limiting, CSP, etc.
    return [];
  }

  private async suggestDocumentationImprovements(): Promise<Improvement[]> {
    // Placeholder: JSDoc scan
    return [];
  }

  private prioritizeTasks(violations: Violation[], improvements: Improvement[]): Task[] {
    const tasks: Task[] = [];

    for (const v of violations) {
      tasks.push({
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'violation',
        priority: v.severity,
        description: `Fix ${v.type}: ${this.truncate(v.details, 80)}`,
        violation: v,
        createdAt: new Date(),
      });
    }

    for (const imp of improvements) {
      tasks.push({
        id: `improvement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'improvement',
        priority: this.priorityFromImprovementType(imp.type),
        description: imp.description,
        improvement: imp,
        createdAt: new Date(),
      });
    }

    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return tasks;
  }

  private priorityFromImprovementType(type: Improvement['type']): Severity {
    switch (type) {
      case 'SECURITY':
      case 'COMPLIANCE':
        return 'HIGH';
      case 'PERFORMANCE':
        return 'HIGH';
      case 'REFACTOR':
      case 'TESTS':
      case 'OBSERVABILITY':
      case 'UPGRADE':
        return 'MEDIUM';
      case 'DOCUMENTATION':
      case 'MODERNIZATION':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  private async executeTask(task: Task): Promise<ExecuteResult> {
    const startTime = Date.now();
    let changesCommitted = false;
    let testDelta = 0;
    let coverageDelta: CoverageDelta = { statements: 0, branches: 0, functions: 0, lines: 0 };
    let performanceDelta: PerformanceDelta | undefined;
    let securityActions: string[] = [];
    let success = false;
    let error: string | undefined;

    try {
      if (task.type === 'violation') {
        const fixResult = await this.fixViolation(task);
        changesCommitted = fixResult.committed;
        testDelta = fixResult.testDelta;
        coverageDelta = fixResult.coverageDelta;
        securityActions = fixResult.securityActions;
      } else {
        const impResult = await this.implementImprovement(task);
        changesCommitted = impResult.committed;
        testDelta = impResult.testDelta;
        coverageDelta = impResult.coverageDelta;
        performanceDelta = impResult.performanceDelta;
        securityActions = impResult.securityActions;
      }

      const verified = await this.verifyQualityGate();
      if (!verified) {
        throw new Error('Quality gate verification failed after task execution');
      }

      success = true;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : String(e);
    }

    return {
      success,
      duration: Date.now() - startTime,
      changesCommitted,
      testDelta,
      coverageDelta,
      performanceDelta,
      securityActions,
      error,
    };
  }

  private async fixViolation(task: Task): Promise<any> {
    console.log(`[AutonomousAgent] Fixing violation: ${task.violation?.type}`);
    return { committed: false, testDelta: 0, coverageDelta: { statements: 0, branches: 0, functions: 0, lines: 0 }, securityActions: [] };
  }

  private async implementImprovement(task: Task): Promise<any> {
    console.log(`[AutonomousAgent] Implementing improvement: ${task.improvement?.type}`);
    return { committed: false, testDelta: 0, coverageDelta: { statements: 0, branches: 0, functions: 0, lines: 0 }, performanceDelta: undefined, securityActions: [] };
  }

  private async verifyQualityGate(): Promise<boolean> {
    try {
      const testResult = await this.api.exec('npm', ['test', '--', '--coverage'], { cwd: process.cwd() });
      if (testResult.code !== 0) return false;
      const lintResult = await this.api.exec('npm', ['run', 'lint'], { cwd: process.cwd() });
      return lintResult.code === 0;
    } catch {
      return false;
    }
  }

  private async logMetrics(task: Task, result: ExecuteResult, duration: number): Promise<void> {
    const metrics: AgentMetrics = {
      taskId: task.id,
      taskType: task.type,
      priority: task.priority,
      duration,
      status: result.success ? 'success' : 'failed',
      testDelta: result.testDelta || 0,
      coverageDelta: result.coverageDelta || { statements: 0, branches: 0, functions: 0, lines: 0 },
      performanceDelta: result.performanceDelta,
      securityActions: result.securityActions || [],
      notes: result.error || 'Completed',
    };

    const logEntry = this.formatMetricsLog(metrics);
    await this.appendToFile('docs/AGENT_METRICS.md', logEntry);
  }

  private formatMetricsLog(metrics: AgentMetrics): string {
    const timestamp = new Date().toISOString();
    return [
      `## [${timestamp}] Cycle - Task: ${metrics.taskId.substring(0, 12)}`,
      `- **Type**: ${metrics.taskType === 'violation' ? 'Violation Fix' : 'Proactive Improvement'}`,
      `- **Priority**: ${metrics.priority}`,
      `- **Duration**: ${metrics.duration}ms`,
      `- **Status**: ${metrics.status === 'success' ? '✅ Success' : '❌ Failed'}`,
      `- **Test Delta**: ${metrics.testDelta} tests`,
      `- **Coverage Delta**: Statements: ${metrics.coverageDelta.statements}%, Branches: ${metrics.coverageDelta.branches}%, Functions: ${metrics.coverageDelta.functions}%, Lines: ${metrics.coverageDelta.lines}%`,
      `- **Performance**: ${metrics.performanceDelta ? JSON.stringify(metrics.performanceDelta) : 'N/A'}`,
      `- **Security**: ${metrics.securityActions.join(', ') || 'None'}`,
      `- **Notes**: ${metrics.notes}`,
      '',
    ].join('\n');
  }

  private shouldUpdateDocs(task: Task, result: ExecuteResult): boolean {
    return task.priority === 'CRITICAL' || result.changesCommitted;
  }

  private async updateEvolutionDocs(_task: Task, _result: ExecuteResult): Promise<void> {
    // Could append to AGENT_PROFILE.md or EVOLUTION.md
  }

  private async commitTask(task: Task, _result: ExecuteResult): Promise<void> {
    const { dirty } = await getGitStatus();
    if (!dirty) return;

    const commitMsg = task.type === 'violation'
      ? `fix(agent): ${task.violation?.type || 'issue'} - ${this.truncate(task.description, 50)}`
      : `feat(improve): ${task.improvement?.type || 'general'} - ${this.truncate(task.description, 50)}`;

    const commitResult = await commitAll(commitMsg);
    if (!commitResult.success) {
      console.error('[AutonomousAgent] Commit failed:', commitResult.error);
      return;
    }

    const remoteExists = await hasRemote();
    if (remoteExists) {
      const pushResult = await pushCommits();
      if (!pushResult.success) {
        console.log('[AutonomousAgent] Push skipped (no remote or auth issue)');
      } else {
        console.log('[AutonomousAgent] Pushed commit');
      }
    }

    console.log(`[AutonomousAgent] Committed: ${commitMsg}`);
  }

  private async logError(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const entry = `[${new Date().toISOString()}] Cycle error: ${message}\n${stack || ''}\n---\n`;
    await this.appendToFile('docs/AUTONOMOUS_ERRORS.log', entry);
  }

  private async appendToFile(path: string, content: string): Promise<void> {
    try {
      const { appendFileSync, mkdirSync } = await import('node:fs');
      const dir = path.split('/').slice(0, -1).join('/');
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        // Dir exists
      }
      appendFileSync(path, content);
    } catch (e) {
      console.error(`[AutonomousAgent] Failed to write ${path}:`, e);
    }
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.substring(0, max - 3) + '...';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
