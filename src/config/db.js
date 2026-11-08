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
 * Prioridad:
 * 1) MYSQLHOST + MYSQLPASSWORD (Railway al vincular servicios)
 * 2) MYSQL_URL privada
 * 3) DB_*
 * 4) URLs públicas
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

// En red privada de Railway el SSL a veces rompe el handshake; se puede forzar con DB_SSL=true.
const forzarSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const forzarSinSsl = String(process.env.DB_SSL || '').toLowerCase() === 'false';
const usarSsl = forzarSinSsl
  ? false
  : forzarSsl
    ? true
    : !esHostPrivadoRailway(cfg.host) && String(process.env.NODE_ENV || '') === 'production';

function crearPool(conSsl) {
  return mysql.createPool({
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
    ...(conSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

const estado = {
  pool: crearPool(usarSsl),
  sslActivo: usarSsl,
};

function infoMysqlDebug() {
  return {
    fuente: cfg.fuente,
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    database: cfg.database,
    ssl: estado.sslActivo,
    passLen: (cfg.password || '').length,
    vars: {
      MYSQLHOST: Boolean(valorEnv('MYSQLHOST', 'MYSQL_HOST')),
      MYSQLPASSWORD: Boolean(valorEnv('MYSQLPASSWORD', 'MYSQL_PASSWORD')),
      MYSQL_URL: Boolean(valorEnv('MYSQL_URL')),
      DATABASE_URL: Boolean(valorEnv('DATABASE_URL')),
      DB_HOST: Boolean(valorEnv('DB_HOST')),
      DB_PASSWORD: Boolean(valorEnv('DB_PASSWORD')),
      MYSQL_PUBLIC_URL: Boolean(valorEnv('MYSQL_PUBLIC_URL')),
    },
  };
}

async function probarPool(poolProbar) {
  const conexion = await poolProbar.getConnection();
  await conexion.query('SELECT 1');
  conexion.release();
}

/**
 * @param {number} intentos
 * @param {number} esperaMs
 * @param {{ salir?: boolean }} opciones
 */
async function verificarConexion(intentos = 8, esperaMs = 3000, opciones = {}) {
  const salir = opciones.salir !== false;
  console.log(
    `Conectando a MySQL [${cfg.fuente}]: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} (ssl=${estado.sslActivo}, passLen=${(cfg.password || '').length})`
  );
  console.log('MySQL env flags:', JSON.stringify(infoMysqlDebug().vars));

  let ultimoError;
  for (let i = 1; i <= intentos; i += 1) {
    try {
      await probarPool(estado.pool);
      console.log('Conexión a MySQL establecida correctamente.');
      return true;
    } catch (error) {
      ultimoError = error;
      console.error(`Intento ${i}/${intentos} falló: ${error.code || ''} ${error.message}`);

      if (i === 1 && esHostPrivadoRailway(cfg.host) && estado.sslActivo) {
        console.warn('Reintentando MySQL sin SSL (red privada Railway)...');
        try {
          const poolSinSsl = crearPool(false);
          await probarPool(poolSinSsl);
          estado.pool = poolSinSsl;
          estado.sslActivo = false;
          console.log('Conexión a MySQL establecida correctamente (sin SSL).');
          return true;
        } catch (errorSsl) {
          console.error('También falló sin SSL:', errorSsl.message);
          ultimoError = errorSsl;
        }
      }

      if (i < intentos) {
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
      }
    }
  }

  console.error('Error al conectar con MySQL:', ultimoError?.message || 'desconocido');
  console.error(
    'Access denied = clave incorrecta. En backend ELIMINE DB_PASSWORD y DATABASE_URL viejos. Vincule el servicio MySQL (Variables → Reference → MYSQLPASSWORD).'
  );

  if (salir) process.exit(1);
  return false;
}

module.exports = {
  get pool() {
    return estado.pool;
  },
  verificarConexion,
  infoMysqlDebug,
};
