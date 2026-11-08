const { pool } = require('../config/db');

const PRODUCTOS_SEED = [
  ['cilindro', 'CIL-25', 'Cilindro de gas 25 lbs', '25 lbs', 0],
  ['cilindro', 'CIL-35', 'Cilindro de gas 35 lbs', '35 lbs', 0],
  ['cilindro', 'CIL-100', 'Cilindro de gas 100 lbs', '100 lbs', 0],
  ['cilindro', 'CIL-IND', 'Cilindro de gas Industrial', 'Industrial', 0],
  ['cilindro', 'CIL-OTR', 'Cilindro de gas Otro', 'Otro', 0],
  ['envase', 'ENV-25', 'Envase de gas 25 lbs', '25 lbs', 0],
  ['envase', 'ENV-35', 'Envase de gas 35 lbs', '35 lbs', 0],
  ['envase', 'ENV-100', 'Envase de gas 100 lbs', '100 lbs', 0],
  ['envase', 'ENV-IND', 'Envase de gas Industrial', 'Industrial', 0],
  ['envase', 'ENV-OTR', 'Envase de gas Otro', 'Otro', 0],
];

/**
 * Crea tablas de proformas/productos si no existen y carga catálogo inicial.
 * Se ejecuta al arrancar el backend (Railway/local) sin intervención manual.
 */
async function asegurarEsquemaProformas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id_producto INT AUTO_INCREMENT PRIMARY KEY,
      tipo ENUM('cilindro', 'envase') NOT NULL,
      codigo VARCHAR(50) NULL,
      descripcion VARCHAR(200) NOT NULL,
      tamano VARCHAR(50) NOT NULL,
      precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
      estado BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME NULL,
      UNIQUE KEY uk_producto_tipo_tamano (tipo, tamano),
      INDEX idx_productos_tipo_estado (tipo, estado)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS proformas (
      id_proforma INT AUTO_INCREMENT PRIMARY KEY,
      numero VARCHAR(30) NOT NULL,
      fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      id_cliente INT NULL,
      cliente_nombre VARCHAR(150) NOT NULL,
      cliente_cedula VARCHAR(50) NULL,
      cliente_telefono VARCHAR(50) NULL,
      cliente_direccion VARCHAR(300) NULL,
      lugar VARCHAR(150) NULL,
      aplica_iva BOOLEAN NOT NULL DEFAULT TRUE,
      precios_incluyen_iva BOOLEAN NOT NULL DEFAULT FALSE,
      subtotal DECIMAL(12,2) NOT NULL,
      monto_iva DECIMAL(12,2) NOT NULL DEFAULT 0,
      total DECIMAL(12,2) NOT NULL,
      observacion VARCHAR(500) NULL,
      id_usuario INT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME NULL,
      UNIQUE KEY uk_proformas_numero (numero),
      INDEX idx_proformas_fecha (fecha),
      FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS proforma_detalles (
      id_detalle INT AUTO_INCREMENT PRIMARY KEY,
      id_proforma INT NOT NULL,
      id_producto INT NOT NULL,
      tipo ENUM('cilindro', 'envase') NOT NULL,
      descripcion VARCHAR(200) NOT NULL,
      tamano VARCHAR(50) NOT NULL,
      cantidad DECIMAL(12,2) NOT NULL,
      precio_unitario DECIMAL(12,2) NOT NULL,
      subtotal_linea DECIMAL(12,2) NOT NULL,
      FOREIGN KEY (id_proforma) REFERENCES proformas(id_proforma) ON DELETE CASCADE,
      FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
    )
  `);

  for (const fila of PRODUCTOS_SEED) {
    await pool.query(
      `INSERT IGNORE INTO productos (tipo, codigo, descripcion, tamano, precio_unitario)
       VALUES (?, ?, ?, ?, ?)`,
      fila
    );
  }

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM productos');
  console.log(`Esquema proformas listo. Productos en catálogo: ${total}`);
}

module.exports = { asegurarEsquemaProformas };
