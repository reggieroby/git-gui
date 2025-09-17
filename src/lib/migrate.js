import { Umzug } from 'umzug'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { getDb } from './db.js'
import { SqliteUmzugStorage } from './umzugSqliteStorage.js'

const DATA_DIR = process.env.DATA_DIR || '/srv/data'

export async function runMigrations() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}

  const db = await getDb()

  const __filename = fileURLToPath(import.meta.url)
  const here = path.dirname(__filename)
  const glob = path.join(here, 'migrations/*.js')

  const umzug = new Umzug({
    migrations: { glob },
    context: { db },
    storage: new SqliteUmzugStorage({ tableName: 'migrations' }),
    logger: console
  })

  await umzug.up()
}

export default runMigrations
