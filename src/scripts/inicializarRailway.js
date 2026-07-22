/**
 * Inicializa la base remota de Railway con reintentos.
 * Uso: MYSQL_URL="mysql://..." node src/scripts/inicializarRailway.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

function parseMysqlUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'railway',
  };
}

async function conectarConReintentos(cfg, intentos = 5) {
  let ultimoError;
  for (let i = 1; i <= intentos; i += 1) {
    try {
      console.log(`Intento ${i}/${intentos}...`);
      const conexion = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false },
        connectTimeout: 60000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });
      await conexion.query('SELECT 1');
      return conexion;
    } catch (error) {
      ultimoError = error;
      console.warn(`Fallo intento ${i}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw ultimoError;
}

async function main() {
  const url = process.argv[2] || process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Defina MYSQL_URL o pase la URL como argumento.');
    process.exit(1);
  }

  const cfg = parseMysqlUrl(url);
  console.log(`Conectando a ${cfg.host}:${cfg.port} / ${cfg.database}`);

  const conexion = await conectarConReintentos(cfg);

  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema_railway.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Creando tablas...');
    await conexion.query(schema);
    console.log('Tablas creadas.');

    const [roles] = await conexion.query("SELECT id_rol FROM roles WHERE nombre = 'Administrador'");
    if (!roles.length) throw new Error('No existe rol Administrador');

    const hash = await bcrypt.hash('Admin123*', 10);
    const [existente] = await conexion.query('SELECT id_usuario FROM usuarios WHERE nombre_usuario = ?', ['admin']);
    if (existente.length) {
      await conexion.query(
        'UPDATE usuarios SET password_hash = ?, id_rol = ?, estado = 1 WHERE nombre_usuario = ?',
        [hash, roles[0].id_rol, 'admin']
      );
      console.log('Usuario admin restablecido.');
    } else {
      await conexion.query(
        `INSERT INTO usuarios (nombre_completo, nombre_usuario, correo, password_hash, id_rol)
         VALUES (?, ?, ?, ?, ?)`,
        ['Administrador del Sistema', 'admin', 'admin@grupogasguanacaste.com', hash, roles[0].id_rol]
      );
      console.log('Usuario admin creado.');
    }

    console.log('Base de datos lista en Railway.');
    console.log('Usuario: admin');
    console.log('Contraseña: Admin123*');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await conexion.end();
  }
}

main();
