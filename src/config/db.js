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

function parseMysqlUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username || 'root'),
    password: decodeURIComponent(parsed.password || ''),
    database: (parsed.pathname || '/').replace(/^\//, '') || 'railway',
    fuente: 'url',
  };
}

function esHostPrivadoRailway(host) {
  return /railway\.internal$/i.test(host || '');
}

/**
 * Prioridad (evita DB_PASSWORD viejo cuando Railway ya inyecta MYSQL*):
 * 1) MYSQLHOST + MYSQLPASSWORD (inyectadas al vincular MySQL)
 * 2) MYSQL_URL / DATABASE_URL si el host es privado (.railway.internal)
 * 3) DB_* manual
 * 4) MYSQL_URL pública / MYSQL_PUBLIC_URL
 */
function obtenerConfigDb() {
  const mysqlHost = valorEnv('MYSQLHOST', 'MYSQL_HOST');
  const mysqlPass = valorEnv('MYSQLPASSWORD', 'MYSQL_PASSWORD');
  if (mysqlHost && mysqlPass) {
    return {
      host: mysqlHost,
      port: Number(valorEnv('MYSQLPORT', 'MYSQL_PORT') || 3306),
      user: valorEnv('MYSQLUSER', 'MYSQL_USER') || 'root',
      password: mysqlPass,
      database: valorEnv('MYSQLDATABASE', 'MYSQL_DATABASE') || 'railway',
      fuente: 'MYSQL*',
    };
  }

  const urlCandidata = valorEnv('MYSQL_URL', 'DATABASE_URL');
  if (urlCandidata && /^mysql(s)?:\/\//i.test(urlCandidata)) {
    try {
      const parsed = parseMysqlUrl(urlCandidata);
      if (esHostPrivadoRailway(parsed.host) || !valorEnv('DB_HOST')) {
        return { ...parsed, fuente: 'MYSQL_URL/DATABASE_URL' };
      }
    } catch (error) {
      console.warn('No se pudo parsear MYSQL_URL/DATABASE_URL:', error.message);
    }
  }

  const dbHost = valorEnv('DB_HOST');
  if (dbHost) {
    return {
      host: dbHost,
      port: Number(valorEnv('DB_PORT') || 3306),
      user: valorEnv('DB_USER') || 'root',
      password: valorEnv('DB_PASSWORD'),
      database: valorEnv('DB_NAME') || 'railway',
      fuente: 'DB_*',
    };
  }

  if (urlCandidata && /^mysql(s)?:\/\//i.test(urlCandidata)) {
    try {
      return { ...parseMysqlUrl(urlCandidata), fuente: 'MYSQL_URL/DATABASE_URL' };
    } catch (error) {
      console.warn('No se pudo parsear MYSQL_URL/DATABASE_URL:', error.message);
    }
  }

  const urlPublica = valorEnv('MYSQL_PUBLIC_URL');
  if (urlPublica && /^mysql(s)?:\/\//i.test(urlPublica)) {
    try {
      return { ...parseMysqlUrl(urlPublica), fuente: 'MYSQL_PUBLIC_URL' };
    } catch (error) {
      console.warn('No se pudo parsear MYSQL_PUBLIC_URL:', error.message);
    }
  }

  return {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'sistema_cilindros',
    fuente: 'default',
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

/**
 * @param {number} intentos
 * @param {number} esperaMs
 * @param {{ salir?: boolean }} opciones
 */
async function verificarConexion(intentos = 8, esperaMs = 3000, opciones = {}) {
  const salir = opciones.salir !== false;
  console.log(
    `Conectando a MySQL [${cfg.fuente}]: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} (ssl=${usarSsl}, passLen=${(cfg.password || '').length})`
  );

  let ultimoError;
  for (let i = 1; i <= intentos; i += 1) {
    try {
      const conexion = await pool.getConnection();
      console.log('Conexión a MySQL establecida correctamente.');
      conexion.release();
      return true;
    } catch (error) {
      ultimoError = error;
      console.error(`Intento ${i}/${intentos} falló: ${error.code || ''} ${error.message}`);
      if (i < intentos) {
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
      }
    }
  }

  console.error('Error al conectar con MySQL:', ultimoError?.message || 'desconocido');
  console.error(
    'Access denied = password incorrecta. En el backend BORRE DB_PASSWORD viejo y use Variable Reference a MYSQLPASSWORD del MySQL, o vincule el servicio MySQL para inyectar MYSQLHOST/MYSQLPASSWORD.'
  );

  if (salir) process.exit(1);
  return false;
}

module.exports = { pool, verificarConexion };
