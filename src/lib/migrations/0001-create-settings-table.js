export async function up({ context }) {
  const { db } = context
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

export async function down({ context }) { }

