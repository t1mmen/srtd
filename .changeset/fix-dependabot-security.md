---
"@t1mmen/srtd": patch
---

chore: fix security vulnerabilities

- Remove task-master-ai dev dependency (source of 4 vulnerabilities including high-severity CVEs in @anthropic-ai/claude-code and jsondiffpatch)
- Update transitive dependencies via npm audit fix (fixes jws, @modelcontextprotocol/sdk, body-parser, brace-expansion vulnerabilities)

Resolves all 12 Dependabot security alerts (9 high, 1 moderate, 2 low → 0 vulnerabilities).
