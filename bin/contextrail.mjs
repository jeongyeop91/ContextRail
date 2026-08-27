#!/usr/bin/env node

import { run } from '../src/cli/main.mjs';

process.exitCode = await run();
