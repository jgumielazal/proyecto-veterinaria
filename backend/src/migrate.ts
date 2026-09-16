import pg = require("pg");
import fs = require("node:fs/promises");
import path = require("node:path");

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Configurá DATABASE_URL antes de ejecutar las migraciones.");
  }

  // La ruta funciona desde dist y no depende del directorio de ejecución.
  const directory = path.resolve(__dirname, "../migrations");
  const files = (await fs.readdir(directory))
    .filter(file => /^\d+_.*\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (files.length === 0) throw new Error("No se encontraron migraciones SQL.");

  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    // Bloqueo de sesión: también protege la creación inicial del historial.
    // PostgreSQL lo libera al cerrar la conexión, incluso ante un error.
    await client.query("SELECT pg_advisory_lock(73126, 1)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre TEXT PRIMARY KEY,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const result = await client.query<{ nombre: string }>("SELECT nombre FROM schema_migrations");
    const applied = new Set(result.rows.map(row => row.nombre));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Ya aplicada: ${file}`);
        continue;
      }
      const original = (await fs.readFile(path.join(directory, file), "utf8")).trim();
      // 003 ya trae una transacción exterior. El ejecutor toma su control
      // para incluir también el INSERT del historial en el mismo COMMIT.
      const wrapper = /^BEGIN\s*;([\s\S]*)COMMIT\s*;\s*$/i.exec(original);
      const sql = wrapper?.[1] ?? original;
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (nombre) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Aplicada: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        // No mostrar mensajes de conexión que puedan incluir secretos.
        const code = (error as { code?: string }).code ?? "sin código";
        throw new Error(`Falló ${file} (${code}); no se registró como aplicada.`);
      }
    }
    console.log("Migraciones al día.");
  } finally {
    await client.end();
  }
}

migrate().catch(error => {
  // Los errores generados arriba no incluyen la URL ni credenciales.
  if (error instanceof Error && /^(Configurá|No se encontraron|Falló)/.test(error.message)) {
    console.error(error.message);
  } else {
    console.error("No se pudieron ejecutar las migraciones. Revisá la conexión y los archivos SQL.");
  }
  process.exitCode = 1;
});
