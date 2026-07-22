/**
 * Migración: crea la tabla clientes y agrega id_cliente a ventas.
 * Ejecutar: npm run seed:clientes
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function migrarClientes() {
  let conexion;

  try {
    conexion = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sistema_cilindros',
      multipleStatements: true,
    });

    console.log('Conexión a MySQL establecida.');

    await conexion.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id_cliente INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        cedula VARCHAR(50),
        telefono VARCHAR(50),
        correo VARCHAR(150),
        direccion VARCHAR(300),
        lugar VARCHAR(150),
        observacion VARCHAR(300),
        estado BOOLEAN NOT NULL DEFAULT TRUE,
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME NULL
      )
    `);
    console.log('Tabla clientes creada / verificada.');

    // Índices (ignorar si ya existen)
    try {
      await conexion.query('CREATE INDEX idx_clientes_nombre ON clientes(nombre)');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
    }
    try {
      await conexion.query('CREATE INDEX idx_clientes_estado ON clientes(estado)');
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') throw e;
    }

    // Columna id_cliente en ventas
    const [columnas] = await conexion.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'id_cliente'`,
      [process.env.DB_NAME || 'sistema_cilindros']
    );

    if (columnas.length === 0) {
      await conexion.query('ALTER TABLE ventas ADD COLUMN id_cliente INT NULL AFTER cliente');
      console.log('Columna id_cliente agregada a ventas.');
    } else {
      console.log('La columna id_cliente ya existe en ventas.');
    }

    // FK opcional
    try {
      await conexion.query(
        `ALTER TABLE ventas
         ADD CONSTRAINT fk_ventas_cliente
         FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
         ON DELETE SET NULL ON UPDATE CASCADE`
      );
      console.log('Llave foránea ventas.id_cliente creada.');
    } catch (e) {
      if (e.code === 'ER_DUP_KEY' || e.code === 'ER_FK_DUP_NAME' || e.errno === 1826 || e.message.includes('Duplicate')) {
        console.log('La llave foránea ya existe.');
      } else {
        console.warn('No se pudo crear la FK (no crítico):', e.message);
      }
    }

    console.log('Migración de clientes completada.');
    process.exit(0);
  } catch (error) {
    console.error('Error en la migración de clientes:', error.message);
    process.exit(1);
  } finally {
    if (conexion) await conexion.end();
  }
}

migrarClientes();
