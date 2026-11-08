/**
 * Crea tablas de proformas/productos y carga el catálogo inicial.
 * Uso: npm run seed:proformas
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  let conexion;

  if (url && /^mysql(s)?:\/\//i.test(url)) {
    const u = new URL(url);
    conexion = await mysql.createConnection({
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'railway',
      multipleStatements: true,
      ssl: { rejectUnauthorized: false },
    });
  } else {
    conexion = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sistema_cilindros',
      multipleStatements: true,
      ...(String(process.env.DB_SSL || '').toLowerCase() === 'true'
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    });
  }

  const sqlPath = path.join(__dirname, '..', 'database', 'migracion_proformas.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Ejecutando migracion_proformas.sql ...');
  await conexion.query(sql);

  const [productos] = await conexion.query('SELECT tipo, COUNT(*) AS total FROM productos GROUP BY tipo');
  console.log('Catálogo:', productos);
  await conexion.end();
  console.log('Migración de proformas completada.');
}

main().catch((error) => {
  console.error('Error en migración de proformas:', error.message);
  process.exit(1);
});
