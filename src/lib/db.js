import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || '/srv/data'
const DB_PATH = path.join(DATA_DIR, 'app.sqlite')

async function init() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database })
  await db.exec('PRAGMA journal_mode = WAL;')
  await db.exec('PRAGMA busy_timeout = 5000;')
  return db
}

// Singleton (promise) to avoid multiple opens in dev/hot-reload
const dbPromise = globalThis.__APP_DB_PROMISE || init()
if (!globalThis.__APP_DB_PROMISE) globalThis.__APP_DB_PROMISE = dbPromise

export async function getDb() { return dbPromise }

export async function setSetting(key, value) {
  const db = await getDb()
  const v = typeof value === 'string' ? value : JSON.stringify(value)
  await db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, v)
}

export async function getSetting(key) {
  const db = await getDb()
  const row = await db.get('SELECT value FROM settings WHERE key=?', key)
  if (!row) return null
  const val = row.value
  try { return JSON.parse(val) } catch { return val }
}

export async function getAllSettings() {
  const db = await getDb()
  const rows = await db.all('SELECT key, value FROM settings')
  const out = {}
  for (const { key, value } of rows) {
    try { out[key] = JSON.parse(value) } catch { out[key] = value }
  }
  return out
}

export default dbPromise
