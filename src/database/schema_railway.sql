-- ============================================================
-- Schema para Railway (sin CREATE DATABASE; la BD ya existe)
-- Pegue este archivo completo en Railway → MySQL → Query / Data
-- o ejecútelo desde la consola del servicio MySQL.
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    estado BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    nombre_usuario VARCHAR(80) NOT NULL UNIQUE,
    correo VARCHAR(150),
    password_hash VARCHAR(255) NOT NULL,
    id_rol INT NOT NULL,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

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
);

CREATE TABLE IF NOT EXISTS ventas (
    id_venta INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cliente VARCHAR(150) NOT NULL,
    id_cliente INT NULL,
    lugar VARCHAR(150),
    tipo_cilindro VARCHAR(100) NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    metodo_pago ENUM('Efectivo','SINPE','Credito','Transferencia') NOT NULL,
    estado_pago ENUM('Pagado','Pendiente','Anulado') NOT NULL DEFAULT 'Pagado',
    numero_referencia VARCHAR(100),
    comprobante_url VARCHAR(500) NULL,
    comprobante_public_id VARCHAR(255) NULL,
    observacion VARCHAR(300),
    id_usuario INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS categorias_gastos (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    estado BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS gastos (
    id_gasto INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_categoria INT NOT NULL,
    descripcion VARCHAR(300) NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    metodo_pago ENUM('Efectivo','SINPE','Transferencia','Tarjeta') NOT NULL,
    numero_comprobante VARCHAR(100),
    comprobante_url VARCHAR(500) NULL,
    comprobante_public_id VARCHAR(255) NULL,
    observacion VARCHAR(300),
    id_usuario INT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    FOREIGN KEY (id_categoria) REFERENCES categorias_gastos(id_categoria),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS configuracion_empresa (
    id_configuracion INT AUTO_INCREMENT PRIMARY KEY,
    nombre_empresa VARCHAR(150) NOT NULL,
    cedula_juridica VARCHAR(50),
    telefono VARCHAR(50),
    correo VARCHAR(150),
    direccion VARCHAR(300),
    logo_url VARCHAR(500),
    logo_public_id VARCHAR(255),
    mensaje_reporte VARCHAR(300),
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO roles (id_rol, nombre, descripcion) VALUES
  (1, 'Administrador', 'Acceso total al sistema'),
  (2, 'Vendedor', 'Registro de ventas y gastos propios');

INSERT IGNORE INTO categorias_gastos (nombre, descripcion) VALUES
  ('Combustible', 'Compra de combustible para vehículos de reparto'),
  ('Alimentación', 'Alimentación de personal'),
  ('Mantenimiento', 'Mantenimiento de vehículos y equipo'),
  ('Reparación', 'Reparaciones varias'),
  ('Compra de cilindros', 'Compra de cilindros de gas'),
  ('Transporte', 'Gastos de transporte'),
  ('Salarios', 'Pago de salarios'),
  ('Servicios', 'Servicios públicos y otros'),
  ('Otros', 'Gastos varios no clasificados');

INSERT INTO configuracion_empresa (nombre_empresa, cedula_juridica, telefono, correo, direccion, mensaje_reporte)
SELECT 'GRUPO GAS GUANACASTE SRL', '0-000-000000', '0000-0000', 'contacto@grupogasguanacaste.com', 'Guanacaste, Costa Rica', 'Gracias por su confianza. GRUPO GAS GUANACASTE SRL'
WHERE NOT EXISTS (SELECT 1 FROM configuracion_empresa LIMIT 1);

-- Nota: tablas de proformas/productos están en migracion_proformas.sql (npm run seed:proformas)
