---
"@openapi-to/core": minor
"@openapi-to/mcp": minor
---

Add optional invocation-scoped cancellation to compiler, config, plugin, artifact, and comparison APIs, and harden the read-only stdio MCP server with bounded per-tool deadlines, cancellation-safe generation queuing, stable progress, structured stderr logging, fixed evaluation corpora, performance/stress gates, and operational security documentation. Existing Core and CLI calls remain source-compatible because every new execution option is optional. The repository fixed-version group coordinates the eventual public-package minor release; no versioning or publication is performed here.
