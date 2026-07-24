#!/usr/bin/env node
import process from 'node:process'

import { runMcpCli } from '@openapi-to/mcp/cli'

await runMcpCli(process.argv.slice(2))
