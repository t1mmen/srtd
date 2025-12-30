---
"@t1mmen/srtd": minor
---

Add `srtd doctor` command for diagnosing setup issues

New diagnostic command that validates your SRTD configuration:
- Checks config file exists and schema is valid
- Verifies template and migration directories exist and have correct permissions
- Validates build log integrity
- Tests database connectivity
- Confirms templates are present

Run `srtd doctor` to quickly identify setup problems.
