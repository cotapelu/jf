# PROMPT.md - System Prompt Composition

System prompt được build từ 8 nguồn chính:

| # | Source | Description |
|---|--------|-------------|
| 1 | customPrompt (SYSTEM.md) | Workflow reference, governance rules |
| 2 | toolSnippets | Từ tool definitions |
| 3 | promptGuidelines | Từ tool definitions |
| 4 | contextFiles (AGENTS.md, CLAUDE.md) | Full system rules |
| 5 | skills (SKILL.md files) | Development rules |
| 6 | appendSystemPrompt (APPEND_SYSTEM.md) | AI-Native vision |
| 7 | date | Current date |
| 8 | cwd | Current working directory |

---

## Chi tiết từng nguồn

### 1. customPrompt (SYSTEM.md)

Workflow reference chứa:
- Workflow loop: `READ → PLAN → IMPLEMENT → VERIFY → REFLECT → LEARN → DOCUMENT → COMMIT`
- Bootstrap protocol cho repositories mới
- Governance rules (Anti-Amnesia, Blast Radius, Anti-Thrash, Prime Invariant)
- UI workflow, Oracle mode, Stop conditions

### 2. toolSnippets

Từ tool definitions:
- `read`: "Read file contents"
- `bash`: "Execute bash commands (ls, grep, find, etc.)"
- `edit`: "Make precise file edits with exact text replacement"
- `write`: "Create or overwrite files"
- `grep`: "Search file contents for patterns"
- `find`: "Find files by glob pattern"
- `ls`: "List directory contents"
- Extension tools: (từ tool definitions)

### 3. promptGuidelines

Từ tool definitions:
- **edit**: 
  - "Use edit for precise changes (edits[].oldText must match exactly)"
  - "When changing multiple separate locations in one file, use one edit call with multiple entries"
  - "Keep edits[].oldText as small as possible while still being unique"
- **read**: "Use read to examine files instead of cat or sed"
- **write**: "Use write only for new files or complete rewrites"
- bash/grep/find/ls: (không có promptGuidelines riêng)

### 4. contextFiles (AGENTS.md, CLAUDE.md)

Full system rules:
- HARD RULES (CRITICAL-3/2/1, IMPORTANT-1)
- SELF-REFLECTION CYCLE
- RULE EVOLUTION PROTOCOL
- MEMORY system

**Note**: CLAUDE.md chứa PRIMARY rules; AGENTS.md dành cho code generation mindset.

### 5. appendSystemPrompt (APPEND_SYSTEM.md)

AI-Native vision:
- AutoResearch (autonomous experimentation loop)
- Attention Is All You Need (Transformer foundation)
- Shipping at Inference-Speed (AI-native development philosophy)
- Unified loop: `objective → prompt → generate → execute → evaluate → improve → repeat`

### 6. skills (SKILL.md files)

Development rules:
- First message behavior (read README, ask which module)
- Code quality rules (no `any` types, no inline imports)
- Commands (npm run check, never npm run dev/build/test unless instructed)
- GitHub issues workflow, PR workflow, OSS weekend mode
- Testing with vitest, tmux testing, style guidelines
- Changelog format, releasing process
- Adding new LLM providers

### 7. date & cwd

Metadata: current date và working directory

