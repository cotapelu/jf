# Custom Message Types Examples

This directory demonstrates how to create and use custom message types in pi's agent system.

## 📄 Overview

Custom message types allow you to extend the conversation format with domain-specific data structures. This is useful for:
- Specialized tool results
- Domain-specific annotations
- Enhanced debugging information
- Custom agent protocols

## 📄 Examples

### 1. Custom Tool Result Message (`custom-tool-result.ts`)

Extends tool results with additional metadata and validation.

```typescript
import type { Message, ToolResultContent } from "@quangtynu/pi-ai";

export interface CustomToolResultMessage extends Message {
	type: "custom_tool_result";
	content: CustomToolResultContent[];
	executionTime: number;
	validationErrors?: string[];
}

export interface CustomToolResultContent extends ToolResultContent {
	metadata?: {
		confidence: number;
		cached: boolean;
		sourceVersion: string;
	};
}

export function createCustomToolResult(
	toolName: string,
	result: any,
	executionTime: number,
	options: {
		confidence?: number;
		cached?: boolean;
		sourceVersion?: string;
		validationErrors?: string[];
	} = {}
): CustomToolResultMessage {
	const { confidence = 1.0, cached = false, sourceVersion = "1.0.0" } = options;
	
	return {
		role: "tool_result",
		type: "custom_tool_result",
		content: [{
			type: "tool_result",
			toolName,
			result,
			metadata: { confidence, cached, sourceVersion }
		}],
		executionTime,
		validationErrors: options.validationErrors,
		timestamp: Date.now()
	};
}
```

### 2. Annotated User Message (`annotated-user-message.ts`)

User messages with semantic annotations for better context understanding.

```typescript
import type { Message, TextContent } from "@quangtynu/pi-ai";

export interface Annotation {
	type: "entity" | "sentiment" | "priority" | "category";
	value: string;
	confidence: number;
	span: [number, number]; // character offsets
}

export interface AnnotatedUserMessage extends Message {
	type: "annotated_user";
	content: AnnotatedContent[];
	annotations: Annotation[];
	metadata: {
		intent?: string;
		language?: string;
		sentiment?: "positive" | "negative" | "neutral";
	};
}

export interface AnnotatedContent extends TextContent {
	annotations?: Annotation[];
}

export function createAnnotatedUserMessage(
	text: string,
	annotations: Annotation[],
	metadata: AnnotatedUserMessage["metadata"] = {}
): AnnotatedUserMessage {
	const content: AnnotatedContent[] = [{
		type: "text",
		text,
		annotations
	}];
	
	return {
		role: "user",
		type: "annotated_user",
		content,
		annotations,
		metadata: {
			language: "en",
			...metadata
		},
		timestamp: Date.now()
	};
}
```

### 3. Structured Thinking Message (`structured-thinking.ts`)

Enhanced thinking messages with step-by-step reasoning.

```typescript
import type { Message, ThinkingContent } from "@quangtynu/pi-ai";

export interface ThinkingStep {
	id: string;
	description: string;
	reasoning: string;
	confidence: number;
	inputs?: Record<string, any>;
	outputs?: Record<string, any>;
}

export interface StructuredThinkingMessage extends Message {
	type: "structured_thinking";
	content: StructuredThinkingContent[];
	steps: ThinkingStep[];
	finalConclusion?: string;
	totalTime?: number;
}

export interface StructuredThinkingContent extends ThinkingContent {
	steps?: ThinkingStep[];
}

export function createStructuredThinking(
	steps: ThinkingStep[],
	conclusion?: string,
	totalTime?: number
): StructuredThinkingMessage {
	return {
		role: "assistant",
		type: "structured_thinking",
		content: [{
			type: "thinking",
			thinking: steps.map(s => `${s.description}: ${s.reasoning}`).join("\n"),
			steps
		}],
		steps,
		finalConclusion: conclusion,
		totalTime,
		timestamp: Date.now()
	};
}
```

### 4. Multi-Modal Image Message (`multimodal-image.ts`)

Enhanced image messages with metadata and regions of interest.

```typescript
import type { Message, ImageContent } from "@quangtynu/pi-ai";

export interface RegionOfInterest {
	x: number;
	y: number;
	width: number;
	height: number;
	label?: string;
	confidence?: number;
}

export interface EnhancedImageMessage extends Message {
	type: "enhanced_image";
	content: EnhancedImageContent[];
	metadata: {
		width: number;
		height: number;
		format: string;
		fileSize: number;
		capturedAt?: string;
		location?: {
			latitude: number;
			longitude: number;
		};
	};
	regions: RegionOfInterest[];
}

export interface EnhancedImageContent extends ImageContent {
	regions?: RegionOfInterest[];
}

export function createEnhancedImageMessage(
	data: string,
	mimeType: string,
	metadata: EnhancedImageMessage["metadata"],
	regions: RegionOfInterest[] = []
): EnhancedImageMessage {
	return {
		role: "user",
		type: "enhanced_image",
		content: [{
			type: "image",
			data,
			mimeType,
			regions
		}],
		metadata,
		regions,
		timestamp: Date.now()
	};
}
```

### 5. Workflow State Message (`workflow-state.ts`)

Messages that track multi-step workflow state.

```typescript
import type { Message } from "@quangtynu/pi-ai";

export interface WorkflowStep {
	id: string;
	name: string;
	status: "pending" | "running" | "completed" | "failed";
	startTime?: number;
	endTime?: number;
	result?: any;
	error?: string;
}

export interface WorkflowStateMessage extends Message {
	type: "workflow_state";
	content: WorkflowStateContent[];
	workflowId: string;
	workflowName: string;
	currentStep: string;
	steps: WorkflowStep[];
	overallStatus: "running" | "completed" | "failed" | "cancelled";
	progress: number; // 0-100
}

export interface WorkflowStateContent {
	type: "workflow_state";
	workflowId: string;
	currentStep: string;
	progress: number;
}

export function createWorkflowStateMessage(
	workflowId: string,
	workflowName: string,
	steps: WorkflowStep[],
	currentStep: string,
	overallStatus: WorkflowStateMessage["overallStatus"]
): WorkflowStateMessage {
	const completedSteps = steps.filter(s => s.status === "completed").length;
	const progress = Math.round((completedSteps / steps.length) * 100);
	
	const content: WorkflowStateContent[] = [{
		type: "workflow_state",
		workflowId,
		currentStep,
		progress
	}];
	
	return {
		role: "system",
		type: "workflow_state",
		content,
		workflowId,
		workflowName,
		currentStep,
		steps,
		overallStatus,
		progress,
		timestamp: Date.now()
	};
}
```

## 📚 Usage Examples

### Registering Custom Message Handlers

```typescript
import { AgentSession } from "@quangtynu/pi-agent-core";
import { 
	createCustomToolResult,
	createStructuredThinking 
} from "./custom-messages";

const session = new AgentSession();

// Handle custom tool results
session.on("custom_tool_result", (message) => {
	console.log("Tool execution time:", message.executionTime);
	if (message.validationErrors?.length) {
		console.warn("Validation errors:", message.validationErrors);
	}
});

// Handle structured thinking
session.on("structured_thinking", (message) => {
	console.log("Thinking steps:", message.steps.length);
	message.steps.forEach(step => {
		console.log(`- ${step.description} (${step.confidence})`);
	});
});
```

### Sending Custom Messages

```typescript
import { createStructuredThinking } from "./structured-thinking";

// Create and send structured thinking
const thinkingMessage = createStructuredThinking(
	[
		{
			id: "step1",
			description: "Analyze requirements",
			reasoning: "Understanding what needs to be built",
			confidence: 0.9,
			inputs: { requirements: "Build a web app" }
		},
		{
			id: "step2",
			description: "Design architecture",
			reasoning: "Choosing appropriate technologies",
			confidence: 0.85,
			inputs: { requirements: "Build a web app" }
		}
	],
	"Proceeding with React and Node.js",
	1500
);

session.addMessage(thinkingMessage);
```

### Extending Agent Context

```typescript
import type { Context } from "@quangtynu/pi-ai";
import { createAnnotatedUserMessage } from "./annotated-user-message";

const annotatedMessage = createAnnotatedUserMessage(
	"I need to analyze sales data for Q4",
	[
		{
			type: "entity",
			value: "sales data",
			confidence: 0.95,
			span: [20, 31]
		},
		{
			type: "category",
			value: "business_analytics",
			confidence: 0.9,
			span: [0, 42]
		}
	],
	{
		intent: "data_analysis",
		sentiment: "neutral"
	}
);

const context: Context = {
	messages: [annotatedMessage],
	systemPrompt: "You are a business analyst."
};
```

## 🎨 Integration with pi System

### Type Registration

To use custom message types with TypeScript:

```typescript
// Augment the base Message type
declare module "@quangtynu/pi-ai" {
	interface MessageTypeMap {
		"custom_tool_result": CustomToolResultMessage;
		"annotated_user": AnnotatedUserMessage;
		"structured_thinking": StructuredThinkingMessage;
		"enhanced_image": EnhancedImageMessage;
		"workflow_state": WorkflowStateMessage;
	}
}
```

### Event Handling

```typescript
import { type AgentSessionEvent } from "@quangtynu/pi-agent-core";

// Handle custom message events
const handleCustomEvent = (event: AgentSessionEvent) => {
	switch (event.type) {
		case "custom_tool_result":
			// Handle custom tool result
			break;
		case "structured_thinking":
			// Handle structured thinking
			break;
		// ... other custom types
	}
};
```

## 🔧 Best Practices

### 1. Type Safety
- Always extend base message interfaces
- Use discriminated unions for type discrimination
- Include proper type guards for runtime checking

### 2. Backward Compatibility
- Maintain compatibility with standard message types
- Provide fallback handlers for unknown message types
- Version your custom message formats

### 3. Performance
- Keep message payloads lean
- Avoid deeply nested structures
- Use efficient serialization formats

### 4. Documentation
- Document message schemas
- Provide usage examples
- Version your custom types

## 📦 Example Implementations

See the following files for complete implementations:
- `custom-tool-result.ts` - Enhanced tool results
- `annotated-user-message.ts` - Semantic annotations
- `structured-thinking.ts` - Step-by-step reasoning
- `multimodal-image.ts` - Rich image content
- `workflow-state.ts` - Multi-step workflow tracking

---

**Last Updated**: 2026-05-07  
**Version**: 1.0.0