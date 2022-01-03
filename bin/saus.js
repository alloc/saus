#!/usr/bin/env node

if (/(^| )saus:\*( |$)/.test(process.env.DEBUG || '')) {
  process.env.DEBUG += ' saus'
}

import cli from '../dist/cli.js'
cli.parse()
