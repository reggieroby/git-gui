export class SqliteUmzugStorage {
  constructor(options = {}) {
    this.tableName = options.tableName || 'migrations'
  }

  async ensureTable(context) {
    const { db } = context
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        name TEXT PRIMARY KEY,
        executed_at TEXT NOT NULL
      );
    `)
  }

  async executed({ context }) {
    await this.ensureTable(context)
    const rows = await context.db.all(`SELECT name FROM ${this.tableName} ORDER BY executed_at ASC`)
    return rows.map(r => r.name)
  }

  async logMigration({ name, context }) {
    await this.ensureTable(context)
    await context.db.run(`INSERT OR IGNORE INTO ${this.tableName}(name, executed_at) VALUES(?, datetime('now'))`, name)
  }

  async unlogMigration({ name, context }) {
    await this.ensureTable(context)
    await context.db.run(`DELETE FROM ${this.tableName} WHERE name = ?`, name)
  }
}

export default SqliteUmzugStorage

