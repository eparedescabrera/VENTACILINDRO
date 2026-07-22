/**
 * Crea la base de datos y ejecuta el schema.sql usando las variables de .env
 * Ejecutar: node src/scripts/crearBaseDatos.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function crearBaseDatos() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'sistema_cilindros';

  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  let conexion;

  try {
    conexion = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    });

    console.log('Conexión a MySQL establecida.');
    console.log(`Creando / actualizando la base de datos "${dbName}"...`);

    await conexion.query(schemaSql);

    console.log('Base de datos y tablas creadas correctamente.');
    console.log('Datos iniciales (roles, categorías, configuración) cargados.');
    console.log('Siguiente paso: npm run seed:admin');
    process.exit(0);
  } catch (error) {
    console.error('Error al crear la base de datos:', error.message);
    process.exit(1);
  } finally {
    if (conexion) await conexion.end();
  }
}

crearBaseDatos();
