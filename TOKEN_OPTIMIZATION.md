# Token Optimization Setup

**Date Configured**: May 12, 2026  
**Baseline Usage**: $115.84/month (1.7M output tokens, 210M cache reads)

## Changes Made

### 1. CLAUDE.md Configuration
**File**: `CLAUDE.md`  
**Purpose**: Provides Claude Code with explicit instructions to minimize token usage through terse, focused responses.

**Key Rules**:
- Read files strategically, not exhaustively
- Respond with code first, minimal explanation
- Batch changes to reduce separate API calls
- No preambles or over-explanation

**Expected Impact**: 15-25% reduction in output tokens by eliminating unnecessary explanations and focusing responses.

---

### 2. Settings Configuration
**File**: `.claude/settings.json`  
**Purpose**: Configures Claude Code to use Haiku model (3.5x cheaper than Sonnet) and optimizes thinking token usage.

**Configuration**:
```json
{
  "model": "haiku-4-5",
  "env": {
    "MAX_THINKING_TOKENS": "5000",
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50"
  }
}
```

**Details**:
- **model**: Routes to Haiku for all tasks (cost: $0.80/$2.40 vs Sonnet $3/$15)
- **MAX_THINKING_TOKENS**: Limits extended thinking to 5k tokens (reduces overhead)
- **CLAUDE_CODE_SUBAGENT_MODEL**: Ensures subagents also use Haiku
- **CLAUDE_AUTOCOMPACT_PCT_OVERRIDE**: Enables aggressive context compression at 50%

**Expected Impact**: 60-70% cost reduction by defaulting to Haiku model.

---

### 3. Token Tracking Script
**File**: `check-tokens.ps1`  
**Purpose**: Quick script to check current token usage without manual API calls.

**Usage**:
```powershell
.\check-tokens.ps1
```

**Expected Output**: Current month's token usage and cost breakdown.

---

## Expected Savings Breakdown

| Optimization | Reduction | Method |
|--------------|-----------|--------|
| CLAUDE.md rules | 15-25% | Terse output, reduced explanations |
| Haiku default | 60-70% | Model cost differential |
| Context compression | 10-15% | Aggressive cache/context pruning |
| **Total Expected** | **40-55%** | Combined effect |

### Before & After Projection
- **Current**: $115.84/month
- **Projected**: $52-69/month (assuming 40-55% reduction)
- **Monthly Savings**: $46-63

---

## Implementation Checklist

- [x] Created CLAUDE.md with token-saving rules
- [x] Configured .claude/settings.json with Haiku default
- [x] Created token tracking script (check-tokens.ps1)
- [x] Documented all changes and expected impact

---

## Usage Guidelines

### For Development
1. Start your Claude Code session as usual
2. CLAUDE.md rules apply automatically
3. Settings.json defaults to Haiku model
4. Use Sonnet/Opus only for explicitly complex tasks requiring it

### Monitoring
Run token check weekly:
```powershell
.\check-tokens.ps1
```

Track results in a spreadsheet to verify savings over time.

### When to Override
- Use Sonnet if Haiku produces incomplete responses
- Use Opus for critical system architecture decisions
- Always test with Haiku first before escalating

---

## Advanced: Shell Aliases (Optional)

For PowerShell, add to your `$PROFILE`:
```powershell
function Check-Tokens { .\check-tokens.ps1 }
```

Then use: `Check-Tokens`

---

## Verification

To verify settings are active:
1. Open Claude Code / Cursor with this project
2. Check that responses are more concise (CLAUDE.md effect)
3. Verify model is Haiku via API response headers or Claude Code UI
4. Run `check-tokens.ps1` to see baseline

---

## References

- Anthropic Pricing: https://www.anthropic.com/pricing
- Claude Models: Haiku ($0.80/$2.40) vs Sonnet ($3/$15) vs Opus ($15/$60)
- Prompt Caching: 90% discount on repeated cache reads (your 210M reads are optimized)
