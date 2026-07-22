const mysql = require('mysql2/promise');
require('dotenv').config();

const usarSsl =
  String(process.env.DB_SSL || '').toLowerCase() === 'true' ||
  String(process.env.NODE_ENV || '') === 'production';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sistema_cilindros',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  connectTimeout: 20000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ...(usarSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function verificarConexion() {
  try {
    const conexion = await pool.getConnection();
    console.log('Conexión a MySQL establecida correctamente.');
    conexion.release();
  } catch (error) {
    console.error('Error al conectar con MySQL:', error.message);
    process.exit(1);
  }
}

module.exports = { pool, verificarConexion };
