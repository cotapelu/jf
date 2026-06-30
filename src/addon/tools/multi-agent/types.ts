export type ChildType = 'llm' | 'executor' | 'test-runner' | 'custom';

export type ChildStatus = 'idle' | 'starting' | 'running' | 'waiting-input' | 'completed' | 'error' | 'terminated';

export interface ChildConfig {
  id: string;
  type: ChildType;
  mission: string;
  context: Record<string, unknown>;
  tools: string[];
  createdAt: string;
}

export interface ChildInfo {
  id: string;
  type: ChildType;
  status: ChildStatus;
  mission: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
}

export interface ParentConfig {
  cwd: string;
  agentDir: string;
  model: string;
  thinkingLevel: string;
  authStoragePath?: string;
  tools: string[];
  services?: import('@earendil-works/pi-coding-agent').AgentSessionServices;
  sessionManager?: import('@earendil-works/pi-coding-agent').SessionManager;
}

export interface ChildWorkerData {
  childId: string;
  config: ChildConfig;
  parentConfig: ParentConfig;
}

// Parent -> Child messages
export interface TaskMessage {
  type: 'task';
  payload: { mission: string; context: Record<string, unknown>; tools: string[] };
}

export interface InputMessage {
  type: 'input';
  payload: unknown;
}

export interface CancelMessage {
  type: 'cancel';
}

export type ParentToChildMessage = TaskMessage | InputMessage | CancelMessage;

export function isTaskMessage(msg: ParentToChildMessage): msg is TaskMessage {
  return msg.type === 'task';
}

export function isInputMessage(msg: ParentToChildMessage): msg is InputMessage {
  return msg.type === 'input';
}

export function isCancelMessage(msg: ParentToChildMessage): msg is CancelMessage {
  return msg.type === 'cancel';
}

// Child -> Parent messages
export interface ProgressMessage {
  type: 'progress';
  payload: { checkpoint: string; data?: unknown };
}

export interface QuestionMessage {
  type: 'question';
  payload: { question: string; options?: string[] };
}

export interface ResultMessage {
  type: 'result';
  payload: { output: unknown; artifacts?: string[] };
}

export interface ErrorMessage {
  type: 'error';
  payload: { message: string; recoverable: boolean };
}

export type ChildToParentMessage = ProgressMessage | QuestionMessage | ResultMessage | ErrorMessage;

export function isProgressMessage(msg: ChildToParentMessage): msg is ProgressMessage {
  return msg.type === 'progress';
}

export function isQuestionMessage(msg: ChildToParentMessage): msg is QuestionMessage {
  return msg.type === 'question';
}

export function isResultMessage(msg: ChildToParentMessage): msg is ResultMessage {
  return msg.type === 'result';
}

export function isErrorMessage(msg: ChildToParentMessage): msg is ErrorMessage {
  return msg.type === 'error';
}

export interface MessageEnvelope<M extends ParentToChildMessage | ChildToParentMessage> {
  from: 'parent' | 'child';
  to: string;
  type: M['type'];
  payload: M extends { payload: infer P } ? P : never;
  timestamp: string;
  correlationId: string;
}

// Tool parameters
export interface SpawnChildParams {
  type: ChildType;
  mission: string;
  context?: Record<string, unknown>;
  tools?: string[];
}

export interface SendMessageParams {
  childId: string;
  message: ParentToChildMessage;
}

export interface AwaitResultParams {
  childId: string;
  timeoutMs?: number;
}

export interface ListChildrenParams {
  status?: ChildStatus;
}

export interface TerminateChildParams {
  childId: string;
  force?: boolean;
}

export interface ReportProgressParams {
  checkpoint: string;
  data?: unknown;
}

export interface AskQuestionParams {
  question: string;
  options?: string[];
}

export interface CompleteParams {
  output: unknown;
  artifacts?: string[];
}

export interface ChildErrorParams {
  message: string;
  recoverable: boolean;
}