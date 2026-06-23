// Types for Autonomous Agent

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Violation {
  type: string;
  severity: Severity;
  file?: string;
  line?: number;
  details: string;
}

export interface Improvement {
  type: 'REFACTOR' | 'PERFORMANCE' | 'SECURITY' | 'TESTS' | 'DOCUMENTATION' | 'OBSERVABILITY' | 'COMPLIANCE' | 'UPGRADE' | 'MODERNIZATION';
  module: string;
  description: string;
  impact: string;
}

export interface Task {
  id: string;
  type: 'violation' | 'improvement';
  priority: Severity;
  description: string;
  violation?: Violation;
  improvement?: Improvement;
  createdAt: Date;
}

export interface ExecuteResult {
  success: boolean;
  duration: number;
  changesCommitted: boolean;
  testDelta?: number;
  coverageDelta?: CoverageDelta;
  performanceDelta?: PerformanceDelta;
  securityActions?: string[];
  error?: string;
}

export interface CoverageDelta {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface PerformanceDelta {
  p50?: number;
  p99?: number;
  scenario?: string;
}

export interface CoverageReport {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  total: number;
  covered: number;
}

export interface ComplexityReport {
  file: string;
  function: string;
  complexity: number;
  lines: number;
}

export interface SecurityScanResult {
  secretsFound: boolean;
  vulnerabilities: number;
  details?: string;
}

export interface AgentMetrics {
  taskId: string;
  taskType: 'violation' | 'improvement';
  priority: Severity;
  duration: number;
  status: 'success' | 'failed';
  testDelta: number;
  coverageDelta: CoverageDelta;
  performanceDelta?: PerformanceDelta;
  securityActions: string[];
  notes: string;
}

export interface AgentStatus {
  isRunning: boolean;
  lastCycleTime?: Date;
  currentTask?: Task;
  tasksCompleted: number;
  tasksFailed: number;
  cycleCount: number;
}
