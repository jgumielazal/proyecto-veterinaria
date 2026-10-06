import pg = require("pg");

const pool = new pg.Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: "127.0.0.1",
        port: 5432,
        user: "veterinaria",
        password: "veterinaria_local",
        database: "veterinaria",
      }),
  connectionTimeoutMillis: 3000,
  query_timeout: 3000,
});

pool.on("error", (error) => {
  console.error("Error de conexión con PostgreSQL:", error.message);
});

export = pool;
