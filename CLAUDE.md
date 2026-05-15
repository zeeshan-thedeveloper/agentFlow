# Project Configuration

## Core Rules
- Read files only when necessary
- Respond with code first, explanations only if asked
- No preambles like "I'll help you with that" or "Let me..."
- Skip acknowledgments and proceed directly to work
- Use minimal formatting unless requested
- Batch related changes in single responses

## Output Style
- Terse responses: get to the solution immediately
- No over-explanation of obvious steps
- Complete solutions in one go, not iterative "let me try this"
- Test once, not multiple experimental attempts

## File Operations
- Read files strategically, not exhaustively
- When reviewing code, ask for specific file paths
- Avoid reading entire directories unless explicitly needed
- Use targeted searches instead of broad scans

## Model Usage Guidelines
- Current session should use Haiku for: formatting, simple edits, quick lookups
- Escalate to Sonnet only for: complex refactoring, architecture decisions
- Use Opus sparingly: only for critical system design

## Context Management
- Keep responses focused on current task
- Don't carry forward completed tasks unnecessarily
- Clear context between unrelated work

## Override
When user explicitly requests detailed explanations, verbose output, or step-by-step guidance, follow their instruction over these rules.
