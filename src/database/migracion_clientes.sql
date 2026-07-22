-- ============================================================
-- Tabla clientes (migración para bases ya existentes)
-- ============================================================
USE sistema_cilindros;

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

CREATE INDEX idx_clientes_nombre ON clientes(nombre);
CREATE INDEX idx_clientes_estado ON clientes(estado);

-- Relación opcional con ventas (se mantiene el nombre en ventas.cliente)
ALTER TABLE ventas
  ADD COLUMN id_cliente INT NULL AFTER cliente;

-- Agregar FK solo si no existe (MySQL no tiene IF NOT EXISTS para FK de forma portable)
-- Si falla porque la columna ya existe, ignore el error al re-ejecutar.
