#!/usr/bin/env node
import runMigrations from '../src/lib/migrate.js'

try {
  await runMigrations()
  console.log('Migrations applied')
} catch (e) {
  console.error('Migration failed:', e?.stack || e?.message || e)
  process.exit(1)
}

