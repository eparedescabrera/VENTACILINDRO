const mysql = require('mysql2/promise');
require('dotenv').config();

function valorEnv(...nombres) {
  for (const nombre of nombres) {
    const valor = process.env[nombre];
    if (valor != null && String(valor).trim() !== '') {
      return String(valor).trim();
    }
  }
  return '';
}

/**
 * Railway MySQL expone MYSQLHOST / MYSQLUSER / etc.
 * También se aceptan DB_* y, si existe, MYSQL_URL / DATABASE_URL.
 */
function obtenerConfigDb() {
  const url = valorEnv('MYSQL_URL', 'DATABASE_URL', 'MYSQL_PUBLIC_URL');
  if (url && /^mysql(s)?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 3306,
        user: decodeURIComponent(parsed.username || 'root'),
        password: decodeURIComponent(parsed.password || ''),
        database: (parsed.pathname || '/').replace(/^\//, '') || 'railway',
      };
    } catch (error) {
      console.warn('No se pudo parsear MYSQL_URL/DATABASE_URL:', error.message);
    }
  }

  return {
    host: valorEnv('DB_HOST', 'MYSQLHOST', 'MYSQL_HOST') || '127.0.0.1',
    port: Number(valorEnv('DB_PORT', 'MYSQLPORT', 'MYSQL_PORT') || 3306),
    user: valorEnv('DB_USER', 'MYSQLUSER', 'MYSQL_USER') || 'root',
    password: valorEnv('DB_PASSWORD', 'MYSQLPASSWORD', 'MYSQL_PASSWORD'),
    database: valorEnv('DB_NAME', 'MYSQLDATABASE', 'MYSQL_DATABASE') || 'sistema_cilindros',
  };
}

const cfg = obtenerConfigDb();

const usarSsl =
  String(process.env.DB_SSL || '').toLowerCase() === 'true' ||
  String(process.env.NODE_ENV || '') === 'production';

const pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  connectTimeout: 20000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ...(usarSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function verificarConexion(intentos = 8, esperaMs = 3000) {
  console.log(
    `Conectando a MySQL: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} (ssl=${usarSsl})`
  );

  let ultimoError;
  for (let i = 1; i <= intentos; i += 1) {
    try {
      const conexion = await pool.getConnection();
      console.log('Conexión a MySQL establecida correctamente.');
      conexion.release();
      return;
    } catch (error) {
      ultimoError = error;
      console.error(`Intento ${i}/${intentos} falló: ${error.message}`);
      if (i < intentos) {
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
      }
    }
  }

  console.error('Error al conectar con MySQL:', ultimoError?.message || 'desconocido');
  console.error(
    'Revise en Railway: DB_HOST/MYSQLHOST, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL=true y que el servicio MySQL esté Running.'
  );
  process.exit(1);
}

module.exports = { pool, verificarConexion };
