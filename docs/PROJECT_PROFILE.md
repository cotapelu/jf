# Project Profile

**Generated**: 2026-07-22T13:25:04.172Z
**Source**: Auto-detected at startup

## Size
- Category: **MEDIUM**
- Evidence:
  - LOC: 44794
  - Files: 304
  - Tests: 139
  - Dependencies: 26

## Risk
- Category: **HIGH**
- Evidence:
  - High-risk keywords: 567
  - Medium-risk keywords: 1286
  - Low-risk keywords: 73
- ⚠️ High-risk keywords detected – full compliance scanning enabled


## Deployment
- Category: **CLOUD**
- Cloud provider: detected



- Cost Optimization: Required

## Team
- Category: **SMALL**
- Evidence:
  - Authors (30d): 2
  - Commits (30d): 318
  - PR estimate: 0
  - CODEOWNERS: No
- Process: 1 review required

## Applied Thresholds

| Metric | Standard | Adjusted | Reason |
|--------|----------|----------|--------|
| Max Function Lines | 20 | 20 | medium size |
| Min Coverage | 80% | 80% | medium size |
| Complexity Limit | 10 | 10 | Default |
| Security Scan | HIGH | CRITICAL | high risk |
| Performance Gates | Required | Yes | high risk |
| Compliance Matrix | Full | Yes | high risk |
| PR Reviews Required | 1 | 1 | small team |
| SLA Initial Review | <24h | <4h | small team |

## Manual Override

To override auto-detected profile, create `docs/PROJECT_PROFILE_OVERRIDE.md`:

```yaml
size: large
risk: high
deployment: cloud
team: large-org
```

Agent will use override values on next startup.

## Notes

- Profile auto-updates on agent startup (if evidence changes significantly)
- Adjustments applied to quality gates, testing pipeline, compliance scanning
- For questions, see GOAL.md §20.2 and docs/PROJECT_PROFILE.md
