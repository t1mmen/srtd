---
"@t1mmen/srtd": minor
---

Refreshed CLI UI for build, apply, and watch commands:

- **New header format**: Grouped sections with context (source → dest paths, template counts)
- **Better branding**: Subtle `[srtd]` badge with improved contrast
- **Results table**: Aligned columns with color-coded status (built/applied/error)
- **Compact unchanged**: Comma-separated list instead of verbose listing
- **Rich error display**: SQL context with line numbers and caret positioning
- **Watch mode improvements**: Timestamped activity log with event icons
- **DRY improvements**: Extracted shared utilities (formatPath, formatTime, errorContext)
